import { useCallback, type CSSProperties } from "react";
import { motion } from "motion/react";

import { trackEvent } from "../lib/analytics";
import { AppHeader } from "../components/ui/AppHeader";
import { PhotoUpload } from "../components/ui/PhotoUpload";
import { Button } from "../components/ui/Button";
import { FixedBottomBar } from "../components/ui/FixedBottomBar";
import { Icon } from "../components/ui/Icon";
import { Screen } from "../components/ui/Screen";
import { PDF_TEMPLATES, templatePreviewUrl } from "../lib/templates";
import { useTelegramBackButton } from "../hooks/useTelegramBackButton";
import { useAppStore, type TemplateId } from "../store";
import { getTg } from "../telegram";

export function TemplatePickPage() {
  const {
    selectedTemplate,
    setSelectedTemplate,
    setPage,
    onboardingStep,
    setOnboardingStep,
    onboardingMode,
  } = useAppStore();

  const handleBack = useCallback(() => {
    getTg()?.HapticFeedback?.impactOccurred("light");
    setPage("onboarding");
    setOnboardingStep(Math.max(0, onboardingStep));
  }, [onboardingStep, setOnboardingStep, setPage]);

  useTelegramBackButton(handleBack);

  const continueFlow = () => {
    getTg()?.HapticFeedback?.impactOccurred("medium");
    trackEvent("template_selected", { template: selectedTemplate });
    setPage("loading");
  };

  const isEdit = onboardingMode === "edit";

  return (
    <Screen withBottomBar className="template-pick-page">
      <AppHeader onBack={handleBack} showBack title="Дизайн PDF" />
      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-y-contain px-4 py-3">
        <div className="template-pick-hero">
          <Icon name="palette" filled size={28} style={{ color: "var(--brand)" }} />
          <h2 className="template-pick-title">
            {isEdit ? "Выберите дизайн для новой версии" : "Как будет выглядеть PDF?"}
          </h2>
          <p className="template-pick-sub">
            Три готовых шаблона — после оплаты PDF и DOCX придут в чат в выбранном стиле.
          </p>
        </div>

        <PhotoUpload mode="store" showSkip />

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
                    {tmpl.id === "modern" ? (
                      <span className="template-pick-recommended">Рекомендуем</span>
                    ) : null}
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
        <Button variant="brand" onClick={continueFlow}>
          Составить резюме
          <Icon name="arrow_forward" size={20} />
        </Button>
      </FixedBottomBar>
    </Screen>
  );
}
