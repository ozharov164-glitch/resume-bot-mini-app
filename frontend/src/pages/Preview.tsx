import { useCallback, useState } from "react";

import { requestPdf } from "../api";
import { AppHeader } from "../components/ui/AppHeader";
import { Button } from "../components/ui/Button";
import { FixedBottomBar } from "../components/ui/FixedBottomBar";
import { FounderBadge } from "../components/ui/FounderBadge";
import { Icon } from "../components/ui/Icon";
import { Screen } from "../components/ui/Screen";
import { useFounderStatus } from "../hooks/useFounderStatus";
import { useTelegramBackButton } from "../hooks/useTelegramBackButton";
import { useAppStore } from "../store";
import { getTg } from "../telegram";

export function PreviewPage() {
  const { resumeData, resumeId, authToken, setPage, setPaid, startEditResume, previewReturnPage } =
    useAppStore();
  const founderActive = useFounderStatus();
  const [sending, setSending] = useState(false);

  const handleBack = useCallback(() => setPage(previewReturnPage), [setPage, previewReturnPage]);
  useTelegramBackButton(handleBack);

  if (!resumeData) return null;

  const handlePdf = async () => {
    getTg()?.HapticFeedback?.impactOccurred("medium");

    if (founderActive && authToken && resumeId) {
      setSending(true);
      try {
        await requestPdf(authToken, resumeId);
        setPaid(true);
        getTg()?.HapticFeedback?.notificationOccurred("success");
        setPage("success");
      } catch {
        alert("Не удалось отправить PDF. Попробуй ещё раз.");
      } finally {
        setSending(false);
      }
      return;
    }

    setPage("payment");
  };

  const contactLine = [resumeData.city, resumeData.phone].filter(Boolean).join(" · ");

  return (
    <Screen withBottomBar>
      <AppHeader onBack={handleBack} showBack title="Предпросмотр" />
      <main className="flex flex-1 flex-col gap-4 px-4 py-4">
        <div
          className="rounded-xl px-4 py-3 text-center text-sm leading-relaxed"
          style={{
            background: "var(--preview-banner-bg)",
            color: "var(--preview-banner-text)",
          }}
        >
          Бесплатный предпросмотр. Чтобы изменить данные — нажми «Изменить ответы».
        </div>

        <section
          className="no-copy preview-protected relative overflow-hidden rounded-xl border p-4"
          style={{ background: "#ffffff", borderColor: "var(--border-subtle)", boxShadow: "var(--card-shadow)" }}
          onCopy={(e) => e.preventDefault()}
        >
          <div className="mb-4 border-b pb-4" style={{ borderColor: "var(--border-subtle)" }}>
            <h3 className="text-xl font-bold">{resumeData.full_name}</h3>
            <p className="mt-1 text-sm font-semibold" style={{ color: "var(--brand)" }}>
              {resumeData.target_position}
            </p>
            {contactLine && (
              <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                {contactLine}
              </p>
            )}
          </div>

          <div className="mb-4">
            <h4
              className="mb-2 text-xs font-bold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}
            >
              Обо мне
            </h4>
            <p className="text-sm leading-relaxed">{resumeData.summary}</p>
          </div>

          {resumeData.experience?.length > 0 && (
            <div className="mb-4">
              <h4
                className="mb-2 text-xs font-bold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Опыт работы
              </h4>
              <ul className="space-y-2 text-sm leading-relaxed" style={{ color: "var(--text-variant)" }}>
                {resumeData.experience.slice(0, 3).map((job, i) => (
                  <li key={`${job.company}-${i}`}>
                    <span className="font-semibold">{job.company}</span>
                    {job.period ? ` · ${job.period}` : ""}
                    {job.description ? ` — ${job.description}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resumeData.skills?.length > 0 && (
            <div>
              <h4
                className="mb-2 text-xs font-bold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Навыки
              </h4>
              <div className="flex flex-wrap gap-2">
                {resumeData.skills.map((skill) => (
                  <span key={skill} className="skill-chip">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {founderActive && <FounderBadge />}
      </main>

      <FixedBottomBar>
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              getTg()?.HapticFeedback?.impactOccurred("light");
              startEditResume();
            }}
            className="!min-h-[44px] flex items-center justify-center gap-2"
          >
            <Icon name="edit" size={18} />
            Изменить ответы
          </Button>
          <Button
            variant="brand"
            onClick={handlePdf}
            disabled={sending}
            className="flex items-center justify-center gap-2"
          >
            <Icon name="picture_as_pdf" size={20} />
            {sending ? "Отправляем PDF…" : "Получить PDF в Telegram"}
          </Button>
        </div>
      </FixedBottomBar>
    </Screen>
  );
}
