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

# Brand palette — Cinnabar tokens from frontend/src/index.css (light theme).
BRAND_MAIN = "#8A2A24"      # --accent (cinnabar)
BRAND_STRONG = "#6E1F1A"    # darker cinnabar for pressed/hover states
TEXT_PRIMARY = "#281E17"    # --fg (warm ink)
TEXT_MUTED = "#6B5D52"      # muted warm ink
PAGE_BG = "#F4EEE4"         # --bg family (warm paper)
CARD_BG = "#FFFFFF"
BORDER = "#E7DFD3"          # warm hairline
FOOTER = "#9A8C80"
DANGER = "#B91C1C"

_LOGO_DIR = Path(__file__).resolve().parent.parent.parent / "templates" / "emails" / "brand"


@functools.lru_cache(maxsize=1)
def _logo_data_uri() -> str:
    """Base64 data URI of the on-brand email logo (Cinnabar SVG).

    SVG is preferred in capable clients (crisp at any DPI); ``_logo_png_data_uri``
    provides the raster fallback for Gmail/Outlook, which strip SVG.
    """
    path = _LOGO_DIR / "academiai_logo.svg"
    if not path.exists():
        logger.warning("Email logo missing at %s; rendering header without it", path)
        return ""
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/svg+xml;base64,{data}"


@functools.lru_cache(maxsize=1)
def _logo_png_data_uri() -> str:
    """Base64 data URI of the raster (PNG) email logo fallback."""
    path = _LOGO_DIR / "academiai_logo.png"
    if not path.exists():
        logger.warning("Email logo PNG missing at %s; rendering header without it", path)
        return ""
    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{data}"


def _base_context(**extra) -> dict:
    ctx = {
        "product_name": "AcademiAI",
        "frontend_url": getattr(settings, "FRONTEND_URL", "http://localhost:5173").rstrip("/"),
        "support_email": getattr(settings, "SUPPORT_EMAIL", "support@academiai.local"),
        "logo_data_uri": _logo_data_uri(),
        "logo_png_data_uri": _logo_png_data_uri(),
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
