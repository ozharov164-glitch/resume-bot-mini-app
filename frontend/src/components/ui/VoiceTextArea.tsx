import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ensureAuthToken } from "../../api";
import { useAppStore } from "../../store";
import { getTg } from "../../telegram";
import { Button } from "./Button";
import { TextArea } from "./TextField";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface VoiceTextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  rows?: number;
  fieldId: string;
}

export function VoiceTextArea({
  value,
  onChange,
  placeholder,
  hint,
  rows = 5,
  fieldId,
}: VoiceTextAreaProps) {
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>();
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const targetPosition = useAppStore((s) => s.answers.target_position ?? "");

  const micAvailable = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return Boolean(navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined");
  }, []);

  const uploadAudio = useCallback(
    async (blob: Blob, mimeType: string) => {
      setTranscribing(true);
      try {
        const token = await ensureAuthToken();
        const ext = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
        const form = new FormData();
        form.append("file", blob, `recording.${ext}`);

        const res = await fetch(`${API_URL}/api/voice/transcribe`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
        if (!res.ok) throw new Error("transcribe failed");
        const data = (await res.json()) as { text?: string };
        if (data.text) {
          const next = value.trim() ? `${value.trim()} ${data.text}` : data.text;
          onChange(next);
          getTg()?.HapticFeedback?.notificationOccurred("success");
        }
      } catch {
        getTg()?.HapticFeedback?.notificationOccurred("error");
        alert("Не удалось распознать речь. Проверь микрофон и попробуй ещё раз.");
      } finally {
        setTranscribing(false);
      }
    },
    [onChange, value],
  );

  const startWaveform = useCallback((stream: MediaStream) => {
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;

    const data = new Uint8Array(analyser.frequencyBinCount);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      analyser.getByteFrequencyData(data);
      const c = canvas.getContext("2d");
      if (!c) return;
      c.clearRect(0, 0, canvas.width, canvas.height);
      const barCount = 28;
      const barW = 3;
      const gap = 3;
      const step = Math.floor(data.length / barCount);
      for (let i = 0; i < barCount; i++) {
        const amp = data[i * step] / 255;
        const h = Math.max(3, amp * canvas.height * 0.85);
        const x = i * (barW + gap);
        const y = (canvas.height - h) / 2;
        c.fillStyle = "#2de08a";
        c.beginPath();
        if (c.roundRect) {
          c.roundRect(x, y, barW, h, 1.5);
        } else {
          c.rect(x, y, barW, h);
        }
        c.fill();
      }
      animFrameRef.current = requestAnimationFrame(draw);
    };
    draw();
  }, []);

  const stopWaveform = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setListening(false);
    stopWaveform();
    clearInterval(timerRef.current);
  }, [stopWaveform]);

  const handleDictate = useCallback(async () => {
    if (transcribing) return;

    if (listening) {
      stopRecording();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        stopWaveform();
        clearInterval(timerRef.current);
        setRecordSeconds(0);
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || mimeType || "audio/webm",
        });
        if (blob.size > 0) {
          await uploadAudio(blob, blob.type);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setListening(true);
      getTg()?.HapticFeedback?.impactOccurred("medium");
      startWaveform(stream);
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      getTg()?.HapticFeedback?.notificationOccurred("error");
      alert("Нет доступа к микрофону. Разреши запись в настройках Telegram/браузера.");
    }
  }, [listening, startWaveform, stopRecording, stopWaveform, transcribing, uploadAudio]);

  const handlePolish = useCallback(async () => {
    if (polishing || value.length <= 20) return;
    setPolishing(true);
    try {
      const token = await ensureAuthToken();
      const res = await fetch(`${API_URL}/api/voice/polish`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: value, position: targetPosition }),
      });
      if (!res.ok) throw new Error("polish failed");
      const data = (await res.json()) as { polished?: string };
      if (data.polished) {
        onChange(data.polished);
        getTg()?.HapticFeedback?.notificationOccurred("success");
      } else {
        getTg()?.HapticFeedback?.notificationOccurred("warning");
      }
    } catch {
      getTg()?.HapticFeedback?.notificationOccurred("error");
      alert("Не удалось улучшить текст. Попробуй ещё раз через пару секунд.");
    } finally {
      setPolishing(false);
    }
  }, [onChange, polishing, targetPosition, value]);

  useEffect(() => {
    return () => {
      stopWaveform();
      clearInterval(timerRef.current);
    };
  }, [stopWaveform]);

  const dictateLabel = transcribing
    ? "Распознаю…"
    : listening
      ? "⏹ Стоп"
      : "🎤 Надиктовать";

  return (
    <div className="flex flex-col gap-2">
      <TextArea
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
      {hint && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {hint}
        </p>
      )}

      {listening && (
        <div className="voice-recording-panel">
          <span className="voice-rec-dot" />
          <canvas
            ref={canvasRef}
            width={168}
            height={32}
            className="voice-waveform-canvas"
          />
          <span className="voice-timer">
            {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, "0")}
          </span>
        </div>
      )}

      {transcribing && (
        <div className="voice-transcribing-panel">
          <span className="voice-spinner" />
          <span className="voice-transcribing-label">Распознаю речь…</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {micAvailable && (
          <Button
            variant="secondary"
            onClick={handleDictate}
            disabled={listening ? false : transcribing}
            className="!min-h-[44px] flex-1"
          >
            {dictateLabel}
          </Button>
        )}
        {value.length > 20 && (
          <Button
            variant="secondary"
            onClick={handlePolish}
            disabled={polishing || transcribing || listening}
            className="!min-h-[44px] flex-1"
          >
            {polishing ? "Улучшаю…" : "✨ Улучшить текст"}
          </Button>
        )}
      </div>
    </div>
  );
}
