import { motion } from "motion/react";

import { Icon } from "../ui/Icon";
import { PreviewWatermarkOverlay } from "./PreviewWatermarkOverlay";

interface PreviewImageFrameProps {
  src: string;
  locked: boolean;
}

export function PreviewImageFrame({ src, locked }: PreviewImageFrameProps) {
  return (
    <motion.section
      className="preview-image-wrap"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="preview-image-stack" aria-hidden>
        <div className="preview-image-stack-sheet preview-image-stack-sheet--2" />
        <div className="preview-image-stack-sheet preview-image-stack-sheet--1" />
      </div>

      <div className={`preview-image-frame${locked ? " preview-image-frame--locked" : ""}`}>
        <div
          className={`no-copy preview-protected preview-image-paper${locked ? " preview-image-paper--scroll" : ""}`}
        >
          {locked && (
            <div className="preview-image-badge">
              <Icon name="visibility" size={14} />
              <span>Бесплатный предпросмотр</span>
            </div>
          )}

          <div className="preview-image-canvas">
            <img
              src={src}
              alt="Предпросмотр резюме"
              className="preview-image"
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
            />

            {locked ? (
              <>
                <PreviewWatermarkOverlay />
                <div className="preview-image-vignette" aria-hidden />
              </>
            ) : (
              <div className="preview-image-badge preview-image-badge--paid">
                <Icon name="verified" filled size={14} />
                <span>PDF разблокирован</span>
              </div>
            )}
          </div>
        </div>

        {locked && (
          <>
            <div className="preview-image-lock-card">
              <div className="preview-image-lock-icon">
                <Icon name="lock" filled size={20} style={{ color: "var(--brand)" }} />
              </div>
              <div className="preview-image-lock-copy">
                <p className="preview-image-lock-title">Полный PDF после оплаты</p>
                <p className="preview-image-lock-sub">
                  Чистый файл без водяных знаков — сразу в Telegram
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {locked && (
        <p className="preview-image-footnote">
          <Icon name="shield" size={15} style={{ color: "var(--brand-bright)" }} />
          <span>Так выглядит финальный дизайн — скачивание доступно после оплаты</span>
        </p>
      )}
    </motion.section>
  );
}
