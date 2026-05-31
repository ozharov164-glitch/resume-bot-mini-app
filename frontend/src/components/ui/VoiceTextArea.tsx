import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ensureAuthToken } from "../../api";
import { useAppStore } from "../../store";
import { getTg } from "../../telegram";
import { Button } from "./Button";
import { TextArea } from "./TextField";
import {
  VoiceRecordingBar,
  VoiceTranscribingBar,
  useVoiceWaveform,
} from "./VoiceRecordingBar";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface VoiceTextAreaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  rows?: number;
  fieldId: string;
  fieldType?: "experience" | "about" | "certificates" | "last_job" | "duties";
  /** Контекст места работы — передаётся в polish, чтобы ИИ не выдумывал стаж */
  workPeriod?: string;
  workCompany?: string;
  workPosition?: string;
}

export function VoiceTextArea({
  value,
  onChange,
  placeholder,
  hint,
  rows = 5,
  fieldId,
  fieldType = "experience",
  workPeriod = "",
  workCompany = "",
  workPosition = "",
}: VoiceTextAreaProps) {
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetPosition = useAppStore((s) => s.answers.target_position ?? "");

  const { start: startWaveform, stop: stopWaveform } = useVoiceWaveform(canvasRef);

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
        alert("Не удалось распознать речь. Проверьте микрофон и попробуйте ещё раз.");
      } finally {
        setTranscribing(false);
      }
    },
    [onChange, value],
  );

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setListening(false);
    stopWaveform();
    getTg()?.HapticFeedback?.impactOccurred("light");
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
        body: JSON.stringify({
          text: value,
          position: workPosition || targetPosition,
          period: workPeriod,
          company: workCompany,
          job_position: workPosition,
          field_type: fieldType,
        }),
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
      alert("Не удалось улучшить текст. Попробуйте ещё раз через пару секунд.");
    } finally {
      setPolishing(false);
    }
  }, [fieldType, onChange, polishing, targetPosition, value, workCompany, workPeriod, workPosition]);

  useEffect(() => () => stopWaveform(), [stopWaveform]);

  const showMicButton = micAvailable && !listening && !transcribing;

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

      <VoiceRecordingBar visible={listening} canvasRef={canvasRef} onStop={stopRecording} />

      <VoiceTranscribingBar visible={transcribing} />

      <div className="flex flex-wrap gap-2">
        {showMicButton && (
          <button
            type="button"
            onClick={handleDictate}
            disabled={transcribing}
            className="voice-mic-trigger"
            aria-label="Надиктовать"
          >
            <span className="voice-mic-trigger__glow" aria-hidden />
            <span className="voice-mic-trigger__icon" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z"
                  fill="currentColor"
                />
                <path
                  d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V21H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-3.08A7 7 0 0 0 19 11Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <span className="voice-mic-trigger__label">Надиктовать</span>
          </button>
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
