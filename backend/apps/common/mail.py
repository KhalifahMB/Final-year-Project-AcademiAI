"""
Shared transactional-email helpers.

All AcademiAI emails are sent as multipart (HTML + plain-text fallback) and
rendered from Django templates under ``templates/emails/``. The brand logo is
base64-embedded so messages render standalone in any client (no externally
hosted asset dependency) — important for local Mailpit and offline reading.

Compose one message with :func:`build_message`, then send it however the
caller needs (each domain task uses :func:`send_email` which wraps Django's
SMTP backend). Nothing here logs message bodies, verification codes, or reset
tokens.
"""
from __future__ import annotations

import base64
import functools
import logging
from pathlib import Path

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string

logger = logging.getLogger(__name__)

# Brand palette — derived from the DESIGN.md oklch tokens (single accent economy).
BRAND_MAIN = "#0230C0"      # --accent oklch(58% 0.18 255)
BRAND_STRONG = "#001F9A"    # --accent-strong oklch(51% 0.185 255)
TEXT_PRIMARY = "#1E293B"    # --fg family (slate-800)
TEXT_MUTED = "#64748B"      # slate-500
PAGE_BG = "#F5F7FA"         # --bg oklch(99% 0.002 240)
CARD_BG = "#FFFFFF"
BORDER = "#E4E7EC"
FOOTER = "#94A3B8"
DANGER = "#B91C1C"

_LOGO_DIR = Path(__file__).resolve().parent.parent.parent / "templates" / "emails" / "brand"


@functools.lru_cache(maxsize=1)
def _logo_data_uri() -> str:
    """Base64 data URI of the on-brand email logo (256px PNG)."""
    path = _LOGO_DIR / "academiai_logo.png"
    if not path.exists():
        logger.warning("Email logo missing at %s; rendering header without it", path)
        return ""
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{data}"


def _base_context(**extra) -> dict:
    ctx = {
        "product_name": "AcademiAI",
        "frontend_url": getattr(settings, "FRONTEND_URL", "http://localhost:5173").rstrip("/"),
        "support_email": getattr(settings, "SUPPORT_EMAIL", "support@academiai.local"),
        "logo_data_uri": _logo_data_uri(),
        "brand_main": BRAND_MAIN,
        "brand_strong": BRAND_STRONG,
        "text_primary": TEXT_PRIMARY,
        "text_muted": TEXT_MUTED,
        "page_bg": PAGE_BG,
        "card_bg": CARD_BG,
        "border": BORDER,
        "footer": FOOTER,
        "danger": DANGER,
    }
    ctx.update(extra)
    return ctx


def render_message(subject: str, to: list[str], template: str, context: dict) -> EmailMultiAlternatives:
    """Render ``template`` (+ ``template``'s ``.txt`` twin) into a multipart message.

    ``context`` is merged over the standard brand context unless ``merge=False``
    is passed (then it is used verbatim so callers can set tokens explicitly).
    """
    merge = context.pop("merge", True)
    full = _base_context(**context) if merge else context
    html = render_to_string(f"emails/{template}.html", full)
    plain = render_to_string(f"emails/{template}.txt", full)
    msg = EmailMultiAlternatives(
        subject=subject,
        body=plain,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=to,
    )
    msg.attach_alternative(html, "text/html")
    return msg


def send_email(subject: str, to: list[str], template: str, context: dict, *, fail_silently: bool = False) -> None:
    """Render ``template`` and deliver via the configured email backend."""
    msg = render_message(subject, to, template, context)
    try:
        msg.send(fail_silently=fail_silently)
        logger.info("Email sent type=%s to=%d", template, len(to))
    except Exception:  # pragma: no cover - transport errors are retried by callers
        logger.exception("Email delivery failed type=%s to=%d", template, len(to))
        raise
