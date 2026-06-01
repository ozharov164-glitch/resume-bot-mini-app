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

export function buildFullName(name: string, patronymic?: string): string {
  const n = capitalizePersonName(name);
  const p = capitalizePersonName(patronymic ?? "");
  if (!n) return p;
  if (p && !n.toLowerCase().includes(p.toLowerCase())) {
    return `${n} ${p}`;
  }
  return n;
}

export function isPersonNameField(fieldId: string): boolean {
  return fieldId === "name" || fieldId === "patronymic";
}
