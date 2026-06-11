import { ensureAuthToken, generateResume, HttpTimeoutError } from "../api";
import { capitalizePersonName } from "./formatPersonName";
import { buildLastJobFromWorkHistory, deriveExperienceLevel } from "./onboardingSteps";
import { trackEvent } from "./analytics";
import { useAppStore } from "../store";

export type ResumeGenerateOutcome = "preview" | "onboarding";

export async function runResumeGenerate(): Promise<ResumeGenerateOutcome> {
  trackEvent("generate_started");
  try {
    const token = await ensureAuthToken();
    const state = useAppStore.getState();
    const payload = { ...state.answers };
    if (typeof payload.name === "string") {
      payload.name = capitalizePersonName(payload.name);
    }
    if (typeof payload.patronymic === "string") {
      payload.patronymic = capitalizePersonName(payload.patronymic);
    }
    const last_job = buildLastJobFromWorkHistory(state.answers.work_history);
    payload.experience_level = deriveExperienceLevel(state.answers.work_history);
    state.setAnswer("experience_level", payload.experience_level);
    state.setAnswer("last_job", last_job);
    if (last_job) {
      payload.last_job = last_job;
    }

    const response = await generateResume(
      token,
      payload,
      state.selectedTemplate,
      state.photoJpegBase64,
      state.photoMode,
    );
    if (!response?.resume_id || !response.resume) {
      throw new Error("Сервер вернул неполный ответ. Попробуйте ещё раз.");
    }

    state.setResumeResult(response.resume_id, response.resume, response.paid);
    if (response.paid) {
      state.setPaid(true);
    }
    if (state.onboardingMode === "create") {
      useAppStore.setState({ previewReturnPage: "home" });
    } else {
      useAppStore.setState((s) => ({
        previewReturnPage: s.previewReturnPage === "history" ? "history" : s.previewReturnPage,
      }));
    }
    state.setPage("preview");
    return "preview";
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "OPEN_VIA_BOT") {
      alert("Откройте приложение через бота @resumeez_bot — без этого авторизация не работает.");
    } else if (error instanceof HttpTimeoutError) {
      alert("Генерация заняла слишком много времени. Проверьте интернет и попробуйте ещё раз.");
    } else if (/401|авториза|токен|пользователь/i.test(message)) {
      alert("Сессия истекла. Закройте Mini App и откройте снова через бота.");
    } else {
      alert(message || "Не удалось составить резюме. Проверьте соединение и попробуйте ещё раз.");
    }
    console.debug(error);
    useAppStore.getState().setPage("onboarding");
    return "onboarding";
  }
}
