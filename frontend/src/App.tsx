import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";

import { BootstrapScreen } from "./components/BootstrapScreen";
import { useFounderStatus } from "./hooks/useFounderStatus";
import { isFounderTelegramId } from "./lib/founder";
import { runAppBootstrap } from "./lib/bootstrap";
import { clearDeepLinkHash, parseDeepLink } from "./lib/deepLink";
import { completePaymentReturn, discoverPaymentReturnResumeId } from "./lib/paymentReturn";
import { useAppStore } from "./store";
import { getTelegramUserId, getTg, initTelegramTheme } from "./telegram";

const HomePage = lazy(() => import("./pages/Home").then((m) => ({ default: m.HomePage })));
const HistoryPage = lazy(() => import("./pages/History").then((m) => ({ default: m.HistoryPage })));
const OnboardingPage = lazy(() => import("./pages/Onboarding").then((m) => ({ default: m.OnboardingPage })));
const LoadingPage = lazy(() => import("./pages/Loading").then((m) => ({ default: m.LoadingPage })));
const PreviewPage = lazy(() => import("./pages/Preview").then((m) => ({ default: m.PreviewPage })));
const PaymentPage = lazy(() => import("./pages/Payment").then((m) => ({ default: m.PaymentPage })));
const SuccessPage = lazy(() => import("./pages/Success").then((m) => ({ default: m.SuccessPage })));
const SkillPickPage = lazy(() => import("./pages/SkillPick").then((m) => ({ default: m.SkillPickPage })));
const TemplatePickPage = lazy(() =>
  import("./pages/TemplatePick").then((m) => ({ default: m.TemplatePickPage })),
);
const TemplateSelectPage = lazy(() =>
  import("./pages/TemplateSelect").then((m) => ({ default: m.TemplateSelectPage })),
);

function PageFallback() {
  return <BootstrapScreen message="Загружаем экран…" />;
}

export default function App() {
  const {
    page,
    setAuthToken,
    setFounder,
    isLoading,
    setLoading,
    startNewResume,
    setPage,
    setHomeTab,
    authToken,
    setResumeResult,
    setPaid,
  } = useAppStore();
  const paymentReturnHandled = useRef(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  useFounderStatus();

  const runBootstrap = useCallback(async () => {
    setBootstrapError(null);
    setLoading(true);
    try {
      const tgId = getTelegramUserId();
      if (isFounderTelegramId(tgId)) {
        setFounder(true);
      }

      const result = await runAppBootstrap();
      if (!result.ok) {
        setBootstrapError(result.message);
        return;
      }

      setAuthToken(result.accessToken);
      if (result.isFounder) {
        setFounder(true);
      }

      const returnResumeId = discoverPaymentReturnResumeId();
      if (returnResumeId && !paymentReturnHandled.current) {
        paymentReturnHandled.current = true;
        clearDeepLinkHash();
        const { outcome, data } = await completePaymentReturn(result.accessToken, returnResumeId);
        if (outcome === "success" && data) {
          setResumeResult(returnResumeId, data, true);
          setPaid(true);
          setPage("success");
          getTg()?.HapticFeedback?.notificationOccurred("success");
          return;
        }
        if (outcome === "pending") {
          if (data) setResumeResult(returnResumeId, data, false);
          setPage("payment");
        }
      }
    } catch (error) {
      console.error(error);
      setBootstrapError("Не удалось запустить приложение. Проверьте интернет и нажмите «Повторить».");
    } finally {
      setLoading(false);
    }
  }, [setAuthToken, setFounder, setLoading, setPage, setPaid, setResumeResult]);

  useEffect(() => {
    initTelegramTheme();
    void runBootstrap();
  }, [runBootstrap, bootstrapAttempt]);

  useEffect(() => {
    if (isLoading || !authToken) return;

    const route = parseDeepLink(window.location.hash);
    if (route === "history") {
      setPage("history");
    } else if (route === "examples") {
      setPage("home");
      setHomeTab("examples");
    }
    if (route) clearDeepLinkHash();
  }, [isLoading, authToken, setPage, setHomeTab]);

  if (isLoading) {
    return (
      <BootstrapScreen
        message={
          discoverPaymentReturnResumeId() ? "Проверяем оплату…" : "Загружаем приложение…"
        }
      />
    );
  }

  if (bootstrapError || !authToken) {
    return (
      <BootstrapScreen
        message="Загружаем приложение…"
        error={bootstrapError || "Не удалось войти. Откройте приложение через @resumeez_bot."}
        onRetry={() => setBootstrapAttempt((n) => n + 1)}
      />
    );
  }

  return (
    <Suspense fallback={<PageFallback />}>
      {page === "home" ? (
        <HomePage onStart={startNewResume} onHistory={() => setPage("history")} />
      ) : null}
      {page === "history" ? <HistoryPage /> : null}
      {page === "template_pick" ? <TemplatePickPage /> : null}
      {page === "skill_pick" ? <SkillPickPage /> : null}
      {page === "loading" ? <LoadingPage /> : null}
      {page === "preview" ? <PreviewPage /> : null}
      {page === "template_select" ? <TemplateSelectPage /> : null}
      {page === "payment" ? <PaymentPage /> : null}
      {page === "success" ? <SuccessPage /> : null}
      {      page !== "home" &&
      page !== "history" &&
      page !== "template_pick" &&
      page !== "skill_pick" &&
      page !== "loading" &&
      page !== "preview" &&
      page !== "template_select" &&
      page !== "payment" &&
      page !== "success" ? (
        <OnboardingPage />
      ) : null}
    </Suspense>
  );
}
