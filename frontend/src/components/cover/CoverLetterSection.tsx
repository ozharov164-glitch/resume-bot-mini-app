import { useCallback, useEffect, useState } from "react";

import { ensureAuthToken, generateCoverLetter, getResume } from "../../api";
import { trackEvent } from "../../lib/analytics";
import { getTg } from "../../telegram";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";

interface CoverLetterSectionProps {
  resumeId: string;
  authToken: string | null;
  initialVacancyText?: string;
  compact?: boolean;
}

export function CoverLetterSection({
  resumeId,
  authToken,
  initialVacancyText = "",
  compact = false,
}: CoverLetterSectionProps) {
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [vacancy, setVacancy] = useState(initialVacancyText);

  useEffect(() => {
    if (initialVacancyText && !vacancy) {
      setVacancy(initialVacancyText);
    }
  }, [initialVacancyText, vacancy]);

  useEffect(() => {
    if (!resumeId || !authToken) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = authToken || (await ensureAuthToken());
        const record = await getResume(token, resumeId);
        if (!cancelled && record.cover_letter?.trim()) {
          setCoverLetter(record.cover_letter.trim());
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resumeId, authToken]);

  const handleGenerate = useCallback(async () => {
    if (!resumeId || loading) return;
    setLoading(true);
    trackEvent("cover_letter_generate", { source: compact ? "preview" : "success" });
    try {
      const token = authToken || (await ensureAuthToken());
      const { cover_letter: text } = await generateCoverLetter(token, resumeId, vacancy.trim());
      setCoverLetter(text);
      getTg()?.HapticFeedback?.notificationOccurred("success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось создать письмо. Попробуйте позже.";
      alert(message);
    } finally {
      setLoading(false);
    }
  }, [authToken, compact, loading, resumeId, vacancy]);

  const copyCoverLetter = useCallback(async () => {
    if (!coverLetter) return;
    try {
      await navigator.clipboard.writeText(coverLetter);
      getTg()?.HapticFeedback?.notificationOccurred("success");
    } catch {
      alert("Не удалось скопировать");
    }
  }, [coverLetter]);

  return (
    <section
      id="cover-letter-section"
      className={`cover-letter-section${compact ? " cover-letter-section--compact" : ""}`}
      aria-labelledby="cover-letter-heading"
    >
      <div className="cover-letter-section__head">
        <h3 id="cover-letter-heading" className="cover-letter-section__title">
          <Icon name="mail" size={18} style={{ color: "var(--brand)" }} />
          Сопроводительное письмо
        </h3>
        <p className="cover-letter-section__text">
          {coverLetter
            ? "Письмо сохранено — можно скопировать или создать новое под другую вакансию."
            : "Сгенерируем из фактов резюме. Вставьте текст вакансии — письмо будет точнее."}
        </p>
      </div>

      <textarea
        value={vacancy}
        onChange={(e) => setVacancy(e.target.value)}
        placeholder="Текст вакансии (необязательно)…"
        rows={compact ? 3 : 4}
        className="cover-letter-section__textarea"
        aria-label="Текст вакансии для сопроводительного письма"
      />

      {coverLetter ? (
        <textarea
          readOnly
          value={coverLetter}
          rows={compact ? 5 : 6}
          className="cover-letter-section__textarea cover-letter-section__textarea--readonly"
          aria-label="Сопроводительное письмо"
        />
      ) : null}

      <div className="cover-letter-section__actions">
        {coverLetter ? (
          <Button variant="outline" onClick={() => void copyCoverLetter()} className="w-full">
            <Icon name="content_copy" size={18} />
            Скопировать письмо
          </Button>
        ) : null}
        <Button
          variant="brand"
          onClick={() => void handleGenerate()}
          disabled={loading}
          className="w-full"
        >
          {loading
            ? "Генерирую письмо…"
            : coverLetter
              ? "Создать письмо заново"
              : "Создать сопроводительное письмо"}
        </Button>
      </div>
    </section>
  );
}
