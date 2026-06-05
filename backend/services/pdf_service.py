import io
import logging
import re
import urllib.request
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from weasyprint import CSS, HTML
from weasyprint.text.fonts import FontConfiguration

from models.schemas import VALID_TEMPLATES
from services.resume_text_utils import split_bullets as _split_bullets

try:
    import pymupdf as fitz
except ImportError:  # pragma: no cover
    fitz = None  # type: ignore[assignment]

logger = logging.getLogger(__name__)

TEMPLATES_DIR = Path(__file__).parent.parent / "templates"
from services.font_assets import FONTS_DIR, FONT_FILES, ensure_fonts

# Cached Jinja2 environment — parse templates once per process
_jinja_env: Environment | None = None


def _get_jinja_env() -> Environment:
    global _jinja_env
    if _jinja_env is None:
        env = Environment(loader=FileSystemLoader(str(TEMPLATES_DIR)), autoescape=True)
        env.filters["split_bullets"] = _split_bullets
        _jinja_env = env
    return _jinja_env


def _font_face_css() -> str:
    """Return @font-face CSS if Nunito Sans fonts are available."""
    if not (FONTS_DIR / "NunitoSans-Regular.ttf").exists():
        return ""

    def font_url(name: str) -> str:
        return f"file://{FONTS_DIR / name}"

    return f"""
@font-face {{
    font-family: 'NunitoSans';
    font-style: normal;
    font-weight: 400;
    src: url("{font_url('NunitoSans-Regular.ttf')}") format("truetype");
}}
@font-face {{
    font-family: 'NunitoSans';
    font-style: normal;
    font-weight: 600;
    src: url("{font_url('NunitoSans-SemiBold.ttf')}") format("truetype");
}}
@font-face {{
    font-family: 'NunitoSans';
    font-style: normal;
    font-weight: 700;
    src: url("{font_url('NunitoSans-Bold.ttf')}") format("truetype");
}}
@font-face {{
    font-family: 'NunitoSans';
    font-style: italic;
    font-weight: 400;
    src: url("{font_url('NunitoSans-Italic.ttf')}") format("truetype");
}}
"""


def get_pdf_styles() -> str:
    font_face = _font_face_css()
    font_stack = "'NunitoSans', 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif"

    return font_face + f"""
    @page {{
        size: A4;
        margin: 8mm 10mm;
        @bottom-center {{
            content: counter(page);
            font-family: {font_stack};
            font-size: 7pt;
            color: rgba(112,117,121,0.5);
        }}
    }}
    @page :first {{
        @bottom-center {{ content: none; }}
    }}

    * {{ box-sizing: border-box; margin: 0; padding: 0; }}

    body {{
        font-family: {font_stack};
        font-size: 10pt;
        line-height: 1.45;
        color: #2c2c2c;
        background: #ffffff;
        hyphens: auto;
        -webkit-hyphens: auto;
        overflow-wrap: anywhere;
        word-break: normal;
    }}
    """ + """
    /* Layout */
    .page-layout { display: flex; width: 100%; min-height: 297mm; }

    .sidebar {
        width: 30%;
        min-width: 30%;
        background: #0d1f14;
        color: #ffffff;
        padding: 24px 18px;
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .main-content {
        flex: 1;
        padding: 24px 20px;
        background: #ffffff;
        min-height: 220mm;
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
        overflow-wrap: anywhere;
        word-break: normal;
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
        font-size: 19pt;
        font-weight: 700;
        color: #0d1f14;
        line-height: 1.15;
        letter-spacing: 0;
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
    .section-block { margin-bottom: 13pt; }

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
        margin-bottom: 10px;
        padding-bottom: 8px;
        border-bottom: 1px solid #f0f0f0;
        page-break-inside: avoid;
    }
    .experience-entry:last-child { border-bottom: none; margin-bottom: 0; }

    .achievement-list { list-style: none; padding: 0; margin: 0; }
    .achievement-list li {
        font-size: 8.5pt;
        color: #374151;
        line-height: 1.45;
        padding-left: 10px;
        position: relative;
        margin-bottom: 3px;
    }
    .achievement-list li::before {
        content: '·';
        position: absolute;
        left: 1px;
        color: #2de08a;
        font-weight: 700;
    }

    .exp-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 4px 8px;
        margin-bottom: 2px;
    }
    .exp-company {
        font-size: 9.5pt;
        font-weight: 700;
        color: #0d1f14;
        flex: 1 1 55%;
        min-width: 0;
        overflow-wrap: anywhere;
    }
    .exp-period {
        font-size: 7pt;
        color: #6b7280;
        white-space: nowrap;
        font-style: italic;
        flex: 0 0 auto;
        max-width: 42%;
        text-align: right;
    }
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
    .edu-entry { margin-bottom: 7px; page-break-inside: avoid; }
    .edu-institution { font-size: 9pt; font-weight: 700; color: #0d1f14; }
    .edu-details { font-size: 8pt; color: #6b7280; margin-top: 1px; }
    """


def get_modern_pdf_styles() -> str:
    font_face = _font_face_css()
    font_stack = "'NunitoSans', 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif"
    accent = "#2563EB"

    return font_face + f"""
    @page {{
        size: A4;
        margin: 14mm 16mm 18mm 16mm;
        @bottom-center {{
            content: counter(page);
            font-family: {font_stack};
            font-size: 7pt;
            color: rgba(75,85,99,0.5);
        }}
    }}
    @page :first {{
        @bottom-center {{ content: none; }}
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
        font-family: {font_stack};
        font-size: 10.5pt;
        line-height: 1.4;
        color: #1f2937;
        background: #ffffff;
        hyphens: auto;
        -webkit-hyphens: auto;
        overflow-wrap: anywhere;
        word-break: normal;
    }}
    .modern-header {{
        margin-bottom: 14pt;
        padding-bottom: 8pt;
        border-bottom: 2pt solid {accent};
    }}
    .modern-name {{
        font-size: 24pt;
        font-weight: 700;
        color: #111827;
        line-height: 1.1;
        letter-spacing: 0;
    }}
    .modern-meta {{
        margin-top: 6pt;
        font-size: 8.5pt;
        color: #4b5563;
    }}
    .modern-meta .sep {{ color: {accent}; margin: 0 4pt; }}
    .section-block {{ margin-bottom: 12pt; }}
    .section-title {{
        font-size: 7.5pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #111827;
        padding-bottom: 3pt;
        margin-bottom: 6pt;
        border-bottom: 1.5pt solid {accent};
    }}
    .summary-text {{
        font-size: 8.5pt;
        color: #374151;
        line-height: 1.5;
    }}
    .skills-list {{ display: flex; flex-wrap: wrap; gap: 3pt; }}
    .skill-chip {{
        background: #eff6ff;
        border: 0.5pt solid #bfdbfe;
        border-radius: 3pt;
        padding: 2pt 5pt;
        font-size: 8pt;
        color: #1e40af;
        line-height: 1.35;
    }}
    .achievement-list {{ list-style: none; padding: 0; margin: 0; }}
    .achievement-list li {{
        font-size: 8.5pt;
        color: #374151;
        line-height: 1.45;
        padding-left: 9pt;
        position: relative;
        margin-bottom: 2pt;
    }}
    .achievement-list li::before {{
        content: '•';
        position: absolute;
        left: 0;
        color: {accent};
        font-weight: 700;
    }}
    .experience-entry {{
        margin-bottom: 8pt;
        padding-bottom: 6pt;
        border-bottom: 0.5pt solid #e5e7eb;
        page-break-inside: avoid;
    }}
    .experience-entry:last-child {{ border-bottom: none; }}
    .exp-header {{
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 4pt 8pt;
    }}
    .exp-company {{
        font-size: 9pt;
        font-weight: 700;
        color: #111827;
        flex: 1 1 55%;
        min-width: 0;
        overflow-wrap: anywhere;
    }}
    .exp-period {{
        font-size: 7pt;
        color: #6b7280;
        white-space: nowrap;
        flex: 0 0 auto;
        max-width: 42%;
        text-align: right;
    }}
    .exp-position {{ font-size: 8pt; color: {accent}; font-weight: 600; margin: 2pt 0 3pt; }}
    .exp-bullets {{ list-style: none; padding: 0; }}
    .exp-bullets li {{
        font-size: 8pt;
        color: #374151;
        padding-left: 9pt;
        position: relative;
        margin-bottom: 1pt;
        line-height: 1.4;
    }}
    .exp-bullets li::before {{
        content: '•';
        position: absolute;
        left: 0;
        color: {accent};
        font-weight: 700;
    }}
    .edu-entry {{ margin-bottom: 5pt; page-break-inside: avoid; }}
    .edu-institution {{ font-size: 8.5pt; font-weight: 700; color: #111827; }}
    .edu-details {{ font-size: 7.5pt; color: #6b7280; }}
    .lang-item, .cert-item {{
        font-size: 8pt;
        color: #374151;
        margin-bottom: 2pt;
    }}
    """


def get_compact_pdf_styles() -> str:
    font_face = _font_face_css()
    font_stack = "'NunitoSans', 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif"
    accent = "#7C3AED"

    return font_face + f"""
    @page {{
        size: A4;
        margin: 8mm 10mm;
        @bottom-center {{
            content: counter(page);
            font-family: {font_stack};
            font-size: 6.5pt;
            color: rgba(112,117,121,0.45);
        }}
    }}
    @page :first {{
        @bottom-center {{ content: none; }}
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
        font-family: {font_stack};
        font-size: 9.5pt;
        line-height: 1.4;
        color: #1f2937;
        background: #ffffff;
        hyphens: auto;
        -webkit-hyphens: auto;
        overflow-wrap: anywhere;
        word-break: normal;
    }}
    .page-layout {{ display: flex; width: 100%; min-height: 297mm; }}
    .sidebar {{
        width: 32%;
        min-width: 32%;
        background: #f8f8f8;
        color: #1f2937;
        padding: 20px 16px;
        display: flex;
        flex-direction: column;
        gap: 14px;
    }}
    .main-content {{
        flex: 1;
        padding: 20px 16px;
        background: #ffffff;
    }}
    .sidebar .section-title {{
        font-size: 6pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: {accent};
        margin-bottom: 5px;
        padding-bottom: 2px;
        border-bottom: 1pt solid #e5e7eb;
    }}
    .contact-item {{
        font-size: 7.5pt;
        color: #374151;
        margin-bottom: 4px;
        line-height: 1.3;
        overflow-wrap: anywhere;
        word-break: normal;
    }}
    .contact-label {{
        font-size: 6pt;
        color: #9ca3af;
        text-transform: uppercase;
        display: block;
        margin-bottom: 1px;
    }}
    .salary-block {{
        background: #f3e8ff;
        border-left: 2pt solid {accent};
        padding: 6px 8px;
    }}
    .salary-value {{ font-size: 10pt; font-weight: 700; color: {accent}; }}
    .salary-label {{ font-size: 6pt; color: #6b7280; margin-top: 1px; }}
    .skills-list {{ display: flex; flex-wrap: wrap; gap: 2px; }}
    .skill-chip {{
        background: #ede9fe;
        border: 0.5pt solid #ddd6fe;
        border-radius: 2px;
        padding: 1px 4px;
        font-size: 6.5pt;
        color: #4c1d95;
    }}
    .lang-item, .cert-item {{
        font-size: 7pt;
        color: #374151;
        margin-bottom: 2px;
        padding-left: 8px;
        position: relative;
    }}
    .lang-item::before, .cert-item::before {{
        content: '·';
        position: absolute;
        left: 0;
        color: {accent};
        font-weight: 700;
    }}
    .hero-section {{
        border-bottom: 1.5pt solid {accent};
        padding-bottom: 8px;
        margin-bottom: 12px;
    }}
    .main-name {{
        font-size: 16pt;
        font-weight: 700;
        color: #111827;
        line-height: 1.15;
        letter-spacing: 0;
    }}
    .main-position {{
        font-size: 9pt;
        color: {accent};
        font-weight: 600;
        margin-top: 2px;
    }}
    .main-content .section-title {{
        font-size: 7pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: #111827;
        margin-bottom: 6px;
        padding-bottom: 2px;
        border-bottom: 1pt solid {accent};
    }}
    .section-block {{ margin-bottom: 11pt; }}
    .summary-text {{
        font-size: 8pt;
        color: #374151;
        line-height: 1.45;
    }}
    .achievement-list {{ list-style: none; padding: 0; margin: 0; }}
    .achievement-list li {{
        font-size: 7.5pt;
        color: #374151;
        line-height: 1.4;
        padding-left: 9px;
        position: relative;
        margin-bottom: 2px;
    }}
    .achievement-list li::before {{
        content: '·';
        position: absolute;
        left: 0;
        color: {accent};
        font-weight: 700;
    }}
    .experience-entry {{
        margin-bottom: 8px;
        padding-bottom: 6px;
        border-bottom: 0.5pt solid #f0f0f0;
        page-break-inside: avoid;
    }}
    .experience-entry:last-child {{ border-bottom: none; }}
    .exp-header {{
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 4px 6px;
    }}
    .exp-company {{
        font-size: 8.5pt;
        font-weight: 700;
        color: #111827;
        flex: 1 1 55%;
        min-width: 0;
        overflow-wrap: anywhere;
    }}
    .exp-period {{
        font-size: 6.5pt;
        color: #6b7280;
        white-space: nowrap;
        flex: 0 0 auto;
        max-width: 42%;
        text-align: right;
    }}
    .exp-position {{ font-size: 7.5pt; color: {accent}; font-weight: 600; margin-bottom: 3px; }}
    .exp-bullets {{ list-style: none; padding: 0; }}
    .exp-bullets li {{
        font-size: 7.5pt;
        color: #374151;
        padding-left: 9px;
        position: relative;
        margin-bottom: 1px;
        line-height: 1.35;
    }}
    .exp-bullets li::before {{
        content: '·';
        position: absolute;
        left: 0;
        color: {accent};
        font-weight: 700;
    }}
    .edu-entry {{ margin-bottom: 5px; page-break-inside: avoid; }}
    .edu-institution {{ font-size: 8pt; font-weight: 700; color: #111827; }}
    .edu-details {{ font-size: 7pt; color: #6b7280; }}
    """


def get_preview_watermark_styles() -> str:
    return """
    .preview-watermark-layer {
        position: fixed;
        inset: 0;
        z-index: 9999;
        pointer-events: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='160'%3E%3Ctext x='50%25' y='50%25' font-family='DejaVu Sans,Arial,sans-serif' font-size='26' font-weight='800' fill='%230d1f14' fill-opacity='0.50' text-anchor='middle' dominant-baseline='middle' transform='rotate(-32 150 80)'%3E%D0%9F%D0%A0%D0%95%D0%94%D0%9F%D0%A0%D0%9E%D0%A1%D0%9C%D0%9E%D0%A2%D0%A0%3C/text%3E%3C/svg%3E");
        background-repeat: repeat;
    }

    .preview-watermark-stripes {
        position: fixed;
        inset: 0;
        z-index: 9998;
        pointer-events: none;
        opacity: 0.25;
        background-image: repeating-linear-gradient(
            -35deg,
            rgba(13, 31, 20, 0.08) 0,
            rgba(13, 31, 20, 0.08) 2px,
            transparent 2px,
            transparent 14px
        );
    }

    .preview-center-watermark {
        position: fixed;
        inset: 0;
        z-index: 10000;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'NunitoSans', 'DejaVu Sans', Arial, sans-serif;
        font-size: 52pt;
        font-weight: 800;
        letter-spacing: 0.12em;
        color: rgba(13, 31, 20, 0.42);
        transform: rotate(-28deg);
        white-space: nowrap;
    }

    .preview-fade-layer {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        height: 65%;
        z-index: 10001;
        pointer-events: none;
        background: linear-gradient(
            to bottom,
            transparent 30%,
            rgba(255, 255, 255, 0.95) 55%,
            white 65%
        );
    }
    """


def _normalize_salary(resume_data: dict) -> dict:
    data = dict(resume_data)
    salary = data.get("salary", "")
    if salary:
        salary_clean = re.sub(r"[^\d\s]", "", str(salary)).strip()
        if salary_clean:
            data["salary"] = salary_clean + " ₽/мес"
    return data


def _render_document(resume_data: dict, template_name: str = "classic", *, preview: bool = False):
    data = _normalize_salary(resume_data)
    if template_name not in VALID_TEMPLATES:
        template_name = "classic"
    env = _get_jinja_env()
    template = env.get_template(f"resume_{template_name}.html")
    html_content = template.render(resume=data, preview=preview)
    if template_name == "modern":
        styles = get_modern_pdf_styles()
    elif template_name == "compact":
        styles = get_compact_pdf_styles()
    else:
        styles = get_pdf_styles()
    if preview:
        styles += get_preview_watermark_styles()

    font_config = FontConfiguration()
    css = CSS(string=styles, font_config=font_config)

    return HTML(string=html_content).render(
        stylesheets=[css],
        font_config=font_config,
    )


def generate_pdf(resume_data: dict, template_name: str = "classic") -> bytes:
    return _render_document(resume_data, template_name, preview=False).write_pdf(
        presentational_hints=True,
    )


def _pdf_bytes_to_png(pdf_bytes: bytes, *, resolution: int = 110) -> bytes:
    """Rasterize first PDF page to PNG (WeasyPrint 53+ has no write_png)."""
    if fitz is None:
        raise RuntimeError("pymupdf is required for PNG preview export")

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        if doc.page_count == 0:
            raise ValueError("Empty PDF")
        page = doc[0]
        scale = resolution / 72.0
        matrix = fitz.Matrix(scale, scale)
        pixmap = page.get_pixmap(matrix=matrix, alpha=False)
        return pixmap.tobytes("png")
    finally:
        doc.close()


def generate_preview_png(
    resume_data: dict,
    template_name: str = "classic",
    *,
    watermark: bool = True,
    resolution: int = 72,
) -> bytes:
    """First-page PNG for unpaid preview — not a downloadable PDF."""
    document = _render_document(resume_data, template_name, preview=watermark)
    pdf_buffer = io.BytesIO()
    if document.pages:
        document.copy([document.pages[0]]).write_pdf(pdf_buffer)
    else:
        document.write_pdf(pdf_buffer)
    return _pdf_bytes_to_png(pdf_buffer.getvalue(), resolution=resolution)
