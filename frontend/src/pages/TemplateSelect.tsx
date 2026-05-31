import { useCallback, useState } from "react";
import { motion } from "motion/react";

import { requestPdf, setResumeTemplate, type TemplateId } from "../api";
import { AppHeader } from "../components/ui/AppHeader";
import { Button } from "../components/ui/Button";
import { FixedBottomBar } from "../components/ui/FixedBottomBar";
import { Screen } from "../components/ui/Screen";
import { useFounderStatus } from "../hooks/useFounderStatus";
import { useTelegramBackButton } from "../hooks/useTelegramBackButton";
import { useAppStore } from "../store";
import { getTg } from "../telegram";

const TEMPLATES: Array<{
  id: TemplateId;
  name: string;
  description: string;
}> = [
  { id: "classic", name: "Classic", description: "Тёмный акцент, две колонки" },
  { id: "modern", name: "Modern", description: "Минимализм, одна колонка" },
  { id: "compact", name: "Compact", description: "Светлый, максимум контента" },
];

function templatePreviewUrl(id: TemplateId): string {
  return `${import.meta.env.BASE_URL}templates/${id}.png`;
}

export function TemplateSelectPage() {
  const { authToken, resumeId, selectedTemplate, setSelectedTemplate, setPage, setPaid } =
    useAppStore();
  const founderActive = useFounderStatus();
  const [saving, setSaving] = useState(false);

  const handleBack = useCallback(() => setPage("preview"), [setPage]);
  useTelegramBackButton(handleBack);

  if (!authToken || !resumeId) return null;

  const continueFlow = async () => {
    getTg()?.HapticFeedback?.impactOccurred("medium");
    setSaving(true);
    try {
      await setResumeTemplate(authToken, resumeId, selectedTemplate);
      if (founderActive) {
        await requestPdf(authToken, resumeId);
        setPaid(true);
        getTg()?.HapticFeedback?.notificationOccurred("success");
        setPage("success");
      } else {
        setPage("payment");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось сохранить шаблон";
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen withBottomBar>
      <AppHeader onBack={handleBack} showBack title="Выбор шаблона" />
      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3">
        <p className="text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Выбери оформление PDF — все шаблоны оптимизированы под hh.ru
        </p>
        <div className="flex flex-col gap-4">
          {TEMPLATES.map((tmpl, index) => {
            const selected = selectedTemplate === tmpl.id;
            return (
              <motion.button
                key={tmpl.id}
                type="button"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
                onClick={() => {
                  setSelectedTemplate(tmpl.id);
                  getTg()?.HapticFeedback?.selectionChanged();
                }}
                className="overflow-hidden rounded-xl text-left transition-shadow"
                style={{
                  border: selected ? "2px solid var(--brand)" : "1px solid var(--border-subtle)",
                  background: "var(--surface-card)",
                  boxShadow: selected ? "0 0 0 1px var(--brand-muted)" : undefined,
                }}
              >
                <img
                  src={templatePreviewUrl(tmpl.id)}
                  alt={`Превью шаблона ${tmpl.name}`}
                  className="w-full object-cover object-top"
                  style={{ maxHeight: "220px" }}
                />
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold">{tmpl.name}</h3>
                    {selected ? (
                      <span className="text-xs font-semibold" style={{ color: "var(--brand)" }}>
                        ✓ Выбран
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
                    {tmpl.description}
                  </p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </main>

      <FixedBottomBar>
        <Button variant="brand" onClick={continueFlow} disabled={saving}>
          {saving ? "Сохраняем…" : "Выбрать и перейти к оплате"}
        </Button>
      </FixedBottomBar>
    </Screen>
  );
}
