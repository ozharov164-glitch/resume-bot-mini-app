import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";

import {
  EXAMPLE_TEMPLATES,
  exampleImageUrl,
  RESUME_EXAMPLES,
  type ResumeExample,
} from "../../data/resumeExamples";
import { EXAMPLES_GALLERY_SUB } from "../../lib/marketingCopy";
import type { TemplateId } from "../../store";
import { Icon } from "../ui/Icon";
import { getTg } from "../../telegram";

interface ExamplesGalleryProps {
  compact?: boolean;
  onStart?: () => void;
  lightboxOpen?: boolean;
  onLightboxOpenChange?: (open: boolean) => void;
}

function TemplatePicker({
  value,
  onChange,
  className = "",
}: {
  value: TemplateId;
  onChange: (id: TemplateId) => void;
  className?: string;
}) {
  return (
    <div
      className={`example-template-picker${className ? ` ${className}` : ""}`}
      role="tablist"
      aria-label="Шаблон оформления"
    >
      {EXAMPLE_TEMPLATES.map((tmpl) => {
        const active = value === tmpl.id;
        return (
          <button
            key={tmpl.id}
            type="button"
            role="tab"
            aria-selected={active}
            className={`example-template-chip${active ? " example-template-chip--active" : ""}`}
            style={
              active
                ? ({
                    "--chip-accent": tmpl.chipColor,
                  } as CSSProperties)
                : undefined
            }
            onClick={(e) => {
              e.stopPropagation();
              getTg()?.HapticFeedback?.selectionChanged();
              onChange(tmpl.id);
            }}
          >
            <span className="example-template-chip-label">{tmpl.label}</span>
            <span className="example-template-chip-hint">{tmpl.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

function ExamplePreviewImage({
  slug,
  template,
  alt,
  className,
}: {
  slug: string;
  template: TemplateId;
  alt: string;
  className: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const src = exampleImageUrl(slug, template);

  useEffect(() => {
    setLoaded(false);
  }, [src]);

  return (
    <div className="example-preview-wrap">
      {!loaded && <div className="example-preview-skeleton" aria-hidden />}
      <AnimatePresence mode="wait">
        <motion.img
          key={src}
          src={src}
          alt={alt}
          className={className}
          loading="lazy"
          decoding="async"
          draggable={false}
          initial={{ opacity: 0 }}
          animate={{ opacity: loaded ? 1 : 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onLoad={() => setLoaded(true)}
        />
      </AnimatePresence>
    </div>
  );
}

function ExampleAlbumCard({
  example,
  index,
  active,
  template,
  onSelect,
  onTemplateChange,
}: {
  example: ResumeExample;
  index: number;
  active: boolean;
  template: TemplateId;
  onSelect: () => void;
  onTemplateChange: (id: TemplateId) => void;
}) {
  const tmplMeta = EXAMPLE_TEMPLATES.find((t) => t.id === template);

  return (
    <motion.article
      className={`example-album-card${active ? " example-album-card--active" : ""}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <button
        type="button"
        className="example-album-card-hit"
        onClick={onSelect}
        aria-label={`Пример резюме: ${example.position}, шаблон ${tmplMeta?.label ?? template}`}
      >
        <div className="example-album-visual">
          <div className="example-album-stack" aria-hidden>
            <div className="example-album-stack-sheet example-album-stack-sheet--2" />
            <div className="example-album-stack-sheet example-album-stack-sheet--1" />
          </div>

          <div
            className="example-album-frame"
            style={
              tmplMeta
                ? ({
                    "--frame-accent": tmplMeta.chipColor,
                  } as CSSProperties)
                : undefined
            }
          >
            <div className="example-album-accent" aria-hidden />
            <ExamplePreviewImage
              slug={example.slug}
              template={template}
              alt={`Резюме — ${example.name}, ${example.position}, ${tmplMeta?.label ?? template}`}
              className="example-album-image"
            />
          </div>
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
      </button>

      <TemplatePicker
        value={template}
        onChange={onTemplateChange}
        className="example-template-picker--card"
      />
    </motion.article>
  );
}

function ExampleLightbox({
  example,
  template,
  onTemplateChange,
  onClose,
}: {
  example: ResumeExample;
  template: TemplateId;
  onTemplateChange: (id: TemplateId) => void;
  onClose: () => void;
}) {
  const tmplMeta = EXAMPLE_TEMPLATES.find((t) => t.id === template);

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

        <TemplatePicker value={template} onChange={onTemplateChange} className="example-template-picker--lightbox" />

        <div className="example-lightbox-visual">
          <div className="example-lightbox-stack" aria-hidden>
            <div className="example-lightbox-stack-sheet example-lightbox-stack-sheet--2" />
            <div className="example-lightbox-stack-sheet example-lightbox-stack-sheet--1" />
          </div>

          <div className="example-lightbox-frame">
            <ExamplePreviewImage
              slug={example.slug}
              template={template}
              alt={`Резюме — ${example.name}, ${tmplMeta?.label ?? template}`}
              className="example-lightbox-image"
            />
          </div>
        </div>

        <div className="example-lightbox-caption">
          <p className="example-lightbox-title">{example.name}</p>
          <p className="example-lightbox-sub">
            {example.position} · {example.city}
            {tmplMeta ? ` · ${tmplMeta.label}` : ""}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function ExamplesGallery({
  compact = false,
  onStart,
  lightboxOpen: lightboxOpenProp,
  onLightboxOpenChange,
}: ExamplesGalleryProps) {
  const [lightbox, setLightboxInternal] = useState<ResumeExample | null>(null);
  const [galleryTemplate, setGalleryTemplate] = useState<TemplateId>("classic");
  const [activeIndex, setActiveIndex] = useState(0);

  const setLightbox = useCallback(
    (example: ResumeExample | null) => {
      setLightboxInternal(example);
      onLightboxOpenChange?.(example !== null);
    },
    [onLightboxOpenChange],
  );

  useEffect(() => {
    if (lightboxOpenProp === false && lightbox) {
      setLightboxInternal(null);
    }
  }, [lightboxOpenProp, lightbox]);

  const openLightbox = useCallback(
    (example: ResumeExample) => {
      setLightbox(example);
    },
    [setLightbox],
  );

  const closeLightbox = useCallback(() => setLightbox(null), [setLightbox]);

  const handleGalleryTemplate = useCallback((id: TemplateId) => {
    setGalleryTemplate(id);
  }, []);

  return (
    <section className={`examples-gallery${compact ? " examples-gallery--compact" : ""}`}>
      {!compact && (
        <div className="examples-gallery-header">
          <h2 className="examples-gallery-title">Примеры готовых резюме</h2>
          <p className="examples-gallery-sub">
            {EXAMPLES_GALLERY_SUB}
          </p>
          <TemplatePicker
            value={galleryTemplate}
            onChange={handleGalleryTemplate}
            className="example-template-picker--gallery"
          />
        </div>
      )}

      <div className="examples-gallery-scroll">
        {RESUME_EXAMPLES.map((example, index) => (
          <ExampleAlbumCard
            key={example.slug}
            example={example}
            index={index}
            active={index === activeIndex}
            template={galleryTemplate}
            onSelect={() => {
              setActiveIndex(index);
              openLightbox(example);
            }}
            onTemplateChange={handleGalleryTemplate}
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
        {lightbox && (
          <ExampleLightbox
            example={lightbox}
            template={galleryTemplate}
            onTemplateChange={handleGalleryTemplate}
            onClose={closeLightbox}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
