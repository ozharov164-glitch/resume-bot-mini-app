const MATERIAL_FONT = '24px "Material Symbols Outlined"';
const READY_CLASS = "material-icons-ready";

export function areMaterialIconsReady(): boolean {
  if (typeof document === "undefined") return true;
  return document.documentElement.classList.contains(READY_CLASS);
}

export function markMaterialIconsReady(): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.add(READY_CLASS);
}

export function subscribeMaterialIcons(listener: () => void): () => void {
  if (typeof document === "undefined") return () => undefined;
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

/** Load Material Symbols before first icon paint to avoid ligature text flash. */
export async function ensureMaterialIconsReady(): Promise<void> {
  if (typeof document === "undefined") return;
  if (areMaterialIconsReady()) return;

  try {
    if (document.fonts?.load) {
      await Promise.race([
        document.fonts.load(MATERIAL_FONT),
        document.fonts.ready,
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 3000);
        }),
      ]);
    }
  } catch {
    /* still show UI with empty icon placeholders */
  }

  markMaterialIconsReady();
}
