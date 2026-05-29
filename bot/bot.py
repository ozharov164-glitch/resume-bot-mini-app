import sys
from pathlib import Path

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update, WebAppInfo
from telegram.ext import Application, CommandHandler, ContextTypes

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from config import settings  # noqa: E402

MINI_APP_URL = settings.FRONTEND_URL


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [[InlineKeyboardButton(text="Создать резюме", web_app=WebAppInfo(url=MINI_APP_URL))]]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(
        text=(
            "Привет! Я помогу создать профессиональное резюме за несколько минут.\n\n"
            "Ты отвечаешь на понятные вопросы, а я формирую аккуратное резюме для отклика на вакансии."
        ),
        reply_markup=reply_markup,
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Как это работает:\n"
        "1) Открой Mini App\n"
        "2) Ответь на вопросы\n"
        "3) Получи готовое резюме\n"
        "4) Скачай PDF после оплаты"
    )


def main():
    app = Application.builder().token(settings.BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
