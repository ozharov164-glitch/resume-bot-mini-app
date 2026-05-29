from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from weasyprint import CSS, HTML

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"


def get_pdf_styles() -> str:
    return """
    @page { size: A4; margin: 20mm 15mm 20mm 20mm; }
    body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1a1a1a; }
    h1 { font-size: 22pt; color: #1a1a2e; margin: 0 0 4pt 0; }
    .position { font-size: 13pt; color: #4a4a6a; margin: 0 0 16pt 0; }
    .section-title { font-size: 13pt; color: #1a1a2e; border-bottom: 1.5pt solid #1a1a2e;
      padding-bottom: 3pt; margin: 14pt 0 8pt 0; text-transform: uppercase; letter-spacing: 0.5pt; }
    .contact-row { font-size: 10pt; color: #555; margin-bottom: 2pt; }
    .job-header { display: flex; justify-content: space-between; margin-bottom: 3pt; }
    .job-company { font-weight: bold; color: #1a1a2e; }
    .job-period { color: #777; font-size: 10pt; }
    .skills-grid { display: flex; flex-wrap: wrap; gap: 4pt; }
    .skill-tag { background: #f0f0f5; border-radius: 3pt; padding: 2pt 7pt; font-size: 10pt; }
    """


def generate_pdf(resume_data: dict, template_name: str = "classic") -> bytes:
    env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)))
    template = env.get_template(f"resume_{template_name}.html")
    html_content = template.render(resume=resume_data)
    return HTML(string=html_content).write_pdf(stylesheets=[CSS(string=get_pdf_styles())])
