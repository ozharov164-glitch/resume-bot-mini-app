import { useEffect, useRef } from "react";

import { AppHeader } from "../components/ui/AppHeader";
import { PreviewAssemblyLoader } from "../components/preview/PreviewAssemblyLoader";
import { Screen } from "../components/ui/Screen";
import { runResumeGenerate } from "../lib/runResumeGenerate";

const GENERATE_PHRASES = [
  "Анализирую ваш опыт...",
  "Подбираю правильные формулировки...",
  "Адаптирую под алгоритмы hh.ru...",
  "Почти готово...",
] as const;

export function LoadingPage() {
  const generateStarted = useRef(false);

  useEffect(() => {
    if (generateStarted.current) return;
    generateStarted.current = true;
    void runResumeGenerate();
  }, []);

  return (
    <Screen className="loading-screen px-4">
      <AppHeader />
      <main className="loading-screen__main mx-auto flex w-full max-w-md flex-1 flex-col items-center px-2">
        <PreviewAssemblyLoader
          phrases={GENERATE_PHRASES}
          secondary="Создаём идеальную структуру для работодателя"
        />
      </main>
    </Screen>
  );
}
