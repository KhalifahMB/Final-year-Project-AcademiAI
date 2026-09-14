"""
ICS (iCalendar) export utility for Calendar events.
Produces RFC-5545 compliant .ics payloads that can be consumed by
Google Calendar, Apple Calendar, Outlook, etc.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone


def _fold_lines(content: str) -> str:
    """RFC 5545 requires lines to be no longer than 75 octets; long lines
    are folded by inserting CRLF + space at UTF-8-safe boundaries."""
    out = []
    for line in content.split("\r\n"):
        if len(line.encode("utf-8")) <= 75:
            out.append(line)
            continue
        parts = []
        current = ""
        for char in line:
            if (len(current.encode("utf-8")) + len(char.encode("utf-8"))) > 73:
                parts.append(current)
                current = char
            else:
                current += char
        parts.append(current)
        out.append(parts[0])
        for part in parts[1:]:
            out.append(" " + part)
    return "\r\n".join(out)


def _format_dt(dt):
    if dt is None:
        dt = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _escape(text: str) -> str:
    return (
        (text or "")
        .replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
    )


def _event_to_vevent(event: CalendarEvent, uid_prefix: str = "") -> str:
    uid = f"{uid_prefix}{event.id}@academiai"
    now = _format_dt(None)
    lines = [
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{now}",
    ]
    if event.all_day:
        start = event.start.date() if event.start else datetime.now().date()
        end = (event.end.date() + timedelta(days=1)) if event.end else start + timedelta(days=1)
        lines.append(f"DTSTART;VALUE=DATE:{start.strftime('%Y%m%d')}")
        lines.append(f"DTEND;VALUE=DATE:{end.strftime('%Y%m%d')}")
    else:
        lines.append(f"DTSTART:{_format_dt(event.start)}")
        if event.end:
            lines.append(f"DTEND:{_format_dt(event.end)}")
    lines.append(f"SUMMARY:{_escape(event.title)}")
    if event.description:
        lines.append(f"DESCRIPTION:{_escape(event.description)}")
    venue = event.venue or event.location
    if venue:
        lines.append(f"LOCATION:{_escape(venue)}")
    categories = [event.layer]
    if event.course_code:
        categories.append(event.course_code)
    lines.append(f"CATEGORIES:{','.join(_escape(c) for c in categories)}")
    lines.append(f"STATUS:{event.status.upper()}")
    if event.recur_rule:
        lines.append(f"RRULE:{event.recur_rule}")
    for minutes in event.reminders_minutes:
        lines.extend([
            "BEGIN:VALARM",
            "ACTION:DISPLAY",
            "DESCRIPTION:Reminder",
            f"TRIGGER:-PT{minutes}M",
            "END:VALARM",
        ])
    lines.append("END:VEVENT")
    return _fold_lines("\r\n".join(lines))


def build_ics(events, calendar_name: str = "AcademiAI Calendar") -> str:
    """Build a full .ics document from an iterable of CalendarEvent."""
    ics = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//AcademiAI//Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{calendar_name}",
    ]
    for event in events:
        ics.append(_event_to_vevent(event))
    ics.append("END:VCALENDAR")
    return "\r\n".join(ics) + "\r\n"
