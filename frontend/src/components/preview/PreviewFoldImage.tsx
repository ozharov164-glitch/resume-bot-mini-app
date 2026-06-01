interface PreviewFoldImageProps {
  src: string;
  locked: boolean;
}

export function PreviewFoldImage({ src, locked }: PreviewFoldImageProps) {
  return (
    <div className="preview-fold-wrap">
      <div className={`preview-fold-canvas${locked ? " preview-fold-canvas--locked" : ""}`}>
        <img
          src={src}
          alt="Предпросмотр резюме"
          className="preview-fold-image"
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
        />
        {locked && (
          <>
            <div className="preview-fold-fade" aria-hidden />
            <div className="preview-fold-paywall-copy" aria-hidden>
              <p>PDF + полный текст hh.ru — 149₽</p>
              <span>Нижняя часть скрыта до оплаты</span>
            </div>
            <span className="preview-fold-watermark">ПРЕДПРОСМОТР</span>
          </>
        )}
      </div>
    </div>
  );
}
