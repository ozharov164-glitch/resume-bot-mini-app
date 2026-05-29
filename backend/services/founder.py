from config import settings

_DEFAULT_FOUNDER_IDS = {7595981350}


def founder_telegram_ids() -> set[int]:
    raw = (settings.FOUNDER_TELEGRAM_IDS or "").strip()
    if not raw:
        return set(_DEFAULT_FOUNDER_IDS)
    ids: set[int] = set()
    for part in raw.split(","):
        part = part.strip()
        if part.isdigit():
            ids.add(int(part))
    return ids or _DEFAULT_FOUNDER_IDS


def is_founder(telegram_id: int | str | None) -> bool:
    if telegram_id is None:
        return False
    return int(telegram_id) in founder_telegram_ids()
