const heroSrc = `${import.meta.env.BASE_URL}images/home-hero.png`;

/** Stitch Home — Light Mode hero (construction worker + resume). */
export function HeroIllustration() {
  return (
    <div className="flex w-full justify-center">
      <div
        className="aspect-square w-full max-w-[280px] overflow-hidden rounded-full border-4"
        style={{
          background: "var(--surface-muted, #eef6ee)",
          borderColor: "#ffffff",
          boxShadow: "0 1px 8px rgba(0, 108, 73, 0.08)",
        }}
      >
        <img
          src={heroSrc}
          alt="Специалист с готовым резюме"
          className="h-full w-full object-cover"
          width={280}
          height={280}
          draggable={false}
        />
      </div>
    </div>
  );
}
