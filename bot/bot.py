import asyncio
import html
import json
import logging
import sys
import time
from pathlib import Path

from telegram import (
    BotCommand,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    MenuButtonWebApp,
    Update,
    WebAppInfo,
)
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    PreCheckoutQueryHandler,
    filters,
)

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from config import settings  # noqa: E402
from database import get_db  # noqa: E402
from services.payment_fulfillment import fulfill_paid_resume  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

MINI_APP_URL = settings.FRONTEND_URL.rstrip("/")
_FALLBACK_COUNT = 1200
_STATS_TTL_SEC = 60.0
_stats_cache: tuple[int, float] | None = None


def _start_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("📝 Создать резюме", web_app=WebAppInfo(url=MINI_APP_URL))],
            [
                InlineKeyboardButton(
                    "📋 Мои резюме", web_app=WebAppInfo(url=f"{MINI_APP_URL}#history")
                ),
                InlineKeyboardButton(
                    "🖼 Примеры", web_app=WebAppInfo(url=f"{MINI_APP_URL}#examples")
                ),
            ],
            [InlineKeyboardButton("❓ Как это работает", callback_data="how_it_works")],
            [InlineKeyboardButton("🛡️ Почему нам доверяют", callback_data="trust")],
            [InlineKeyboardButton("🎁 Пригласить друга", callback_data="invite_prompt")],
        ]
    )


def _trust_text(count: int) -> str:
    return (
        "🛡️ <b>Почему нам доверяют:</b>\n\n"
        f"📊 Уже <b>{count:,}+</b> резюме — люди реально пользуются\n"
        "👀 <b>Сначала смотри — потом плати</b>\n"
        "   Бесплатный предпросмотр до оплаты. Риска нет.\n"
        "✅ <b>Формат hh.ru</b> — HR смотрит без лишних вопросов\n"
        "💰 <b>149 ₽</b> вместо 500–1000 ₽ у конкурентов\n"
        "🔒 Данные только для твоего резюме — никуда не продаём\n"
        "🤖 ИИ не выдумывает опыт — только твои ответы\n"
        "💳 Оплата через Telegram Stars — без карты на сайте\n"
        "↩️ Не понравилось? /support — <b>вернём Stars</b>\n\n"
        "⏱ Весь процесс — 3–5 минут. Проще, чем писать самому."
    )


def _start_text(count: int, greeting: str | None = None) -> str:
    intro = f"Привет, {greeting}! 👋\n\n" if greeting else ""
    return (
        "🎯 <b>Профессиональное резюме за 5 минут</b>\n\n"
        f"{intro}"
        "Как это работает:\n"
        "📝 Отвечаешь на простые вопросы\n"
        "🤖 ИИ составляет сильное резюме\n"
        "📄 Получаешь готовый PDF прямо в этот чат\n\n"
        "✅ Формат hh.ru — работодатели привыкли\n"
        "🎤 Можно диктовать голосом\n"
        f"📄 Уже создано <b>{count:,}+</b> резюме\n\n"
        "💳 Стоимость: <b>99 ⭐ Stars</b> или <b>149 ₽</b>"
    )


def _display_name(user) -> str:
    raw = user.first_name or user.username or "друг"
    return html.escape(str(raw), quote=False)


def _ensure_user_row(db, tg_user) -> None:
    if db.find_user_by_telegram_id(tg_user.id):
        return
    db.create_user(
        telegram_id=tg_user.id,
        first_name=tg_user.first_name or "",
        last_name=tg_user.last_name or "",
        username=tg_user.username or "",
    )


def _resume_count_from_db() -> int:
    try:
        count = get_db().count_resumes()
        if count < 1:
            return _FALLBACK_COUNT
        return count + _FALLBACK_COUNT
    except Exception as exc:
        logger.warning("resume count from db failed: %s", exc)
        return _FALLBACK_COUNT


def get_resume_count() -> int:
    """Cached resume count — same formula as /api/stats/count, no HTTP round-trip."""
    global _stats_cache
    now = time.monotonic()
    if _stats_cache and now - _stats_cache[1] < _STATS_TTL_SEC:
        return _stats_cache[0]
    count = _resume_count_from_db()
    _stats_cache = (count, now)
    return count


async def _get_resume_count() -> int:
    return get_resume_count()


async def _persist_referral(referrer_id: int, tg_user) -> None:
    try:
        db = get_db()
        await asyncio.to_thread(_ensure_user_row, db, tg_user)
        await asyncio.to_thread(db.save_referral, referrer_id, tg_user.id)
    except Exception as exc:
        logger.warning("Referral save failed: %s", exc)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    referrer_id = None
    tg_user = update.message.from_user
    if context.args and context.args[0].startswith("ref_"):
        try:
            referrer_id = int(context.args[0][4:])
        except (ValueError, IndexError):
            referrer_id = None

    count = get_resume_count()
    text = _start_text(count, _display_name(tg_user))
    await update.message.reply_text(text, reply_markup=_start_keyboard(), parse_mode="HTML")

    if referrer_id and referrer_id != tg_user.id:
        asyncio.create_task(_persist_referral(referrer_id, tg_user))


async def resume_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = InlineKeyboardMarkup(
        [[InlineKeyboardButton("📝 Открыть конструктор", web_app=WebAppInfo(url=MINI_APP_URL))]]
    )
    await update.message.reply_text(
        "Нажми кнопку — откроется конструктор резюме.\n"
        "Ответь на несколько вопросов, и ИИ составит профессиональное резюме за 5 минут.",
        reply_markup=keyboard,
    )


async def my_resumes_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "📋 Открыть историю", web_app=WebAppInfo(url=f"{MINI_APP_URL}#history")
                )
            ]
        ]
    )
    await update.message.reply_text(
        "Здесь хранятся все твои резюме.\n"
        "Можно открыть, отредактировать или скачать PDF повторно.",
        reply_markup=keyboard,
    )


async def examples_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "🖼 Смотреть примеры", web_app=WebAppInfo(url=f"{MINI_APP_URL}#examples")
                )
            ]
        ]
    )
    await update.message.reply_text(
        "Посмотри примеры резюме, которые создаёт наш ИИ:\n\n"
        "🚗 Водитель  🔒 Охранник  💊 Фармацевт  🛒 Продавец\n\n"
        "Каждое резюме — профессиональный дизайн, формат hh.ru.",
        reply_markup=keyboard,
    )


async def trust_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    count = get_resume_count()
    await update.message.reply_text(
        _trust_text(count),
        reply_markup=InlineKeyboardMarkup(
            [
                [InlineKeyboardButton("📝 Создать резюме", web_app=WebAppInfo(url=MINI_APP_URL))],
                [
                    InlineKeyboardButton(
                        "🖼 Примеры", web_app=WebAppInfo(url=f"{MINI_APP_URL}#examples")
                    )
                ],
            ]
        ),
        parse_mode="HTML",
    )


async def support_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🆘 <b>Нужна помощь?</b>\n\n"
        "Частые вопросы:\n"
        "• <b>PDF не пришёл</b> → подожди 1-2 минуты, затем напиши /start\n"
        "• <b>Хочу изменить резюме</b> → открой «Мои резюме» → «Изменить ответы»\n"
        "• <b>Ошибка оплаты</b> → попробуй ещё раз или выбери другой способ\n\n"
        "Не помогло? Опиши проблему — ответим в течение часа.\n"
        "Гарантия: если что-то пошло не так — вернём Stars.",
        parse_mode="HTML",
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = InlineKeyboardMarkup(
        [[InlineKeyboardButton("📝 Создать резюме", web_app=WebAppInfo(url=MINI_APP_URL))]]
    )
    await update.message.reply_text(
        "📌 <b>Как создать резюме:</b>\n\n"
        "1️⃣ Нажми «Создать резюме» — откроется мини-приложение\n"
        "2️⃣ Ответь на 11 простых вопросов (можно голосом 🎤)\n"
        "3️⃣ ИИ напишет профессиональное резюме по твоим ответам\n"
        "4️⃣ Посмотри бесплатный предпросмотр\n"
        "5️⃣ Оплати 99 ⭐ или 149 ₽ — PDF придёт в этот чат\n\n"
        "⏱ Весь процесс: 3-5 минут.\n"
        "📄 Соответствует формату hh.ru.",
        reply_markup=keyboard,
        parse_mode="HTML",
    )


async def invite_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.message.from_user.id
    invite_link = f"https://t.me/{settings.BOT_USERNAME}?start=ref_{user_id}"

    await update.message.reply_text(
        "🎁 <b>Пригласи друга — получи бесплатное резюме!</b>\n\n"
        "Как это работает:\n"
        "1. Отправь ссылку другу\n"
        "2. Друг создаёт и оплачивает резюме\n"
        "3. Ты получаешь одно бесплатное резюме 🎉\n\n"
        f"Твоя личная ссылка:\n<code>{invite_link}</code>\n\n"
        "Нажми и удержи ссылку чтобы скопировать, "
        "или используй кнопку «Поделиться».",
        reply_markup=InlineKeyboardMarkup(
            [
                [
                    InlineKeyboardButton(
                        "📤 Поделиться с другом",
                        switch_inline_query=(
                            f"Создай профессиональное резюме за 5 минут → {invite_link}"
                        ),
                    )
                ],
            ]
        ),
        parse_mode="HTML",
    )


async def how_it_works_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    await query.edit_message_text(
        "📌 <b>Как создать резюме:</b>\n\n"
        "1️⃣ Нажми «Создать резюме»\n"
        "2️⃣ Ответь на 11 вопросов (можно голосом 🎤)\n"
        "3️⃣ ИИ составляет профессиональное резюме\n"
        "4️⃣ Смотри бесплатный предпросмотр\n"
        "5️⃣ Оплати 99 ⭐ или 149 ₽ — PDF в чат\n\n"
        "⏱ 3-5 минут от начала до PDF.",
        reply_markup=InlineKeyboardMarkup(
            [
                [InlineKeyboardButton("📝 Создать резюме", web_app=WebAppInfo(url=MINI_APP_URL))],
                [InlineKeyboardButton("◀️ Назад", callback_data="back_to_start")],
            ]
        ),
        parse_mode="HTML",
    )


async def trust_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    count = get_resume_count()
    await query.edit_message_text(
        _trust_text(count),
        reply_markup=InlineKeyboardMarkup(
            [
                [InlineKeyboardButton("📝 Создать резюме", web_app=WebAppInfo(url=MINI_APP_URL))],
                [
                    InlineKeyboardButton(
                        "🖼 Примеры", web_app=WebAppInfo(url=f"{MINI_APP_URL}#examples")
                    )
                ],
                [InlineKeyboardButton("◀️ Назад", callback_data="back_to_start")],
            ]
        ),
        parse_mode="HTML",
    )


async def invite_prompt_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    invite_link = f"https://t.me/{settings.BOT_USERNAME}?start=ref_{user_id}"
    await query.edit_message_text(
        "🎁 <b>Пригласи друга — получи бесплатное резюме!</b>\n\n"
        "Как это работает:\n"
        "1. Отправь ссылку другу\n"
        "2. Друг создаёт и оплачивает резюме\n"
        "3. Ты получаешь одно бесплатное резюме 🎉\n\n"
        f"Твоя ссылка:\n<code>{invite_link}</code>",
        reply_markup=InlineKeyboardMarkup(
            [
                [
                    InlineKeyboardButton(
                        "📤 Поделиться",
                        switch_inline_query=f"Создай резюме за 5 минут! {invite_link}",
                    )
                ],
                [InlineKeyboardButton("◀️ Назад", callback_data="back_to_start")],
            ]
        ),
        parse_mode="HTML",
    )


async def back_to_start_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    count = get_resume_count()
    await query.edit_message_text(
        _start_text(count),
        reply_markup=_start_keyboard(),
        parse_mode="HTML",
    )


async def fallback_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Я работаю через мини-приложение — там удобнее всего. 👇\n\n"
        "Если что-то не работает — напиши /support",
        reply_markup=InlineKeyboardMarkup(
            [
                [InlineKeyboardButton("📝 Создать резюме", web_app=WebAppInfo(url=MINI_APP_URL))],
                [
                    InlineKeyboardButton(
                        "📋 Мои резюме", web_app=WebAppInfo(url=f"{MINI_APP_URL}#history")
                    ),
                    InlineKeyboardButton(
                        "🖼 Примеры", web_app=WebAppInfo(url=f"{MINI_APP_URL}#examples")
                    ),
                ],
                [InlineKeyboardButton("❓ Как это работает", callback_data="how_it_works")],
            ]
        ),
    )


async def follow_up_after_payment(context: ContextTypes.DEFAULT_TYPE):
    job = context.job
    telegram_id = job.data["telegram_id"]
    user_name = job.data.get("first_name", "")
    user_id = job.data.get("user_id")
    invite_link = f"https://t.me/{settings.BOT_USERNAME}?start=ref_{user_id}"

    keyboard = InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("🎁 Получить бесплатное резюме", callback_data="invite_prompt")],
            [InlineKeyboardButton("📝 Создать ещё резюме", web_app=WebAppInfo(url=MINI_APP_URL))],
        ]
    )
    try:
        await context.bot.send_message(
            chat_id=telegram_id,
            text=(
                f"Как тебе резюме{', ' + html.escape(str(user_name), quote=False) if user_name else ''}? 😊\n\n"
                "Если понравилось — пригласи друга!\n"
                "За каждого, кто оплатит резюме, ты получишь <b>одно бесплатное</b>.\n\n"
                f"Твоя ссылка:\n<code>{invite_link}</code>"
            ),
            reply_markup=keyboard,
            parse_mode="HTML",
        )
    except Exception as e:
        logger.warning("Follow-up failed for %s: %s", telegram_id, e)


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

        if context.job_queue:
            context.job_queue.run_once(
                follow_up_after_payment,
                when=45,
                data={
                    "telegram_id": telegram_id,
                    "first_name": update.message.from_user.first_name,
                    "user_id": telegram_id,
                },
            )
    except Exception:
        logger.exception("successful_payment handler failed")
        await update.message.reply_text(
            "Оплата получена, но PDF не удалось отправить. Напиши /help — мы поможем."
        )


async def post_init(application: Application) -> None:
    get_resume_count()
    await application.bot.set_my_commands(
        [
            BotCommand("start", "Запустить бота"),
            BotCommand("resume", "Создать новое резюме"),
            BotCommand("myresumes", "Мои резюме"),
            BotCommand("examples", "Примеры резюме"),
            BotCommand("invite", "Пригласить друга"),
            BotCommand("trust", "Почему нам доверяют"),
            BotCommand("support", "Связаться с поддержкой"),
            BotCommand("help", "Как это работает"),
        ]
    )
    await application.bot.set_chat_menu_button(
        menu_button=MenuButtonWebApp(
            text="📝 Создать резюме",
            web_app=WebAppInfo(url=MINI_APP_URL),
        )
    )


def main():
    app = (
        Application.builder()
        .token(settings.BOT_TOKEN)
        .post_init(post_init)
        .build()
    )

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("resume", resume_command))
    app.add_handler(CommandHandler("myresumes", my_resumes_command))
    app.add_handler(CommandHandler("examples", examples_command))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("trust", trust_command))
    app.add_handler(CommandHandler("invite", invite_command))
    app.add_handler(CommandHandler("support", support_command))

    app.add_handler(CallbackQueryHandler(how_it_works_callback, pattern="^how_it_works$"))
    app.add_handler(CallbackQueryHandler(trust_callback, pattern="^trust$"))
    app.add_handler(CallbackQueryHandler(back_to_start_callback, pattern="^back_to_start$"))
    app.add_handler(CallbackQueryHandler(invite_prompt_callback, pattern="^invite_prompt$"))

    app.add_handler(PreCheckoutQueryHandler(pre_checkout))
    app.add_handler(MessageHandler(filters.SUCCESSFUL_PAYMENT, successful_payment))

    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, fallback_text))

    logger.info("Bot started")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
