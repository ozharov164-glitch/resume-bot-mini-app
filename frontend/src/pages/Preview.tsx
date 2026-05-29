import { useAppStore } from "../store";

export function PreviewPage() {
  const { resumeData, setPage } = useAppStore();
  if (!resumeData) return null;

  return (
    <div className="min-h-screen px-4 py-6 flex flex-col gap-5" style={{ background: "var(--tg-bg)", color: "var(--tg-text)" }}>
      <h1 className="text-xl font-semibold">Готово! Выглядит отлично 🎉</h1>
      <div className="rounded-2xl p-4 border" style={{ borderColor: "rgba(0,0,0,0.08)", background: "var(--tg-secondary-bg)" }}>
        <div className="text-lg font-semibold">{resumeData.full_name}</div>
        <div className="opacity-80">{resumeData.target_position}</div>
        <div className="mt-4 text-sm opacity-70">О себе</div>
        <p className="text-sm">{resumeData.summary}</p>
        <div className="mt-4 text-sm opacity-70">Навыки</div>
        <div className="text-sm">{resumeData.skills?.join(", ")}</div>
      </div>
      <button
        onClick={() => setPage("payment")}
        className="mt-auto w-full rounded-2xl py-4 font-semibold"
        style={{ background: "var(--tg-button)", color: "var(--tg-button-text)" }}
      >
        Получить PDF
      </button>
    </div>
  );
}
