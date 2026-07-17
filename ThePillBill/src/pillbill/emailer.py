from __future__ import annotations

from datetime import datetime
import subprocess


def compose_email_subject(patient_id: str, for_date: str) -> str:
    return f"Medication Schedule for {patient_id} - {for_date}"


def compose_email_body(*, daily_markdown: str, weekly_markdown: str) -> str:
    return (
        "Daily regimen and weekly schedule are below."
        " Verify each administration against discharge instructions before use.\n\n"
        f"{daily_markdown}\n\n"
        "---\n\n"
        f"{weekly_markdown}"
    )


def send_via_macos_mail(
    *,
    to_address: str,
    subject: str,
    body: str,
    sender: str | None = None,
    dry_run: bool = False,
) -> None:
    if dry_run:
        return

    script = """
on run argv
  set recipientAddress to item 1 of argv
  set subjectLine to item 2 of argv
  set bodyText to item 3 of argv
  set senderAddress to ""
  if (count of argv) > 3 then
    set senderAddress to item 4 of argv
  end if

  tell application "Mail"
    set newMessage to make new outgoing message with properties {subject:subjectLine, content:bodyText & return & return, visible:false}
    if senderAddress is not "" then
      try
        set sender of newMessage to senderAddress
      end try
    end if
    tell newMessage
      make new to recipient at end of to recipients with properties {address:recipientAddress}
      send
    end tell
  end tell
end run
"""

    args = ["osascript", "-e", script, to_address, subject, body]
    if sender:
        args.append(sender)

    completed = subprocess.run(args, capture_output=True, text=True)
    if completed.returncode != 0:
        stderr = (completed.stderr or "").strip()
        stdout = (completed.stdout or "").strip()
        details = stderr or stdout or "Unknown Mail error"
        raise RuntimeError(f"Failed to send email via Mail.app: {details}")


def timestamp_local() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
