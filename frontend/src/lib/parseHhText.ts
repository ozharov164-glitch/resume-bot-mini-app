export interface HhTextSection {
  title: string;
  lines: string[];
}

export interface ParsedHhText {
  headline: string;
  metaLines: string[];
  sections: HhTextSection[];
}

export function parseHhText(raw: string): ParsedHhText {
  const sections: HhTextSection[] = [];
  let current: HhTextSection | null = null;

  for (const line of raw.split("\n")) {
    const match = line.match(/^=== (.+?) ===$/);
    if (match) {
      if (current) sections.push(current);
      current = { title: match[1].trim(), lines: [] };
      continue;
    }
    if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);

  const [head, ...body] = sections;
  const headline = head?.title ?? "Резюме";
  const metaLines = (head?.lines ?? []).map((l) => l.trim()).filter(Boolean);

  return {
    headline,
    metaLines,
    sections: body.map((section) => ({
      title: section.title,
      lines: trimTrailingBlankLines(section.lines),
    })),
  };
}

function trimTrailingBlankLines(lines: string[]): string[] {
  const copy = [...lines];
  while (copy.length > 0 && !copy[copy.length - 1]?.trim()) {
    copy.pop();
  }
  return copy;
}
