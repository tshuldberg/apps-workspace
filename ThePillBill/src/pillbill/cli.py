from __future__ import annotations

import argparse
from datetime import date, datetime, timezone
import json
from pathlib import Path
import shlex
import sys

from .emailer import compose_email_body, compose_email_subject, send_via_macos_mail, timestamp_local
from .extractors import extract_draft_regimen
from .models import PatientConfig, Regimen
from .safety import ValidationIssue, validate_regimen_for_verification
from .scheduler import (
    build_daily_schedule,
    build_weekly_schedule,
    daily_to_dict,
    render_daily_markdown,
    render_weekly_markdown,
    weekly_to_dict,
)
from .storage import Storage


def _cmd_init_patient(args: argparse.Namespace, storage: Storage) -> int:
    storage.init_patient(PatientConfig(patient_id=args.patient_id, timezone=args.timezone))
    print(f"Initialized patient workspace: {storage.patient_dir(args.patient_id)}")
    return 0


def _cmd_upload(args: argparse.Namespace, storage: Storage) -> int:
    files: list[Path] = [Path(f).expanduser().resolve() for f in args.files]
    missing = [str(f) for f in files if not f.exists()]
    if missing:
        print("Missing input files:", file=sys.stderr)
        for m in missing:
            print(f"- {m}", file=sys.stderr)
        return 1

    copied = storage.upload_documents(args.patient_id, files)
    print(f"Uploaded {len(copied)} document(s) for {args.patient_id}:")
    for path in copied:
        print(f"- {path}")
    return 0


def _cmd_extract(args: argparse.Namespace, storage: Storage) -> int:
    patient = storage.load_patient(args.patient_id)
    docs = storage.list_documents(args.patient_id)
    if not docs:
        print("No source documents uploaded.", file=sys.stderr)
        return 1

    if not args.include_all_formats:
        docx_docs = [d for d in docs if d.suffix.lower() == ".docx"]
        if docx_docs:
            docs = docx_docs
            print("Using DOCX sources only for higher-fidelity initial extraction.")

    source_hash = storage.compute_docs_hash(args.patient_id, docs)
    regimen = extract_draft_regimen(
        patient_id=args.patient_id,
        timezone=patient.timezone,
        source_hash=source_hash,
        docs=docs,
    )
    path = storage.save_regimen(args.patient_id, regimen, verified=False)
    checklist_path = _write_verification_checklist(args.patient_id, regimen, storage)

    print(f"Draft regimen extracted with {len(regimen.medications)} medication candidate(s).")
    print(f"Draft path: {path}")
    print(f"Verification checklist: {checklist_path}")
    print("Next: review and mark each medication as manually verified before finalizing.")
    return 0


def _format_source(med) -> str:
    if med.source is None:
        return "<missing source>"
    page = f", page {med.source.page}" if med.source.page is not None else ""
    return f"{med.source.file}{page}, line {med.source.line}: \"{med.source.quote}\""


def _cmd_review(args: argparse.Namespace, storage: Storage) -> int:
    regimen = storage.load_regimen(args.patient_id, verified=False)
    if not regimen.medications:
        print("No medications found in draft regimen.")
        return 0

    for med in regimen.medications:
        verified = "YES" if med.manually_verified else "NO"
        print(f"{med.medication_id} | verified={verified} | confidence={med.confidence}")
        print(f"  Name: {med.name}")
        print(f"  Dose: {med.dose}")
        print(f"  Route: {med.route}")
        print(f"  Frequency: {med.frequency}")
        print(f"  Times: {', '.join(med.times) if med.times else '<none>'}")
        if med.is_prn:
            print(f"  PRN max/day: {med.max_daily_dose or '<missing>'}")
        print(f"  Source: {_format_source(med)}")
        print("")

    return 0


def _apply_optional_updates(args: argparse.Namespace, med) -> None:
    if args.name:
        med.name = args.name
    if args.dose:
        med.dose = args.dose
    if args.route:
        med.route = args.route
    if args.frequency:
        med.frequency = args.frequency
    if args.times is not None:
        values = [item.strip() for item in args.times.split(",") if item.strip()]
        med.times = values
    if args.is_prn:
        med.is_prn = True
    if args.not_prn:
        med.is_prn = False
    if args.indication is not None:
        med.indication = args.indication or None
    if args.max_daily_dose is not None:
        med.max_daily_dose = args.max_daily_dose or None
    if args.notes is not None:
        med.notes = args.notes or None
    if med.source is not None:
        if args.source_quote is not None:
            med.source.quote = args.source_quote
        if args.source_file is not None:
            med.source.file = args.source_file
        if args.source_page is not None:
            med.source.page = args.source_page
        if args.source_line is not None:
            med.source.line = args.source_line


def _cmd_mark_verified(args: argparse.Namespace, storage: Storage) -> int:
    regimen = storage.load_regimen(args.patient_id, verified=False)
    med = next((m for m in regimen.medications if m.medication_id == args.medication_id), None)
    if med is None:
        print(f"Medication not found: {args.medication_id}", file=sys.stderr)
        return 1

    placeholder_fields = [
        "name",
        "dose",
        "route",
        "frequency",
        "times",
        "indication",
        "max_daily_dose",
        "notes",
        "source_quote",
        "source_file",
    ]
    todo_hits: list[str] = []
    for field in placeholder_fields:
        value = getattr(args, field, None)
        if isinstance(value, str) and "TODO_" in value:
            todo_hits.append(field)
    if todo_hits:
        joined = ", ".join(sorted(set(todo_hits)))
        print(
            f"Refusing to verify {args.medication_id}: unresolved TODO placeholders in {joined}.",
            file=sys.stderr,
        )
        return 1

    _apply_optional_updates(args, med)
    med.manually_verified = True
    med.verified_by = args.verified_by
    med.verified_at = datetime.now(timezone.utc).isoformat()

    storage.save_regimen(args.patient_id, regimen, verified=False)
    print(f"Marked {med.medication_id} as manually verified.")
    return 0


def _print_issues(issues: list[ValidationIssue]) -> None:
    for issue in issues:
        med = f" ({issue.medication_id})" if issue.medication_id else ""
        print(f"- [{issue.severity}] {issue.field}{med}: {issue.message}")


def _cmd_finalize(args: argparse.Namespace, storage: Storage) -> int:
    regimen = storage.load_regimen(args.patient_id, verified=False)
    if regimen.source_files:
        docs: list[Path] = []
        for filename in regimen.source_files:
            path = storage.patient_dir(args.patient_id) / "docs" / filename
            if not path.exists():
                print(f"Missing source file used for extraction: {path}", file=sys.stderr)
                return 1
            docs.append(path)
        docs_hash = storage.compute_docs_hash(args.patient_id, docs)
    else:
        docs_hash = storage.compute_docs_hash(args.patient_id)
    issues = validate_regimen_for_verification(regimen, docs_hash)
    if issues:
        print("Cannot finalize regimen. Resolve the following issues:")
        _print_issues(issues)
        return 1

    regimen.status = "verified"
    regimen.verified_by = args.verified_by
    regimen.verified_at = datetime.now(timezone.utc).isoformat()
    path = storage.save_regimen(args.patient_id, regimen, verified=True)
    print(f"Verified regimen saved: {path}")
    return 0


def _shell_cmd(parts: list[str]) -> str:
    return " ".join(shlex.quote(p) for p in parts)


def _verify_command_for_med(
    patient_id: str,
    verified_by: str,
    med,
    verify_one_path: str,
) -> tuple[str, list[str]]:
    warnings: list[str] = []
    parts: list[str] = [
        verify_one_path,
        patient_id,
        med.medication_id,
        verified_by,
    ]

    parts.extend(["--name", med.name])

    dose = med.dose
    if dose == "dose not specified":
        dose = "TODO_SET_DOSE"
        warnings.append("missing dose")
    parts.extend(["--dose", dose])

    route = med.route
    if route == "route not specified":
        route = "TODO_SET_ROUTE"
        warnings.append("missing route")
    parts.extend(["--route", route])

    frequency = med.frequency
    if frequency == "frequency not specified":
        frequency = "TODO_SET_FREQUENCY"
        warnings.append("missing frequency")
    parts.extend(["--frequency", frequency])

    if med.times:
        parts.extend(["--times", ",".join(med.times)])
    elif (not med.is_prn) and ("every" not in med.frequency.lower()):
        parts.extend(["--times", "TODO_SET_TIMES_HH:MM"])
        warnings.append("missing explicit times")

    if med.is_prn:
        parts.append("--is-prn")
        if not med.max_daily_dose or med.max_daily_dose == "required during verification":
            parts.extend(["--max-daily-dose", "TODO_SET_MAX_DAILY"])
            warnings.append("missing PRN max daily dose")
        else:
            parts.extend(["--max-daily-dose", med.max_daily_dose])
    elif med.max_daily_dose:
        parts.extend(["--max-daily-dose", med.max_daily_dose])

    if med.indication:
        parts.extend(["--indication", med.indication])
    if med.notes:
        parts.extend(["--notes", med.notes])

    if med.source is not None:
        parts.extend(["--source-file", med.source.file])
        if med.source.page is not None:
            parts.extend(["--source-page", str(med.source.page)])
        if med.source.line is not None:
            parts.extend(["--source-line", str(med.source.line)])
        parts.extend(["--source-quote", med.source.quote])
    else:
        warnings.append("missing source citation")

    return _shell_cmd(parts), warnings


def _cmd_generate_verify_script(args: argparse.Namespace, storage: Storage) -> int:
    regimen = storage.load_regimen(args.patient_id, verified=False)
    if not regimen.medications:
        print("No medications in draft regimen. Run extract first.", file=sys.stderr)
        return 1

    project_root = Path(__file__).resolve().parents[2]
    verify_one_path = str((project_root / "scripts" / "verify_one").resolve())
    pb_path = str((project_root / "scripts" / "pb").resolve())

    output = Path(args.output) if args.output else Path("scripts") / f"verify_all_{args.patient_id}.sh"
    output.parent.mkdir(parents=True, exist_ok=True)

    lines: list[str] = []
    lines.append("#!/usr/bin/env bash")
    lines.append("set -euo pipefail")
    lines.append("")
    lines.append(f'VERIFY_ONE="{verify_one_path}"')
    lines.append(f'PB="{pb_path}"')
    lines.append('if [ ! -x "$VERIFY_ONE" ]; then')
    lines.append('  echo "Missing helper: $VERIFY_ONE" >&2')
    lines.append("  exit 1")
    lines.append("fi")
    lines.append('if [ ! -x "$PB" ]; then')
    lines.append('  echo "Missing helper: $PB" >&2')
    lines.append("  exit 1")
    lines.append("fi")
    lines.append("")
    lines.append(f"# Patient: {args.patient_id}")
    lines.append(f"# Verified by: {args.verified_by}")
    lines.append("# Review each command before running. TODO_* values must be replaced.")
    lines.append("")

    todo_count = 0
    for med in regimen.medications:
        cmd, warnings = _verify_command_for_med(
            args.patient_id,
            args.verified_by,
            med,
            verify_one_path=verify_one_path,
        )
        lines.append(f"# {med.medication_id} - {med.name}")
        if warnings:
            todo_count += 1
            lines.append(f"# TODO: {', '.join(warnings)}")
        lines.append(cmd)
        lines.append("")

    if args.include_finalize:
        lines.append(
            _shell_cmd(
                [
                    pb_path,
                    "finalize",
                    "--patient-id",
                    args.patient_id,
                    "--verified-by",
                    args.verified_by,
                ]
            )
        )
        lines.append("")

    output.write_text("\n".join(lines).strip() + "\n", encoding="utf-8")
    output.chmod(0o755)

    print(f"Generated verification script: {output}")
    print(f"Medications included: {len(regimen.medications)}")
    print(f"Commands with TODO markers: {todo_count}")
    return 0


def _write_verification_checklist(patient_id: str, regimen: Regimen, storage: Storage) -> Path:
    root = storage.patient_dir(patient_id)
    out = root / "verification_checklist.md"
    lines: list[str] = []
    lines.append(f"# Verification Checklist: {patient_id}")
    lines.append("")
    lines.append("Mark each medication as verified only after checking source text.")
    lines.append("")
    lines.append("| Done | Medication ID | Name | Dose | Frequency | Source |")
    lines.append("| --- | --- | --- | --- | --- | --- |")
    for med in regimen.medications:
        src = "<missing>"
        if med.source is not None:
            page = f"p{med.source.page}" if med.source.page is not None else "no-page"
            src = f"{med.source.file} {page} L{med.source.line}"
        lines.append(
            f"| [ ] | {med.medication_id} | {med.name} | {med.dose} | {med.frequency} | {src} |"
        )
    lines.append("")
    lines.append("## Source Quotes")
    lines.append("")
    for med in regimen.medications:
        lines.append(f"### {med.medication_id} - {med.name}")
        quote = med.source.quote if med.source is not None else "<missing source quote>"
        lines.append(f"> {quote}")
        lines.append("")
    out.write_text("\n".join(lines).strip() + "\n", encoding="utf-8")
    return out


def _write_schedule_outputs(
    *,
    regimen: Regimen,
    output_dir: Path,
    for_date: date,
) -> tuple[Path, Path, Path, Path, str, str]:
    daily = build_daily_schedule(regimen, for_date)
    weekly = build_weekly_schedule(regimen, for_date)

    daily_md = render_daily_markdown(daily)
    weekly_md = render_weekly_markdown(weekly)

    daily_md_path = output_dir / f"daily-{for_date.isoformat()}.md"
    weekly_md_path = output_dir / f"weekly-{for_date.isoformat()}.md"
    daily_json_path = output_dir / f"daily-{for_date.isoformat()}.json"
    weekly_json_path = output_dir / f"weekly-{for_date.isoformat()}.json"

    daily_md_path.write_text(daily_md, encoding="utf-8")
    weekly_md_path.write_text(weekly_md, encoding="utf-8")
    daily_json_path.write_text(json.dumps(daily_to_dict(daily), indent=2) + "\n", encoding="utf-8")
    weekly_json_path.write_text(json.dumps(weekly_to_dict(weekly), indent=2) + "\n", encoding="utf-8")

    return daily_md_path, weekly_md_path, daily_json_path, weekly_json_path, daily_md, weekly_md


def _parse_date(value: str | None) -> date:
    if not value:
        return date.today()
    return datetime.strptime(value, "%Y-%m-%d").date()


def _cmd_generate(args: argparse.Namespace, storage: Storage) -> int:
    regimen = storage.load_regimen(args.patient_id, verified=True)
    target_date = _parse_date(args.date)
    out = storage.output_dir(args.patient_id)

    daily_md_path, weekly_md_path, daily_json_path, weekly_json_path, _, _ = _write_schedule_outputs(
        regimen=regimen,
        output_dir=out,
        for_date=target_date,
    )

    print("Schedule outputs written:")
    print(f"- {daily_md_path}")
    print(f"- {weekly_md_path}")
    print(f"- {daily_json_path}")
    print(f"- {weekly_json_path}")
    return 0


def _cmd_send_email(args: argparse.Namespace, storage: Storage) -> int:
    regimen = storage.load_regimen(args.patient_id, verified=True)
    target_date = _parse_date(args.date)
    out = storage.output_dir(args.patient_id)

    _, _, _, _, daily_md, weekly_md = _write_schedule_outputs(
        regimen=regimen,
        output_dir=out,
        for_date=target_date,
    )

    subject = args.subject or compose_email_subject(args.patient_id, target_date.isoformat())
    body = compose_email_body(daily_markdown=daily_md, weekly_markdown=weekly_md)

    send_via_macos_mail(
        to_address=args.to,
        subject=subject,
        body=body,
        sender=args.sender,
        dry_run=args.dry_run,
    )

    if args.dry_run:
        print("Dry run complete. Email was not sent.")
    else:
        print(f"Email sent to {args.to} at {timestamp_local()}.")
    return 0


def _cmd_automation_daily(args: argparse.Namespace, storage: Storage) -> int:
    regimen = storage.load_regimen(args.patient_id, verified=True)
    target_date = _parse_date(args.date)
    out = storage.output_dir(args.patient_id)

    _, _, _, _, daily_md, weekly_md = _write_schedule_outputs(
        regimen=regimen,
        output_dir=out,
        for_date=target_date,
    )

    subject = args.subject or compose_email_subject(args.patient_id, target_date.isoformat())
    body = compose_email_body(daily_markdown=daily_md, weekly_markdown=weekly_md)

    send_via_macos_mail(
        to_address=args.to,
        subject=subject,
        body=body,
        sender=args.sender,
        dry_run=args.dry_run,
    )

    status = "dry-run" if args.dry_run else "sent"
    print(
        json.dumps(
            {
                "status": status,
                "patient_id": args.patient_id,
                "date": target_date.isoformat(),
                "to": args.to,
                "output_dir": str(out),
            },
            indent=2,
        )
    )
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="pillbill",
        description="Verification-first post-op medication schedule tool",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    init_cmd = sub.add_parser("init-patient", help="Initialize patient workspace")
    init_cmd.add_argument("--patient-id", required=True)
    init_cmd.add_argument("--timezone", default="America/Los_Angeles")

    upload_cmd = sub.add_parser("upload", help="Upload source documents for patient")
    upload_cmd.add_argument("--patient-id", required=True)
    upload_cmd.add_argument("--files", nargs="+", required=True)

    extract_cmd = sub.add_parser("extract", help="Extract draft regimen from uploaded docs")
    extract_cmd.add_argument("--patient-id", required=True)
    extract_cmd.add_argument(
        "--include-all-formats",
        action="store_true",
        help="Process all uploaded files (default prefers DOCX-only when available)",
    )

    review_cmd = sub.add_parser("review", help="Review extracted draft medications")
    review_cmd.add_argument("--patient-id", required=True)

    mark_cmd = sub.add_parser("mark-verified", help="Mark one medication as manually verified")
    mark_cmd.add_argument("--patient-id", required=True)
    mark_cmd.add_argument("--medication-id", required=True)
    mark_cmd.add_argument("--verified-by", required=True)
    mark_cmd.add_argument("--name")
    mark_cmd.add_argument("--dose")
    mark_cmd.add_argument("--route")
    mark_cmd.add_argument("--frequency")
    mark_cmd.add_argument("--times", help="Comma-separated HH:MM values")
    mark_cmd.add_argument("--is-prn", action="store_true")
    mark_cmd.add_argument("--not-prn", action="store_true")
    mark_cmd.add_argument("--indication", help="Set indication text; pass empty string to clear")
    mark_cmd.add_argument("--max-daily-dose", help="Set PRN max daily dose; empty string clears")
    mark_cmd.add_argument("--notes", help="Set notes; empty string clears")
    mark_cmd.add_argument("--source-quote")
    mark_cmd.add_argument("--source-file")
    mark_cmd.add_argument("--source-page", type=int)
    mark_cmd.add_argument("--source-line", type=int)

    verify_script_cmd = sub.add_parser(
        "generate-verify-script",
        help="Generate a bulk verification shell script for all medications",
    )
    verify_script_cmd.add_argument("--patient-id", required=True)
    verify_script_cmd.add_argument("--verified-by", required=True)
    verify_script_cmd.add_argument(
        "--output",
        help="Output shell script path (default: scripts/verify_all_<patient-id>.sh)",
    )
    verify_script_cmd.add_argument(
        "--include-finalize",
        action="store_true",
        help="Append finalize command at the end of the generated script",
    )

    finalize_cmd = sub.add_parser("finalize", help="Finalize verified regimen")
    finalize_cmd.add_argument("--patient-id", required=True)
    finalize_cmd.add_argument("--verified-by", required=True)

    generate_cmd = sub.add_parser("generate", help="Generate daily and weekly schedules")
    generate_cmd.add_argument("--patient-id", required=True)
    generate_cmd.add_argument("--date", help="YYYY-MM-DD (defaults to today)")

    send_cmd = sub.add_parser("send-email", help="Generate and send schedule email")
    send_cmd.add_argument("--patient-id", required=True)
    send_cmd.add_argument("--to", required=True)
    send_cmd.add_argument("--date", help="YYYY-MM-DD (defaults to today)")
    send_cmd.add_argument("--subject")
    send_cmd.add_argument("--sender", help="Optional sender email address configured in Mail.app")
    send_cmd.add_argument("--dry-run", action="store_true")

    auto_cmd = sub.add_parser("automation-daily", help="Automation-friendly daily run")
    auto_cmd.add_argument("--patient-id", required=True)
    auto_cmd.add_argument("--to", required=True)
    auto_cmd.add_argument("--date", help="YYYY-MM-DD (defaults to today)")
    auto_cmd.add_argument("--subject")
    auto_cmd.add_argument("--sender")
    auto_cmd.add_argument("--dry-run", action="store_true")

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    storage = Storage()

    try:
        if args.command == "init-patient":
            return _cmd_init_patient(args, storage)
        if args.command == "upload":
            return _cmd_upload(args, storage)
        if args.command == "extract":
            return _cmd_extract(args, storage)
        if args.command == "review":
            return _cmd_review(args, storage)
        if args.command == "mark-verified":
            return _cmd_mark_verified(args, storage)
        if args.command == "generate-verify-script":
            return _cmd_generate_verify_script(args, storage)
        if args.command == "finalize":
            return _cmd_finalize(args, storage)
        if args.command == "generate":
            return _cmd_generate(args, storage)
        if args.command == "send-email":
            return _cmd_send_email(args, storage)
        if args.command == "automation-daily":
            return _cmd_automation_daily(args, storage)
    except FileNotFoundError as exc:
        print(str(exc), file=sys.stderr)
        return 1
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
