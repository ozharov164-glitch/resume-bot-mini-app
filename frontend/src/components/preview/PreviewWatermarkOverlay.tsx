const WATERMARK_TILES = Array.from({ length: 12 }, (_, i) => i);

export function PreviewWatermarkOverlay() {
  return (
    <>
      <div className="preview-watermark-grid" aria-hidden>
        {WATERMARK_TILES.map((i) => (
          <span key={i}>ПРЕДПРОСМОТР</span>
        ))}
      </div>
      <div className="preview-watermark-shield" aria-hidden />
    </>
  );
}
