import { parseHhText } from "../../lib/parseHhText";

interface HhTextViewerProps {
  text: string;
}

export function HhTextViewer({ text }: HhTextViewerProps) {
  const parsed = parseHhText(text);

  return (
    <article className="hh-text-view">
      <header className="hh-text-view__header">
        <h2 className="hh-text-view__name">{parsed.headline}</h2>
        {parsed.metaLines.length > 0 ? (
          <ul className="hh-text-view__meta">
            {parsed.metaLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </header>

      {parsed.sections.map((section) => (
        <section key={section.title} className="hh-text-view__section">
          <h3 className="hh-text-view__section-title">{section.title}</h3>
          <div className="hh-text-view__section-body">
            {section.lines.map((line, index) => {
              const trimmed = line.trim();
              if (!trimmed) {
                return <div key={`${section.title}-gap-${index}`} className="hh-text-view__gap" />;
              }
              if (trimmed.startsWith("• ")) {
                return (
                  <p key={`${section.title}-${index}`} className="hh-text-view__bullet">
                    {trimmed.slice(2)}
                  </p>
                );
              }
              if (trimmed.includes(" — ") && section.title === "ОПЫТ РАБОТЫ") {
                return (
                  <p key={`${section.title}-${index}`} className="hh-text-view__job-title">
                    {trimmed}
                  </p>
                );
              }
              return (
                <p key={`${section.title}-${index}`} className="hh-text-view__paragraph">
                  {trimmed}
                </p>
              );
            })}
          </div>
        </section>
      ))}
    </article>
  );
}
