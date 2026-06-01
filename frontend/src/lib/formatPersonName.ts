/** Capitalize each word (and hyphen segment) in Russian ФИО. */

function capitalizeToken(token: string): string {
  if (!token) return token;
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

export function capitalizePersonName(value: string): string {
  const text = value.trim();
  if (!text) return "";

  return text
    .split(/(\s+)/)
    .map((chunk) => {
      if (!chunk.trim()) return chunk;
      return chunk.split("-").map(capitalizeToken).join("-");
    })
    .join("");
}

/** Фамилия Имя Отчество from onboarding «Имя Фамилия» + отчество. */
export function buildFullName(name: string, patronymic?: string): string {
  const n = capitalizePersonName(name);
  let p = capitalizePersonName(patronymic ?? "");
  const parts = n.split(/\s+/).filter(Boolean);
  if (!parts.length) return p;
  if (parts.length === 1) {
    const given = parts[0];
    if (p && !given.toLowerCase().includes(p.toLowerCase())) return `${given} ${p}`;
    return given;
  }
  const surname = parts[parts.length - 1];
  const given = parts.slice(0, -1).join(" ");
  if (p && n.toLowerCase().includes(p.toLowerCase())) p = "";
  return [surname, given, p].filter(Boolean).join(" ");
}

export function isPersonNameField(fieldId: string): boolean {
  return fieldId === "name" || fieldId === "patronymic";
}
