import { PhotoUpload } from "../ui/PhotoUpload";
import { PHOTO_MODE_OPTIONS, photoModeNeedsUpload } from "../../lib/photoModes";
import { useAppStore } from "../../store";
import type { PhotoMode } from "../../types";
import { getTg } from "../../telegram";

export function PhotoSetupStep() {
  const { photoMode, setPhotoMode, photoJpegBase64, setPhotoJpegBase64 } = useAppStore();

  const handleMode = (mode: PhotoMode) => {
    getTg()?.HapticFeedback?.selectionChanged();
    setPhotoMode(mode);
    if (mode === "none") {
      setPhotoJpegBase64(null);
    }
  };

  const needsUpload = photoModeNeedsUpload(photoMode);

  return (
    <div className="photo-setup flex flex-col gap-4">
      <p className="text-sm text-[var(--hint)] leading-relaxed">
        Портрет 3:4 повышает отклики на hh.ru. Выберите, куда добавить фото — или получите обработанные
        версии прямо в чат с ботом.
      </p>

      <div className="photo-setup__modes flex flex-col gap-2" role="radiogroup" aria-label="Куда добавить фото">
        {PHOTO_MODE_OPTIONS.map((opt) => {
          const active = photoMode === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`photo-setup__mode${active ? " photo-setup__mode--active" : ""}`}
              onClick={() => handleMode(opt.id)}
            >
              <span className="photo-setup__mode-label">{opt.label}</span>
              <span className="photo-setup__mode-desc">{opt.description}</span>
            </button>
          );
        })}
      </div>

      {needsUpload ? (
        <PhotoUpload mode="store" showSkip={false} variant="default" />
      ) : null}
    </div>
  );
}
