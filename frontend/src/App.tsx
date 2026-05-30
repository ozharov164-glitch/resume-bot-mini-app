import { useEffect } from "react";

import { authWithTelegram } from "./api";
import { useFounderStatus } from "./hooks/useFounderStatus";
import { isFounderTelegramId } from "./lib/founder";
import { clearDeepLinkHash, parseDeepLink } from "./lib/deepLink";
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
  const { page, setAuthToken, setFounder, isLoading, setLoading, startNewResume, setPage, setHomeTab } =
    useAppStore();
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
    if (isLoading) return;
    const route = parseDeepLink(window.location.hash);
    if (route === "history") {
      setPage("history");
    } else if (route === "examples") {
      setPage("home");
      setHomeTab("examples");
    }
    if (route) clearDeepLinkHash();
  }, [isLoading, setPage, setHomeTab]);

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4 px-6"
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
