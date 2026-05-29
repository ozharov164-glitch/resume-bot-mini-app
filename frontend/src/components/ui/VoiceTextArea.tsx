import { useCallback, useMemo, useRef, useState } from "react";

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

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setListening(false);
  }, []);

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
    } catch {
      getTg()?.HapticFeedback?.notificationOccurred("error");
      alert("Нет доступа к микрофону. Разреши запись в настройках Telegram/браузера.");
    }
  }, [listening, stopRecording, transcribing, uploadAudio]);

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
      if (data.polished) onChange(data.polished);
      getTg()?.HapticFeedback?.notificationOccurred("success");
    } catch {
      getTg()?.HapticFeedback?.notificationOccurred("error");
    } finally {
      setPolishing(false);
    }
  }, [onChange, polishing, targetPosition, value]);

  const dictateLabel = transcribing
    ? "Расшифровываю…"
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
            disabled={polishing || transcribing}
            className="!min-h-[44px] flex-1"
          >
            {polishing ? "Улучшаю…" : "✨ Улучшить текст"}
          </Button>
        )}
      </div>
    </div>
  );
}
