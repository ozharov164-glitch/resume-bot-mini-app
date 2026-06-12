import { motion } from "motion/react";

import { normalizeResumeData } from "../../lib/resumeNormalize";
import type { ResumeData } from "../../types";
import { HH_RU_BADGE } from "../../lib/marketingCopy";
import { Icon } from "../ui/Icon";
import { PreviewWatermarkOverlay } from "./PreviewWatermarkOverlay";

function initialsFromName(name: string | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0]?.slice(0, 2) ?? "?").toUpperCase();
}

function ProfileAvatar({ resume }: { resume: ResumeData }) {
  const photoB64 = resume.photo_jpeg_base64?.trim();
  if (photoB64) {
    return (
      <img
        src={`data:image/jpeg;base64,${photoB64}`}
        alt=""
        className="h-16 w-16 shrink-0 rounded-full border object-cover"
        style={{ borderColor: "var(--border-subtle)" }}
      />
    );
  }
  return (
    <div
      className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border text-lg font-bold"
      style={{
        background: "var(--surface-card)",
        borderColor: "var(--border-subtle)",
        color: "var(--brand)",
      }}
    >
      {initialsFromName(resume.full_name)}
    </div>
  );
}

interface PreviewResumeCardProps {
  resume: ResumeData;
}

export function PreviewResumeCard({ resume: raw }: PreviewResumeCardProps) {
  const resume = normalizeResumeData(raw);
  const contactParts = [resume.city, resume.phone, resume.email].filter(Boolean);

  return (
    <motion.section
      className="relative mt-3"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.08 }}
    >
      <div className="preview-eyebrow absolute -top-3 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider shadow-sm">
        Бесплатный предпросмотр
      </div>

      <div
        className="no-copy preview-protected preview-resume-card relative overflow-hidden rounded-xl border p-4"
        onCopy={(e) => e.preventDefault()}
      >
        <PreviewWatermarkOverlay />
        <div className="preview-watermark pointer-events-none absolute inset-0 z-[4] flex select-none items-center justify-center">
          <span className="preview-watermark-text">ПРЕДПРОСМОТР</span>
        </div>

        <div
          className="relative mb-4 flex items-center gap-4 border-b pb-4"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <ProfileAvatar resume={resume} />
          <div className="min-w-0">
            <h3 className="truncate text-lg font-bold">{resume.full_name || "Кандидат"}</h3>
            <p className="mt-1 text-sm font-semibold" style={{ color: "var(--brand)" }}>
              {resume.target_position || "Специалист"}
            </p>
            {contactParts.length > 0 && (
              <p className="mt-1 truncate text-xs" style={{ color: "var(--text-muted)" }}>
                {contactParts.join(" · ")}
              </p>
            )}
          </div>
        </div>

        {resume.summary && (
          <div className="relative mb-4">
            <h4 className="preview-section-title">Обо мне</h4>
            <p className="text-sm leading-relaxed">{resume.summary}</p>
          </div>
        )}

        {resume.experience?.length > 0 && (
          <div className="relative mb-4">
            <h4 className="preview-section-title mb-3">Опыт работы</h4>
            <div className="preview-timeline space-y-4">
              {resume.experience.slice(0, 4).map((job, i) => (
                <div key={`${job.company}-${i}`} className="preview-timeline-item relative">
                  <div
                    className="preview-timeline-dot absolute"
                    style={{
                      background: i === 0 ? "var(--brand)" : "var(--surface-variant)",
                    }}
                  />
                  <div className="text-sm font-semibold">{job.company}</div>
                  {job.period && (
                    <div className="mb-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      {job.period}
                      {job.position ? ` · ${job.position}` : ""}
                    </div>
                  )}
                  {job.description && (
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-variant)" }}>
                      {job.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {resume.education?.length > 0 && (
          <div className="relative mb-4">
            <h4 className="preview-section-title">Образование</h4>
            <ul className="space-y-2 text-sm" style={{ color: "var(--text-variant)" }}>
              {resume.education.slice(0, 2).map((edu, i) => (
                <li key={`${edu.institution}-${i}`}>
                  <span className="font-semibold">{edu.institution}</span>
                  {edu.degree ? ` — ${edu.degree}` : ""}
                  {edu.year ? ` (${edu.year})` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}

        {resume.skills?.length > 0 && (
          <div className="relative">
            <h4 className="preview-section-title">Навыки</h4>
            <div className="flex flex-wrap gap-2">
              {resume.skills.map((skill) => (
                <span key={skill} className="preview-skill-pill">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="relative mt-4 flex items-center justify-center gap-1.5 pt-2">
          <Icon name="verified" filled size={14} style={{ color: "var(--brand)" }} />
          <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            {HH_RU_BADGE}
          </span>
        </div>
      </div>
    </motion.section>
  );
}
