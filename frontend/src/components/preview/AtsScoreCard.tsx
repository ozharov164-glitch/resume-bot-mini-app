import { useCallback, useEffect, useRef, useState } from "react";

import { fetchAtsScore, type AtsScoreResult } from "../../api";
import { Icon } from "../ui/Icon";

interface AtsScoreCardProps {
  token: string;
  resumeId: string;
}

const LEVEL_CONFIG = {
  great: { color: "#10b981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.30)", icon: "verified" },
  good:  { color: "#059669", bg: "rgba(5,150,105,0.08)",  border: "rgba(5,150,105,0.25)",  icon: "check_circle" },
  medium:{ color: "#d97706", bg: "rgba(217,119,6,0.08)",  border: "rgba(217,119,6,0.22)",  icon: "warning" },
  low:   { color: "#dc2626", bg: "rgba(220,38,38,0.08)",  border: "rgba(220,38,38,0.20)",  icon: "error" },
} as const;

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const dash = (score / 100) * circumference;

  return (
    <svg width={68} height={68} viewBox="0 0 68 68" fill="none" aria-hidden>
      <circle cx={34} cy={34} r={r} stroke="rgba(0,0,0,0.07)" strokeWidth={5} />
      <circle
        cx={34}
        cy={34}
        r={r}
        stroke={color}
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        transform="rotate(-90 34 34)"
        style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)" }}
      />
      <text x={34} y={39} textAnchor="middle" fill={color} fontSize={15} fontWeight={800} fontFamily="inherit">
        {score}
      </text>
    </svg>
  );
}

export function AtsScoreCard({ token, resumeId }: AtsScoreCardProps) {
  const [result, setResult] = useState<AtsScoreResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [vacancy, setVacancy] = useState("");
  const [checking, setChecking] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async (vacancyText = "") => {
    try {
      const data = await fetchAtsScore(token, resumeId, vacancyText);
      if (mounted.current) setResult(data);
    } catch {
      // score unavailable silently
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
    try {
      await load(vacancy.trim());
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <div className="ats-card ats-card--loading" aria-busy="true">
        <div className="ats-card__skeleton-ring" />
        <div className="ats-card__skeleton-text" />
      </div>
    );
  }

  if (!result) return null;

  const cfg = LEVEL_CONFIG[result.level];

  return (
    <div
      className={`ats-card ats-card--${result.level}`}
      style={{ "--ats-color": cfg.color, "--ats-bg": cfg.bg, "--ats-border": cfg.border } as React.CSSProperties}
    >
      {/* Header row */}
      <button
        type="button"
        className="ats-card__header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <ScoreRing score={result.score} color={cfg.color} />

        <div className="ats-card__header-copy">
          <div className="ats-card__title-row">
            <span className="ats-card__label">ATS-оценка</span>
            <span className="ats-card__badge" style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
              <Icon name={cfg.icon} filled size={13} />
              {result.label}
            </span>
          </div>
          <p className="ats-card__description">{result.description}</p>
          {!result.has_vacancy && (
            <p className="ats-card__hint">Введите вакансию для точного анализа ↓</p>
          )}
        </div>

        <Icon
          name={expanded ? "expand_less" : "expand_more"}
          size={20}
          style={{ color: "var(--text-muted)", flexShrink: 0 }}
        />
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="ats-card__body">
          {/* Score breakdown */}
          <div className="ats-card__bars">
            <ScoreBar label="Полнота" value={result.completeness} max={40} color={cfg.color} />
            <ScoreBar label="Качество" value={result.quality} max={25} color={cfg.color} />
            <ScoreBar
              label={result.has_vacancy ? "Ключевые слова" : "Ключевые слова (без вакансии)"}
              value={result.keyword_score}
              max={35}
              color={cfg.color}
            />
          </div>

          {/* Keywords */}
          {result.has_vacancy && result.missing_keywords.length > 0 && (
            <div className="ats-card__kw-section">
              <p className="ats-card__kw-label ats-card__kw-label--miss">
                <Icon name="close" size={14} />
                Не хватает в резюме:
              </p>
              <div className="ats-card__kw-chips">
                {result.missing_keywords.map((kw) => (
                  <span key={kw} className="ats-card__chip ats-card__chip--miss">{kw}</span>
                ))}
              </div>
            </div>
          )}
          {result.has_vacancy && result.matched_keywords.length > 0 && (
            <div className="ats-card__kw-section">
              <p className="ats-card__kw-label ats-card__kw-label--ok">
                <Icon name="check" size={14} />
                Найдено в резюме:
              </p>
              <div className="ats-card__kw-chips">
                {result.matched_keywords.slice(0, 10).map((kw) => (
                  <span key={kw} className="ats-card__chip ats-card__chip--ok">{kw}</span>
                ))}
              </div>
            </div>
          )}

          {/* Tips */}
          {result.tips.length > 0 && (
            <div className="ats-card__tips">
              {result.tips.map((tip) => (
                <div key={tip} className="ats-card__tip">
                  <Icon name="lightbulb" filled size={14} style={{ color: "#f59e0b", flexShrink: 0 }} />
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          )}

          {/* Vacancy input */}
          <div className="ats-card__vacancy">
            <p className="ats-card__vacancy-label">
              {result.has_vacancy ? "Проверить под другую вакансию:" : "Проверить под конкретную вакансию:"}
            </p>
            <textarea
              className="ats-card__vacancy-textarea"
              value={vacancy}
              onChange={(e) => setVacancy(e.target.value)}
              placeholder="Вставьте текст вакансии с hh.ru…"
              rows={3}
              aria-label="Текст вакансии для ATS-анализа"
            />
            <button
              type="button"
              className="ats-card__vacancy-btn"
              onClick={() => void checkVacancy()}
              disabled={checking || vacancy.trim().length < 20}
              style={{ color: cfg.color, borderColor: cfg.border }}
            >
              {checking ? (
                <><span className="ats-spinner" />Анализируем…</>
              ) : (
                <><Icon name="manage_search" size={16} />Проверить совпадение</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="ats-bar">
      <div className="ats-bar__meta">
        <span className="ats-bar__label">{label}</span>
        <span className="ats-bar__value" style={{ color }}>{value}<span className="ats-bar__max">/{max}</span></span>
      </div>
      <div className="ats-bar__track">
        <div
          className="ats-bar__fill"
          style={{ width: `${pct}%`, background: color, transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </div>
    </div>
  );
}
