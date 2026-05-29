import re
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from weasyprint import CSS, HTML

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"


def _split_bullets(text: str) -> list[str]:
    if not text:
        return []
    parts = re.split(r"[•·\n]+", text)
    return [p.strip() for p in parts if p.strip()]


def get_pdf_styles() -> str:
    return """
    @page { size: A4; margin: 0; }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
        font-family: 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif;
        font-size: 9.5pt;
        line-height: 1.45;
        color: #2c2c2c;
        background: #ffffff;
    }

    /* Layout */
    .page-layout { display: flex; width: 100%; min-height: 297mm; }

    .sidebar {
        width: 30%;
        min-width: 30%;
        background: #0d1f14;
        color: #ffffff;
        padding: 24px 16px;
        display: flex;
        flex-direction: column;
        gap: 18px;
    }

    .main-content {
        flex: 1;
        padding: 24px 22px 24px 20px;
        background: #ffffff;
    }

    /* Sidebar — section titles */
    .sidebar .section-title {
        font-size: 6.5pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1.2px;
        color: #2de08a;
        margin-bottom: 6px;
        padding-bottom: 3px;
        border-bottom: 1px solid rgba(45, 224, 138, 0.2);
    }

    /* Contacts */
    .contact-item {
        font-size: 8pt;
        color: rgba(255,255,255,0.82);
        margin-bottom: 5px;
        line-height: 1.3;
        word-break: break-all;
    }
    .contact-label {
        font-size: 6.5pt;
        color: rgba(255,255,255,0.4);
        text-transform: uppercase;
        letter-spacing: 0.4px;
        display: block;
        margin-bottom: 1px;
    }

    /* Salary block */
    .salary-block {
        background: rgba(45, 224, 138, 0.1);
        border: 1px solid rgba(45, 224, 138, 0.22);
        border-radius: 5px;
        padding: 7px 9px;
    }
    .salary-value {
        font-size: 11.5pt;
        font-weight: 700;
        color: #2de08a;
        line-height: 1.1;
    }
    .salary-label {
        font-size: 6.5pt;
        color: rgba(255,255,255,0.38);
        text-transform: uppercase;
        letter-spacing: 0.4px;
        margin-top: 2px;
    }

    /* Skills */
    .skills-list { display: flex; flex-wrap: wrap; gap: 3px; }
    .skill-chip {
        background: rgba(45, 224, 138, 0.09);
        border: 1px solid rgba(45, 224, 138, 0.18);
        border-radius: 3px;
        padding: 2px 5px;
        font-size: 7pt;
        color: rgba(255,255,255,0.82);
        line-height: 1.4;
    }

    /* Languages */
    .lang-item {
        font-size: 8pt;
        color: rgba(255,255,255,0.82);
        margin-bottom: 3px;
        padding-left: 8px;
        position: relative;
    }
    .lang-item::before { content: '·'; position: absolute; left: 0; color: #2de08a; font-weight: 700; }

    /* Certificates */
    .cert-item {
        font-size: 7.5pt;
        color: rgba(255,255,255,0.72);
        margin-bottom: 3px;
        padding-left: 10px;
        position: relative;
        line-height: 1.3;
    }
    .cert-item::before { content: '✓'; position: absolute; left: 0; color: #2de08a; font-size: 6.5pt; }

    /* Main — Hero */
    .hero-section {
        border-bottom: 2px solid #0d1f14;
        padding-bottom: 10px;
        margin-bottom: 14px;
    }
    .main-name {
        font-size: 17pt;
        font-weight: 700;
        color: #0d1f14;
        line-height: 1.15;
        letter-spacing: -0.3px;
    }
    .main-position {
        font-size: 10pt;
        color: #16a34a;
        font-weight: 600;
        margin-top: 2px;
    }

    /* Main — section titles */
    .main-content .section-title {
        font-size: 7.5pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.9px;
        color: #0d1f14;
        margin-bottom: 8px;
        padding-bottom: 3px;
        border-bottom: 2px solid #2de08a;
        display: inline-block;
    }
    .section-block { margin-bottom: 14px; }

    /* Summary */
    .summary-text {
        font-size: 9pt;
        color: #374151;
        line-height: 1.55;
        background: #f7fdf9;
        border-left: 3px solid #2de08a;
        padding: 7px 10px;
        border-radius: 0 4px 4px 0;
    }

    /* Experience */
    .experience-entry {
        margin-bottom: 11px;
        padding-bottom: 9px;
        border-bottom: 1px solid #f0f0f0;
    }
    .experience-entry:last-child { border-bottom: none; margin-bottom: 0; }

    .exp-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 6px;
        margin-bottom: 1px;
    }
    .exp-company { font-size: 9.5pt; font-weight: 700; color: #0d1f14; flex: 1; }
    .exp-period { font-size: 7pt; color: #6b7280; white-space: nowrap; font-style: italic; }
    .exp-position { font-size: 8.5pt; color: #16a34a; font-weight: 600; margin-bottom: 4px; }

    .exp-bullets { list-style: none; padding: 0; }
    .exp-bullets li {
        font-size: 8.5pt;
        color: #374151;
        line-height: 1.45;
        padding-left: 10px;
        position: relative;
        margin-bottom: 2px;
    }
    .exp-bullets li::before {
        content: '·';
        position: absolute;
        left: 1px;
        color: #2de08a;
        font-size: 11pt;
        line-height: 1.1;
        font-weight: 700;
    }

    /* Education */
    .edu-entry { margin-bottom: 7px; }
    .edu-institution { font-size: 9pt; font-weight: 700; color: #0d1f14; }
    .edu-details { font-size: 8pt; color: #6b7280; margin-top: 1px; }

    /* Footer */
    .page-footer {
        position: fixed;
        bottom: 0; left: 0; right: 0;
        height: 18px;
        background: #0d1f14;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .footer-text {
        font-size: 6pt;
        color: rgba(255,255,255,0.3);
        letter-spacing: 1px;
        text-transform: uppercase;
    }
    """


def generate_pdf(resume_data: dict, template_name: str = "classic") -> bytes:
    salary = resume_data.get("salary", "")
    if salary:
        salary_clean = re.sub(r"[^\d\s]", "", str(salary)).strip()
        if salary_clean:
            resume_data["salary"] = salary_clean + " ₽/мес"

    env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))
    env.filters["split_bullets"] = _split_bullets
    template = env.get_template(f"resume_{template_name}.html")
    html_content = template.render(resume=resume_data)
    return HTML(string=html_content).write_pdf(stylesheets=[CSS(string=get_pdf_styles())])
