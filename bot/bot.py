import json
import logging
import sys
from pathlib import Path

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update, WebAppInfo
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, PreCheckoutQueryHandler, filters

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from config import settings  # noqa: E402
from database import get_db  # noqa: E402
from services.payment_fulfillment import fulfill_paid_resume  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)

MINI_APP_URL = settings.FRONTEND_URL.rstrip("/")


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
        "4) Оплати Stars прямо в приложении — PDF придёт в этот чат"
    )


async def pre_checkout(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.pre_checkout_query.answer(ok=True)


async def successful_payment(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.successful_payment:
        return
    payment = update.message.successful_payment
    try:
        payload = json.loads(payment.invoice_payload)
        resume_id = payload["resume_id"]
        telegram_id = update.message.from_user.id
        db = get_db()
        await fulfill_paid_resume(db, resume_id, telegram_id)
    except Exception:
        logger.exception("successful_payment handler failed")
        await update.message.reply_text(
            "Оплата получена, но PDF не удалось отправить. Напиши /help — мы поможем."
        )


def main():
    app = Application.builder().token(settings.BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(PreCheckoutQueryHandler(pre_checkout))
    app.add_handler(MessageHandler(filters.SUCCESSFUL_PAYMENT, successful_payment))
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
