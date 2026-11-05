#!/usr/bin/env python3
"""Run from the repository root:  python3 tools/build_journal.py

Builds the Journal from the articles in journal/*.md: one page per article (journal-<name>.html) and the list on
journal.html, and adds the articles to sitemap.xml. Each article file starts with a few details, then the text:

    ---
    title: The Story Behind Siaram
    date: 2026-11-20
    image: images/journal/story-behind-siaram.jpg
    excerpt: How a horse named Marais became the heart of a jewelry brand.
    category: Our Stories                          (optional: the label and the filter on the Journal page)
    pieces: horseshoe-ring, horseshoe-bracelet     (optional: piece cards under the article)
    email: 2026-12-08 10:00                        (optional: email the article to subscribers, see below)
    ---
    The first paragraph...

    ## A heading
    More text, with **bold**, *italic* and [links](shop.html).

    ![A photo description](images/journal/photo.jpg)

Pull quotes, photo pairs, piece cards and the "Explore further" panel: see body_html below.

Articles are NOT emailed unless they have an "email:" line. With "email: yes" the article is emailed when it is
published; with a date and time (Beirut time) the email is scheduled for then. This is done by
.github/workflows/journal-newsletter.yml (tools/send_journal_email.py), and only once the site has launched."""
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


def piece(slug):
    """Name, price, photo and page of a piece, read from its product page."""
    page = open(f"product-{slug}.html", encoding="utf-8").read()
    name = re.search(r'<meta property="og:title" content="([^"]*?)(?: — Siaram Jewelry)?"', page).group(1)
    image = re.search(r'<meta property="og:image" content="([^"]*)"', page).group(1)
    price = re.search(r'class="product-price"[^>]*>([^<]*)<', page)
    return {"slug": slug, "name": html.unescape(name), "image": image, "page": f"product-{slug}.html",
            "price": price.group(1).replace(".00", "") if price else ""}


def slugs(text):
    return [s.strip().removeprefix("product-").removesuffix(".html") for s in text.split(",") if s.strip()]


def pieces_html(names, heading="Shop the Story"):
    cards = "\n".join(f"""        <a class="story-piece" href="{p['page']}">
          <span class="story-piece-photo"><img src="{html.escape(p['image'].replace(BASE, ''))}" alt="{html.escape(p['name'])}" loading="lazy" /></span>
          <span class="story-piece-name">{html.escape(p['name'])}</span>
          <span class="story-piece-price">{html.escape(p['price'])}</span>
        </a>""" for p in map(piece, names))
    return f"""      <div class="story-pieces">
        <p class="story-pieces-title"><span aria-hidden="true">&#10022;</span> {heading} <span aria-hidden="true">&#10022;</span></p>
        <div class="story-pieces-grid">
{cards}
        </div>
      </div>"""


def figure(alt, src):
    m = re.fullmatch(r'(.+?)\s+"(.*)"', src)
    src, caption = (m.group(1), m.group(2)) if m else (src, "")
    cap = f"<figcaption>{inline(caption)}</figcaption>" if caption else ""
    return f'<figure class="article-figure"><img src="{html.escape(src)}" alt="{html.escape(alt)}" loading="lazy" />{cap}</figure>'


def body_html(body):
    """The article text. Besides paragraphs, ## and ### headings, - and 1. lists, **bold**, *italic* and links:
      > A line worth remembering           a large pull quote
      ![description](images/journal/a.jpg "caption")   a photo (the caption is optional)
      two or three photo lines together    photos side by side
      [[pieces: qamar-ring, sun-ring]]     cards of those pieces, linking to them
      ## Explore further                   everything below it becomes a green panel at the end"""
    out, first_paragraph, explore = [], True, False
    for block in re.split(r"\n\s*\n", body):
        block = block.strip()
        if not block:
            continue
        lines = block.splitlines()
        imgs = [re.fullmatch(r"!\[(.*?)\]\((.+?)\)", l.strip()) for l in lines]
        if all(imgs):
            figs = "".join(figure(m.group(1), m.group(2)) for m in imgs)
            out.append(f'      <div class="article-gallery cols-{len(imgs)}">{figs}</div>' if len(imgs) > 1 else f"      {figs}")
        elif re.fullmatch(r"\[\[pieces:(.+)\]\]", block):
            out.append(pieces_html(slugs(re.fullmatch(r"\[\[pieces:(.+)\]\]", block).group(1))))
        elif block.startswith(">"):
            text = " ".join(l.lstrip("> ").strip() for l in lines)
            out.append(f'      <blockquote class="article-quote"><span class="article-quote-mark" aria-hidden="true">&#10022;</span><p>{inline(text)}</p></blockquote>')
        elif block.startswith("#"):
            level = 3 if block.startswith("### ") else 2
            first, _, rest = block.partition("\n")
            title = first.lstrip("#").strip()
            if level == 2 and title.lower() == "explore further":
                explore = True
                out.append(f'      <aside class="article-explore"><p class="article-explore-title">{inline(title)}</p>')
            else:
                if explore and level == 2:
                    out.append("      </aside>")
                    explore = False
                out.append(f"      <h{level}>{inline(title)}</h{level}>")
            if rest.strip():
                out.append(f"      <p>{inline(' '.join(rest.splitlines()))}</p>")
        elif all(l.startswith("- ") for l in lines):
            out.append("      <ul>" + "".join(f"<li>{inline(l[2:])}</li>" for l in lines) + "</ul>")
        elif all(re.match(r"\d+\. ", l) for l in lines):
            out.append("      <ol>" + "".join(f"<li>{inline(l.split('. ', 1)[1])}</li>" for l in lines) + "</ol>")
        else:
            cls = ' class="article-lead"' if first_paragraph and not explore else ""
            first_paragraph = False
            out.append(f"      <p{cls}>{inline(' '.join(lines))}</p>")
    if explore:
        out.append("      </aside>")
    return "\n".join(out)


def long_date(d):
    return f"{d.day} {d.strftime('%B %Y')}"


def minutes(a):
    return max(1, round(len(re.findall(r"\w+", a["body"])) / 200))


def card(a, cls="journal-card"):
    return f"""      <a class="{cls} reveal" href="{a['page']}" data-category="{html.escape(a['category'])}">
          <span class="journal-photo"><img src="{html.escape(a['image'])}" alt="{html.escape(a['title'])}" loading="lazy" /></span>
          <span class="journal-card-text">
            <span class="eyebrow">{html.escape(a['category'])}</span>
            <h2>{html.escape(a['title'])}</h2>
            <p>{html.escape(a['excerpt'])}</p>
            <span class="journal-more">Read the story <span aria-hidden="true">&rarr;</span></span>
          </span>
        </a>"""


def build():
    journal = open("journal.html", encoding="utf-8").read()
    HEAD_END = journal.index("</head>")
    BODY_START = journal.index('<section class="page-hero">')
    FOOTER = journal[journal.index('<footer class="site-footer">'):]
    articles = sorted((read_article(p) for p in glob.glob("journal/*.md")), key=lambda a: a["when"], reverse=True)
    for a in articles:
        a["category"] = a.get("category") or "Journal"
    if articles:  # the Journal is hidden from search engines only while it is empty
        journal = re.sub(r'<meta name="robots" content="noindex" />\s*', "", journal, count=1)

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
        shop = pieces_html(slugs(a["pieces"]), "Pieces from this Story") if a.get("pieces") else ""
        more = [b for b in articles if b is not a][:3]
        related = ("""    <section class="article-related">
      <div class="container">
        <div class="section-head"><span class="eyebrow">Keep Reading</span><h2>More from the Journal</h2></div>
        <div class="journal-grid">
""" + "\n".join(card(b) for b in more) + """
        </div>
      </div>
    </section>

""") if more else ""
        page = (head + journal[HEAD_END:BODY_START] + f"""<section class="article-hero">
      <div class="container">
        <p class="article-crumb"><a href="journal.html">Journal</a> <span aria-hidden="true">&#10022;</span> {html.escape(a['category'])}</p>
        <h1>{t}</h1>
        <p class="article-standfirst">{d}</p>
        <p class="article-meta">{long_date(a['when'])} &middot; {minutes(a)} min read</p>
      </div>
      <div class="container article-cover-wrap">
        <img class="article-cover" src="{html.escape(a['image'])}" alt="{t}" />
      </div>
    </section>

    <section class="article-body">
      <div class="container">
        <article class="article">
{body_html(a['body'])}
          <p class="article-signoff">Simply Elegant. Endlessly Yours.</p>
{shop}
          <p class="article-back"><a href="journal.html">&larr; All stories</a></p>
        </article>
      </div>
    </section>

{related}    """ + FOOTER)
        open(a["page"], "w", encoding="utf-8").write(page)
        print("wrote", a["page"])

    # The list on journal.html (the "coming soon" note stays until the first article): the newest story large,
    # then the rest, with buttons to show one category.
    start = journal.index("<section>", BODY_START)
    end = journal.index("</section>", start) + len("</section>")
    if articles:
        cats = []
        for a in articles:
            if a["category"] not in cats:
                cats.append(a["category"])
        chips = "".join(f'<button type="button" class="journal-chip" data-filter="{html.escape(c)}">{html.escape(c)}</button>' for c in cats)
        rest = "\n".join(card(a) for a in articles[1:])
        listing = f"""<section>
      <div class="container">
        <div class="journal-filter" role="group" aria-label="Show stories about"><button type="button" class="journal-chip is-active" data-filter="">All stories</button>{chips}</div>
  {card(articles[0], "journal-feature")}
        <div class="journal-grid">
{rest}
        </div>
      </div>
    </section>"""
        journal = journal[:start] + listing + journal[end:]
        if "js/journal.js" not in journal:
            journal = journal.replace('<script src="js/script.js"></script>', '<script src="js/script.js"></script>\n<script src="js/journal.js"></script>')
        open("journal.html", "w", encoding="utf-8").write(journal)
        print("wrote journal.html with", len(articles), "articles")

    # Sitemap
    sitemap = open("sitemap.xml", encoding="utf-8").read()
    if articles and f"<loc>{BASE}journal</loc>" not in sitemap:
        sitemap = sitemap.replace("</urlset>", f"  <url><loc>{BASE}journal</loc></url>\n</urlset>")
    for a in articles:
        loc = f"{BASE}journal-{a['slug']}"
        if loc not in sitemap:
            sitemap = sitemap.replace("</urlset>", f"  <url><loc>{loc}</loc><lastmod>{a['date']}</lastmod></url>\n</urlset>")
    open("sitemap.xml", "w", encoding="utf-8").write(sitemap)


if __name__ == "__main__":
    build()
