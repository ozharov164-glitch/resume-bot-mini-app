import { useEffect } from "react";

import { authWithTelegram } from "./api";
import { OnboardingPage } from "./pages/Onboarding";
import { PaymentPage } from "./pages/Payment";
import { PreviewPage } from "./pages/Preview";
import { SuccessPage } from "./pages/Success";
import { useAppStore } from "./store";
import { initTelegramTheme, tg } from "./telegram";

export default function App() {
  const { page, setAuthToken, isLoading, setLoading } = useAppStore();

  useEffect(() => {
    initTelegramTheme();
    const bootstrap = async () => {
      try {
        setLoading(true);
        const initData = tg?.initData || "";
        if (!initData) return;
        const auth = await authWithTelegram(initData);
        setAuthToken(auth.access_token);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    void bootstrap();
  }, [setAuthToken, setLoading]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-base" style={{ background: "var(--tg-bg)", color: "var(--tg-text)" }}>
        Подготавливаем ваш персональный кабинет...
      </div>
    );
  }

  if (page === "preview") return <PreviewPage />;
  if (page === "payment") return <PaymentPage />;
  if (page === "success") return <SuccessPage />;
  return <OnboardingPage />;
}
