#!/usr/bin/env python3
"""Run from the repository root:  python3 tools/build_nav.py

Writes the same top menu (with the Shop dropdown) and phone menu into every page, from the lists below.
Run it again after changing a list. 404.html gets addresses from the site root, because it can appear at any address.
Product pages copy their header from shop.html (tools/build_products.py), so they keep this menu too.
It also adds the Skip to content link, <main> and the footer heading levels: run it last, after any other build_ tool."""
import glob
import re

CATEGORIES = [("All Pieces", "shop.html#all"), ("Necklaces", "shop.html#necklaces"), ("Earrings", "shop.html#earrings"),
              ("Bracelets", "shop.html#bracelets"), ("Rings", "shop.html#rings"), ("Anklets", "shop.html#anklets")]
COLLECTIONS = [("Equestrian", "shop.html#equestrian"), ("Core", "shop.html#core"), ("Hamsa", "shop.html#fatima"),
               ("Geometric", "shop.html#geometric"), ("Celestial", "shop.html#celestial"), ("Ocean", "shop.html#ocean"),
               ("Arrow", "shop.html#arrow")]
GIFTS = [("Gift Guide", "gift-guide.html"), ("Bestsellers", "index.html#bestsellers"), ("Gift Vouchers", "gift-voucher.html"), ("Custom Pieces", "custom.html"),
         ("Size Guide", "size-guide.html"), ("Gold &amp; Gemstones", "materials.html"),
         ("Care Guide", "care-guide.html")]
FEATURE = ("shop.html#equestrian", "images/products/horseshoe-necklace-1.jpg", "Bestsellers", "Our Horseshoe Pieces")
TOP = [("Home", "index.html"), ("About", "about.html"), ("Shop", "shop.html"), ("Custom", "custom.html"),
       ("Gift Vouchers", "gift-voucher.html"), ("Journal", "journal.html"), ("Contact", "contact.html")]


def menus(root=""):
    u = lambda href: root + href
    col = lambda title, links: (f'          <div class="mega-col">\n            <h4>{title}</h4>\n'
                                + "".join(f'            <a href="{u(h)}">{t}</a>\n' for t, h in links) + "          </div>\n")
    href, img, eyebrow, title = FEATURE
    mega = (f'        <div class="mega" role="region" aria-label="Shop">\n          <div class="mega-inner">\n'
            + col("Shop by Category", CATEGORIES) + col("Shop by Collection", COLLECTIONS) + col("Gifts &amp; Services", GIFTS)
            + f'          <a class="mega-feature" href="{u(href)}"><img src="{u(img)}" alt="Fortune Necklace" loading="lazy" />'
              f'<span class="eyebrow">{eyebrow}</span><span class="mega-feature-title">{title}</span></a>\n'
            + "          </div>\n        </div>\n")
    items = []
    for t, h in TOP:
        if t == "Shop":
            items.append(f'      <li class="has-mega"><a href="{u(h)}" aria-haspopup="true">{t}</a>\n{mega}      </li>')
        else:
            items.append(f'      <li><a href="{u(h)}">{t}</a></li>')
    desktop = '<ul class="nav-links">\n' + "\n".join(items) + "\n    </ul>"

    sub = lambda title, links: (f'        <p class="mobile-sub-title">{title}</p>\n'
                                + "".join(f'        <a href="{u(h)}">{t}</a>\n' for t, h in links))
    phone = []
    for t, h in TOP:
        if t == "Shop":
            phone.append(f'    <details class="mobile-shop">\n      <summary>Shop</summary>\n      <div class="mobile-shop-links">\n'
                         + sub("Shop by Category", CATEGORIES) + sub("Shop by Collection", COLLECTIONS)
                         + sub("Gifts &amp; Services", GIFTS) + "      </div>\n    </details>")
        else:
            phone.append(f'    <a href="{u(h)}">{t}</a>')
    phone.append('    <div class="mobile-enquire"><span>Enquire</span>'
                 '<a href="https://wa.me/96176052068" target="_blank" rel="noopener">WhatsApp</a>'
                 '<a href="mailto:customerservice@siaramjewelry.com?subject=Enquiry">Email</a></div>')
    mobile = '<div class="mobile-menu" id="mobile-menu">\n' + "\n".join(phone) + "\n  </div>"
    return desktop, mobile


NAV_RE = re.compile(r'<ul class="nav-links">.*?\n    </ul>', re.S)
MOBILE_RE = re.compile(r'<div class="mobile-menu"(?: id="mobile-menu")?>.*?\n  </div>', re.S)

FOOTER_RE = re.compile(r'<footer class="site-footer">.*?</footer>', re.S)


def accessible(page):
    """Landmarks and headings every page needs for screen readers and keyboard users: a "Skip to content" link,
    the page content inside <main>, footer headings at h2 (not h4), and a menu button that says if it is open."""
    if '<a class="skip-link"' not in page:
        page = re.sub(r'(<body[^>]*>)', r'\1\n<a class="skip-link" href="#main">Skip to content</a>', page, count=1)
    if '<main' not in page and '</header>' in page and '<footer class="site-footer">' in page:
        page = page.replace('</header>', '</header>\n<main id="main">', 1)
        page = page.replace('<footer class="site-footer">', '</main>\n\n<footer class="site-footer">', 1)
    page = FOOTER_RE.sub(lambda m: m.group(0).replace('<h4>', '<h2 class="footer-heading">').replace('</h4>', '</h2>'),
                         page, count=1)
    # Ordering controls stay hidden (keeping their space) until prices and stock have loaded: see js/store.js.
    if 'store-pending' not in page:
        page = page.replace('</head>', '<script>document.documentElement.classList.add(\'store-pending\')</script>\n</head>', 1)
    page = page.replace('<button class="nav-toggle" aria-label="Menu">',
                        '<button class="nav-toggle" aria-label="Menu" aria-expanded="false" aria-controls="mobile-menu">')
    return page


for path in sorted(glob.glob("*.html")):
    page = open(path, encoding="utf-8").read()
    if '<ul class="nav-links">' not in page:
        continue
    desktop, mobile = menus("/" if path == "404.html" else "")
    new = NAV_RE.sub(lambda _: desktop, page, count=1)
    new = MOBILE_RE.sub(lambda _: mobile, new, count=1)
    new = accessible(new)
    if new != page:
        open(path, "w", encoding="utf-8").write(new)
        print("menu updated:", path)
