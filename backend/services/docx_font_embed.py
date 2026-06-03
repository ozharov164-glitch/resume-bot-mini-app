"""Embed Nunito Sans TTF fonts into DOCX (ODTTF obfuscation per ECMA-376)."""

from __future__ import annotations

import io
import uuid
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from services.font_assets import FONTS_DIR

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
CT_NS = "http://schemas.openxmlformats.org/package/2006/content-types"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"

FONT_TABLE_REL_TYPE = (
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable"
)
FONT_ODTTF_CT = "application/vnd.openxmlformats-officedocument.obfuscatedFont"

FONT_VARIANTS = (
    ("NunitoSans-Regular.ttf", "embedRegular"),
    ("NunitoSans-Bold.ttf", "embedBold"),
    ("NunitoSans-SemiBold.ttf", "embedBold"),  # Word allows one bold slot; SemiBold maps here
    ("NunitoSans-Italic.ttf", "embedItalic"),
)


def _obfuscate_ttf(font_key: bytes, ttf_data: bytes) -> bytes:
    out = bytearray(ttf_data)
    for i in range(16):
        out[i] = ttf_data[i] ^ font_key[15 - i]
        out[i + 16] = ttf_data[i + 16] ^ font_key[15 - i]
    return bytes(out)


def _register_ns() -> None:
    ET.register_namespace("w", W_NS)
    ET.register_namespace("r", R_NS)


def _next_rid(rels_root: ET.Element) -> str:
    max_id = 0
    for rel in rels_root.findall(f"{{{REL_NS}}}Relationship"):
        rid = rel.get("Id", "")
        if rid.startswith("rId"):
            try:
                max_id = max(max_id, int(rid[3:]))
            except ValueError:
                continue
    return f"rId{max_id + 1}"


def embed_nunito_fonts(docx_bytes: bytes) -> bytes:
    """Return DOCX with embedded Nunito Sans (Regular/Bold/Italic) when font files exist."""
    available = [(name, tag) for name, tag in FONT_VARIANTS if (FONTS_DIR / name).exists()]
    if not available:
        return docx_bytes

    inp = io.BytesIO(docx_bytes)
    out = io.BytesIO()
    font_entries: list[tuple[str, str, str, bytes]] = []  # tag, rid, font_key_guid, odttf

    with zipfile.ZipFile(inp, "r") as zin, zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zout:
        names = set(zin.namelist())
        doc_rels_path = "word/_rels/document.xml.rels"
        doc_rels_xml = zin.read(doc_rels_path)
        rels_root = ET.fromstring(doc_rels_xml)

        next_num = 1
        for filename, embed_tag in available:
            if embed_tag == "embedBold" and any(e[0] == "embedBold" for e in font_entries):
                continue
            font_key = uuid.uuid4().bytes
            font_key_guid = str(uuid.UUID(bytes=font_key)).upper()
            ttf_data = (FONTS_DIR / filename).read_bytes()
            odttf = _obfuscate_ttf(font_key, ttf_data)
            rid = _next_rid(rels_root)
            rel = ET.SubElement(rels_root, f"{{{REL_NS}}}Relationship")
            rel.set("Id", rid)
            rel.set("Type", "http://schemas.openxmlformats.org/officeDocument/2006/relationships/font")
            odttf_name = f"font{next_num}.odttf"
            rel.set("Target", f"fonts/{odttf_name}")
            font_entries.append((embed_tag, rid, font_key_guid, odttf))
            next_num += 1

        # fontTable relationship on document
        has_font_table = any(
            rel.get("Type") == FONT_TABLE_REL_TYPE for rel in rels_root.findall(f"{{{REL_NS}}}Relationship")
        )
        font_table_rid = None
        if not has_font_table:
            font_table_rid = _next_rid(rels_root)
            rel = ET.SubElement(rels_root, f"{{{REL_NS}}}Relationship")
            rel.set("Id", font_table_rid)
            rel.set("Type", FONT_TABLE_REL_TYPE)
            rel.set("Target", "fontTable.xml")

        _register_ns()
        new_doc_rels = ET.tostring(rels_root, encoding="utf-8", xml_declaration=True)

        # fontTable.xml
        fonts_el = ET.Element(f"{{{W_NS}}}fonts")
        font_el = ET.SubElement(fonts_el, f"{{{W_NS}}}font")
        font_el.set(f"{{{W_NS}}}name", "Nunito Sans")
        for tag_name in ("panose1",):
            pass
        charset = ET.SubElement(font_el, f"{{{W_NS}}}charset")
        charset.set(f"{{{W_NS}}}val", "CC")
        family = ET.SubElement(font_el, f"{{{W_NS}}}family")
        family.set(f"{{{W_NS}}}val", "swiss")
        pitch = ET.SubElement(font_el, f"{{{W_NS}}}pitch")
        pitch.set(f"{{{W_NS}}}val", "variable")
        for embed_tag, rid, font_key_guid, _ in font_entries:
            node = ET.SubElement(font_el, f"{{{W_NS}}}{embed_tag}")
            node.set(f"{{{R_NS}}}id", rid)
            node.set(f"{{{W_NS}}}fontKey", f"{{{font_key_guid}}}")

        font_table_bytes = ET.tostring(fonts_el, encoding="utf-8", xml_declaration=True)

        # [Content_Types].xml
        ct_xml = zin.read("[Content_Types].xml")
        ct_root = ET.fromstring(ct_xml)
        ct_children_tags = {child.tag for child in ct_root}
        if f"{{{CT_NS}}}Override" not in ct_children_tags:
            pass
        existing_parts = {
            child.get("PartName")
            for child in ct_root.findall(f"{{{CT_NS}}}Override")
        }
        if "/word/fontTable.xml" not in existing_parts:
            override = ET.SubElement(ct_root, f"{{{CT_NS}}}Override")
            override.set("PartName", "/word/fontTable.xml")
            override.set(
                "ContentType",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml",
            )
        for i in range(1, next_num):
            part = f"/word/fonts/font{i}.odttf"
            if part not in existing_parts:
                override = ET.SubElement(ct_root, f"{{{CT_NS}}}Override")
                override.set("PartName", part)
                override.set("ContentType", FONT_ODTTF_CT)
        ct_bytes = ET.tostring(ct_root, encoding="utf-8", xml_declaration=True)

        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == doc_rels_path:
                data = new_doc_rels
            elif item.filename == "[Content_Types].xml":
                data = ct_bytes
            zout.writestr(item, data)

        if "word/fontTable.xml" not in names:
            zout.writestr("word/fontTable.xml", font_table_bytes)
        for i, (_, _, _, odttf) in enumerate(font_entries, start=1):
            zout.writestr(f"word/fonts/font{i}.odttf", odttf)

    return out.getvalue()
