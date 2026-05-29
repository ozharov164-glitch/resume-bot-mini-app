import re
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from weasyprint import CSS, HTML

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"

BRAND_PRIMARY = "#006c49"
BRAND_BRIGHT = "#10b981"
TEXT_DARK = "#161d19"
TEXT_MUTED = "#4a5c52"


def get_pdf_styles() -> str:
    # Color tokens
    SIDEBAR_BG    = "#0d1f14"   # deep dark forest green
    SIDEBAR_TITLE = "#2de08a"   # bright mint — section titles on dark
    SIDEBAR_TEXT  = "#c8e0d0"   # light cream — body text on dark
    SIDEBAR_MUTED = "#6ea882"   # muted sage — labels, secondary
    SIDEBAR_CHIP_BG     = "rgba(255,255,255,0.09)"
    SIDEBAR_CHIP_BORDER = "rgba(255,255,255,0.22)"
    BRAND_PRIMARY = "#006c49"   # section titles on white, position
    BRAND_ACCENT  = "#1a8a52"   # divider, subtle accents
    TEXT_DARK     = "#0a1a0f"   # near-black (slightly green)
    TEXT_BODY     = "#2c3a30"   # body text
    TEXT_MUTED    = "#5a7060"   # muted — periods, labels

    return f"""
@page {{
    size: A4;
    margin: 16mm 13mm 14mm 13mm;
}}

* {{
    box-sizing: border-box;
}}

body {{
    font-family: 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.55;
    color: {TEXT_DARK};
    margin: 0;
    padding: 0;
}}

/* ─── LAYOUT ─────────────────────────────────────────── */

.page-layout {{
    display: flex;
    align-items: stretch;
    gap: 16pt;
    min-height: 240mm;
}}

/* ─── SIDEBAR ────────────────────────────────────────── */

.sidebar {{
    width: 29%;
    flex-shrink: 0;
    background: {SIDEBAR_BG};
    border-radius: 5pt;
    padding: 14pt 11pt 14pt 11pt;
}}

.sidebar-block {{
    margin-bottom: 13pt;
    break-inside: avoid;
}}

.sidebar-title {{
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: {SIDEBAR_TITLE};
    border-bottom: 0.5pt solid rgba(45,224,138,0.35);
    padding-bottom: 3.5pt;
    margin-bottom: 6pt;
}}

.sidebar-line {{
    font-size: 9pt;
    color: {SIDEBAR_TEXT};
    line-height: 1.55;
    margin-bottom: 4pt;
    word-break: break-word;
}}

.sidebar-line .label {{
    font-size: 7.5pt;
    font-weight: 700;
    color: {SIDEBAR_MUTED};
    text-transform: uppercase;
    letter-spacing: 0.06em;
    display: block;
    margin-bottom: 1pt;
}}

/* Зарплата — выделить ярче */
.sidebar-block.salary-block .sidebar-line {{
    font-size: 11pt;
    font-weight: 700;
    color: {SIDEBAR_TITLE};
    letter-spacing: -0.2pt;
}}

/* Навыки — chips на тёмном фоне */
.skills-grid {{
    display: flex;
    flex-wrap: wrap;
    gap: 4pt;
}}

.skill-tag {{
    background: {SIDEBAR_CHIP_BG};
    border: 0.5pt solid {SIDEBAR_CHIP_BORDER};
    border-radius: 3pt;
    padding: 2.5pt 6pt;
    font-size: 8pt;
    color: {SIDEBAR_TEXT};
    word-break: break-word;
    white-space: normal;
    max-width: 100%;
}}

/* ─── MAIN AREA ──────────────────────────────────────── */

.main {{
    flex: 1;
    min-width: 0;
}}

/* ─── HERO ───────────────────────────────────────────── */

.hero {{
    margin-bottom: 13pt;
    padding-bottom: 10pt;
    border-bottom: 1pt solid #c8ddd2;
}}

h1 {{
    font-size: 23pt;
    font-weight: 700;
    color: {TEXT_DARK};
    margin: 0 0 3pt 0;
    letter-spacing: -0.4pt;
    line-height: 1.08;
}}

.position {{
    font-size: 11pt;
    color: {BRAND_PRIMARY};
    font-weight: 600;
    letter-spacing: 0.02em;
    margin: 0;
}}

/* убрать старый градиентный divider — теперь border-bottom в .hero */
.hero-divider {{
    display: none;
}}

/* ─── SECTIONS ───────────────────────────────────────── */

.section {{
    margin-bottom: 12pt;
    break-inside: avoid-page;
}}

.section-header {{
    display: flex;
    align-items: center;
    gap: 0;
    margin-bottom: 6pt;
    border-bottom: 0.5pt solid #c8ddd2;
    padding-bottom: 3pt;
}}

/* убрать старый marker — теперь не нужен */
.section-marker {{
    display: none;
}}

.section-title {{
    font-size: 8.5pt;
    font-weight: 700;
    color: {BRAND_PRIMARY};
    text-transform: uppercase;
    letter-spacing: 0.12em;
    margin: 0;
    padding: 0;
    border: none;
    flex: 1;
}}

/* ─── SUMMARY ────────────────────────────────────────── */

.summary-text {{
    font-size: 9.5pt;
    line-height: 1.70;
    color: {TEXT_BODY};
    margin: 0;
    padding: 0;
}}

/* ─── EXPERIENCE ─────────────────────────────────────── */

.job-entry {{
    margin-bottom: 10pt;
    break-inside: avoid;
}}

.job-header {{
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 1pt;
}}

.job-company {{
    font-weight: 700;
    font-size: 10.5pt;
    color: {TEXT_DARK};
    letter-spacing: -0.1pt;
}}

.job-period {{
    font-size: 8.5pt;
    color: {TEXT_MUTED};
    flex-shrink: 0;
    margin-left: 8pt;
    font-style: italic;
}}

.job-position {{
    font-size: 9.5pt;
    color: {BRAND_PRIMARY};
    font-weight: 600;
    margin-bottom: 4pt;
    letter-spacing: 0.01em;
}}

.job-bullets {{
    margin: 0;
    padding: 0;
    list-style: none;
}}

.job-bullets li {{
    font-size: 9.5pt;
    line-height: 1.58;
    color: {TEXT_BODY};
    padding-left: 12pt;
    position: relative;
    margin-bottom: 2.5pt;
}}

.job-bullets li::before {{
    content: '·';
    position: absolute;
    left: 2pt;
    color: {BRAND_ACCENT};
    font-size: 14pt;
    line-height: 0.85;
    font-weight: 700;
}}

/* ─── EDUCATION ──────────────────────────────────────── */

.edu-entry {{
    font-size: 9.5pt;
    color: {TEXT_BODY};
    line-height: 1.55;
    margin-bottom: 4pt;
    padding-left: 12pt;
    position: relative;
}}

.edu-entry::before {{
    content: '·';
    position: absolute;
    left: 2pt;
    color: {BRAND_ACCENT};
    font-size: 14pt;
    line-height: 0.85;
    font-weight: 700;
}}

.edu-institution {{ font-weight: 700; color: {TEXT_DARK}; }}
.edu-degree {{ color: {TEXT_MUTED}; }}

/* ─── FOOTER ─────────────────────────────────────────── */

.footer {{
    margin-top: 12pt;
    padding-top: 5pt;
    border-top: 0.5pt solid #d4e8db;
    font-size: 7pt;
    color: #9aab9f;
    text-align: center;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}}
"""


def generate_pdf(resume_data: dict, template_name: str = "classic") -> bytes:
    salary = resume_data.get("salary", "")
    if salary:
        salary_clean = re.sub(r"[^\d\s]", "", str(salary)).strip()
        if salary_clean:
            resume_data["salary"] = salary_clean + " ₽/мес"

    env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))
    template = env.get_template(f"resume_{template_name}.html")
    html_content = template.render(resume=resume_data)
    return HTML(string=html_content).write_pdf(stylesheets=[CSS(string=get_pdf_styles())])
