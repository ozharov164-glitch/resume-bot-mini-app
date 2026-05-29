import { motion } from "motion/react";

export function PreviewLoadingSkeleton() {
  return (
    <motion.div
      className="preview-loading"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      aria-busy
      aria-label="Загружаем предпросмотр"
    >
      <div className="preview-image-stack" aria-hidden>
        <div className="preview-image-stack-sheet preview-image-stack-sheet--2" />
        <div className="preview-image-stack-sheet preview-image-stack-sheet--1" />
      </div>

      <div className="preview-loading-paper">
        <div className="preview-loading-shimmer" aria-hidden />
        <div className="preview-loading-sidebar" />
        <div className="preview-loading-body">
          <div className="preview-loading-line preview-loading-line--title" />
          <div className="preview-loading-line preview-loading-line--subtitle" />
          <div className="preview-loading-block" />
          <div className="preview-loading-line" />
          <div className="preview-loading-line preview-loading-line--short" />
        </div>
      </div>

      <p className="preview-loading-caption">Формируем предпросмотр…</p>
    </motion.div>
  );
}
