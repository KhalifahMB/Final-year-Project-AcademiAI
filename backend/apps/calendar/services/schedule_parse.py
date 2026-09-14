"""
Timetable parsing & CSV template helpers for the calendar admin upload
wizard.

CSV is parsed with the stdlib ``csv`` module (no extra dependency). XLSX
parsing requires ``openpyxl``; if it is not installed we surface a preview
error instructing the operator to install it, rather than swallowing the
request.

Each parsed row is normalised to a canonical dict matching
:class:`apps.calendar.models.CalendarEvent` fields. Validation is collected
per row so a bad row never aborts the whole file — that is what powers the
preview + error-count workflow on :class:`CalendarSchedule`.
"""
from __future__ import annotations

import csv
import io
from datetime import datetime, time

from django.utils.dateparse import parse_datetime

from ..models import CalendarLayer, EventStatus

REQUIRED_HEADERS = ["title", "start", "end", "layer"]

VALID_LAYERS = set(CalendarLayer.values)
VALID_STATUSES = set(EventStatus.values)


def _as_bool(value):
    return str(value or "").strip().lower() in ("1", "true", "yes", "y", "on")


def _parse_dt(value):
    """Return an aware datetime for ISO strings or ``YYYY-MM-DD HH:MM``."""
    from django.utils import timezone

    value = (value or "").strip()
    if not value:
        return None
    parsed = parse_datetime(value.replace("T", " ", 1))
    if parsed is None:
        for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M", "%Y/%m/%d"):
            try:
                parsed = datetime.strptime(value, fmt)
                break
            except ValueError:
                continue
    if parsed is None:
        return None
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed)
    return parsed


def _parse_layer(value):
    candidate = (value or "").strip().lower().replace(" ", "_")
    if candidate in VALID_LAYERS:
        return candidate
    return None


def template_csv_bytes() -> bytes:
    """UTF-8 CSV template with a sample row and the canonical headers."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(REQUIRED_HEADERS + ["all_day", "location", "status"])
    writer.writerow([
        "Intro to CS", "2026-09-15 09:00", "2026-09-15 10:00",
        "academic", "false", "LT-1", "confirmed",
    ])
    return buffer.getvalue().encode("utf-8")


def _read_rows(source_format: str, raw: bytes):
    if source_format == "xlsx":
        try:
            import openpyxl
        except ImportError as exc:  # pragma: no cover - env dependent
            raise ValueError(
                "XLSX parsing requires the 'openpyxl' package. "
                "Install it (pip install openpyxl) and retry, or upload a CSV."
            ) from exc
        workbook = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
        sheet = workbook.active
        rows = list(sheet.iter_rows(values_only=True))
        workbook.close()
        if not rows:
            return []
        return _rows_to_dicts([list(r) for r in rows])

    # default: csv
    text = raw.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return []
    normalized = []
    for row in reader:
        normalized.append({str(k or "").strip(): (v or "") for k, v in row.items()})
    return normalized


def _rows_to_dicts(rows):
    if not rows or not rows[0]:
        return []
    headers = [str(h or "").strip() for h in rows[0]]
    normalized = []
    for values in rows[1:]:
        values = list(values) + [""] * (len(headers) - len(values))
        normalized.append(
            {headers[i]: (values[i] if values[i] is not None else "") for i in range(len(headers))}
        )
    return normalized


def parse_schedule(source_format: str, raw: bytes, filename: str = ""):
    """Parse uploaded timetable rows and return (rows, warnings).

    ``rows`` is a list of validated dicts; ``warnings`` is a list of
    human-readable per-row messages. Rows that fail hard validation are
    omitted from ``rows`` and reported in ``warnings``.
    """
    source_format = (source_format or "csv").lower()
    try:
        dict_rows = _read_rows(source_format, raw)
    except ValueError as exc:
        return [], [str(exc)]

    if not dict_rows:
        return [], ["The file is empty or has no header row."]

    headers = set(dict_rows[0].keys())
    missing = [h for h in REQUIRED_HEADERS if h not in headers]
    if missing:
        return [], [f"Missing required column(s): {', '.join(missing)}."]

    rows = []
    warnings = []
    for index, item in enumerate(dict_rows, start=2):
        title = (item.get("title") or "").strip()
        start_dt = _parse_dt(item.get("start"))
        end_dt = _parse_dt(item.get("end"))
        layer = _parse_layer(item.get("layer"))

        problems = []
        if not title:
            problems.append("missing title")
        if start_dt is None:
            problems.append("invalid start")
        if end_dt is not None and start_dt is not None and end_dt <= start_dt:
            problems.append("end not after start")
        if layer is None:
            problems.append(f"invalid layer (use {', '.join(sorted(VALID_LAYERS))})")

        if problems:
            warnings.append(
                f"Row {index} ({title or 'no title'}): skipped — {'; '.join(problems)}."
            )
            continue

        rows.append({
            "title": title,
            "description": (item.get("description") or "").strip(),
            "start": start_dt.isoformat(),
            "end": end_dt.isoformat() if end_dt else None,
            "layer": layer,
            "all_day": _as_bool(item.get("all_day")),
            "location": (item.get("location") or "").strip(),
            "venue": (item.get("venue") or "").strip(),
            "course_code": (item.get("course_code") or "").strip(),
            "status": (
                item.get("status") if (item.get("status") or "") in VALID_STATUSES else "confirmed"
            ),
        })
    return rows, warnings


def rows_to_events(rows, tenant, user, import_type, layer_default):
    """Materialise validated rows into CalendarEvent objects (unsaved).

    ``layer_default`` is the layer used when a row carries no valid layer,
    e.g. ``academic`` for a lecture timetable.
    """
    from django.utils import timezone

    from ..models import CalendarEvent

    def _aware(value):
        dt = parse_datetime(value)
        if dt is not None and timezone.is_naive(dt):
            dt = timezone.make_aware(dt)
        return dt

    events = []
    for item in rows:
        layer = item.get("layer") or layer_default
        events.append(
            CalendarEvent(
                tenant=tenant,
                title=item["title"],
                description=item.get("description") or "",
                start=_aware(item["start"]) or timezone.now(),
                end=_aware(item["end"]) if item.get("end") else None,
                layer=layer,
                event_type={
                    "exam": "exam",
                    "academic": "lecture",
                    "office_hours": "office_hours",
                    "institution": "institution",
                }.get(layer, "reminder"),
                all_day=item.get("all_day") or False,
                location=item.get("location") or "",
                venue=item.get("venue") or "",
                course_code=item.get("course_code") or "",
                status=item.get("status") or "confirmed",
                created_by=user,
                user=None if layer == CalendarLayer.INSTITUTION else user,
                notify_enabled=True,
            )
        )
    return events
