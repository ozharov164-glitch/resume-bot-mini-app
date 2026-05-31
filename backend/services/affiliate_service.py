"""Affiliate (trafficker) grant, revoke, and shared stats."""

from __future__ import annotations

from typing import Any

from services.admin_stats import stats_exclude_telegram_ids


def get_affiliate_stats_for_owner(
    db: Any,
    owner_tg_id: int,
    *,
    exclude_telegram_ids: list[int] | None = None,
) -> dict | None:
    """Stats for one trafficker — same numbers as admin promo analytics."""
    user = db.find_user_by_telegram_id(owner_tg_id)
    if not user or not db.is_user_affiliate(owner_tg_id):
        return None

    promos = db.list_promo_codes_by_owner(owner_tg_id)
    base = {
        "telegram_id": owner_tg_id,
        "first_name": user.get("first_name") or "",
        "username": user.get("username") or "",
        "code": None,
        "discount_percent": 0,
        "activations": 0,
        "paid_count": 0,
        "max_uses": 0,
        "uses_count": 0,
        "is_active": False,
    }
    if not promos:
        return base

    primary_code = str(promos[0]["code"])
    analytics = db.get_promo_analytics(exclude_telegram_ids=exclude_telegram_ids)
    for promo in analytics:
        if str(promo.get("code")) == primary_code:
            return {
                **base,
                "code": primary_code,
                "discount_percent": int(promo.get("discount_percent") or 0),
                "activations": int(promo.get("activations") or 0),
                "paid_count": int(promo.get("paid_count") or 0),
                "max_uses": promo.get("max_uses"),
                "uses_count": int(promo.get("uses_count") or 0),
                "is_active": bool(promo.get("is_active")),
            }

    primary = promos[0]
    return {
        **base,
        "code": primary_code,
        "discount_percent": int(primary.get("discount_percent") or 0),
        "max_uses": primary.get("max_uses"),
        "uses_count": int(primary.get("uses_count") or 0),
        "is_active": bool(primary.get("is_active")),
    }


def list_affiliates_with_stats(db: Any) -> list[dict]:
    exclude = stats_exclude_telegram_ids()
    out: list[dict] = []
    for user in db.list_affiliate_users():
        tg_id = int(user["telegram_id"])
        stats = get_affiliate_stats_for_owner(db, tg_id, exclude_telegram_ids=exclude)
        if stats:
            out.append(stats)
    return out


def grant_affiliate(
    db: Any,
    *,
    telegram_id: int,
    code: str,
    discount: int = 10,
    max_uses: int = 100,
) -> dict:
    code = code.strip().upper()
    if not code:
        raise ValueError("Промокод не может быть пустым.")

    user = db.find_user_by_telegram_id(telegram_id)
    if not user:
        user = db.create_user(telegram_id=telegram_id)

    active = [p for p in db.list_promo_codes_by_owner(telegram_id) if p.get("is_active")]
    if active:
        raise ValueError("У траффера уже есть активный промокод.")

    promo = db.create_promo_code(
        code,
        owner_tg_id=telegram_id,
        discount=discount,
        max_uses=max_uses,
    )
    db.set_user_affiliate(telegram_id, is_affiliate=True)
    stats = get_affiliate_stats_for_owner(
        db, telegram_id, exclude_telegram_ids=stats_exclude_telegram_ids()
    )
    return {
        "telegram_id": telegram_id,
        "user_id": user.get("id"),
        "promo": promo,
        "stats": stats,
    }


def revoke_affiliate(db: Any, telegram_id: int) -> dict:
    was_affiliate = db.is_user_affiliate(telegram_id)
    had_promos = bool(db.list_promo_codes_by_owner(telegram_id))
    if not was_affiliate and not had_promos:
        raise ValueError("Пользователь не является траффером.")

    codes = db.deactivate_promos_by_owner(telegram_id)
    db.set_user_affiliate(telegram_id, is_affiliate=False)
    return {
        "telegram_id": telegram_id,
        "revoked": True,
        "already_revoked": was_affiliate is False and bool(codes) is False,
        "codes_deactivated": codes,
    }
