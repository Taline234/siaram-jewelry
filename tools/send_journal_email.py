#!/usr/bin/env python3
"""Emails journal articles to the mailing list through Resend (a Broadcast to the Resend audience).

Run by .github/workflows/journal-newsletter.yml when a new journal/*.md article is published. Only articles with an
"email:" line are sent: "email: yes" sends now, "email: 2026-12-08 10:00" schedules it (Beirut time), and an optional
"subject:" line replaces the title as the subject.
    python3 tools/send_journal_email.py journal/the-story-behind-siaram.md
Needs the RESEND_API_KEY and RESEND_AUDIENCE_ID secrets in GitHub. To see an email without sending it:
    python3 tools/send_journal_email.py --preview preview.html journal/the-story-behind-siaram.md
"""
import datetime
import html
import json
import os
import sys
import urllib.request
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from build_journal import piece, read_article, slugs  # noqa: E402

BASE = "https://siaramjewelry.com/"
TEMPLATE = open("tools/email/journal-template.html", encoding="utf-8").read()


BESTSELLERS = ["horseshoe-necklace-black-stone", "horseshoe-bracelet", "horseshoe-ring", "horseshoe-chain-earrings"]


# Photos to use in emails instead of a piece's main photo.
EMAIL_IMAGE = {}


def pieces_html(a):
    """The 2 x 2 grid of pieces: the article's "pieces:" line or the bestsellers."""
    cells = []
    for p in map(piece, (slugs(a.get("pieces", "")) or BESTSELLERS)[:4]):
        p["image"] = EMAIL_IMAGE.get(p["slug"], p["image"])
        url = BASE + p["page"].removesuffix(".html")
        cells.append(f"""<td width="50%" valign="top" style="padding:0 8px 22px;text-align:left;">
          <a href="{url}"><img src="{html.escape(p['image'])}" width="250" alt="{html.escape(p['name'])}" style="display:block;border:0;width:100%;height:auto;border-radius:8px;" /></a>
          <p style="margin:10px 0 3px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#173a2c;"><a href="{url}" style="color:#173a2c;text-decoration:none;">{html.escape(p['name'])}</a></p>
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#5b574d;">{html.escape(p['price'])}</p>
        </td>""")
    rows = "".join("<tr>" + "".join(cells[i:i + 2]) + "</tr>" for i in range(0, len(cells), 2))
    return f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0">{rows}</table>'


def send_time(value):
    """None to send now, or the ISO time for an "email: 2026-12-08 10:00" line (Beirut time)."""
    if value.strip().lower() in ("yes", "now", "true"):
        return None
    when = datetime.datetime.fromisoformat(value.strip()).replace(tzinfo=ZoneInfo("Asia/Beirut"))
    return when.isoformat() if when > datetime.datetime.now(datetime.timezone.utc) else None


def email_html(a):
    image = a["image"] if a["image"].startswith("http") else BASE + a["image"]
    return (TEMPLATE.replace("{{TITLE}}", html.escape(a["title"]))
            .replace("{{EXCERPT}}", html.escape(a["excerpt"]))
            .replace("{{IMAGE}}", html.escape(image))
            .replace("{{PIECES}}", pieces_html(a))
            .replace("{{URL}}", f"{BASE}journal-{a['slug']}"))


def resend(path, body):
    req = urllib.request.Request("https://api.resend.com" + path, data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {os.environ['RESEND_API_KEY']}",
                                          "Content-Type": "application/json", "User-Agent": "siaram-journal"})
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read() or b"{}")


def main(argv):
    preview = None
    if argv[:1] == ["--preview"]:
        preview, argv = argv[1], argv[2:]
    for path in argv:
        a = read_article(path)
        if not preview and not a.get("email"):
            print("not emailed (no email: line):", a["title"])
            continue
        body = email_html(a)
        if preview:
            open(preview, "w", encoding="utf-8").write(body)
            print("preview written to", preview)
            continue
        broadcast = resend("/broadcasts", {
            "audience_id": os.environ["RESEND_AUDIENCE_ID"],
            "from": os.environ.get("NEWSLETTER_FROM") or "Siaram Jewelry <journal@siaramjewelry.com>",
            "reply_to": "customerservice@siaramjewelry.com",
            "subject": a.get("subject") or a["title"],
            "name": f"Journal: {a['title']}",
            "html": body,
        })
        at = send_time(a["email"])
        resend(f"/broadcasts/{broadcast['id']}/send", {"scheduled_at": at} if at else {})
        print("scheduled for " + at if at else "sent", a["title"], broadcast["id"])


if __name__ == "__main__":
    main(sys.argv[1:])
