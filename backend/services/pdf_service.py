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
    return f"""
@page {{
    size: A4;
    margin: 18mm 14mm 16mm 14mm;
}}

body {{
    font-family: 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.55;
    color: {TEXT_DARK};
    margin: 0;
}}

.page-layout {{
    display: flex;
    align-items: flex-start;
    gap: 14pt;
}}

.sidebar {{
    width: 30%;
    flex-shrink: 0;
    background: #f4faf7;
    border: 0.5pt solid #d4ebe2;
    border-radius: 6pt;
    padding: 10pt 9pt;
}}

.main {{
    flex: 1;
    min-width: 0;
}}

.sidebar-block {{
    margin-bottom: 10pt;
    break-inside: avoid;
}}

.sidebar-title {{
    font-size: 8.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: {BRAND_PRIMARY};
    border-bottom: 1pt solid {BRAND_BRIGHT};
    padding-bottom: 3pt;
    margin-bottom: 5pt;
}}

.sidebar-line {{
    font-size: 9pt;
    color: {TEXT_MUTED};
    line-height: 1.5;
    margin-bottom: 3pt;
}}

.sidebar-line .label {{
    font-weight: 700;
    color: {TEXT_DARK};
    display: block;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}}

.hero {{
    margin-bottom: 10pt;
}}

h1 {{
    font-size: 22pt;
    font-weight: 700;
    color: {TEXT_DARK};
    margin: 0 0 2pt 0;
    letter-spacing: -0.2pt;
    line-height: 1.05;
}}

.position {{
    font-size: 11.5pt;
    color: {BRAND_PRIMARY};
    margin: 0;
    font-weight: 600;
}}

.hero-divider {{
    height: 2.5pt;
    background: linear-gradient(90deg, {BRAND_PRIMARY} 0%, {BRAND_BRIGHT} 70%, transparent 100%);
    border-radius: 2pt;
    margin-top: 8pt;
}}

.section {{
    margin-bottom: 11pt;
    break-inside: avoid-page;
}}

.section-header {{
    display: flex;
    align-items: center;
    gap: 6pt;
    margin-bottom: 5pt;
}}

.section-marker {{
    width: 3pt;
    height: 13pt;
    background: {BRAND_BRIGHT};
    border-radius: 2pt;
    flex-shrink: 0;
}}

.section-title {{
    font-size: 10pt;
    font-weight: 700;
    color: {BRAND_PRIMARY};
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-bottom: 0.6pt solid #c8e6d8;
    padding-bottom: 2pt;
    flex: 1;
    margin: 0;
}}

.summary-text {{
    font-size: 10pt;
    line-height: 1.65;
    color: #2a3530;
    border-left: 2.5pt solid {BRAND_BRIGHT};
    padding-left: 8pt;
    margin: 0;
}}

.job-entry {{
    margin-bottom: 9pt;
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
}}

.job-period {{
    font-size: 9pt;
    color: #7a8a82;
    flex-shrink: 0;
    margin-left: 6pt;
}}

.job-position {{
    font-size: 10pt;
    color: {BRAND_PRIMARY};
    font-weight: 600;
    margin-bottom: 3pt;
}}

.job-bullets {{
    margin: 0;
    padding: 0;
    list-style: none;
}}

.job-bullets li {{
    font-size: 9.5pt;
    line-height: 1.55;
    color: #2a3530;
    padding-left: 11pt;
    position: relative;
    margin-bottom: 2pt;
}}

.job-bullets li::before {{
    content: '—';
    position: absolute;
    left: 0;
    color: {BRAND_BRIGHT};
    font-weight: 700;
}}

.edu-entry {{
    font-size: 10pt;
    color: #2a3530;
    line-height: 1.5;
    margin-bottom: 3pt;
}}

.edu-institution {{ font-weight: 700; color: {TEXT_DARK}; }}
.edu-degree {{ color: {TEXT_MUTED}; }}

.skills-grid {{
    display: flex;
    flex-wrap: wrap;
    gap: 4pt;
}}

.skill-tag {{
    background: #ffffff;
    border: 0.5pt solid #b8ddd0;
    border-radius: 3pt;
    padding: 2pt 6pt;
    font-size: 8.5pt;
    color: {BRAND_PRIMARY};
    word-break: break-word;
    white-space: normal;
    max-width: 100%;
}}

.footer {{
    margin-top: 10pt;
    padding-top: 6pt;
    border-top: 0.5pt solid #d4ebe2;
    font-size: 7.5pt;
    color: #9aab9f;
    text-align: center;
    letter-spacing: 0.06em;
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
