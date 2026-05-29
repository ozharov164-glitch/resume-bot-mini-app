import { useCallback, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { exampleImageUrl, RESUME_EXAMPLES, type ResumeExample } from "../../data/resumeExamples";
import { Icon } from "../ui/Icon";

interface ExamplesGalleryProps {
  compact?: boolean;
  onStart?: () => void;
}

function ExampleAlbumCard({
  example,
  index,
  active,
  onSelect,
}: {
  example: ResumeExample;
  index: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      className={`example-album-card${active ? " example-album-card--active" : ""}`}
      onClick={onSelect}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      aria-label={`Пример резюме: ${example.position}`}
    >
      <div className="example-album-stack" aria-hidden>
        <div className="example-album-stack-sheet example-album-stack-sheet--2" />
        <div className="example-album-stack-sheet example-album-stack-sheet--1" />
      </div>

      <div className="example-album-frame">
        <div
          className="example-album-accent"
          style={{ background: example.accent }}
          aria-hidden
        />
        <img
          src={exampleImageUrl(example.slug)}
          alt={`Резюме — ${example.name}, ${example.position}`}
          className="example-album-image"
          loading="lazy"
          draggable={false}
        />
      </div>

      <div className="example-album-meta">
        <span className="example-album-badge" style={{ color: example.accent }}>
          {example.position}
        </span>
        <span className="example-album-name">{example.name}</span>
        <span className="example-album-tagline">{example.tagline}</span>
        <span className="example-album-city">
          <Icon name="location_on" size={14} />
          {example.city}
        </span>
      </div>
    </motion.button>
  );
}

function ExampleLightbox({
  example,
  onClose,
}: {
  example: ResumeExample;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="example-lightbox"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="example-lightbox-sheet"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="example-lightbox-close" onClick={onClose} aria-label="Закрыть">
          <Icon name="close" size={22} />
        </button>

        <div className="example-lightbox-stack" aria-hidden>
          <div className="example-lightbox-stack-sheet example-lightbox-stack-sheet--2" />
          <div className="example-lightbox-stack-sheet example-lightbox-stack-sheet--1" />
        </div>

        <div className="example-lightbox-frame">
          <img
            src={exampleImageUrl(example.slug)}
            alt={`Резюме — ${example.name}`}
            className="example-lightbox-image"
            draggable={false}
          />
        </div>

        <div className="example-lightbox-caption">
          <p className="example-lightbox-title">{example.name}</p>
          <p className="example-lightbox-sub">{example.position} · {example.city}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function ExamplesGallery({ compact = false, onStart }: ExamplesGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightbox, setLightbox] = useState<ResumeExample | null>(null);

  const openLightbox = useCallback((example: ResumeExample) => {
    setLightbox(example);
  }, []);

  const closeLightbox = useCallback(() => setLightbox(null), []);

  return (
    <section className={`examples-gallery${compact ? " examples-gallery--compact" : ""}`}>
      {!compact && (
        <div className="examples-gallery-header">
          <h2 className="examples-gallery-title">Примеры готовых резюме</h2>
          <p className="examples-gallery-sub">
            Так выглядит финальный PDF — профессиональный дизайн под стандарты hh.ru
          </p>
        </div>
      )}

      <div className="examples-gallery-scroll">
        {RESUME_EXAMPLES.map((example, index) => (
          <ExampleAlbumCard
            key={example.slug}
            example={example}
            index={index}
            active={index === activeIndex}
            onSelect={() => {
              setActiveIndex(index);
              openLightbox(example);
            }}
          />
        ))}
      </div>

      <div className="examples-gallery-dots" role="tablist" aria-label="Примеры резюме">
        {RESUME_EXAMPLES.map((example, index) => (
          <button
            key={example.slug}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            className={`examples-gallery-dot${index === activeIndex ? " examples-gallery-dot--active" : ""}`}
            onClick={() => setActiveIndex(index)}
            aria-label={example.position}
          />
        ))}
      </div>

      {onStart && (
        <button type="button" className="examples-gallery-cta" onClick={onStart}>
          <Icon name="auto_awesome" filled size={18} />
          Создать такое же резюме
        </button>
      )}

      <AnimatePresence>
        {lightbox && <ExampleLightbox example={lightbox} onClose={closeLightbox} />}
      </AnimatePresence>
    </section>
  );
}
