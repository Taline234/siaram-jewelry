#!/usr/bin/env python3
"""Run from the repository root, after tools/build_products.py and before tools/build_nav.py:
    python3 tools/build_gift_guide.py

Writes gift-guide.html: pieces grouped by price (the same product cards as the shop, so Add to Cart and the live
prices work), ways to make a gift personal, and how gift orders are delivered. Everything comes from what the site
already offers; it adds no offers or promises of its own."""
import re

BASE = "https://siaramjewelry.com/"
shop = open("shop.html", encoding="utf-8").read()
cards = re.findall(r'(      <article class="product-card".*?</article>)', shop, re.S)


def price(card):
    m = re.search(r'data-price-for="[^"]+">\$([\d,.]+)', card)
    return float(m.group(1).replace(",", "")) if m else None


BANDS = [("under-450", "Under $450", lambda p: p < 450), ("450-550", "$450 to $550", lambda p: 450 <= p <= 550),
         ("over-550", "Over $550", lambda p: p > 550)]
sections = []
for anchor, label, test in BANDS:
    picks = [c for c in cards if price(c) is not None and test(price(c))][:4]
    if not picks:
        continue
    sections.append(f"""    <div class="guide-section gift-band reveal" id="{anchor}">
      <h2>{label}</h2>
      <div class="product-grid">
{chr(10).join(picks)}
      </div>
      <a class="section-link" href="shop.html#all">See every piece <span aria-hidden="true">&rarr;</span></a>
    </div>""")

body = f"""
<section class="guide">
  <div class="container guide-container">
    <nav class="guide-jump" aria-label="On this page">{"".join(f'<a href="#{a}">{l}</a>' for a, l, _ in BANDS)}<a href="#personal">Make it personal</a><a href="#sending">Sending a gift</a></nav>

{chr(10).join(sections)}

    <div class="guide-section reveal" id="personal">
      <h2>Make it personal</h2>
      <div class="gift-ideas">
        <a class="gift-idea" href="custom.html"><strong>Names &amp; initials</strong><span>A custom piece with a name or
          initial, in Arabic or English, designed with you.</span></a>
        <a class="gift-idea" href="materials.html#birthstones"><strong>Birthstones</strong><span>A stone for each month, for a
          piece that is theirs alone.</span></a>
        <a class="gift-idea" href="gift-voucher.html"><strong>Gift vouchers</strong><span>From $100, sent digitally to the
          person you name, so they can choose their own piece.</span></a>
      </div>
    </div>

    <div class="guide-section reveal" id="sending">
      <h2>Sending a gift</h2>
      <p>At checkout, tick <strong>This is a gift</strong>: we deliver to the person you name, leave every price out of the
        parcel and add your message card.</p>
      <p>Not sure about a size? See our <a href="size-guide.html">Size Guide</a>, or <a href="contact.html">ask us</a>.</p>
    </div>

    <div class="guide-help reveal">
      <h2>Still not sure what to get them?</h2>
      <p>Tell us a little about them and we will help you choose, or let them choose for themselves with a gift voucher.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="contact.html">Ask Us for Ideas</a>
        <a class="btn btn-outline" href="gift-voucher.html">Give a Gift Voucher</a>
      </div>
    </div>
  </div>
</section>
"""

# Head, header and footer come from the Care Guide page, so the menus and styles match the other guides.
care = open("care-guide.html", encoding="utf-8").read()
head = care[:care.index('<section class="page-hero">')]
footer = care[care.index('</main>') if '</main>' in care else care.index('<footer class="site-footer">'):]
head = re.sub(r"<title>.*?</title>", "<title>Gift Guide | Siaram Jewelry</title>", head, count=1, flags=re.S)
desc = "Gift ideas from Siaram Jewelry: 18k gold pieces by budget, personalised pieces, birthstones and gift vouchers."
head = re.sub(r'(<meta name="description" content=")[^"]*', r"\g<1>" + desc, head, count=1)
head = re.sub(r'(<meta property="og:description" content=")[^"]*', r"\g<1>" + desc, head)
head = re.sub(r'(<meta (?:property|name)="(?:og|twitter):title" content=")[^"]*', r"\g<1>Gift Guide | Siaram Jewelry", head)
head = head.replace(f'{BASE}care-guide', f'{BASE}gift-guide')
hero = """<section class="page-hero">
  <div class="container">
    <span class="eyebrow">The Perfect Gift</span>
    <h1>Gift Guide</h1>
    <p class="guide-intro">Pieces for every budget, ways to make a gift personal, and how we deliver it.</p>
  </div>
</section>
"""
open("gift-guide.html", "w", encoding="utf-8").write(head + hero + body + footer)

sitemap = open("sitemap.xml", encoding="utf-8").read()
loc = f"<url><loc>{BASE}gift-guide</loc></url>"
if loc not in sitemap:
    open("sitemap.xml", "w", encoding="utf-8").write(sitemap.replace("</urlset>", f"  {loc}\n</urlset>"))
print("wrote gift-guide.html with", sum(s.count("<article") for s in sections), "pieces")
