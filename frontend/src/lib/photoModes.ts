import type { PhotoMode } from "../types";

export interface PhotoModeOption {
  id: PhotoMode;
  label: string;
  description: string;
}

export const PHOTO_MODE_OPTIONS: PhotoModeOption[] = [
  {
    id: "none",
    label: "Без фото",
    description: "Резюме без портрета — как раньше",
  },
  {
    id: "pdf",
    label: "Только в PDF",
    description: "Фото в PDF-файле для отправки работодателю",
  },
  {
    id: "docx",
    label: "Только в DOCX",
    description: "Фото в Word-файле для hh.ru и ATS",
  },
  {
    id: "both",
    label: "В PDF и DOCX",
    description: "Портрет во всех документах — максимум откликов",
  },
  {
    id: "chat",
    label: "Прислать в чат бота",
    description: "Сжатое и полное фото в Telegram — без вставки в файлы",
  },
];

export function photoModeNeedsUpload(mode: PhotoMode): boolean {
  return mode !== "none";
}
