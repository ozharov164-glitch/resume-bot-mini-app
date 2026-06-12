import { create } from "zustand";

import { readCachedAuthToken } from "./lib/authSession";
import { normalizeResumeData } from "./lib/resumeNormalize";
import type { ResumeData, UserAnswers, WorkEntry, PhotoMode } from "./types";

type Page =
  | "home"
  | "onboarding"
  | "template_pick"
  | "skill_pick"
  | "loading"
  | "preview"
  | "payment"
  | "success"
  | "history"
  | "hh_text";
type OnboardingMode = "create" | "edit";
type HomeTab = "main" | "examples";
export type TemplateId = "classic" | "modern" | "compact";

interface AppState {
  page: Page;
  setPage: (page: Page) => void;
  answers: Partial<UserAnswers>;
  setAnswer: (
    key: keyof UserAnswers,
    value: string | string[] | WorkEntry[] | Record<string, string | string[]>,
  ) => void;
  setAnswers: (answers: Partial<UserAnswers>) => void;
  authToken: string | null;
  setAuthToken: (token: string) => void;
  resumeId: string | null;
  resumeData: ResumeData | null;
  setResumeResult: (resumeId: string, resumeData: ResumeData, isPaid?: boolean) => void;
  isLoading: boolean;
  setLoading: (value: boolean) => void;
  isPaid: boolean;
  setPaid: (value: boolean) => void;
  isFounder: boolean;
  setFounder: (value: boolean) => void;
  onboardingMode: OnboardingMode;
  previewReturnPage: Page;
  hhTextReturnPage: Page;
  openHhTextView: (returnPage?: Page) => void;
  onboardingStep: number;
  setOnboardingStep: (step: number) => void;
  homeTab: HomeTab;
  setHomeTab: (tab: HomeTab) => void;
  selectedTemplate: TemplateId;
  setSelectedTemplate: (template: TemplateId) => void;
  pendingVacancyText: string;
  setPendingVacancyText: (text: string) => void;
  fastMode: boolean;
  setFastMode: (v: boolean) => void;
  photoJpegBase64: string | null;
  setPhotoJpegBase64: (value: string | null) => void;
  photoMode: PhotoMode;
  setPhotoMode: (mode: PhotoMode) => void;
  startNewResume: () => void;
  startEditResume: () => void;
  cancelEditResume: () => void;
  openResumeFromHistory: (
    resumeId: string,
    resumeData: ResumeData,
    isPaid: boolean,
    answers?: Partial<UserAnswers>,
  ) => void;
  /** Navigate to preview immediately; Preview page hydrates data + image. */
  openResumeFromHistoryPending: (resumeId: string, isPaid: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  page: "home",
  setPage: (page) => set({ page }),
  answers: {},
  setAnswer: (key, value) => set((state) => ({ answers: { ...state.answers, [key]: value } })),
  setAnswers: (answers) => set({ answers }),
  authToken: readCachedAuthToken(),
  setAuthToken: (token) => set({ authToken: token }),
  resumeId: null,
  resumeData: null,
  setResumeResult: (resumeId, resumeData, isPaid) =>
    set({
      resumeId,
      resumeData: normalizeResumeData(resumeData),
      photoMode: resumeData.photo_mode ?? "none",
      photoJpegBase64: resumeData.photo_jpeg_base64 ?? null,
      ...(isPaid !== undefined ? { isPaid } : {}),
    }),
  isLoading: !readCachedAuthToken(),
  setLoading: (value) => set({ isLoading: value }),
  isPaid: false,
  setPaid: (value) => set({ isPaid: value }),
  isFounder: false,
  setFounder: (value) => set({ isFounder: value }),
  onboardingMode: "create",
  previewReturnPage: "home",
  hhTextReturnPage: "preview",
  openHhTextView: (returnPage) =>
    set((state) => ({
      page: "hh_text",
      hhTextReturnPage: returnPage ?? state.page,
    })),
  onboardingStep: 0,
  setOnboardingStep: (onboardingStep) => set({ onboardingStep }),
  homeTab: "main",
  setHomeTab: (homeTab) => set({ homeTab }),
  selectedTemplate: "modern" as TemplateId,
  setSelectedTemplate: (selectedTemplate) => set({ selectedTemplate }),
  pendingVacancyText: "",
  setPendingVacancyText: (pendingVacancyText) => set({ pendingVacancyText }),
  fastMode: false,
  setFastMode: (fastMode) => set({ fastMode }),
  photoJpegBase64: null,
  setPhotoJpegBase64: (photoJpegBase64) => set({ photoJpegBase64 }),
  photoMode: "none" as PhotoMode,
  setPhotoMode: (photoMode) => set({ photoMode }),
  startNewResume: () =>
    set({
      page: "onboarding",
      onboardingMode: "create",
      previewReturnPage: "home",
      onboardingStep: 0,
      answers: { gender: "" },
      resumeId: null,
      resumeData: null,
      isPaid: false,
      selectedTemplate: "modern",
      pendingVacancyText: "",
      photoJpegBase64: null,
      photoMode: "none",
    }),
  startEditResume: () => set({ page: "onboarding", onboardingMode: "edit" }),
  cancelEditResume: () => {
    const { resumeData, previewReturnPage } = get();
    set({
      page: resumeData ? "preview" : previewReturnPage,
      onboardingMode: "create",
    });
  },
  openResumeFromHistory: (resumeId, resumeData, isPaid, answers) =>
    set({
      resumeId,
      resumeData,
      isPaid,
      answers: answers ?? {},
      photoMode: (resumeData.photo_mode as PhotoMode) ?? "none",
      photoJpegBase64: resumeData.photo_jpeg_base64 ?? null,
      page: "preview",
      previewReturnPage: "history",
      onboardingMode: "create",
    }),
  openResumeFromHistoryPending: (resumeId, isPaid) =>
    set({
      resumeId,
      resumeData: null,
      isPaid,
      answers: {},
      photoJpegBase64: null,
      photoMode: "none",
      page: "preview",
      previewReturnPage: "history",
      onboardingMode: "create",
    }),
}));
