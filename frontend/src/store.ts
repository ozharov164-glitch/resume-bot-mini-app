import { create } from "zustand";

import type { ResumeData, UserAnswers } from "./types";

type Page = "home" | "onboarding" | "loading" | "preview" | "payment" | "success";

interface AppState {
  page: Page;
  setPage: (page: Page) => void;
  answers: Partial<UserAnswers>;
  setAnswer: (key: keyof UserAnswers, value: string | string[]) => void;
  authToken: string | null;
  setAuthToken: (token: string) => void;
  resumeId: string | null;
  resumeData: ResumeData | null;
  setResumeResult: (resumeId: string, resumeData: ResumeData) => void;
  isLoading: boolean;
  setLoading: (value: boolean) => void;
  isPaid: boolean;
  setPaid: (value: boolean) => void;
  isFounder: boolean;
  setFounder: (value: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  page: "home",
  setPage: (page) => set({ page }),
  answers: {},
  setAnswer: (key, value) => set((state) => ({ answers: { ...state.answers, [key]: value } })),
  authToken: null,
  setAuthToken: (token) => set({ authToken: token }),
  resumeId: null,
  resumeData: null,
  setResumeResult: (resumeId, resumeData) => set({ resumeId, resumeData }),
  isLoading: false,
  setLoading: (value) => set({ isLoading: value }),
  isPaid: false,
  setPaid: (value) => set({ isPaid: value }),
  isFounder: false,
  setFounder: (value) => set({ isFounder: value }),
}));
