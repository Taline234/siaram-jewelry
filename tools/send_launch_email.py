#!/usr/bin/env python3
"""Sends the launch announcement ("Siaram is now online") once, to everyone on the mailing list (the Resend audience).

Run by the "Send launch email" workflow (GitHub -> Actions -> Send launch email -> Run workflow) on launch day.
Needs the RESEND_API_KEY and RESEND_AUDIENCE_ID secrets. To see the email without sending it:
    python3 tools/send_launch_email.py --preview preview.html
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from send_journal_email import BASE, pieces_html, resend  # noqa: E402

TEMPLATE = open("tools/email/launch-template.html", encoding="utf-8").read()
SUBJECT = "Siaram is now online"


def email_html():
    return TEMPLATE.replace("{{PIECES}}", pieces_html({}))


def main(argv):
    body = email_html()
    if argv[:1] == ["--preview"]:
        open(argv[1], "w", encoding="utf-8").write(body)
        print("preview written to", argv[1])
        return
    broadcast = resend("/broadcasts", {
        "audience_id": os.environ["RESEND_AUDIENCE_ID"],
        "from": os.environ.get("NEWSLETTER_FROM") or "Siaram Jewelry <journal@siaramjewelry.com>",
        "reply_to": "customerservice@siaramjewelry.com",
        "subject": SUBJECT,
        "name": "Launch announcement",
        "html": body,
    })
    resend(f"/broadcasts/{broadcast['id']}/send", {})
    print("sent launch announcement", broadcast["id"], "from", BASE)


if __name__ == "__main__":
    main(sys.argv[1:])
