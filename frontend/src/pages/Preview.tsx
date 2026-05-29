import { useState } from "react";

import { requestPdf } from "../api";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { Screen } from "../components/ui/Screen";
import { useAppStore } from "../store";
import { tg } from "../telegram";

export function PreviewPage() {
  const { resumeData, resumeId, authToken, isFounder, setPage, setPaid } = useAppStore();
  const [sending, setSending] = useState(false);

  if (!resumeData) return null;

  const handlePdf = async () => {
    tg?.HapticFeedback?.impactOccurred("light");

    if (isFounder && authToken && resumeId) {
      setSending(true);
      try {
        await requestPdf(authToken, resumeId);
        setPaid(true);
        tg?.HapticFeedback?.notificationOccurred("success");
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
    <Screen className="gap-6">
      <PageHeader
        eyebrow={isFounder ? "Режим основателя" : "Бесплатный просмотр"}
        title={
          <>
            Готово! <span aria-hidden>🎉</span>
          </>
        }
        subtitle={
          isFounder
            ? "Безлимит: PDF сразу в чат с ботом, без оплаты"
            : "Проверь текст — PDF отправим в Telegram после оплаты"
        }
      />

      <Card variant="resume" className="flex flex-col gap-4">
        <div>
          <div className="text-xl font-extrabold leading-tight">{resumeData.full_name}</div>
          <div className="text-base font-semibold mt-1" style={{ color: "var(--accent)" }}>
            {resumeData.target_position}
          </div>
        </div>

        <div>
          <div className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-muted)" }}>
            О себе
          </div>
          <p className="text-sm leading-relaxed">{resumeData.summary}</p>
        </div>

        {resumeData.skills && resumeData.skills.length > 0 && (
          <div>
            <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>
              Навыки
            </div>
            <div className="flex flex-wrap gap-2">
              {resumeData.skills.map((skill) => (
                <span key={skill} className="skill-chip">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Button variant="accent" className="mt-auto" onClick={handlePdf} disabled={sending}>
        {sending ? "Отправляем PDF…" : "Получить PDF в Telegram"}
      </Button>
    </Screen>
  );
}
