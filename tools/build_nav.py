#!/usr/bin/env python3
"""Run from the repository root:  python3 tools/build_nav.py

Writes the same top menu (with the Shop dropdown) and phone menu into every page, from the lists below.
Run it again after changing a list. 404.html gets addresses from the site root, because it can appear at any address.
Product pages copy their header from shop.html (tools/build_products.py), so they keep this menu too."""
import glob
import re

CATEGORIES = [("All Pieces", "shop.html#all"), ("Necklaces", "shop.html#necklaces"), ("Earrings", "shop.html#earrings"),
              ("Bracelets", "shop.html#bracelets"), ("Rings", "shop.html#rings"), ("Anklets", "shop.html#anklets")]
COLLECTIONS = [("Equestrian", "shop.html#equestrian"), ("Core", "shop.html#core"), ("Hamsa", "shop.html#fatima"),
               ("Geometric", "shop.html#geometric"), ("Celestial", "shop.html#celestial"), ("Ocean", "shop.html#ocean"),
               ("Arrow", "shop.html#arrow")]
GIFTS = [("Bestsellers", "index.html#bestsellers"), ("Gift Vouchers", "gift-voucher.html"), ("Custom Pieces", "custom.html"),
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
    mobile = '<div class="mobile-menu">\n' + "\n".join(phone) + "\n  </div>"
    return desktop, mobile


NAV_RE = re.compile(r'<ul class="nav-links">.*?\n    </ul>', re.S)
MOBILE_RE = re.compile(r'<div class="mobile-menu">.*?\n  </div>', re.S)

for path in sorted(glob.glob("*.html")):
    page = open(path, encoding="utf-8").read()
    if '<ul class="nav-links">' not in page:
        continue
    desktop, mobile = menus("/" if path == "404.html" else "")
    new = NAV_RE.sub(lambda _: desktop, page, count=1)
    new = MOBILE_RE.sub(lambda _: mobile, new, count=1)
    if new != page:
        open(path, "w", encoding="utf-8").write(new)
        print("menu updated:", path)
