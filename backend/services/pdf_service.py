from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from weasyprint import CSS, HTML

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"


def get_pdf_styles() -> str:
    return """
@page {
    size: A4;
    margin: 22mm 16mm 20mm 20mm;
}

body {
    font-family: 'PT Sans', Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.55;
    color: #1a1a1a;
    margin: 0;
}

/* ── ШАПКА ── */
.header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0;
}

.header-left { flex: 1; }

.header-right {
    text-align: right;
    flex-shrink: 0;
    margin-left: 16pt;
}

h1 {
    font-family: 'PT Serif', Georgia, serif;
    font-size: 24pt;
    font-weight: 700;
    color: #0d0d1f;
    margin: 0 0 3pt 0;
    letter-spacing: -0.3pt;
    line-height: 1.05;
}

.position {
    font-size: 12pt;
    color: #4a4a70;
    margin: 0 0 2pt 0;
    font-style: italic;
}

.header-divider {
    height: 2pt;
    background: linear-gradient(90deg, #0d0d1f 0%, #E8962A 60%, transparent 100%);
    border-radius: 1pt;
    margin: 9pt 0 10pt 0;
}

.contact-row {
    font-size: 9.5pt;
    color: #555;
    line-height: 1.7;
    text-align: right;
}

/* ── СЕКЦИИ ── */
.section { margin-bottom: 12pt; }

.section-header {
    display: flex;
    align-items: center;
    gap: 7pt;
    margin-bottom: 6pt;
}

.section-marker {
    width: 3.5pt;
    height: 14pt;
    background: #E8962A;
    border-radius: 2pt;
    flex-shrink: 0;
}

.section-title {
    font-family: 'PT Serif', Georgia, serif;
    font-size: 11pt;
    font-weight: 700;
    color: #0d0d1f;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-bottom: 0.8pt solid #c8c8d8;
    padding-bottom: 2pt;
    flex: 1;
    margin: 0;
}

/* ── БЛОК SUMMARY ── */
.summary-text {
    font-size: 10.5pt;
    line-height: 1.6;
    color: #2a2a2a;
    border-left: 2.5pt solid #E8962A;
    padding-left: 9pt;
    margin: 0;
}

/* ── ОПЫТ РАБОТЫ ── */
.job-entry { margin-bottom: 10pt; }

.job-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 1pt;
}

.job-company {
    font-weight: 700;
    font-size: 11pt;
    color: #0d0d1f;
}

.job-period {
    font-size: 9.5pt;
    color: #888;
    flex-shrink: 0;
    margin-left: 8pt;
}

.job-position {
    font-size: 10.5pt;
    color: #555;
    font-style: italic;
    margin-bottom: 4pt;
}

/* ── КРИТИЧНО: буллеты на отдельных строках ── */
.job-bullets {
    margin: 0;
    padding: 0;
    list-style: none;
}

.job-bullets li {
    font-size: 10.5pt;
    line-height: 1.55;
    color: #2a2a2a;
    padding-left: 12pt;
    position: relative;
    margin-bottom: 2pt;
}

.job-bullets li::before {
    content: '—';
    position: absolute;
    left: 0;
    color: #E8962A;
    font-weight: 700;
}

/* ── ОБРАЗОВАНИЕ ── */
.edu-entry {
    font-size: 10.5pt;
    color: #2a2a2a;
    line-height: 1.5;
}

.edu-institution { font-weight: 700; color: #0d0d1f; }
.edu-degree { color: #555; }

/* ── НАВЫКИ ── */
.skills-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 5pt;
}

.skill-tag {
    background: #f2f2f6;
    border: 0.5pt solid #d8d8e8;
    border-radius: 3pt;
    padding: 2.5pt 8pt;
    font-size: 9.5pt;
    color: #333;
    white-space: nowrap;
}

/* ── ЗАРПЛАТА И ЯЗЫКИ ── */
.meta-row {
    font-size: 10pt;
    color: #555;
    margin-top: 4pt;
}

.meta-label {
    font-weight: 600;
    color: #0d0d1f;
    margin-right: 4pt;
}
"""


def generate_pdf(resume_data: dict, template_name: str = "classic") -> bytes:
    env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))
    template = env.get_template(f"resume_{template_name}.html")
    html_content = template.render(resume=resume_data)
    return HTML(string=html_content).write_pdf(stylesheets=[CSS(string=get_pdf_styles())])
