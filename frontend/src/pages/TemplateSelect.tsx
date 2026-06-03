import { useCallback, useState, type CSSProperties } from "react";
import { motion } from "motion/react";

import { requestPdf, setResumeTemplate } from "../api";
import { AppHeader } from "../components/ui/AppHeader";
import { Button } from "../components/ui/Button";
import { FixedBottomBar } from "../components/ui/FixedBottomBar";
import { Icon } from "../components/ui/Icon";
import { Screen } from "../components/ui/Screen";
import { useFounderStatus } from "../hooks/useFounderStatus";
import { useTelegramBackButton } from "../hooks/useTelegramBackButton";
import { PDF_TEMPLATES, templatePreviewUrl } from "../lib/templates";
import { useAppStore } from "../store";
import { getTg } from "../telegram";

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
      <AppHeader onBack={handleBack} showBack title="Подтвердите шаблон" />
      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3">
        <div className="template-pick-hero template-pick-hero--compact">
          <h2 className="template-pick-title">Перед оплатой</h2>
          <p className="template-pick-sub">
            Можно оставить выбранный дизайн или сменить на другой — после этого в чат придут PDF и DOCX.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          {PDF_TEMPLATES.map((tmpl, index) => {
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
                className={`template-pick-card template-pick-card--compact${selected ? " template-pick-card--selected" : ""}`}
                style={{ "--pick-accent": tmpl.chipColor } as CSSProperties}
              >
                <div className="template-pick-card-visual template-pick-card-visual--compact">
                  <div className="template-pick-card-frame">
                    <img
                      src={templatePreviewUrl(tmpl.id)}
                      alt={`Превью шаблона ${tmpl.name}`}
                      className="template-pick-card-image"
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                    />
                  </div>
                </div>
                <div className="template-pick-card-meta">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold">{tmpl.name}</h3>
                    {selected ? (
                      <span className="template-pick-check">
                        <Icon name="check_circle" filled size={18} />
                        Выбран
                      </span>
                    ) : null}
                  </div>
                  <p className="template-pick-card-desc">{tmpl.description}</p>
                </div>
              </motion.button>
            );
          })}
        </div>
      </main>

      <FixedBottomBar>
        <Button variant="brand" onClick={continueFlow} disabled={saving}>
          {saving ? "Сохраняем…" : "Подтвердить и перейти к оплате"}
        </Button>
      </FixedBottomBar>
    </Screen>
  );
}
