import { useCallback, useMemo, useState } from "react";

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
  const [polishing, setPolishing] = useState(false);
  const targetPosition = useAppStore((s) => s.answers.target_position ?? "");

  const speechAvailable = useMemo(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.SpeechRecognition || (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition);
  }, []);

  const handleDictate = useCallback(() => {
    const SR =
      window.SpeechRecognition ||
      (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = "ru-RU";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0]?.transcript ?? "")
        .join("");
      onChange(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.start();
    setListening(true);
    getTg()?.HapticFeedback?.impactOccurred("medium");
  }, [onChange]);

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
        {speechAvailable && (
          <Button
            variant="secondary"
            onClick={handleDictate}
            disabled={listening}
            className="!min-h-[44px] flex-1"
          >
            {listening ? "Слушаю…" : "🎤 Надиктовать"}
          </Button>
        )}
        {value.length > 20 && (
          <Button
            variant="secondary"
            onClick={handlePolish}
            disabled={polishing}
            className="!min-h-[44px] flex-1"
          >
            {polishing ? "Улучшаю…" : "✨ Улучшить текст"}
          </Button>
        )}
      </div>
    </div>
  );
}
