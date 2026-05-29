import { useState } from "react";

import { requestPdf } from "../api";
import { AppHeader } from "../components/ui/AppHeader";
import { Button } from "../components/ui/Button";
import { FixedBottomBar } from "../components/ui/FixedBottomBar";
import { FounderBadge } from "../components/ui/FounderBadge";
import { Icon } from "../components/ui/Icon";
import { Screen } from "../components/ui/Screen";
import { useFounderStatus } from "../hooks/useFounderStatus";
import { useAppStore } from "../store";
import { getTg } from "../telegram";

export function PreviewPage() {
  const { resumeData, resumeId, authToken, setPage, setPaid } = useAppStore();
  const founderActive = useFounderStatus();
  const [sending, setSending] = useState(false);

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

  return (
    <Screen withBottomBar>
      <AppHeader onBack={() => setPage("onboarding")} showBack />
      <main className="flex flex-1 flex-col gap-6 px-4 py-4">
        <section className="flex flex-col items-center gap-3 text-center">
          <div
            className="mb-1 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: "var(--brand-muted)" }}
          >
            <Icon name="check_circle" filled className="text-primary-container" size={36} />
          </div>
          <h2 className="text-2xl font-bold">Готово к скачиванию</h2>
          <p className="max-w-[280px] text-base" style={{ color: "var(--text-muted)" }}>
            Твое резюме успешно создано. Проверь данные перед получением PDF.
          </p>
        </section>

        <section className="relative mt-2">
          <div
            className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider shadow-sm"
            style={{
              background: "#fc7c78",
              color: "#711419",
              borderColor: "rgba(164,58,58,0.2)",
            }}
          >
            Бесплатный предпросмотр
          </div>

          <div
            className="relative overflow-hidden rounded-xl border p-4 shadow-card"
            style={{ background: "#ffffff", borderColor: "var(--border-subtle)" }}
          >
            <div
              className="pointer-events-none absolute inset-0 flex select-none items-center justify-center opacity-[0.03]"
              aria-hidden
            >
              <div className="-rotate-45 text-7xl font-bold whitespace-nowrap">ПРЕДПРОСМОТР</div>
            </div>

            <div
              className="mb-4 flex items-center gap-4 border-b pb-4"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <div
                className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border"
                style={{ background: "var(--surface-elevated)", borderColor: "var(--border-subtle)" }}
              >
                <Icon name="person" size={32} style={{ color: "var(--text-muted)" }} />
              </div>
              <div>
                <h3 className="text-lg font-bold">{resumeData.full_name}</h3>
                <p className="mt-1 text-sm font-semibold" style={{ color: "var(--brand)" }}>
                  {resumeData.target_position}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <h4
                className="mb-2 text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Обо мне
              </h4>
              <p className="text-sm leading-relaxed">{resumeData.summary}</p>
            </div>

            {resumeData.experience?.length > 0 && (
              <div className="mb-4">
                <h4
                  className="mb-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  Опыт работы
                </h4>
                <div
                  className="space-y-4 border-l-2 pl-6"
                  style={{ borderColor: "var(--surface-container-high, #e3eae3)" }}
                >
                  {resumeData.experience.slice(0, 2).map((job, i) => (
                    <div key={`${job.company}-${i}`} className="relative">
                      <div
                        className="absolute -left-[29px] top-1 h-3 w-3 rounded-full border-2"
                        style={{
                          background: i === 0 ? "var(--brand)" : "var(--surface-variant, #dde4dd)",
                          borderColor: "#ffffff",
                        }}
                      />
                      <div className="text-sm font-semibold">{job.company}</div>
                      <div className="mb-1 text-xs" style={{ color: "var(--text-muted)" }}>
                        {job.period}
                      </div>
                      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                        {job.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {resumeData.skills?.length > 0 && (
              <div>
                <h4
                  className="mb-2 text-xs font-semibold uppercase tracking-wider"
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
          </div>
        </section>

        {founderActive && <FounderBadge />}
      </main>

      <FixedBottomBar>
        <Button variant="brand" onClick={handlePdf} disabled={sending} className="flex items-center justify-center gap-2">
          <Icon name="picture_as_pdf" size={20} />
          {sending ? "Отправляем PDF…" : "Получить PDF в Telegram"}
        </Button>
      </FixedBottomBar>
    </Screen>
  );
}
