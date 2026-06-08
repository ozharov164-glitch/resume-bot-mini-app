import { useCallback, useEffect, useRef, useState } from "react";

import { fetchAtsScore, saveAdaptVacancy, type AtsScoreResult } from "../../api";
import { trackEvent } from "../../lib/analytics";
import { useAppStore } from "../../store";
import { Icon } from "../ui/Icon";

interface AtsBadgeProps {
  token: string;
  resumeId: string;
  isPaid?: boolean;
  onGetPdf?: () => void;
}

const LEVEL_CFG = {
  great:  { color: "#059669", bg: "rgba(5,150,105,0.1)",  border: "rgba(5,150,105,0.28)",  dot: "#10b981" },
  good:   { color: "#065f46", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.30)", dot: "#10b981" },
  medium: { color: "#92400e", bg: "rgba(217,119,6,0.1)",  border: "rgba(217,119,6,0.25)",  dot: "#f59e0b" },
  low:    { color: "#991b1b", bg: "rgba(220,38,38,0.09)", border: "rgba(220,38,38,0.22)",  dot: "#ef4444" },
} as const;

function ScoreRing({ score, color, size = 44 }: { score: number; color: string; size?: number }) {
  const r = size === 44 ? 18 : 26;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  const cx = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden>
      <circle cx={cx} cy={cx} r={r} stroke="rgba(0,0,0,0.08)" strokeWidth={3.5} />
      <circle
        cx={cx} cy={cx} r={r}
        stroke={color}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        transform={`rotate(-90 ${cx} ${cx})`}
        style={{ transition: "stroke-dasharray 0.7s cubic-bezier(0.4,0,0.2,1)" }}
      />
      <text x={cx} y={cx + (size === 44 ? 4.5 : 5)} textAnchor="middle" fill={color} fontSize={size === 44 ? 11 : 15} fontWeight={800} fontFamily="inherit">
        {score}
      </text>
    </svg>
  );
}

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="atsp-bar">
      <div className="atsp-bar__meta">
        <span className="atsp-bar__label">{label}</span>
        <span className="atsp-bar__val" style={{ color }}>{value}<span className="atsp-bar__max">/{max}</span></span>
      </div>
      <div className="atsp-bar__track">
        <div className="atsp-bar__fill" style={{ width: `${Math.round(value / max * 100)}%`, background: color, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

export function AtsBadge({ token, resumeId, isPaid = false, onGetPdf }: AtsBadgeProps) {
  const { pendingVacancyText, setPendingVacancyText, setPage } = useAppStore();
  const [result, setResult] = useState<AtsScoreResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [vacancy, setVacancy] = useState(pendingVacancyText);
  const [checking, setChecking] = useState(false);
  const [jdDisclaimerSeen, setJdDisclaimerSeen] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async (vacancyText = "") => {
    try {
      const data = await fetchAtsScore(token, resumeId, vacancyText);
      if (mounted.current) setResult(data);
    } catch {
      /* silent */
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [token, resumeId]);

  useEffect(() => {
    void load(pendingVacancyText);
    return () => { mounted.current = false; };
  }, [load, pendingVacancyText]);

  const checkVacancy = async () => {
    const text = vacancy.trim();
    if (text.length < 20 || checking) return;
    setChecking(true);
    try {
      setPendingVacancyText(text);
      trackEvent("jd_pasted");
      if (isPaid) {
        try {
          await saveAdaptVacancy(token, resumeId, text);
        } catch {
          /* non-blocking */
        }
      }
      await load(text);
      if (!jdDisclaimerSeen) setJdDisclaimerSeen(true);
    } finally {
      setChecking(false);
    }
  };

  const cfg = result ? LEVEL_CFG[result.level] : null;
  const hasVacancyMatch = result?.has_vacancy && (result.vacancy_match_percent ?? 0) > 0;

  const handleAdaptCta = () => {
    trackEvent("ats_fix_tapped", { paid: isPaid });
    if (!isPaid) {
      onGetPdf?.();
      setOpen(false);
      return;
    }
    setPendingVacancyText(vacancy.trim() || pendingVacancyText);
    setPage("success");
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className="ats-badge"
        onClick={() => setOpen(true)}
        aria-label="ATS-оценка резюме"
        disabled={loading || !result}
        style={cfg ? {
          background: cfg.bg,
          border: `1px solid ${cfg.border}`,
          color: cfg.color,
        } : undefined}
      >
        {loading || !result ? (
          <span className="ats-badge__skeleton" />
        ) : (
          <>
            <span className="ats-badge__dot" style={{ background: cfg!.dot }} />
            <span className="ats-badge__score">{result.score}</span>
            {hasVacancyMatch ? (
              <span className="ats-badge__vacancy-pct">{result.vacancy_match_percent}%</span>
            ) : null}
            <span className="ats-badge__label">ATS</span>
          </>
        )}
      </button>

      {open && result && cfg && (
        <>
          <div className="ats-overlay-backdrop" onClick={() => setOpen(false)} />
          <div className="ats-overlay" role="dialog" aria-label="ATS-анализ резюме">
            <div className="ats-overlay__handle" onClick={() => setOpen(false)} aria-hidden />

            <div className="ats-overlay__header">
              <ScoreRing score={result.score} color={cfg.color} size={68} />
              <div className="ats-overlay__header-copy">
                <div className="ats-overlay__title-row">
                  <span className="ats-overlay__title">Готовность резюме</span>
                  <span
                    className="ats-overlay__badge"
                    style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
                  >
                    {result.label}
                  </span>
                </div>
                <p className="ats-overlay__desc">
                  Насколько резюме готово к откликам на hh.ru и автоотбору
                </p>
              </div>
              <button type="button" className="ats-overlay__close" onClick={() => setOpen(false)} aria-label="Закрыть">
                <Icon name="close" size={18} />
              </button>
            </div>

            {result.has_vacancy && (
              <div className="ats-overlay__dual-metric">
                <div className="ats-overlay__dual-metric-row">
                  <span className="ats-overlay__dual-label">Совпадение с вакансией</span>
                  <strong className="ats-overlay__dual-value" style={{ color: cfg.color }}>
                    {result.vacancy_match_percent ?? 0}%
                  </strong>
                </div>
                {(result.title_match_score ?? 0) > 0 && (
                  <div className="ats-overlay__dual-metric-row">
                    <span className="ats-overlay__dual-label">Должность в тексте</span>
                    <strong className="ats-overlay__dual-value">{result.title_match_score}%</strong>
                  </div>
                )}
                {result.has_vacancy && !jdDisclaimerSeen && (
                  <p className="ats-overlay__jd-disclaimer">
                    Это отдельная проверка по тексту вакансии. Готовность резюме: {result.score}.
                  </p>
                )}
              </div>
            )}

            {(result.format_penalty ?? 0) < 0 && (
              <p className="ats-overlay__format-tip">
                <Icon name="info" size={14} />
                Шаблон с колонками хуже читается роботами — попробуйте Modern на предпросмотре
              </p>
            )}

            <div className="ats-overlay__bars">
              <ScoreBar label="Полнота" value={result.completeness} max={40} color={cfg.color} />
              <ScoreBar label="Качество" value={result.quality} max={25} color={cfg.color} />
              {result.has_vacancy && (
                <ScoreBar label="Ключевые слова" value={result.keyword_score} max={35} color={cfg.color} />
              )}
            </div>

            {result.has_vacancy && result.missing_keywords.length > 0 && (
              <div className="ats-overlay__kw-block">
                <p className="ats-overlay__kw-title ats-overlay__kw-title--miss">
                  <Icon name="close" size={13} />Не хватает в резюме:
                </p>
                <div className="ats-overlay__chips">
                  {result.missing_keywords.map((kw) => (
                    <span key={kw} className="ats-chip ats-chip--miss">{kw}</span>
                  ))}
                </div>
                <button
                  type="button"
                  className="ats-overlay__adapt-cta"
                  onClick={handleAdaptCta}
                  style={{ color: cfg.color, borderColor: cfg.border }}
                >
                  <Icon name="auto_fix_high" size={16} />
                  {isPaid ? "Добавить слова из вакансии — 99 ₽" : "Получить PDF — 149 ₽"}
                </button>
              </div>
            )}

            {result.has_vacancy && result.matched_keywords.length > 0 && (
              <div className="ats-overlay__kw-block">
                <p className="ats-overlay__kw-title ats-overlay__kw-title--ok">
                  <Icon name="check" size={13} />Найдено:
                </p>
                <div className="ats-overlay__chips">
                  {result.matched_keywords.slice(0, 10).map((kw) => (
                    <span key={kw} className="ats-chip ats-chip--ok">{kw}</span>
                  ))}
                </div>
              </div>
            )}

            {result.tips.length > 0 && (
              <div className="ats-overlay__tips">
                {result.tips.map((tip) => (
                  <div key={tip} className="ats-overlay__tip">
                    <Icon name="lightbulb" filled size={13} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
                    <span>{tip}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="ats-overlay__vacancy">
              <p className="ats-overlay__vacancy-label">
                {result.has_vacancy ? "Другая вакансия:" : "Проверить под вакансию:"}
              </p>
              <div className="ats-overlay__vacancy-row">
                <textarea
                  className="ats-overlay__textarea"
                  value={vacancy}
                  onChange={(e) => setVacancy(e.target.value)}
                  placeholder="Вставьте текст вакансии с hh.ru…"
                  rows={2}
                />
                <button
                  type="button"
                  className="ats-overlay__check-btn"
                  onClick={() => void checkVacancy()}
                  disabled={checking || vacancy.trim().length < 20}
                  style={{ color: cfg.color, borderColor: cfg.border }}
                >
                  {checking ? <span className="ats-spinner" /> : <Icon name="manage_search" size={16} />}
                </button>
              </div>
              {!result.has_vacancy && (
                <p className="ats-overlay__vacancy-hint">Вставьте текст — покажем, какие ключевые слова добавить</p>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
