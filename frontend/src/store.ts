import { create } from "zustand";

import type { ResumeData, UserAnswers } from "./types";

type Page = "home" | "onboarding" | "loading" | "preview" | "payment" | "success" | "history";
type OnboardingMode = "create" | "edit";

interface AppState {
  page: Page;
  setPage: (page: Page) => void;
  answers: Partial<UserAnswers>;
  setAnswer: (key: keyof UserAnswers, value: string | string[]) => void;
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
  startNewResume: () => void;
  startEditResume: () => void;
  cancelEditResume: () => void;
  openResumeFromHistory: (
    resumeId: string,
    resumeData: ResumeData,
    isPaid: boolean,
    answers?: Partial<UserAnswers>,
  ) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  page: "home",
  setPage: (page) => set({ page }),
  answers: {},
  setAnswer: (key, value) => set((state) => ({ answers: { ...state.answers, [key]: value } })),
  setAnswers: (answers) => set({ answers }),
  authToken: null,
  setAuthToken: (token) => set({ authToken: token }),
  resumeId: null,
  resumeData: null,
  setResumeResult: (resumeId, resumeData, isPaid) =>
    set({ resumeId, resumeData, ...(isPaid !== undefined ? { isPaid } : {}) }),
  isLoading: false,
  setLoading: (value) => set({ isLoading: value }),
  isPaid: false,
  setPaid: (value) => set({ isPaid: value }),
  isFounder: false,
  setFounder: (value) => set({ isFounder: value }),
  onboardingMode: "create",
  previewReturnPage: "home",
  startNewResume: () =>
    set({
      page: "onboarding",
      onboardingMode: "create",
      previewReturnPage: "home",
      answers: {},
      resumeId: null,
      resumeData: null,
      isPaid: false,
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
      page: "preview",
      previewReturnPage: "history",
      onboardingMode: "create",
    }),
}));
