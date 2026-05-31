import { useEffect } from "react";

import { authWithTelegram, getResume, waitUntilPaid } from "./api";
import { useFounderStatus } from "./hooks/useFounderStatus";
import { isFounderTelegramId } from "./lib/founder";
import { clearDeepLinkHash, parseDeepLink, parsePaymentReturnResumeId } from "./lib/deepLink";
import { HistoryPage } from "./pages/History";
import { HomePage } from "./pages/Home";
import { LoadingPage } from "./pages/Loading";
import { OnboardingPage } from "./pages/Onboarding";
import { PaymentPage } from "./pages/Payment";
import { PreviewPage } from "./pages/Preview";
import { SkillPickPage } from "./pages/SkillPick";
import { SuccessPage } from "./pages/Success";
import { useAppStore } from "./store";
import { getTelegramUserId, initTelegramTheme, waitForInitData } from "./telegram";

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
  useFounderStatus();

  useEffect(() => {
    initTelegramTheme();
    const bootstrap = async () => {
      try {
        setLoading(true);
        const tgId = getTelegramUserId();
        if (isFounderTelegramId(tgId)) {
          setFounder(true);
        }
        const initData = await waitForInitData();
        if (!initData) return;
        const auth = await authWithTelegram(initData);
        setAuthToken(auth.access_token);
        if (auth.is_founder || auth.unlimited) {
          setFounder(true);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    void bootstrap();
  }, [setAuthToken, setFounder, setLoading]);

  useEffect(() => {
    if (isLoading || !authToken) return;

    const paymentResumeId = parsePaymentReturnResumeId(window.location.hash);
    if (paymentResumeId) {
      clearDeepLinkHash();
      void (async () => {
        try {
          setLoading(true);
          const resume = await getResume(authToken, paymentResumeId);
          setResumeResult(paymentResumeId, resume.data, resume.is_paid);
          const confirmed = resume.is_paid || (await waitUntilPaid(authToken, paymentResumeId, 40, 1000));
          if (confirmed) {
            setPaid(true);
            setPage("success");
          } else {
            setPage("payment");
            alert(
              "Оплата ещё обрабатывается. PDF появится в чате с ботом через минуту — проверь сообщения.",
            );
          }
        } catch (error) {
          console.error(error);
          setPage("home");
          alert("Не удалось проверить оплату. Открой приложение из бота и проверь чат.");
        } finally {
          setLoading(false);
        }
      })();
      return;
    }

    const route = parseDeepLink(window.location.hash);
    if (route === "history") {
      setPage("history");
    } else if (route === "examples") {
      setPage("home");
      setHomeTab("examples");
    }
    if (route) clearDeepLinkHash();
  }, [isLoading, authToken, setPage, setHomeTab, setLoading, setResumeResult, setPaid]);

  if (isLoading) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-4 px-6"
        style={{ background: "var(--tg-bg)", color: "var(--tg-text)" }}
      >
        <div
          className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "var(--brand-bright)", borderTopColor: "transparent" }}
          aria-hidden
        />
        <p className="text-base font-semibold" style={{ color: "var(--text-muted)" }}>
          Загружаем приложение...
        </p>
      </div>
    );
  }

  if (page === "home") {
    return (
      <HomePage
        onStart={startNewResume}
        onHistory={() => setPage("history")}
      />
    );
  }
  if (page === "history") return <HistoryPage />;
  if (page === "skill_pick") return <SkillPickPage />;
  if (page === "loading") return <LoadingPage />;
  if (page === "preview") return <PreviewPage />;
  if (page === "payment") return <PaymentPage />;
  if (page === "success") return <SuccessPage />;
  return <OnboardingPage />;
}
