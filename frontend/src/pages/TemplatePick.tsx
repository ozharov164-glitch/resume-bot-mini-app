import { useCallback, type CSSProperties } from "react";
import { motion } from "motion/react";

import { AppHeader } from "../components/ui/AppHeader";
import { Button } from "../components/ui/Button";
import { FixedBottomBar } from "../components/ui/FixedBottomBar";
import { Icon } from "../components/ui/Icon";
import { Screen } from "../components/ui/Screen";
import { PDF_TEMPLATES, templatePreviewUrl } from "../lib/templates";
import { useTelegramBackButton } from "../hooks/useTelegramBackButton";
import { useAppStore, type TemplateId } from "../store";
import { getTg } from "../telegram";

export function TemplatePickPage() {
  const { selectedTemplate, setSelectedTemplate, setPage } = useAppStore();

  const handleBack = useCallback(() => setPage("home"), [setPage]);
  useTelegramBackButton(handleBack);

  const continueFlow = () => {
    getTg()?.HapticFeedback?.impactOccurred("medium");
    setPage("onboarding");
  };

  return (
    <Screen withBottomBar>
      <AppHeader onBack={handleBack} showBack title="Выбери дизайн" />
      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3">
        <div className="template-pick-hero">
          <Icon name="palette" filled size={28} style={{ color: "var(--brand)" }} />
          <h2 className="template-pick-title">Как будет выглядеть твоё резюме?</h2>
          <p className="template-pick-sub">
            Три готовых шаблона — выберите стиль. Перед оплатой можно сменить.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {PDF_TEMPLATES.map((tmpl, index) => {
            const selected = selectedTemplate === tmpl.id;
            return (
              <motion.button
                key={tmpl.id}
                type="button"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.07 }}
                onClick={() => {
                  setSelectedTemplate(tmpl.id as TemplateId);
                  getTg()?.HapticFeedback?.selectionChanged();
                }}
                className={`template-pick-card${selected ? " template-pick-card--selected" : ""}`}
                style={{ "--pick-accent": tmpl.chipColor } as CSSProperties}
              >
                <div className="template-pick-card-visual">
                  <div className="template-pick-card-stack" aria-hidden>
                    <div className="template-pick-card-stack-sheet template-pick-card-stack-sheet--2" />
                    <div className="template-pick-card-stack-sheet template-pick-card-stack-sheet--1" />
                  </div>
                  <div className="template-pick-card-frame">
                    <img
                      src={templatePreviewUrl(tmpl.id)}
                      alt={`Шаблон ${tmpl.name}`}
                      className="template-pick-card-image"
                      loading={index === 0 ? "eager" : "lazy"}
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
        <Button variant="brand" onClick={continueFlow} className="flex items-center justify-center gap-2">
          Продолжить
          <Icon name="arrow_forward" size={20} />
        </Button>
      </FixedBottomBar>
    </Screen>
  );
}
