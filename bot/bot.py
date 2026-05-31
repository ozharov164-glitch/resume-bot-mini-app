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
from services.admin_notify import PaymentNotifyInfo  # noqa: E402
from services.user_registration import register_telegram_user  # noqa: E402
from services.founder_contact import (  # noqa: E402
    ensure_founder_username,
    founder_chat_hint_text,
    founder_display_name,
    founder_dm_url,
    support_hub_text,
)
from services.bot_copy import (  # noqa: E402
    examples_text,
    fallback_text as bot_fallback_text,
    follow_up_after_payment_text,
    founder_dm_fallback_text,
    how_it_works_text,
    invite_text,
    my_resumes_text,
    payment_error_text,
    resume_command_text,
    start_text,
    trust_text,
)
from services.payment_fulfillment import fulfill_paid_resume  # noqa: E402
from services.stats_display import public_resume_count  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

MINI_APP_URL = settings.FRONTEND_URL.rstrip("/")
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
            [
                InlineKeyboardButton("🛡️ Почему мы", callback_data="trust"),
                InlineKeyboardButton("💬 Поддержка", callback_data="support_hub"),
            ],
            [InlineKeyboardButton("🎁 Пригласить друга", callback_data="invite_prompt")],
        ]
    )


def _display_name(user) -> str:
    raw = user.first_name or user.username or "друг"
    return html.escape(str(raw), quote=False)


async def _register_bot_contact(tg_user, referrer_id: int | None = None) -> None:
    """First /start (or ref link): persist user + admin ping; optional referral."""
    if not tg_user:
        return
    try:
        db = get_db()
        await register_telegram_user(
            db,
            telegram_id=tg_user.id,
            first_name=tg_user.first_name or "",
            last_name=tg_user.last_name or "",
            username=tg_user.username or "",
        )
        if referrer_id and referrer_id != tg_user.id:
            await asyncio.to_thread(db.save_referral, referrer_id, tg_user.id)
    except Exception:
        logger.exception("bot contact registration failed telegram_id=%s", tg_user.id)


def get_resume_count() -> int:
    """Cached public resume count — same formula as /api/stats/count."""
    global _stats_cache
    now = time.monotonic()
    if _stats_cache and now - _stats_cache[1] < _STATS_TTL_SEC:
        return _stats_cache[0]
    count = public_resume_count(get_db())
    _stats_cache = (count, now)
    return count


async def _get_resume_count() -> int:
    return get_resume_count()


async def _support_keyboard(bot) -> InlineKeyboardMarkup:
    username = await ensure_founder_username(bot)
    dm_url = founder_dm_url(username)
    label = f"✉️ Написать {founder_display_name()}"
    if dm_url:
        contact_row = [InlineKeyboardButton(label, url=dm_url)]
    else:
        contact_row = [InlineKeyboardButton(label, callback_data="founder_dm_hint")]
    return InlineKeyboardMarkup(
        [
            contact_row,
            [InlineKeyboardButton("📝 Создать резюме", web_app=WebAppInfo(url=MINI_APP_URL))],
            [InlineKeyboardButton("◀️ В меню", callback_data="back_to_start")],
        ]
    )


async def _reply_support_hub(update: Update, *, edit: bool = False) -> None:
    user = update.effective_user
    greeting = _display_name(user) if user else None
    text = support_hub_text(greeting=greeting)
    bot = update.get_bot()
    keyboard = await _support_keyboard(bot)
    if edit and update.callback_query:
        await update.callback_query.edit_message_text(
            text, reply_markup=keyboard, parse_mode="HTML"
        )
        return
    message = update.effective_message
    if message:
        await message.reply_text(text, reply_markup=keyboard, parse_mode="HTML")


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    referrer_id = None
    tg_user = update.message.from_user
    if context.args and context.args[0].startswith("ref_"):
        try:
            referrer_id = int(context.args[0][4:])
        except (ValueError, IndexError):
            referrer_id = None

    count = get_resume_count()
    text = start_text(count, _display_name(tg_user))
    await update.message.reply_text(text, reply_markup=_start_keyboard(), parse_mode="HTML")

    asyncio.create_task(_register_bot_contact(tg_user, referrer_id))


async def resume_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = InlineKeyboardMarkup(
        [[InlineKeyboardButton("📝 Открыть конструктор", web_app=WebAppInfo(url=MINI_APP_URL))]]
    )
    await update.message.reply_text(resume_command_text(), reply_markup=keyboard)


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
    await update.message.reply_text(my_resumes_text(), reply_markup=keyboard)


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
    await update.message.reply_text(examples_text(), reply_markup=keyboard)


async def trust_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    count = get_resume_count()
    await update.message.reply_text(
        trust_text(count),
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
    await _reply_support_hub(update)


async def founder_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await _reply_support_hub(update)


async def support_hub_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    await _reply_support_hub(update, edit=True)


async def founder_dm_hint_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    username = await ensure_founder_username(query.get_bot())
    if not username:
        await query.edit_message_text(
            founder_dm_fallback_text(),
            reply_markup=InlineKeyboardMarkup(
                [[InlineKeyboardButton("◀️ В меню", callback_data="back_to_start")]]
            ),
        )
        return
    await query.edit_message_text(
        founder_chat_hint_text(username),
        reply_markup=InlineKeyboardMarkup(
            [
                [InlineKeyboardButton(f"✉️ @{username}", url=founder_dm_url(username))],
                [InlineKeyboardButton("◀️ Назад", callback_data="support_hub")],
            ]
        ),
        parse_mode="HTML",
        disable_web_page_preview=True,
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = InlineKeyboardMarkup(
        [[InlineKeyboardButton("📝 Создать резюме", web_app=WebAppInfo(url=MINI_APP_URL))]]
    )
    await update.message.reply_text(
        how_it_works_text(),
        reply_markup=keyboard,
        parse_mode="HTML",
    )


async def invite_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.message.from_user.id
    invite_link = f"https://t.me/{settings.BOT_USERNAME}?start=ref_{user_id}"

    await update.message.reply_text(
        invite_text(invite_link),
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
        how_it_works_text(),
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
        trust_text(count),
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
        invite_text(invite_link, compact=True),
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
        start_text(count),
        reply_markup=_start_keyboard(),
        parse_mode="HTML",
    )


async def fallback_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        bot_fallback_text(),
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
                [
                    InlineKeyboardButton("❓ Как это работает", callback_data="how_it_works"),
                    InlineKeyboardButton("💬 Поддержка", callback_data="support_hub"),
                ],
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
            text=follow_up_after_payment_text(user_name or None, invite_link),
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
        from_user = update.message.from_user
        db = get_db()
        pay_info = PaymentNotifyInfo(
            provider="telegram_stars",
            amount=str(payment.total_amount),
            currency="⭐" if payment.currency == "XTR" else payment.currency,
            resume_id=resume_id,
            telegram_id=telegram_id,
            username=from_user.username or "",
            first_name=from_user.first_name or "",
        )
        await fulfill_paid_resume(db, resume_id, telegram_id, payment=pay_info)

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
        await update.message.reply_text(payment_error_text())


async def post_init(application: Application) -> None:
    get_resume_count()
    await ensure_founder_username(application.bot)
    await application.bot.set_my_commands(
        [
            BotCommand("start", "Запустить бота"),
            BotCommand("resume", "Создать новое резюме"),
            BotCommand("myresumes", "Мои резюме"),
            BotCommand("examples", "Примеры резюме"),
            BotCommand("invite", "Пригласить друга"),
            BotCommand("trust", "Почему нам доверяют"),
            BotCommand("support", "Помощь и связь с основателем"),
            BotCommand("founder", "Написать основателю"),
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
    app.add_handler(CommandHandler("founder", founder_command))

    app.add_handler(CallbackQueryHandler(how_it_works_callback, pattern="^how_it_works$"))
    app.add_handler(CallbackQueryHandler(trust_callback, pattern="^trust$"))
    app.add_handler(CallbackQueryHandler(support_hub_callback, pattern="^support_hub$"))
    app.add_handler(CallbackQueryHandler(founder_dm_hint_callback, pattern="^founder_dm_hint$"))
    app.add_handler(CallbackQueryHandler(back_to_start_callback, pattern="^back_to_start$"))
    app.add_handler(CallbackQueryHandler(invite_prompt_callback, pattern="^invite_prompt$"))

    app.add_handler(PreCheckoutQueryHandler(pre_checkout))
    app.add_handler(MessageHandler(filters.SUCCESSFUL_PAYMENT, successful_payment))

    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, fallback_text))

    logger.info("Bot started")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
