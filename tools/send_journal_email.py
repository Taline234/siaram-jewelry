#!/usr/bin/env python3
"""Emails journal articles to the mailing list through Resend (a Broadcast to the Resend audience).

Run by .github/workflows/journal-newsletter.yml when a new journal/*.md article is published:
    python3 tools/send_journal_email.py journal/the-story-behind-siaram.md
Needs the RESEND_API_KEY and RESEND_AUDIENCE_ID secrets in GitHub. To see an email without sending it:
    python3 tools/send_journal_email.py --preview preview.html journal/the-story-behind-siaram.md
"""
import html
import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from build_journal import read_article  # noqa: E402

BASE = "https://siaramjewelry.com/"
TEMPLATE = open("tools/email/journal-template.html", encoding="utf-8").read()


def email_html(a):
    image = a["image"] if a["image"].startswith("http") else BASE + a["image"]
    return (TEMPLATE.replace("{{TITLE}}", html.escape(a["title"]))
            .replace("{{EXCERPT}}", html.escape(a["excerpt"]))
            .replace("{{IMAGE}}", html.escape(image))
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
        body = email_html(a)
        if preview:
            open(preview, "w", encoding="utf-8").write(body)
            print("preview written to", preview)
            continue
        broadcast = resend("/broadcasts", {
            "audience_id": os.environ["RESEND_AUDIENCE_ID"],
            "from": os.environ.get("NEWSLETTER_FROM") or "Siaram Jewelry <journal@siaramjewelry.com>",
            "reply_to": "customerservice@siaramjewelry.com",
            "subject": a["title"],
            "name": f"Journal: {a['title']}",
            "html": body,
        })
        resend(f"/broadcasts/{broadcast['id']}/send", {})
        print("sent", a["title"], broadcast["id"])


if __name__ == "__main__":
    main(sys.argv[1:])
