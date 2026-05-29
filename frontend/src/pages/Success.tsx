export function SuccessPage() {
  return (
    <div className="min-h-screen px-4 py-6 flex flex-col justify-center gap-4 text-center" style={{ background: "var(--tg-bg)", color: "var(--tg-text)" }}>
      <h1 className="text-2xl font-semibold">Готово!</h1>
      <p className="text-base opacity-80">
        Спасибо за оплату. Резюме уже отправлено в чат с ботом. Желаем вам уверенных откликов и быстрого оффера.
      </p>
    </div>
  );
}
