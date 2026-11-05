#!/usr/bin/env python3
"""Run from the repository root:  python3 tools/build_journal.py

Builds the Journal from the articles in journal/*.md: one page per article (journal-<name>.html) and the list on
journal.html, and adds the articles to sitemap.xml. Each article file starts with a few details, then the text:

    ---
    title: The Story Behind Siaram
    date: 2026-11-20
    image: images/journal/story-behind-siaram.jpg
    excerpt: How a horse named Marais became the heart of a jewelry brand.
    ---
    The first paragraph...

    ## A heading
    More text, with **bold**, *italic* and [links](shop.html).

    ![A photo description](images/journal/photo.jpg)

When a new article is published, .github/workflows/journal-newsletter.yml emails it to the mailing list
(tools/send_journal_email.py)."""
import datetime
import glob
import html
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
BASE = "https://siaramjewelry.com/"


def read_article(path):
    text = open(path, encoding="utf-8").read()
    m = re.match(r"---\n(.*?)\n---\n(.*)", text, re.S)
    if not m:
        raise SystemExit(f"{path}: the article must start with the --- details block")
    meta = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip().lower()] = v.strip()
    for key in ("title", "date", "image", "excerpt"):
        if not meta.get(key):
            raise SystemExit(f"{path}: missing '{key}'")
    meta["slug"] = os.path.splitext(os.path.basename(path))[0]
    meta["page"] = f"journal-{meta['slug']}.html"
    meta["body"] = m.group(2).strip()
    meta["when"] = datetime.date.fromisoformat(meta["date"])
    return meta


def inline(text):
    t = html.escape(text, quote=False)
    t = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"\*(.+?)\*", r"<em>\1</em>", t)
    t = re.sub(r"\[(.+?)\]\((.+?)\)", lambda m: f'<a href="{html.escape(m.group(2))}">{m.group(1)}</a>', t)
    return t


def body_html(body):
    out = []
    for block in re.split(r"\n\s*\n", body):
        block = block.strip()
        if not block:
            continue
        img = re.fullmatch(r"!\[(.*?)\]\((.+?)\)", block)
        if img:
            out.append(f'      <figure class="article-figure"><img src="{html.escape(img.group(2))}" alt="{html.escape(img.group(1))}" loading="lazy" /></figure>')
        elif block.startswith("## "):
            first, _, rest = block.partition("\n")
            out.append(f"      <h2>{inline(first[3:])}</h2>")
            if rest.strip():
                out.append(f"      <p>{inline(' '.join(rest.splitlines()))}</p>")
        elif all(line.startswith("- ") for line in block.splitlines()):
            items = "".join(f"<li>{inline(line[2:])}</li>" for line in block.splitlines())
            out.append(f"      <ul>{items}</ul>")
        else:
            out.append(f"      <p>{inline(' '.join(block.splitlines()))}</p>")
    return "\n".join(out)


def long_date(d):
    return f"{d.day} {d.strftime('%B %Y')}"


def build():
    journal = open("journal.html", encoding="utf-8").read()
    HEAD_END = journal.index("</head>")
    BODY_START = journal.index('<section class="page-hero">')
    FOOTER = journal[journal.index('<footer class="site-footer">'):]
    articles = sorted((read_article(p) for p in glob.glob("journal/*.md")), key=lambda a: a["when"], reverse=True)

    for a in articles:
        head = journal[:HEAD_END]
        t = html.escape(a["title"]); d = html.escape(a["excerpt"])
        head = re.sub(r"<title>.*?</title>", f"<title>{t} — Siaram Jewelry</title>", head, count=1)
        head = re.sub(r'<meta name="description" content="[^"]*"', f'<meta name="description" content="{d}"', head, count=1)
        head = re.sub(r'<link rel="canonical" href="[^"]*"', f'<link rel="canonical" href="{BASE}journal-{a["slug"]}"', head, count=1)
        head = re.sub(r'<meta property="og:title" content="[^"]*"', f'<meta property="og:title" content="{t}"', head, count=1)
        head = re.sub(r'<meta property="og:description" content="[^"]*"', f'<meta property="og:description" content="{d}"', head, count=1)
        head = re.sub(r'<meta property="og:url" content="[^"]*"', f'<meta property="og:url" content="{BASE}journal-{a["slug"]}"', head, count=1)
        head = re.sub(r'<meta property="og:image" content="[^"]*"', f'<meta property="og:image" content="{BASE}{html.escape(a["image"])}"', head, count=1)
        head = re.sub(r'<meta property="og:type" content="[^"]*"', '<meta property="og:type" content="article"', head, count=1)
        page = (head + journal[HEAD_END:BODY_START] + f"""<section class="page-hero">
      <div class="container">
        <span class="eyebrow">Journal</span>
        <h1>{t}</h1>
        <p class="article-meta">{long_date(a['when'])}</p>
      </div>
    </section>

    <section>
      <div class="container">
        <article class="article">
          <img class="article-cover" src="{html.escape(a['image'])}" alt="{t}" />
    {body_html(a['body'])}
          <p class="article-back"><a href="journal.html">&larr; All stories</a></p>
        </article>
      </div>
    </section>

    """ + FOOTER)
        open(a["page"], "w", encoding="utf-8").write(page)
        print("wrote", a["page"])

    # The list on journal.html (the "coming soon" note stays until the first article).
    start = journal.index("<section>", BODY_START)
    end = journal.index("</section>", start) + len("</section>")
    if articles:
        cards = "\n".join(f"""      <a class="journal-card reveal" href="{a['page']}">
            <span class="journal-photo"><img src="{html.escape(a['image'])}" alt="" loading="lazy" /></span>
            <span class="article-meta">{long_date(a['when'])}</span>
            <h2>{html.escape(a['title'])}</h2>
            <p>{html.escape(a['excerpt'])}</p>
            <span class="journal-more">Read the story <span aria-hidden="true">&rarr;</span></span>
          </a>""" for a in articles)
        listing = f"""<section>
      <div class="container">
        <div class="journal-grid">
    {cards}
        </div>
      </div>
    </section>"""
        journal = journal[:start] + listing + journal[end:]
        open("journal.html", "w", encoding="utf-8").write(journal)
        print("wrote journal.html with", len(articles), "articles")

    # Sitemap
    sitemap = open("sitemap.xml", encoding="utf-8").read()
    for a in articles:
        loc = f"{BASE}journal-{a['slug']}"
        if loc not in sitemap:
            sitemap = sitemap.replace("</urlset>", f"  <url><loc>{loc}</loc><lastmod>{a['date']}</lastmod></url>\n</urlset>")
    open("sitemap.xml", "w", encoding="utf-8").write(sitemap)


if __name__ == "__main__":
    build()
