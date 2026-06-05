import { useCallback, useEffect, useRef, useState } from "react";

import { fetchAtsScore, type AtsScoreResult } from "../../api";
import { Icon } from "../ui/Icon";

interface AtsBadgeProps {
  token: string;
  resumeId: string;
}

const LEVEL_CFG = {
  great:  { color: "#059669", bg: "rgba(5,150,105,0.1)",  border: "rgba(5,150,105,0.28)",  dot: "#10b981" },
  good:   { color: "#065f46", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.30)", dot: "#10b981" },
  medium: { color: "#92400e", bg: "rgba(217,119,6,0.1)",  border: "rgba(217,119,6,0.25)",  dot: "#f59e0b" },
  low:    { color: "#991b1b", bg: "rgba(220,38,38,0.09)", border: "rgba(220,38,38,0.22)",  dot: "#ef4444" },
} as const;

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <svg width={44} height={44} viewBox="0 0 44 44" fill="none" aria-hidden>
      <circle cx={22} cy={22} r={r} stroke="rgba(0,0,0,0.08)" strokeWidth={3.5} />
      <circle
        cx={22} cy={22} r={r}
        stroke={color}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c}`}
        transform="rotate(-90 22 22)"
        style={{ transition: "stroke-dasharray 0.7s cubic-bezier(0.4,0,0.2,1)" }}
      />
      <text x={22} y={26.5} textAnchor="middle" fill={color} fontSize={11} fontWeight={800} fontFamily="inherit">
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

export function AtsBadge({ token, resumeId }: AtsBadgeProps) {
  const [result, setResult] = useState<AtsScoreResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [vacancy, setVacancy] = useState("");
  const [checking, setChecking] = useState(false);
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
    void load();
    return () => { mounted.current = false; };
  }, [load]);

  const checkVacancy = async () => {
    if (vacancy.trim().length < 20 || checking) return;
    setChecking(true);
    try { await load(vacancy.trim()); } finally { setChecking(false); }
  };

  // Compact badge (always visible in bottom bar)
  const cfg = result ? LEVEL_CFG[result.level] : null;

  return (
    <>
      {/* Compact pill */}
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
            <span className="ats-badge__label">ATS</span>
          </>
        )}
      </button>

      {/* Overlay panel */}
      {open && result && cfg && (
        <>
          <div className="ats-overlay-backdrop" onClick={() => setOpen(false)} />
          <div className="ats-overlay" role="dialog" aria-label="ATS-анализ резюме">
            {/* Handle bar */}
            <div className="ats-overlay__handle" onClick={() => setOpen(false)} aria-hidden />

            <div className="ats-overlay__header">
              <ScoreRing score={result.score} color={cfg.color} />
              <div className="ats-overlay__header-copy">
                <div className="ats-overlay__title-row">
                  <span className="ats-overlay__title">ATS-оценка</span>
                  <span
                    className="ats-overlay__badge"
                    style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
                  >
                    {result.label}
                  </span>
                </div>
                <p className="ats-overlay__desc">{result.description}</p>
              </div>
              <button type="button" className="ats-overlay__close" onClick={() => setOpen(false)} aria-label="Закрыть">
                <Icon name="close" size={18} />
              </button>
            </div>

            {/* Bars */}
            <div className="ats-overlay__bars">
              <ScoreBar label="Полнота" value={result.completeness} max={40} color={cfg.color} />
              <ScoreBar label="Качество" value={result.quality} max={25} color={cfg.color} />
              <ScoreBar label={result.has_vacancy ? "Ключевые слова" : "Ключевые слова (без вакансии)"} value={result.keyword_score} max={35} color={cfg.color} />
            </div>

            {/* Missing keywords */}
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

            {/* Tips */}
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

            {/* Vacancy input */}
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
                <p className="ats-overlay__vacancy-hint">Вставьте текст — покажем какие ключевые слова добавить</p>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
