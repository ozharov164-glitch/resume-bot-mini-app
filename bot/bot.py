import asyncio
import html
import json
import logging
import sys
import time
from functools import wraps
from pathlib import Path

import httpx

from telegram import (
    BotCommand,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    MenuButtonWebApp,
    Update,
    WebAppInfo,
)
from telegram.error import BadRequest
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
from services.admin_notify import PaymentNotifyInfo, notify_promo_activation  # noqa: E402
from services.promo_service import activate_promo  # noqa: E402
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
    promo_activated_text,
    promo_invalid_text,
    promo_prompt_text,
    reengagement_text,
    resume_command_text,
    start_text,
    trust_hub_text,
    trust_price_text,
    trust_proof_text,
    trust_text,
    trust_vs_ai_text,
)
from services.payment_fulfillment import fulfill_paid_resume  # noqa: E402
from services.stats_display import public_resume_count  # noqa: E402
from services.affiliate_service import get_affiliate_stats_for_owner  # noqa: E402
from services.admin_stats import stats_exclude_telegram_ids  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

MINI_APP_URL = settings.FRONTEND_URL.rstrip("/")
API_URL = settings.APP_URL.rstrip("/")
_ADMIN_KEY = settings.ADMIN_SECRET_KEY
_STATS_TTL_SEC = 60.0
_stats_cache: tuple[int, float] | None = None
PDF_TEMPLATE_LABELS = {
    "classic": "Classic",
    "modern": "Modern",
    "compact": "Compact",
}


def _paid_template_keyboard(resume_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    f"🖼 {PDF_TEMPLATE_LABELS['classic']}",
                    callback_data=f"paid_tpl:{resume_id}:classic",
                ),
                InlineKeyboardButton(
                    f"✨ {PDF_TEMPLATE_LABELS['modern']}",
                    callback_data=f"paid_tpl:{resume_id}:modern",
                ),
            ],
            [
                InlineKeyboardButton(
                    f"📄 {PDF_TEMPLATE_LABELS['compact']}",
                    callback_data=f"paid_tpl:{resume_id}:compact",
                )
            ],
        ]
    )


def _founder_ids() -> list[int]:
    return [int(x) for x in settings.FOUNDER_TELEGRAM_IDS.split(",") if x.strip()]


def _is_user_affiliate(telegram_id: int) -> bool:
    try:
        return bool(get_db().is_user_affiliate(telegram_id))
    except Exception:
        logger.exception("is_user_affiliate check failed telegram_id=%s", telegram_id)
        return False


def _menu_flags(user) -> tuple[bool, bool]:
    if not user:
        return False, False
    is_admin = user.id in _founder_ids()
    is_affiliate = _is_user_affiliate(user.id)
    return is_admin, is_affiliate


def affiliate_only(func):
    @wraps(func)
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE):
        user = update.effective_user
        if not user or not _is_user_affiliate(user.id):
            if update.callback_query:
                await update.callback_query.answer("⛔ Доступ закрыт", show_alert=True)
            elif update.message:
                await update.message.reply_text("⛔ Доступ к панели траффера закрыт.")
            return
        return await func(update, context)

    return wrapper


def admin_only(func):
    @wraps(func)
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE):
        user = update.effective_user
        if not user or user.id not in _founder_ids():
            if update.callback_query:
                await update.callback_query.answer("⛔ Нет доступа", show_alert=True)
            elif update.message:
                await update.message.reply_text("⛔ Нет доступа")
            return
        return await func(update, context)

    return wrapper


def _admin_headers() -> dict[str, str]:
    return {"X-Admin-Key": _ADMIN_KEY}


def _admin_back_refresh(refresh_callback: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("🔄 Обновить", callback_data=refresh_callback)],
            [InlineKeyboardButton("◀️ Назад", callback_data="adm_back")],
        ]
    )


async def _edit_callback_message(
    query,
    text: str,
    *,
    reply_markup=None,
    parse_mode: str = "HTML",
    disable_web_page_preview: bool | None = None,
) -> None:
    """Edit inline message; tolerate Telegram 'message is not modified' on refresh."""
    kwargs: dict = {"reply_markup": reply_markup, "parse_mode": parse_mode}
    if disable_web_page_preview is not None:
        kwargs["disable_web_page_preview"] = disable_web_page_preview
    try:
        await query.edit_message_text(text, **kwargs)
        await query.answer()
    except BadRequest as exc:
        if "Message is not modified" in str(exc):
            await query.answer("Данные актуальны")
            return
        await query.answer("Ошибка отображения", show_alert=True)
        raise


def _admin_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton("📊 Статистика", callback_data="adm_stats"),
                InlineKeyboardButton("🎟 Промокоды", callback_data="adm_promos"),
            ],
            [
                InlineKeyboardButton("👥 Трафферы", callback_data="adm_affiliates"),
                InlineKeyboardButton("➕ Добавить траффера", callback_data="adm_add_affiliate"),
            ],
            [
                InlineKeyboardButton("➕ /newpromo КОД", callback_data="adm_create_promo"),
                InlineKeyboardButton("📈 Топ рефереры", callback_data="adm_refs"),
            ],
            [
                InlineKeyboardButton("📋 Активации промо", callback_data="adm_promo_acts"),
                InlineKeyboardButton("📈 Воронка", callback_data="adm_funnel"),
            ],
        ]
    )


@admin_only
async def admin_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🔧 Админ-панель ResumeBot",
        reply_markup=_admin_menu_keyboard(),
    )


@admin_only
async def newpromo_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    args = context.args or []
    if not args:
        await update.message.reply_text(
            "Использование: /newpromo КОД [скидка%] [лимит] [owner_tg_id]\n"
            "Пример: /newpromo BLOG10 10 200 123456789\n"
            "owner_tg_id — Telegram ID траффера для атрибуции."
        )
        return
    code = args[0].strip()
    discount = int(args[1]) if len(args) > 1 else 10
    max_uses = int(args[2]) if len(args) > 2 else 100
    owner_tg_id = int(args[3]) if len(args) > 3 else None
    payload: dict = {"code": code, "discount": discount, "max_uses": max_uses}
    if owner_tg_id is not None:
        payload["owner_tg_id"] = owner_tg_id
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{API_URL}/api/admin/promos",
                headers=_admin_headers(),
                json=payload,
            )
        if resp.status_code == 200:
            data = resp.json()
            promo = data.get("promo", {})
            owner_line = f"\nТраффер: <code>{owner_tg_id}</code>" if owner_tg_id else ""
            await update.message.reply_text(
                f"✅ Промокод создан: <b>{html.escape(promo.get('code', code))}</b>\n"
                f"Скидка: {promo.get('discount_percent', discount)}%\n"
                f"Лимит: {max_uses}{owner_line}",
                parse_mode="HTML",
            )
        else:
            await update.message.reply_text(f"❌ Ошибка: {resp.status_code} {resp.text[:200]}")
    except Exception as exc:
        logger.exception("newpromo failed")
        await update.message.reply_text(f"❌ Не удалось создать промокод: {exc}")


@admin_only
async def adm_stats_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{API_URL}/api/admin/stats", headers=_admin_headers())
        if resp.status_code != 200:
            await _edit_callback_message(query, f"❌ Ошибка stats: {resp.status_code}")
            return
        data = resp.json()
        text = (
            f"📊 <b>Статистика</b>\n\n"
            f"Всего резюме (витрина): {data.get('count', 0)}\n"
            f"Оплачено (без тестов): {data.get('paid_count', 0)}\n"
            f"Сегодня (без тестов): {data.get('today_count', 0)}\n"
            f"Пользователей: {data.get('users', 0)}\n"
            f"Пришли по реф-ссылкам: {data.get('referred', 0)}"
        )
        keyboard = _admin_back_refresh("adm_stats")
        await _edit_callback_message(query, text, reply_markup=keyboard)
    except Exception as exc:
        logger.exception("adm_stats failed")
        try:
            await _edit_callback_message(query, f"❌ {exc}")
        except Exception:
            await query.answer(f"❌ {exc}", show_alert=True)


@admin_only
async def adm_promos_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{API_URL}/api/admin/promos/analytics", headers=_admin_headers())
        if resp.status_code != 200:
            await _edit_callback_message(query, f"❌ Ошибка promos: {resp.status_code}")
            return
        promos = resp.json().get("promos", [])
        if not promos:
            text = "🎟 Промокодов пока нет.\n\nСоздай: /newpromo КОД 10 100 [owner_tg_id]"
        else:
            lines = ["🎟 <b>Промокоды</b> (активации / оплаты)\n"]
            for p in promos[:15]:
                status = "✅" if p.get("is_active") else "❌"
                code = html.escape(str(p.get("code", "")))
                uses = p.get("uses_count", 0)
                max_u = p.get("max_uses", "∞")
                disc = p.get("discount_percent", 0)
                activations = p.get("activations", 0)
                paid = p.get("paid_count", 0)
                owner = p.get("owner_tg_id")
                owner_part = f", траффер <code>{owner}</code>" if owner else ""
                lines.append(
                    f"{status} <code>{code}</code> −{disc}% · "
                    f"активаций {activations}, оплат {paid}, использований {uses}/{max_u}{owner_part}"
                )
            text = "\n".join(lines)
        keyboard = _admin_back_refresh("adm_promos")
        await _edit_callback_message(query, text, reply_markup=keyboard)
    except Exception as exc:
        logger.exception("adm_promos failed")
        try:
            await _edit_callback_message(query, f"❌ {exc}")
        except Exception:
            await query.answer(f"❌ {exc}", show_alert=True)


def _format_affiliate_name(stats: dict) -> str:
    name = html.escape(str(stats.get("first_name") or "")) or "—"
    uname = stats.get("username")
    handle = f" @{html.escape(str(uname))}" if uname else ""
    return f"{name}{handle}"


def _format_affiliate_panel_text(stats: dict) -> str:
    code = stats.get("code")
    if not code:
        return (
            "📈 <b>Панель траффера</b>\n\n"
            "Промокод ещё не назначен. Напишите администратору."
        )
    code_esc = html.escape(str(code))
    bot_user = settings.BOT_USERNAME.lstrip("@")
    promo_link = f"https://t.me/{bot_user}?start=promo_{code_esc}"
    status = "активен ✅" if stats.get("is_active") else "отключён ❌"
    discount = int(stats.get("discount_percent") or 0)
    return (
        "📈 <b>Панель траффера</b>\n\n"
        f"Промокод: <code>{code_esc}</code> (−{discount}%) · {status}\n"
        f"Ссылка: {html.escape(promo_link)}\n\n"
        f"👤 Активировали промокод: <b>{stats.get('activations', 0)}</b>\n"
        f"💳 Купили резюме: <b>{stats.get('paid_count', 0)}</b>"
    )


def _affiliate_panel_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("🔄 Обновить", callback_data="aff_refresh")],
            [InlineKeyboardButton("◀️ В меню", callback_data="back_to_start")],
        ]
    )


async def _fetch_affiliate_stats(telegram_id: int) -> dict | None:
    return await asyncio.to_thread(
        get_affiliate_stats_for_owner,
        get_db(),
        telegram_id,
        exclude_telegram_ids=stats_exclude_telegram_ids(),
    )


async def _notify_affiliate_granted(context: ContextTypes.DEFAULT_TYPE, telegram_id: int, code: str) -> None:
    try:
        await context.bot.send_message(
            chat_id=telegram_id,
            text=(
                "🎉 <b>Вам открыта панель траффера!</b>\n\n"
                f"Ваш промокод: <code>{html.escape(code)}</code>\n\n"
                "Нажмите /start — в меню появится кнопка «📈 Панель траффера»."
            ),
            parse_mode="HTML",
        )
    except Exception:
        logger.exception("affiliate grant notify failed telegram_id=%s", telegram_id)


async def _notify_affiliate_revoked(context: ContextTypes.DEFAULT_TYPE, telegram_id: int) -> None:
    try:
        await context.bot.send_message(
            chat_id=telegram_id,
            text="ℹ️ Доступ к панели траффера закрыт. Промокод больше не принимается.",
        )
    except Exception:
        logger.exception("affiliate revoke notify failed telegram_id=%s", telegram_id)


@admin_only
async def adm_affiliates_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(f"{API_URL}/api/admin/affiliates", headers=_admin_headers())
        if resp.status_code != 200:
            await _edit_callback_message(
                query,
                f"❌ Ошибка affiliates: {resp.status_code}",
                reply_markup=_admin_back_refresh("adm_affiliates"),
            )
            return
        affiliates = resp.json().get("affiliates", [])
        if not affiliates:
            text = (
                "👥 <b>Трафферы</b>\n\n"
                "Пока никого нет.\n\n"
                "Нажмите «➕ Добавить траффера» или используйте /newpromo с owner_tg_id."
            )
            keyboard = InlineKeyboardMarkup(
                [
                    [InlineKeyboardButton("🔄 Обновить", callback_data="adm_affiliates")],
                    [InlineKeyboardButton("◀️ Назад", callback_data="adm_back")],
                ]
            )
        else:
            lines = ["👥 <b>Трафферы</b> (активации / оплаты)\n"]
            rows: list[list[InlineKeyboardButton]] = []
            for aff in affiliates[:15]:
                tg_id = aff.get("telegram_id")
                code = html.escape(str(aff.get("code") or "—"))
                activations = aff.get("activations", 0)
                paid = aff.get("paid_count", 0)
                lines.append(
                    f"• {_format_affiliate_name(aff)} (<code>{tg_id}</code>)\n"
                    f"  <code>{code}</code> · акт. {activations}, оплат {paid}"
                )
                rows.append(
                    [
                        InlineKeyboardButton(
                            f"❌ Убрать {tg_id}",
                            callback_data=f"adm_revoke_aff:{tg_id}",
                        )
                    ]
                )
            text = "\n".join(lines)
            rows.append([InlineKeyboardButton("🔄 Обновить", callback_data="adm_affiliates")])
            rows.append([InlineKeyboardButton("◀️ Назад", callback_data="adm_back")])
            keyboard = InlineKeyboardMarkup(rows)
        await _edit_callback_message(query, text, reply_markup=keyboard)
    except Exception as exc:
        logger.exception("adm_affiliates failed")
        try:
            await _edit_callback_message(
                query,
                f"❌ {exc}",
                reply_markup=_admin_back_refresh("adm_affiliates"),
            )
        except Exception:
            await query.answer(f"❌ {exc}", show_alert=True)


@admin_only
async def adm_add_affiliate_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    context.user_data["awaiting_affiliate"] = "id"
    context.user_data.pop("affiliate_draft", None)
    keyboard = InlineKeyboardMarkup(
        [[InlineKeyboardButton("◀️ Отмена", callback_data="adm_add_affiliate_cancel")]]
    )
    await query.edit_message_text(
        "➕ <b>Добавить траффера</b>\n\n"
        "Отправьте Telegram ID пользователя (число).\n"
        "Пример: <code>123456789</code>",
        reply_markup=keyboard,
        parse_mode="HTML",
    )


@admin_only
async def adm_add_affiliate_cancel_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    context.user_data.pop("awaiting_affiliate", None)
    context.user_data.pop("affiliate_draft", None)
    await query.edit_message_text(
        "🔧 Админ-панель ResumeBot",
        reply_markup=_admin_menu_keyboard(),
    )


@admin_only
async def adm_revoke_affiliate_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data or ""
    try:
        telegram_id = int(data.split(":", 1)[1])
    except (IndexError, ValueError):
        await query.answer("Некорректный ID", show_alert=True)
        return
    keyboard = InlineKeyboardMarkup(
        [
            [
                InlineKeyboardButton(
                    "✅ Да, убрать",
                    callback_data=f"adm_revoke_ok:{telegram_id}",
                ),
                InlineKeyboardButton("◀️ Отмена", callback_data="adm_affiliates"),
            ]
        ]
    )
    await query.edit_message_text(
        f"⚠️ Убрать траффера <code>{telegram_id}</code>?\n\n"
        "Статистика сохранится, промокод перестанет работать.",
        reply_markup=keyboard,
        parse_mode="HTML",
    )


@admin_only
async def adm_revoke_affiliate_confirm_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data or ""
    try:
        telegram_id = int(data.split(":", 1)[1])
    except (IndexError, ValueError):
        await query.answer("Некорректный ID", show_alert=True)
        return
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{API_URL}/api/admin/affiliates/revoke",
                headers=_admin_headers(),
                json={"telegram_id": telegram_id},
            )
        if resp.status_code != 200:
            detail = resp.text[:200]
            await query.edit_message_text(
                f"❌ Не удалось убрать: {resp.status_code} {detail}",
                reply_markup=_admin_back_refresh("adm_affiliates"),
            )
            return
        payload = resp.json()
        codes = payload.get("codes_deactivated") or []
        codes_line = ", ".join(html.escape(str(c)) for c in codes) if codes else "—"
        await _notify_affiliate_revoked(context, telegram_id)
        await query.edit_message_text(
            f"✅ Траффер <code>{telegram_id}</code> снят.\n"
            f"Отключены промокоды: {codes_line}",
            reply_markup=_admin_back_refresh("adm_affiliates"),
            parse_mode="HTML",
        )
    except Exception as exc:
        logger.exception("adm_revoke_affiliate_confirm failed")
        await query.edit_message_text(
            f"❌ {exc}",
            reply_markup=_admin_back_refresh("adm_affiliates"),
        )


@affiliate_only
async def aff_panel_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    stats = await _fetch_affiliate_stats(query.from_user.id)
    if not stats:
        await _edit_callback_message(
            query,
            "⛔ Доступ к панели траффера закрыт.",
            reply_markup=InlineKeyboardMarkup(
                [[InlineKeyboardButton("◀️ В меню", callback_data="back_to_start")]]
            ),
        )
        return
    await _edit_callback_message(
        query,
        _format_affiliate_panel_text(stats),
        reply_markup=_affiliate_panel_keyboard(),
        disable_web_page_preview=True,
    )


@affiliate_only
async def aff_refresh_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    stats = await _fetch_affiliate_stats(query.from_user.id)
    if not stats:
        await _edit_callback_message(
            query,
            "⛔ Доступ к панели траффера закрыт.",
            reply_markup=InlineKeyboardMarkup(
                [[InlineKeyboardButton("◀️ В меню", callback_data="back_to_start")]]
            ),
        )
        return
    await _edit_callback_message(
        query,
        _format_affiliate_panel_text(stats),
        reply_markup=_affiliate_panel_keyboard(),
        disable_web_page_preview=True,
    )


@admin_only
async def adm_refs_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    keyboard = InlineKeyboardMarkup(
        [[InlineKeyboardButton("◀️ Назад", callback_data="adm_back")]]
    )
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{API_URL}/api/admin/referrers", headers=_admin_headers()
            )
        if resp.status_code != 200:
            await query.edit_message_text(
                f"❌ Ошибка referrers: {resp.status_code}", reply_markup=keyboard
            )
            return
        referrers = resp.json().get("referrers", [])
        if not referrers:
            text = (
                "👥 <b>Топ рефереров</b>\n\n"
                "Пока никто не пришёл по реф-ссылкам.\n\n"
                "Реф-ссылка формируется в кнопке «🎁 Пригласить друга», "
                "а трафик можно метить промокодами (/newpromo)."
            )
        else:
            lines = ["👥 <b>Топ рефереров</b>\n"]
            for i, r in enumerate(referrers, 1):
                name = html.escape(str(r.get("first_name") or "")) or "—"
                uname = r.get("username")
                handle = f" @{html.escape(str(uname))}" if uname else ""
                rid = r.get("referrer_id")
                invited = r.get("invited", 0)
                lines.append(f"{i}. {name}{handle} (<code>{rid}</code>) — {invited} 👤")
            text = "\n".join(lines)
        await query.edit_message_text(text, parse_mode="HTML", reply_markup=keyboard)
    except Exception as exc:
        logger.exception("adm_refs failed")
        await query.edit_message_text(f"❌ {exc}", reply_markup=keyboard)


@admin_only
async def adm_create_promo_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    keyboard = InlineKeyboardMarkup(
        [[InlineKeyboardButton("◀️ Назад", callback_data="adm_back")]]
    )
    await query.edit_message_text(
        "➕ Создание промокода:\n\n/newpromo КОД [скидка%] [лимит] [owner_tg_id]\n"
        "Пример: /newpromo BLOG10 10 200 123456789",
        reply_markup=keyboard,
    )


@admin_only
async def adm_promo_acts_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    keyboard = InlineKeyboardMarkup(
        [[InlineKeyboardButton("◀️ Назад", callback_data="adm_back")]]
    )
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{API_URL}/api/admin/promos/activations",
                headers=_admin_headers(),
                params={"limit": 15},
            )
        if resp.status_code != 200:
            await query.edit_message_text(
                f"❌ Ошибка activations: {resp.status_code}", reply_markup=keyboard
            )
            return
        activations = resp.json().get("activations", [])
        if not activations:
            text = "📋 <b>Активации промокодов</b>\n\nПока никто не активировал промокод."
        else:
            lines = ["📋 <b>Последние активации промокодов</b>\n"]
            for act in activations:
                code = html.escape(str(act.get("promo_code", "")))
                name = html.escape(str(act.get("first_name") or "—"))
                uname = act.get("username")
                handle = f" @{html.escape(str(uname))}" if uname else ""
                uid = act.get("user_tg_id")
                paid = "✅ оплатил" if act.get("paid_at") else "⏳ ждём оплату"
                owner = act.get("owner_tg_id")
                owner_part = f" · траффер <code>{owner}</code>" if owner else ""
                lines.append(f"• <code>{code}</code> — {name}{handle} (<code>{uid}</code>) — {paid}{owner_part}")
            text = "\n".join(lines)
        await query.edit_message_text(text, parse_mode="HTML", reply_markup=keyboard)
    except Exception as exc:
        logger.exception("adm_promo_acts failed")
        await query.edit_message_text(f"❌ {exc}", reply_markup=keyboard)


def _format_admin_funnel_text(d: dict) -> str:
    """Render founder funnel: unique users, real payments, test traffic excluded."""

    def _step(label: str, key: str, prev_key: str | None) -> str:
        n = int(d.get(key, 0) or 0)
        if prev_key is None:
            return f"• {label}: <b>{n}</b>"
        prev = int(d.get(prev_key, 0) or 0)
        if prev > 0 and n <= prev:
            drop = round(100 * (prev - n) / prev)
            return f"• {label}: <b>{n}</b> <i>(−{drop}%)</i>"
        return f"• {label}: <b>{n}</b>"

    lines = [
        "📈 <b>Воронка (7 дней)</b>",
        "<i>Уникальные пользователи · без ваших тестов</i>",
        "",
        _step("Начали анкету", "onboarding_started", None),
        _step("Нажали «Сформировать»", "generate_started", "onboarding_started"),
        _step("Выбрали шаблон", "template_selected", "generate_started"),
        _step("Открыли предпросмотр", "preview_viewed", "template_selected"),
        _step("Нажали «Оплатить»", "pay_clicked", "preview_viewed"),
        "",
        f"💳 <b>Оплатили (реально):</b> {int(d.get('payments_real', 0) or 0)}",
        "",
        f"Конверсия (оплата / анкета): <b>{d.get('conversion_rate', '0%')}</b>",
        f"Оплата после предпросмотра: <b>{d.get('preview_to_pay_rate', '0%')}</b>",
        f"Оплата после «Оплатить»: <b>{d.get('pay_click_to_paid_rate', '0%')}</b>",
        "",
        f"Поделились: {int(d.get('share_clicked', 0) or 0)} · "
        f"Share-rate: <b>{d.get('share_rate', '0%')}</b>",
    ]
    return "\n".join(lines)


@admin_only
async def adm_funnel_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{API_URL}/api/admin/funnel-key",
                headers=_admin_headers(),
            )
        if resp.status_code != 200:
            await _edit_callback_message(query, f"❌ Ошибка funnel: {resp.status_code}")
            return
        text = _format_admin_funnel_text(resp.json())
        keyboard = _admin_back_refresh("adm_funnel")
        await _edit_callback_message(query, text, reply_markup=keyboard)
    except Exception as exc:
        logger.exception("adm_funnel failed")
        await query.answer(f"❌ {exc}", show_alert=True)


@admin_only
async def adm_back_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    await query.edit_message_text(
        "🔧 Админ-панель ResumeBot",
        reply_markup=_admin_menu_keyboard(),
    )


@admin_only
async def adm_open_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    await query.edit_message_text(
        "🔧 Админ-панель ResumeBot",
        reply_markup=_admin_menu_keyboard(),
    )


def _start_keyboard(is_admin: bool = False, is_affiliate: bool = False) -> InlineKeyboardMarkup:
    rows = [
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
        [InlineKeyboardButton("🎟 Активировать промокод", callback_data="promo_prompt")],
    ]
    if is_affiliate:
        rows.append(
            [InlineKeyboardButton("📈 Панель траффера", callback_data="aff_panel")]
        )
    if is_admin:
        rows.append(
            [InlineKeyboardButton("🔧 Админ-панель", callback_data="adm_open")]
        )
    return InlineKeyboardMarkup(rows)


def _promo_result_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("📝 Создать резюме", web_app=WebAppInfo(url=MINI_APP_URL))],
            [InlineKeyboardButton("◀️ В меню", callback_data="back_to_start")],
        ]
    )


async def _activate_promo_for_user(tg_user, code: str, *, message=None) -> None:
    if not tg_user or not code.strip():
        return
    try:
        await register_telegram_user(
            get_db(),
            telegram_id=tg_user.id,
            first_name=tg_user.first_name or "",
            last_name=tg_user.last_name or "",
            username=tg_user.username or "",
        )
        result = await asyncio.to_thread(activate_promo, get_db(), code.strip(), tg_user.id)
        if not result.get("already_active"):
            await notify_promo_activation(
                get_db(),
                promo_code=str(result.get("code", code)),
                discount_percent=int(result.get("discount_percent") or 0),
                telegram_id=tg_user.id,
                first_name=tg_user.first_name or "",
                username=tg_user.username or "",
                owner_tg_id=result.get("owner_tg_id"),
            )
        text = promo_activated_text(
            str(result.get("code", code)),
            int(result.get("discount_percent") or 0),
            already_active=bool(result.get("already_active")),
        )
        if message:
            await message.reply_text(text, reply_markup=_promo_result_keyboard(), parse_mode="HTML")
    except ValueError:
        if message:
            await message.reply_text(
                promo_invalid_text(),
                reply_markup=InlineKeyboardMarkup(
                    [[InlineKeyboardButton("◀️ В меню", callback_data="back_to_start")]]
                ),
            )
    except Exception:
        logger.exception("promo activation failed telegram_id=%s", tg_user.id)
        if message:
            await message.reply_text("❌ Не удалось активировать промокод. Попробуйте позже.")


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


async def promo_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["awaiting_promo"] = True
    keyboard = InlineKeyboardMarkup(
        [[InlineKeyboardButton("◀️ Отмена", callback_data="promo_cancel")]]
    )
    await update.message.reply_text(promo_prompt_text(), reply_markup=keyboard, parse_mode="HTML")


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message:
        return
    referrer_id = None
    tg_user = update.message.from_user

    if context.args and context.args[0].startswith("pay_"):
        resume_id = context.args[0][4:].strip()
        if resume_id:
            app_url = f"{MINI_APP_URL}#payment-return?resume_id={resume_id}"
            keyboard = InlineKeyboardMarkup(
                [
                    [
                        InlineKeyboardButton(
                            "✅ Открыть приложение",
                            web_app=WebAppInfo(url=app_url),
                        )
                    ],
                ]
            )
            await update.message.reply_text(
                "✅ <b>Оплата прошла!</b>\n\n"
                "Нажмите кнопку ниже — откроется приложение, PDF и DOCX придут в этот чат с ботом.",
                reply_markup=keyboard,
                parse_mode="HTML",
            )
            asyncio.create_task(_register_bot_contact(tg_user, None))
            return

    if context.args and context.args[0].startswith("ref_"):
        try:
            referrer_id = int(context.args[0][4:])
        except (ValueError, IndexError):
            referrer_id = None

    promo_code_from_link = None
    if context.args and context.args[0].startswith("promo_"):
        promo_code_from_link = context.args[0][6:].strip()

    count = get_resume_count()
    text = start_text(count, _display_name(tg_user))
    is_admin, is_affiliate = _menu_flags(tg_user)
    await update.message.reply_text(
        text, reply_markup=_start_keyboard(is_admin, is_affiliate), parse_mode="HTML"
    )

    asyncio.create_task(_register_bot_contact(tg_user, referrer_id))
    if promo_code_from_link:
        asyncio.create_task(_activate_promo_for_user(tg_user, promo_code_from_link, message=update.message))


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


def _trust_hub_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("📖 Полный обзор", callback_data="trust_main")],
            [
                InlineKeyboardButton("🤖 vs ChatGPT", callback_data="trust_vs_ai"),
                InlineKeyboardButton("💰 Цена", callback_data="trust_price"),
            ],
            [InlineKeyboardButton("⭐ Отзывы", callback_data="trust_proof")],
            [InlineKeyboardButton("📝 Создать резюме", web_app=WebAppInfo(url=MINI_APP_URL))],
            [
                InlineKeyboardButton(
                    "🖼 Примеры", web_app=WebAppInfo(url=f"{MINI_APP_URL}#examples")
                )
            ],
            [InlineKeyboardButton("◀️ В меню", callback_data="back_to_start")],
        ]
    )


def _trust_detail_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("📝 Создать резюме", web_app=WebAppInfo(url=MINI_APP_URL))],
            [InlineKeyboardButton("◀️ К разделу «Почему мы»", callback_data="trust")],
            [InlineKeyboardButton("◀️ В меню", callback_data="back_to_start")],
        ]
    )


async def _send_trust_hub(update: Update, *, edit: bool = False) -> None:
    count = get_resume_count()
    text = trust_hub_text(count)
    markup = _trust_hub_keyboard()
    if edit and update.callback_query:
        await update.callback_query.edit_message_text(
            text, reply_markup=markup, parse_mode="HTML"
        )
        return
    message = update.effective_message
    if message:
        await message.reply_text(text, reply_markup=markup, parse_mode="HTML")


async def trust_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await _send_trust_hub(update)


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


async def my_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message:
        return
    user_id = update.message.from_user.id
    db = get_db()
    stats = db.get_referral_stats(user_id)
    bonus = int(stats.get("bonus_stars") or 0)
    referral = db.get_referral_bonus(user_id)
    lines = [
        f"💎 Бонусный счёт: {bonus} Stars",
        "Списываются при оплате в Mini App — Stars или картой (кнопка «Применить скидку»).",
        "",
        f"👥 Друзей по вашей ссылке: {stats.get('invited', 0)}",
        f"💳 Из них оплатили: {stats.get('paid_referrals', 0)}",
    ]
    if referral > 0:
        lines.append(f"🎁 Бесплатных резюме (старый бонус): {referral}")
    await update.message.reply_text("\n".join(lines))


async def cabinet_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message:
        return
    user = update.message.from_user
    if not user or not _is_user_affiliate(user.id):
        await update.message.reply_text(
            "Кабинет траффера доступен только партнёрам с промокодом.\n"
            "Если вы траффер — напишите в поддержку."
        )
        return
    stats = await _fetch_affiliate_stats(user.id)
    if not stats:
        await update.message.reply_text("Не удалось загрузить статистику. Попробуйте позже.")
        return
    await update.message.reply_text(
        _format_affiliate_panel_text(stats),
        reply_markup=_affiliate_panel_keyboard(),
        parse_mode="HTML",
        disable_web_page_preview=True,
    )


async def invite_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_id = update.message.from_user.id
    invite_link = f"https://t.me/{settings.BOT_USERNAME}?start=ref_{user_id}"
    db = get_db()
    ref_stats = db.get_referral_stats(user_id)

    await update.message.reply_text(
        invite_text(
            invite_link,
            invited=int(ref_stats.get("invited") or 0),
            paid_referrals=int(ref_stats.get("paid_referrals") or 0),
            bonus_stars=int(ref_stats.get("bonus_stars") or 0),
        ),
        reply_markup=InlineKeyboardMarkup(
            [
                [
                    InlineKeyboardButton(
                        "📤 Поделиться с другом",
                        switch_inline_query=(
                            f"Резюме за 5 минут: PDF и DOCX, вопросы голосом, файлы в Telegram → {invite_link}"
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
    await _send_trust_hub(update, edit=True)


async def trust_main_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    count = get_resume_count()
    await query.edit_message_text(
        trust_text(count),
        reply_markup=_trust_detail_keyboard(),
        parse_mode="HTML",
    )


async def trust_vs_ai_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    await query.edit_message_text(
        trust_vs_ai_text(),
        reply_markup=_trust_detail_keyboard(),
        parse_mode="HTML",
    )


async def trust_price_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    await query.edit_message_text(
        trust_price_text(),
        reply_markup=_trust_detail_keyboard(),
        parse_mode="HTML",
    )


async def trust_proof_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    await query.edit_message_text(
        trust_proof_text(),
        reply_markup=_trust_detail_keyboard(),
        parse_mode="HTML",
    )


async def invite_prompt_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    invite_link = f"https://t.me/{settings.BOT_USERNAME}?start=ref_{user_id}"
    ref_stats = get_db().get_referral_stats(user_id)
    await query.edit_message_text(
        invite_text(
            invite_link,
            compact=True,
            invited=int(ref_stats.get("invited") or 0),
            paid_referrals=int(ref_stats.get("paid_referrals") or 0),
            bonus_stars=int(ref_stats.get("bonus_stars") or 0),
        ),
        reply_markup=InlineKeyboardMarkup(
            [
                [
                    InlineKeyboardButton(
                        "📤 Поделиться",
                        switch_inline_query=f"Резюме за 5 минут — PDF, DOCX и текст в Telegram! {invite_link}",
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
    is_admin, is_affiliate = _menu_flags(query.from_user)
    await query.edit_message_text(
        start_text(count),
        reply_markup=_start_keyboard(is_admin, is_affiliate),
        parse_mode="HTML",
    )


async def promo_prompt_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    context.user_data["awaiting_promo"] = True
    keyboard = InlineKeyboardMarkup(
        [[InlineKeyboardButton("◀️ Отмена", callback_data="promo_cancel")]]
    )
    await query.message.reply_text(promo_prompt_text(), reply_markup=keyboard, parse_mode="HTML")


async def promo_cancel_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    context.user_data.pop("awaiting_promo", None)
    count = get_resume_count()
    is_admin, is_affiliate = _menu_flags(query.from_user)
    await query.message.reply_text(
        start_text(count),
        reply_markup=_start_keyboard(is_admin, is_affiliate),
        parse_mode="HTML",
    )


async def affiliate_admin_text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    if not user or user.id not in _founder_ids():
        return
    step = context.user_data.get("awaiting_affiliate")
    if not step:
        return

    text = (update.message.text or "").strip()
    draft = context.user_data.setdefault("affiliate_draft", {})

    if step == "id":
        try:
            telegram_id = int(text)
        except ValueError:
            await update.message.reply_text("Отправьте числовой Telegram ID, например: 123456789")
            return
        if telegram_id in _founder_ids():
            await update.message.reply_text("Нельзя назначить администратора траффером.")
            return
        draft["telegram_id"] = telegram_id
        context.user_data["awaiting_affiliate"] = "code"
        await update.message.reply_text(
            f"ID: <code>{telegram_id}</code>\n\n"
            "Теперь отправьте промокод (латиница и цифры).\n"
            "Пример: <code>BLOG10</code>",
            parse_mode="HTML",
        )
        return

    if step == "code":
        code = text.upper().replace(" ", "")
        if not code or len(code) < 3:
            await update.message.reply_text("Промокод слишком короткий. Пример: BLOG10")
            return
        telegram_id = draft.get("telegram_id")
        if not telegram_id:
            context.user_data.pop("awaiting_affiliate", None)
            await update.message.reply_text("Сессия сброшена. Начните снова из админ-панели.")
            return
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{API_URL}/api/admin/affiliates",
                    headers=_admin_headers(),
                    json={"telegram_id": telegram_id, "code": code},
                )
            if resp.status_code != 200:
                detail = resp.text[:300]
                await update.message.reply_text(f"❌ Ошибка: {resp.status_code}\n{detail}")
                return
            data = resp.json()
            promo = data.get("promo", {})
            promo_code = str(promo.get("code", code))
            context.user_data.pop("awaiting_affiliate", None)
            context.user_data.pop("affiliate_draft", None)
            await _notify_affiliate_granted(context, int(telegram_id), promo_code)
            await update.message.reply_text(
                f"✅ Траффер <code>{telegram_id}</code> добавлен.\n"
                f"Промокод: <b>{html.escape(promo_code)}</b>\n"
                "Пользователю отправлено уведомление — ему нужно нажать /start.",
                parse_mode="HTML",
            )
        except Exception as exc:
            logger.exception("add affiliate failed")
            await update.message.reply_text(f"❌ Не удалось добавить траффера: {exc}")


async def text_message_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if context.user_data.get("awaiting_affiliate"):
        await affiliate_admin_text_handler(update, context)
        return
    if context.user_data.get("awaiting_promo"):
        await promo_text_handler(update, context)
        return
    await fallback_text(update, context)


async def promo_text_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.pop("awaiting_promo", None)
    code = (update.message.text or "").strip()
    if not code:
        await update.message.reply_text("Отправьте промокод текстом, например: BLOG10")
        context.user_data["awaiting_promo"] = True
        return
    await _activate_promo_for_user(update.effective_user, code, message=update.message)


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
            [InlineKeyboardButton("🎁 Пригласить друга (+Stars)", callback_data="invite_prompt")],
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
    query = update.pre_checkout_query
    if not query or not query.from_user:
        return
    try:
        from services.invoice_payload import parse_invoice_payload
        from services.payment_validation import expected_stars_amount

        payload = parse_invoice_payload(query.invoice_payload or "")
        resume_id = str(payload.get("resume_id") or "").strip()
        if not resume_id:
            await query.answer(ok=False, error_message="Некорректный счёт. Создайте оплату заново.")
            return

        payment_type = str(payload.get("type") or "single_pdf")
        bonus = int(payload.get("bonus_stars_applied") or 0)
        db = get_db()
        expected = expected_stars_amount(
            db,
            resume_id=resume_id,
            telegram_id=query.from_user.id,
            payment_type=payment_type,
            bonus_stars_applied=bonus,
        )
        if expected is None:
            await query.answer(ok=False, error_message="Резюме не найдено или счёт устарел.")
            return
        if int(query.total_amount) != expected:
            await query.answer(
                ok=False,
                error_message="Сумма счёта изменилась. Откройте оплату снова в приложении.",
            )
            return
        await query.answer(ok=True)
    except Exception:
        logger.exception("pre_checkout validation failed")
        await query.answer(ok=False, error_message="Не удалось проверить оплату. Попробуйте снова.")


async def successful_payment(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not update.message or not update.message.successful_payment:
        return
    payment = update.message.successful_payment
    try:
        from services.invoice_payload import parse_invoice_payload

        payload = parse_invoice_payload(payment.invoice_payload)
        resume_id = payload["resume_id"]
        telegram_id = update.message.from_user.id
        from_user = update.message.from_user
        db = get_db()
        from services.payment_validation import expected_stars_amount

        payment_type = str(payload.get("type") or "single_pdf")
        bonus = int(payload.get("bonus_stars_applied") or 0)
        expected = expected_stars_amount(
            db,
            resume_id=resume_id,
            telegram_id=telegram_id,
            payment_type=payment_type,
            bonus_stars_applied=bonus,
        )
        if expected is None or int(payment.total_amount) != expected:
            logger.warning(
                "successful_payment amount mismatch resume_id=%s telegram_id=%s expected=%s paid=%s",
                resume_id,
                telegram_id,
                expected,
                payment.total_amount,
            )
            await update.message.reply_text(payment_error_text())
            return
        pay_info = PaymentNotifyInfo(
            provider="telegram_stars",
            amount=str(payment.total_amount),
            currency="⭐" if payment.currency == "XTR" else payment.currency,
            resume_id=resume_id,
            telegram_id=telegram_id,
            username=from_user.username or "",
            first_name=from_user.first_name or "",
        )
        from services.payment_dispatch import fulfill_from_invoice_payload

        if payment_type == "single_pdf":
            paid = await fulfill_from_invoice_payload(
                db,
                payload,
                telegram_id,
                payment=pay_info,
                send_document=False,
            )
            if not paid:
                raise RuntimeError("payment fulfilled state was not saved")
            resume_id = str(payload.get("resume_id") or "")
            if not resume_id:
                raise RuntimeError("payment payload missing resume_id")
            await update.message.reply_text(
                "✅ Оплата прошла!\n\n"
                "Теперь выберите шаблон PDF. После выбора сразу отправлю PDF и DOCX в этот чат.",
                reply_markup=_paid_template_keyboard(resume_id),
            )
        else:
            await fulfill_from_invoice_payload(db, payload, telegram_id, payment=pay_info)

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


async def paid_template_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    if not query:
        return
    parts = (query.data or "").split(":")
    if len(parts) != 3:
        await query.answer("Некорректный выбор шаблона", show_alert=True)
        return
    _, resume_id, template_id = parts
    if template_id not in PDF_TEMPLATE_LABELS:
        await query.answer("Шаблон не найден", show_alert=True)
        return
    user = update.effective_user
    if not user:
        await query.answer("Не удалось определить пользователя", show_alert=True)
        return

    db = get_db()
    user_record = db.find_user_by_telegram_id(user.id)
    if not user_record:
        await query.answer("Пользователь не найден", show_alert=True)
        return
    resume = db.find_resume(resume_id, user_record["id"])
    if not resume:
        await query.answer("Резюме не найдено", show_alert=True)
        return
    if not resume.get("is_paid"):
        await query.answer("Сначала завершите оплату", show_alert=True)
        return

    await _edit_callback_message(
        query,
        f"⏳ Готовлю PDF и DOCX в шаблоне <b>{PDF_TEMPLATE_LABELS[template_id]}</b>...",
    )
    try:
        await fulfill_paid_resume(
            db,
            resume_id,
            user.id,
            bonus_stars_applied=0,
            template_name=template_id,
        )
    except Exception:
        logger.exception(
            "paid template callback failed resume_id=%s telegram_id=%s template=%s",
            resume_id,
            user.id,
            template_id,
        )
        await query.message.reply_text(payment_error_text())
        return

    await _edit_callback_message(
        query,
        f"✅ Отправил PDF и DOCX в шаблоне <b>{PDF_TEMPLATE_LABELS[template_id]}</b>.\n"
        "Если хотите, можете выбрать другой шаблон и получить ещё один вариант.",
        reply_markup=_paid_template_keyboard(resume_id),
    )


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
            BotCommand("promo", "Активировать промокод"),
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


async def reengagement_job(context: ContextTypes.DEFAULT_TYPE) -> None:
    db = get_db()
    records = db.list_unpaid_for_reengagement(min_age_hours=3, max_age_hours=24)
    for rec in records:
        telegram_id = rec.get("telegram_id")
        if not telegram_id:
            continue
        position = rec.get("target_position") or ""
        try:
            keyboard = InlineKeyboardMarkup(
                [[InlineKeyboardButton("📄 Открыть резюме", url=MINI_APP_URL)]]
            )
            await context.bot.send_message(
                chat_id=int(telegram_id),
                text=reengagement_text(position),
                reply_markup=keyboard,
                parse_mode="HTML",
            )
            db.mark_reengagement_sent(rec["resume_id"])
            await asyncio.sleep(0.3)
        except Exception as e:
            logger.warning("reengagement send failed tg_id=%s err=%s", telegram_id, e)


def main():
    app = (
        Application.builder()
        .token(settings.BOT_TOKEN)
        .post_init(post_init)
        .build()
    )

    if app.job_queue:
        app.job_queue.run_repeating(reengagement_job, interval=3600, first=300)

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("resume", resume_command))
    app.add_handler(CommandHandler("myresumes", my_resumes_command))
    app.add_handler(CommandHandler("examples", examples_command))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("trust", trust_command))
    app.add_handler(CommandHandler("my", my_command))
    app.add_handler(CommandHandler("invite", invite_command))
    app.add_handler(CommandHandler("cabinet", cabinet_command))
    app.add_handler(CommandHandler("support", support_command))
    app.add_handler(CommandHandler("founder", founder_command))
    app.add_handler(CommandHandler("admin", admin_command))
    app.add_handler(CommandHandler("newpromo", newpromo_command))
    app.add_handler(CommandHandler("promo", promo_command))

    app.add_handler(CallbackQueryHandler(adm_open_callback, pattern="^adm_open$"))
    app.add_handler(CallbackQueryHandler(adm_stats_callback, pattern="^adm_stats$"))
    app.add_handler(CallbackQueryHandler(adm_promos_callback, pattern="^adm_promos$"))
    app.add_handler(CallbackQueryHandler(adm_refs_callback, pattern="^adm_refs$"))
    app.add_handler(CallbackQueryHandler(adm_create_promo_callback, pattern="^adm_create_promo$"))
    app.add_handler(CallbackQueryHandler(adm_promo_acts_callback, pattern="^adm_promo_acts$"))
    app.add_handler(CallbackQueryHandler(adm_affiliates_callback, pattern="^adm_affiliates$"))
    app.add_handler(CallbackQueryHandler(adm_add_affiliate_callback, pattern="^adm_add_affiliate$"))
    app.add_handler(
        CallbackQueryHandler(adm_add_affiliate_cancel_callback, pattern="^adm_add_affiliate_cancel$")
    )
    app.add_handler(CallbackQueryHandler(adm_revoke_affiliate_callback, pattern=r"^adm_revoke_aff:\d+$"))
    app.add_handler(
        CallbackQueryHandler(adm_revoke_affiliate_confirm_callback, pattern=r"^adm_revoke_ok:\d+$")
    )
    app.add_handler(CallbackQueryHandler(adm_funnel_callback, pattern="^adm_funnel$"))
    app.add_handler(CallbackQueryHandler(adm_back_callback, pattern="^adm_back$"))

    app.add_handler(CallbackQueryHandler(aff_panel_callback, pattern="^aff_panel$"))
    app.add_handler(CallbackQueryHandler(aff_refresh_callback, pattern="^aff_refresh$"))

    app.add_handler(CallbackQueryHandler(promo_prompt_callback, pattern="^promo_prompt$"))
    app.add_handler(CallbackQueryHandler(promo_cancel_callback, pattern="^promo_cancel$"))

    app.add_handler(CallbackQueryHandler(how_it_works_callback, pattern="^how_it_works$"))
    app.add_handler(CallbackQueryHandler(trust_callback, pattern="^trust$"))
    app.add_handler(CallbackQueryHandler(trust_main_callback, pattern="^trust_main$"))
    app.add_handler(CallbackQueryHandler(trust_vs_ai_callback, pattern="^trust_vs_ai$"))
    app.add_handler(CallbackQueryHandler(trust_price_callback, pattern="^trust_price$"))
    app.add_handler(CallbackQueryHandler(trust_proof_callback, pattern="^trust_proof$"))
    app.add_handler(CallbackQueryHandler(support_hub_callback, pattern="^support_hub$"))
    app.add_handler(CallbackQueryHandler(founder_dm_hint_callback, pattern="^founder_dm_hint$"))
    app.add_handler(CallbackQueryHandler(back_to_start_callback, pattern="^back_to_start$"))
    app.add_handler(CallbackQueryHandler(invite_prompt_callback, pattern="^invite_prompt$"))
    app.add_handler(CallbackQueryHandler(paid_template_callback, pattern=r"^paid_tpl:[0-9a-f-]{36}:(classic|modern|compact)$"))

    app.add_handler(PreCheckoutQueryHandler(pre_checkout))
    app.add_handler(MessageHandler(filters.SUCCESSFUL_PAYMENT, successful_payment))

    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_message_handler))

    logger.info("Bot started")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
