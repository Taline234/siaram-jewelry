#!/usr/bin/env python3
"""Run from anywhere:  python3 tools/build_products.py

Build every product page, the shop and home grids, the sitemap and the database seed
from the Siaram catalogue (names, prices, collections) and the July shoot photos."""
import html, json, os, re
from urllib.parse import quote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # the repository
BASE = "https://siaramjewelry.com/"
EMAIL = "customerservice@siaramjewelry.com"
WA = "96176052068"
os.chdir(ROOT)


shop = open("shop.html", encoding="utf-8").read()
HEADER = shop[shop.index('<header class="site-header">'):shop.index("</header>") + len("</header>")]
FOOTER = shop[shop.index('<footer class="site-footer">'):]

def url_for(page): return BASE if page == "index.html" else BASE + page

def seo_tags(page, title, desc, image, og_type, jsonld):
    t = html.escape(title, quote=True); d = html.escape(desc, quote=True)
    lines = [f'<link rel="canonical" href="{url_for(page)}" />',
             '<meta property="og:site_name" content="Siaram Jewelry" />',
             f'<meta property="og:type" content="{og_type}" />',
             f'<meta property="og:title" content="{t}" />',
             f'<meta property="og:description" content="{d}" />',
             f'<meta property="og:url" content="{url_for(page)}" />',
             f'<meta property="og:image" content="{BASE}{image}" />',
             '<meta name="twitter:card" content="summary_large_image" />']
    for block in jsonld:
        lines.append('<script type="application/ld+json">\n' + json.dumps(block, indent=2, ensure_ascii=False) + "\n</script>")
    return "\n".join(lines)

def breadcrumb(items):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList",
            "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": url_for(p)}
                                for i, (n, p) in enumerate(items)]}


# ---- catalogue (SJ Catalogue, October 2026): collection order and names as printed;
#      prices set by the owner on 23 October 2026
COLLECTIONS = [
    ("equestrian", "Equestrian", "Inspired by the bond between a horse and its rider, and the quiet strength, elegance and timeless spirit of the equestrian world."),
    ("core", "Core", "Signature designs that embody the effortless elegance at the heart of Siaram Jewelry."),
    ("fatima", "Fatima", "An enduring symbol reimagined through delicate details and contemporary elegance."),
    ("geometric", "Geometric", "Clean lines and sculptural forms come together in a study of modern simplicity."),
    ("celestial", "Celestial", "Inspired by the sun, moon and stars &mdash; a celebration of light in all its forms."),
    ("ocean", "Ocean", "Fluid forms inspired by the beauty, movement and serenity of the sea."),
    ("arrow", "Arrow", "Always moving forward. The arrow symbolises direction, determination and the courage to follow your own path."),
]
COLL = {k: (name, intro) for k, name, intro in COLLECTIONS}

def item(slug, name, cat, coll, price, short, stones, alt, extra=None, imgs=1):
    body = [short]
    if extra:
        body.append(extra)
    body.append(f"Part of our {COLL[coll][0]} Collection. {COLL[coll][1]}")
    return dict(slug=slug, name=name, cat=cat, coll=coll, price=price, short=short, body=body,
                stones=stones, alt=alt, nimgs=imgs)

P = [
    # Equestrian: horse shoe (best sellers)
    item("horseshoe-necklace", "Horse Shoe Necklace", "Necklaces", "equestrian", 490,
         "Our signature horseshoe pendant on a fine 18k yellow gold chain, with a long drop ending in a white zircon.",
         "White zircon", "Gold horseshoe pendant necklace with a long drop, worn with a green top",
         "A timeless symbol of good luck, protection and prosperity, designed as a subtle luxury charm for everyday wear.", imgs=3),
    item("horseshoe-necklace-black-stone", "Horse Shoe Necklace &ndash; Black Stone", "Necklaces", "equestrian", 525,
         "A Y-shaped 18k yellow gold necklace featuring a horseshoe set with black stones, finished with a fine drop chain ending in a white stone.",
         "Black and white zircon", "Y-shaped gold necklace with a black stone horseshoe, worn with a white top",
         "A timeless symbol of good luck, protection and prosperity, designed as a subtle luxury charm for everyday wear.", imgs=3),
    item("horseshoe-bracelet", "Horse Shoe Bracelet", "Bracelets", "equestrian", 450,
         "A fine 18k yellow gold chain bracelet featuring a horseshoe set with black stones, paired with a brilliant white stone.",
         "Black and white zircon", "Gold chain bracelet with a black stone horseshoe and a white stone, on the wrist", imgs=3),
    item("horseshoe-ring", "Horse Shoe Ring", "Rings", "equestrian", 350,
         "A horseshoe ring in 18k yellow gold, set with sparkling pav&eacute; zircon.",
         "Pav&eacute; zircon", "Gold horseshoe ring set with pavé zircon, worn on the hand",
         "A nod to the bond between a horse and its rider that gave Siaram its name. Delicate enough to stack, easy to wear every day.",
         imgs=3),
    item("horseshoe-chain-earrings", "Horse Shoe Earring", "Earrings", "equestrian", 420,
         "An 18k yellow gold earring featuring a black zircon-set horseshoe, connected by a fine gold chain to a sparkling white stone stud.",
         "Black and white zircon", "Gold horseshoe chain earring with a white stone stud, worn on the ear",
         "Made for two piercings in one ear: the chain drapes between them and catches the light as you move.",
         imgs=3),
    # Equestrian: horse eye
    item("horse-eye-ring", "Horse Eye Ring", "Rings", "equestrian", 555,
         "An open 18k yellow gold ring in the shape of a horse eye, with a striking marquise-cut red stone and white stones along its curved silhouette.",
         "Marquise-cut red stone and white zircon", "Gold horse eye ring with a red stone, worn on a hand resting on a horse", imgs=3),
    item("horse-eye-stud", "Horse Eye Stud", "Earrings", "equestrian", 410,
         "A bold 18k yellow gold horse eye stud with a marquise-shaped coloured centre stone, framed by subtle sparkling stones.",
         "Marquise-shaped coloured centre stone and zircon", "Gold horse eye stud earring, worn on the ear", imgs=3),
    item("horse-eye-bracelet", "Horse Eye Bracelet", "Bracelets", "equestrian", 450,
         "An 18k yellow gold chain bracelet featuring an elegant horse eye motif, set with a rich marquise-shaped red stone and sparkling white stones.",
         "Marquise-cut red stone and white zircon", "Gold horse eye bracelet laid out with other Siaram pieces", imgs=3),
    item("horse-eye-necklace", "Horse Eye Necklace", "Necklaces", "equestrian", 620,
         "An eye-catching 18k yellow gold necklace with a horse eye motif, set with a striking marquise-cut red stone and finished with delicate stone detailing along the eye.",
         "Marquise-cut red stone and zircon", "Gold horse eye necklace worn in dappled light", imgs=3),
    # Core
    item("curved-marquise-necklace", "Curved Marquise Necklace", "Necklaces", "core", 610,
         "An 18k yellow gold necklace with a fluid curved motif, accented with a sparkling marquise-cut stone and smaller stone details.",
         "Marquise-cut and round zircon", "Gold curved marquise necklace set with zircon, worn with a white top",
         'It layers beautifully with the <a href="product-v-bird-necklace.html">V Bird Necklace</a> and <a href="product-v-pendant-necklace.html">V Pendant</a>; each is sold separately.',
         imgs=3),
    item("curved-marquise-bracelet", "Curved Marquise Bracelet", "Bracelets", "core", 465,
         "An 18k yellow gold chain bracelet featuring a fluid marquise-inspired curve, partially set with sparkling white stones.",
         "White zircon", "Gold curved marquise bracelet on the wrist", imgs=3),
    item("curved-marquise-earrings", "Curved Marquise Earrings", "Earrings", "core", 540,
         "Delicate drop earrings in 18k yellow gold: a white stone stud, a fine chain and a sculpted curve, finished with a marquise-cut stone surrounded by smaller stones.",
         "Marquise-cut and round white zircon", "Gold curved marquise drop earrings displayed on a portrait vase",
         imgs=3),
    item("eye-necklace", "Eye Necklace", "Necklaces", "core", 630,
         "A delicate 18k yellow gold chain adorned with white pearls, with an eye-shaped pendant embellished with white stones and a striking turquoise centre.",
         "White zircon, turquoise centre stone and white pearls", "Gold eye necklace with pearls and a turquoise centre, in warm light", imgs=3),
    # Fatima
    item("fatima-pearl-earrings", "Fatima &amp; Pearl Drop Asymmetric Earrings", "Earrings", "fatima", 450,
         "An asymmetric pair in 18k yellow gold: a geometric triangle stud with a fine drop chain finished with a luminous white pearl, and an openwork Fatima hand charm.",
         "White pearl", "Asymmetric gold Fatima and pearl drop earrings, worn", imgs=3),
    item("fatima-necklace", "Fatima Necklace", "Necklaces", "fatima", 645,
         "A delicate Y-shaped 18k yellow gold necklace with an intricate Fatima hand charm, accented with three blue freshwater pearls and finished with a dangling white pearl.",
         "Turquoise-toned pearls and a white pearl", "Y-shaped gold Fatima hand necklace with blue freshwater pearls, worn with a white shirt", imgs=3),
    item("fatima-ring", "Fatima Ring", "Rings", "fatima", 355,
         "A minimal open ring in 18k yellow gold with a fine chain and a small Fatima hand outline set with a white stone.",
         "White zircon", "Minimal gold Fatima ring worn by the sea", imgs=3),
    item("fatima-anklet", "Fatima Anklet", "Anklets", "fatima", 420,
         "A delicate 18k yellow gold chain anklet with an open Fatima hand charm and three blue freshwater pearls along the chain.",
         "Turquoise-toned pearls", "Gold Fatima anklet with blue freshwater pearls, laid out with other pieces", imgs=3),
    # Geometric
    item("v-pendant-necklace", "V Pendant", "Necklaces", "geometric", 489,
         "A Y-shaped 18k yellow gold necklace with a sleek V-shaped centrepiece, finished with a fine drop chain and a geometric pendant accented with a white stone.",
         "White zircon", "Gold V pendant necklace with a white stone drop, layered",
         'It layers beautifully with the <a href="product-curved-marquise-necklace.html">Curved Marquise</a> and <a href="product-v-bird-necklace.html">V Bird</a> necklaces; each is sold separately.',
         imgs=3),
    item("triangle-necklace", "Triangle Necklace", "Necklaces", "geometric", 519,
         "An open triangle necklace in 18k yellow gold, centred with a white stone.",
         "White zircon", "Gold open triangle necklace with a white stone, on an open book", imgs=3),
    item("v-bird-necklace", "V Bird Necklace", "Necklaces", "geometric", 559,
         "An 18k yellow gold necklace with a sculpted V-shaped bird motif embellished with sparkling white stones.",
         "Pav&eacute; white zircon", "Gold V bird necklace set with white zircon, on an open book",
         'It layers beautifully with the <a href="product-curved-marquise-necklace.html">Curved Marquise Necklace</a> and <a href="product-v-pendant-necklace.html">V Pendant</a>; each is sold separately.',
         imgs=3),
    # Celestial
    item("moon-star-handchain", "Moon/Star Handchain", "Bracelets", "celestial", 622,
         "A delicate 18k yellow gold hand chain featuring an intricate crescent moon with a white stone, connecting to an open star charm and a fine chain ring.",
         "White zircon", "Gold moon and star hand chain, worn with a white shirt", imgs=3),
    item("moon-star-pendant-earring", "Moon &amp; Star Pendant Earring", "Earrings", "celestial", 450,
         "A white stone stud drop earring in 18k yellow gold, with a star suspended from a gold chain and a moon set with a black stone.",
         "White and black zircon", "Gold moon and star drop earring, worn by the sea", imgs=3),
    item("crescent-moon-earrings", "Crescent Moon Earrings", "Earrings", "celestial", 499.99,
         "Crescent moon studs in 18k yellow gold set with white stones, finished with a fine chain and a dangling white pearl.",
         "White zircon and white pearls", "Gold crescent moon earrings with pearl drops", imgs=2),
    item("star-moon-necklace", "Star/Moon Necklace", "Necklaces", "celestial", 470,
         "A delicate Y-shaped 18k yellow gold necklace with a hollow star connector and a small crescent moon drop.",
         "Zircon", "Y-shaped gold star and moon necklace displayed on a candle", imgs=3),
    item("qamar-ring", "Qamar Ring", "Rings", "celestial", 430,
         "The Arabic word &ldquo;&#1602;&#1605;&#1585;&rdquo; (qamar, moon) crafted into an 18k yellow gold ring with a white stone.",
         "White zircon", "Gold ring spelling qamar in Arabic, among white roses", imgs=3),
    item("crescent-moon-ring", "Crescent Moon Ring", "Rings", "celestial", 340,
         "A bold 18k yellow gold open crescent moon ring with a central stone detail.",
         "Zircon", "Gold open crescent moon ring with a zircon, on a wooden block", imgs=3),
    item("sun-necklace", "Sun Necklace", "Necklaces", "celestial", 579.99,
         "An open sun pendant in 18k yellow gold framed with shimmering stones and finished with a single suspended white pearl.",
         "White zircon and a white pearl", "Gold open sun necklace with a pearl, worn with a white shirt", imgs=3),
    item("sun-ring", "Sun Ring", "Rings", "celestial", 540,
         "A radiant open ring in 18k yellow gold with a white stone-set sun motif and a sweeping curved band of shining stones.",
         "White zircon", "Gold sun ring set with white zircon, worn on the hand", imgs=3),
    item("sun-stud-earrings", "Sun Stud Earring", "Earrings", "celestial", 569,
         "A statement sun-shaped stud in 18k yellow gold with an open centre, surrounded by sparkling white stones and polished golden rays.",
         "White zircon", "Gold sun stud earring with white zircon, worn", imgs=3),
    # Ocean
    item("seahorse-pearl-bracelet", "Seahorse Bracelet", "Bracelets", "ocean", 420,
         "A fine 18k yellow gold chain bracelet with a seahorse charm and a subtle zircon detail, accented by three small white pearls.",
         "Zircon and white pearls", "Gold seahorse bracelet with white pearls, on the wrist", imgs=3),
    item("wave-bracelet", "Wave Bracelet", "Bracelets", "ocean", 410,
         "An 18k yellow gold chain bracelet with a fluid wave-inspired design, centred with a luminous white pearl.",
         "White pearl", "Gold wave bracelet with a pearl, on the wrist", imgs=3),
    # Arrow
    item("arrow-necklace", "Arrow Necklace", "Necklaces", "arrow", 489,
         "A Y-shaped 18k yellow gold necklace with an arrow motif and a subtle zircon accent, finished with a fine drop chain and arrow tip.",
         "Zircon", "Y-shaped gold arrow necklace worn with a black top", imgs=3),
    item("arrow-bracelet", "Arrow Bracelet", "Bracelets", "arrow", 689,
         "A delicate 18k yellow gold bracelet featuring a geometric arrow, accented with sparkling stones and a vibrant red centre stone.",
         "White zircon and a red centre stone", "Gold arrow bracelet with a red stone, in warm light", imgs=3),
    item("arrow-earrings", "Arrow Earring", "Earrings", "arrow", 499,
         "An 18k yellow gold threader earring with a fine chain and a geometric arrowhead, accented with sparkling white stones and a vibrant red centre stone.",
         "White zircon and a red centre stone", "Gold arrow threader earring, worn", imgs=3),
    item("arrow-open-ring", "Arrow Open Ring", "Rings", "arrow", 589,
         "An open 18k yellow gold ring with the two ends of an arrow facing in opposite directions, set with contrasting black and white stones.",
         "Black and white zircon", "Gold open arrow ring with black and white stones", imgs=3),
    item("arrow-ring", "Arrow Ring", "Rings", "arrow", 679,
         "An 18k yellow gold ring where two arrowheads meet: one traced with white stones around a vivid coloured centre stone, the other polished gold.",
         "White zircon and a coloured centre stone", "Gold arrow ring with a coloured centre stone", imgs=3),
]

# ---- details from the owner (24 October 2026): SKU from the finance workbook, stones, other
#      materials, and sizes. ring = the size the ring is made in; wrist = adjustable chain (cm).
D = {
    "horseshoe-necklace": dict(sku="NK-01", stone="White zircon", dims=[("Chain", "40 cm"), ("Drop chain", "6 cm")]),
    "horseshoe-necklace-black-stone": dict(sku="NK-05", stone="Black zircon, white zircon", dims=[("Chain", "39.5&ndash;41.5 cm (adjustable)"), ("Drop chain", "5 cm")]),
    "horseshoe-bracelet": dict(sku="BR-02", stone="Black zircon, white zircon", wrist=(15, 17)),
    "horseshoe-ring": dict(sku="RG-04", stone="White zircon", ring=54),
    "horseshoe-chain-earrings": dict(sku="EA-03", stone="Black zircon, white zircon"),
    "horse-eye-ring": dict(sku="RG-07", stone="Red zircon (marquise cut), white zircon", ring=54),
    "horse-eye-stud": dict(sku="EA-08", stone="Red zircon (marquise cut), white zircon"),
    "horse-eye-bracelet": dict(sku="BR-08", stone="Red zircon (marquise cut), white zircon", wrist=(16, 17.5)),
    "horse-eye-necklace": dict(sku="NK-10", stone="Red zircon (marquise cut), white zircon", dims=[("Chain", "37&ndash;40 cm (adjustable)")]),
    "curved-marquise-necklace": dict(sku="NK-12", stone="White zircon", dims=[("Chain", "50&ndash;52 cm (adjustable)")]),
    "curved-marquise-bracelet": dict(sku="BR-07", stone="White zircon", wrist=(15, 17)),
    "curved-marquise-earrings": dict(sku="EA-10", stone="White zircon", dims=[("Drop chain", "2 cm")]),
    "eye-necklace": dict(sku="NK-02", stone="Blue zircon (centre), white zircon", other="White freshwater pearls", dims=[("Chain", "40&ndash;52.5 cm (adjustable)")]),
    "fatima-pearl-earrings": dict(sku="EA-01/EA-02", other="White freshwater pearl", dims=[("Drop chain", "3 cm")]),
    "fatima-necklace": dict(sku="NK-06", other="Blue freshwater pearls, white freshwater pearl", dims=[("Chain", "38&ndash;40 cm (adjustable)"), ("Blue pearls to white pearl", "5.5 cm")]),
    "fatima-ring": dict(sku="RG-03", stone="White zircon", ring=54),
    "fatima-anklet": dict(sku="AK-01", other="Blue freshwater pearls", dims=[("Chain", "21&ndash;22 cm (adjustable)")]),
    "v-pendant-necklace": dict(sku="NK-08", stone="White zircon", dims=[("Chain", "50&ndash;52 cm (adjustable)")]),
    "triangle-necklace": dict(sku="NK-09", stone="White zircon", dims=[("Chain", "50&ndash;52 cm (adjustable)")]),
    "v-bird-necklace": dict(sku="NK-07", stone="White zircon", dims=[("Chain", "39&ndash;41.5 cm (adjustable)")]),
    "moon-star-handchain": dict(sku="BR-04", stone="White zircon", wrist=(16, 18), dims=[("Moon to star", "2.5 cm"), ("Finger chain", "7 cm")]),
    "moon-star-pendant-earring": dict(sku="EA-04/EA-05", stone="White zircon, black zircon", dims=[("Star chain", "2.5 cm"), ("Moon chain", "3.5 cm")]),
    "crescent-moon-earrings": dict(sku="EA-07", stone="White zircon", other="White freshwater pearls"),
    "star-moon-necklace": dict(sku="NK-03", stone="White zircon", dims=[("Chain", "43 cm"), ("Drop chain", "3 cm")]),
    "qamar-ring": dict(sku="RG-02", stone="White zircon", ring=55),
    "crescent-moon-ring": dict(sku="RG-01", stone="White zircon", ring=54),
    "sun-necklace": dict(sku="NK-11", stone="White zircon", other="White freshwater pearl", dims=[("Chain", "35&ndash;38 cm (adjustable)")]),
    "sun-ring": dict(sku="RG-08", stone="White zircon", ring=54),
    "sun-stud-earrings": dict(sku="EA-09", stone="White zircon"),
    "seahorse-pearl-bracelet": dict(sku="BR-01", stone="White zircon", other="White freshwater pearls", wrist=(15, 16)),
    "wave-bracelet": dict(sku="BR-06", other="White freshwater pearl", wrist=(15, 16.5)),
    "arrow-necklace": dict(sku="NK-04", stone="White zircon", dims=[("Chain", "41 cm"), ("Drop chain", "5.5 cm")]),
    "arrow-bracelet": dict(sku="BR-05", stone="Red zircon (centre), white zircon", wrist=(16, 17)),
    "arrow-earrings": dict(sku="EA-06", stone="Red zircon (centre), white zircon", dims=[("Drop chain", "4 cm")]),
    "arrow-open-ring": dict(sku="RG-05", stone="Black zircon, white zircon", ring=55),
    "arrow-ring": dict(sku="RG-06", stone="Red zircon (centre), white zircon", ring=55),
}
assert set(D) == {p["slug"] for p in P}

# Ring sizes from the size guide: EU size (the inside circumference in mm) and its US equivalent.
RING_SIZES = [(45, "3.5"), (47, "4"), (48, "4.5"), (49, "5"), (50, "5.5"), (51, "6"), (52, "6.5"),
              (54, "7"), (55, "7.5"), (56, "8"), (58, "8.5"), (59, "9")]
CUSTOM_WRISTS = range(14, 21)  # other chain lengths in cm
cm = lambda v: f"{v:g}"

def size_options(d):
    """[(value, label)] for the size picker, or [] when the piece has no size. Every piece is made to order."""
    if "ring" in d:
        return [(f"EU {eu}", f"EU {eu} &middot; US {us}") for eu, us in RING_SIZES]
    if "wrist" in d:
        lo, hi = d["wrist"]
        std = f"{cm(lo)}&ndash;{cm(hi)} cm"
        return ([(html.unescape(std), f"{std} (adjustable, standard)")]
                + [(f"{n} cm", f"{n} cm") for n in CUSTOM_WRISTS if not lo <= n <= hi])
    return []

for p in P:
    d = D[p["slug"]]
    p.update(sku=d["sku"], stone=d.get("stone"), other=d.get("other"), sizes=size_options(d),
             size_kind="ring" if "ring" in d else "bracelet" if "wrist" in d else "necklace" if p["cat"] == "Necklaces" else None)
    dims = list(d.get("dims", []))
    if "wrist" in d:
        dims.insert(0, ("Wrist chain" if p["slug"] == "moon-star-handchain" else "Length",
                        f"{cm(d['wrist'][0])}&ndash;{cm(d['wrist'][1])} cm (adjustable)"))
    p["dims"] = dims
for p in P:
    p["imgs"] = [f"images/products/{p['slug']}-{i}.jpg" for i in range(1, p["nimgs"] + 1)]
    p["img"] = p["imgs"][0]
    p["plain"] = html.unescape(p["name"])
    p["page"] = f"product-{p['slug']}.html"
    p["desc"] = html.unescape(re.sub("<[^>]+>", "", p["short"]))
    p["price_text"] = f"${p['price']:,.2f}"
for p in P:
    for path in p["imgs"]:
        assert os.path.exists(path), path
WA_ICON = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>'

def links(p):
    mail = f"mailto:{EMAIL}?subject=" + quote(f"Enquiry: {p['plain']}")
    wa = f"https://wa.me/{WA}?text=" + quote(f"Hello Siaram, I'm interested in the {p['plain']}.")
    return html.escape(mail, quote=True), html.escape(wa, quote=True)

def card(p):
    mail, _ = links(p)
    return f"""      <article class="product-card" data-category="{p['cat'].lower()}" data-collection="{p['coll']}">
        <a href="{p['page']}" class="product-media" data-photos="{','.join(p['imgs'])}"><img src="{p['img']}" alt="{p['alt']}" loading="lazy" /></a>
        <div class="product-body">
          <span class="product-cat">{COLL[p['coll']][0]} Collection</span>
          <h3><a href="{p['page']}">{p['name']}</a></h3>
          <span class="card-price" data-price-for="{p['slug']}">{p['price_text']}</span>
          <p>{p['short']}</p>
          <a class="product-link" href="{p['page']}">View Details</a>
          <a class="btn btn-contact" href="{mail}">
            Enquire by Email
          </a>
        </div>
      </article>"""

METALS = [("yellow", "18k yellow gold"), ("rose", "18k rose gold"), ("white", "18k white gold")]

# Necklace length guide: where each length sits, drawn on a simple neckline.
NECKLACE_GUIDE = """<dialog class="size-guide" id="size-guide-necklace" aria-labelledby="necklace-guide-title">
  <button type="button" class="size-guide-close" aria-label="Close">&times;</button>
  <h2 id="necklace-guide-title">Necklace Length Guide</h2>
  <p>Each piece lists its chain length. Most of our chains are adjustable, so you can wear them a little higher or lower. Here is where each length sits.</p>
  <svg class="neck-diagram" viewBox="0 0 340 200" role="img" aria-label="Where 35, 40, 45 and 50 cm necklaces sit on the neckline">
    <path class="neck-body" d="M136 0 V58 C136 74 100 82 40 96 C22 100 10 112 6 130 M204 0 V58 C204 74 240 82 300 96 C318 100 330 112 334 130" />
    <path class="neck-line" d="M136 60 C142 92 198 92 204 60" />
    <path class="neck-line" d="M132 66 C138 122 202 122 208 66" />
    <path class="neck-line" d="M126 72 C134 152 206 152 214 72" />
    <path class="neck-line" d="M118 78 C128 196 212 196 222 78" />
    <text x="252" y="88">35 cm</text><line x1="196" y1="84" x2="248" y2="84" />
    <text x="252" y="114">40 cm</text><line x1="200" y1="108" x2="248" y2="110" />
    <text x="252" y="142">45 cm</text><line x1="204" y1="132" x2="248" y2="138" />
    <text x="252" y="176">50 cm</text><line x1="210" y1="166" x2="248" y2="172" />
  </svg>
  <table class="size-table">
    <thead><tr><th>Length</th><th>Where it sits</th></tr></thead>
    <tbody>
        <tr><td>35&ndash;38 cm</td><td>At the base of the neck</td></tr>
        <tr><td>40 cm</td><td>On the collarbone</td></tr>
        <tr><td>43&ndash;45 cm</td><td>Just below the collarbone</td></tr>
        <tr><td>50&ndash;52 cm</td><td>Above the neckline, lovely for layering</td></tr>
    </tbody>
  </table>
  <p class="size-guide-note">Shown on an average neck; the same chain sits a little higher on a larger neck. Want a different length? Every necklace is made to order: add the length you want in the order notes at checkout, or message us.</p>
</dialog>

"""

def options_html(p):
    """Metal and size pickers. They show on every product page; the cart reads them."""
    metals = "\n".join(
        f'            <label class="metal-choice"><input type="radio" name="metal" value="{v}"{" checked" if v == "yellow" else ""} />'
        f'<span class="metal-swatch metal-{v}" aria-hidden="true"></span><span>{label}</span></label>'
        for v, label in METALS)
    size = ""
    if p["sizes"]:
        opts = "\n".join(f'              <option value="{html.escape(v, quote=True)}">{label}</option>'
                         for v, label in p["sizes"])
        what = "Ring size" if p["size_kind"] == "ring" else "Length"
        size = f"""          <div class="option-group">
            <div class="option-head"><label for="size-select">{what}</label>
              <button type="button" class="link-btn size-guide-open" data-guide="{p['size_kind']}">Size guide</button></div>
            <select id="size-select" class="size-select" name="size" required>
              <option value="">Select a {what.lower()}</option>
{opts}
            </select>
          </div>
"""
    necklace_guide = ""
    if p["size_kind"] == "necklace":
        necklace_guide = """          <div class="option-head"><span class="option-label">Chain length</span>
            <button type="button" class="link-btn size-guide-open" data-guide="necklace">Necklace length guide</button></div>
"""
    return f"""        <div class="product-options" data-size-kind="{p['size_kind'] or ''}">
          <fieldset class="option-group">
            <legend>Metal</legend>
            <div class="metal-choices">
{metals}
            </div>
          </fieldset>
{size}{necklace_guide}          <p class="made-to-order-note">Every Siaram piece is made to order for you, in the metal and size you choose.</p>
        </div>
"""

def specs_html(p):
    rows = [("SKU", p["sku"]), ("Collection", COLL[p["coll"]][0]), ("Category", p["cat"]),
            ("Metal", "18k yellow, rose or white gold")]
    if p["stone"]:
        rows.append(("Stone", p["stone"]))
    if p["other"]:
        rows.append(("Other", p["other"]))
    rows += p["dims"]
    rows.append(("Care", '<a href="journal-gold-jewelry-care.html">How to care for your gold jewelry</a>'))
    body = "\n".join(f"          <dt>{k}</dt><dd>{v}</dd>" for k, v in rows)
    return f"""        <h2 class="specs-title">Details</h2>
        <dl class="product-specs">
{body}
        </dl>
"""

def guide_dialog(p):
    if p["size_kind"] == "ring":
        rows = "\n".join(f"        <tr><td>{eu / 3.14159:.1f}</td><td>{us}</td><td>{eu}</td></tr>" for eu, us in RING_SIZES)
        return f"""<dialog class="size-guide" id="size-guide-ring" aria-labelledby="ring-guide-title">
  <button type="button" class="size-guide-close" aria-label="Close">&times;</button>
  <h2 id="ring-guide-title">Ring Size Guide</h2>
  <p>Take a ring that fits you well and measure the inside diameter: straight across the centre, at the widest part of the circle. Find that measurement below to get your size.</p>
  <table class="size-table">
    <thead><tr><th>Diameter (mm)</th><th>US</th><th>EU</th></tr></thead>
    <tbody>
{rows}
    </tbody>
  </table>
  <p class="size-guide-note">Between two sizes? Choose the larger one. Every ring is made to order in the size you choose.</p>
</dialog>

"""
    if p["size_kind"] == "bracelet":
        return """<dialog class="size-guide" id="size-guide-bracelet" aria-labelledby="bracelet-guide-title">
  <button type="button" class="size-guide-close" aria-label="Close">&times;</button>
  <h2 id="bracelet-guide-title">Bracelet Size Guide</h2>
  <p>Wrap a soft tape measure, or a strip of paper you then lay against a ruler, around your wrist just above the wrist bone. Add 1 cm for a close fit or 2 cm for a looser drape.</p>
  <table class="size-table">
    <thead><tr><th>Your wrist</th><th>Close fit</th><th>Loose fit</th></tr></thead>
    <tbody>
        <tr><td>13 cm</td><td>14 cm</td><td>15 cm</td></tr>
        <tr><td>14 cm</td><td>15 cm</td><td>16 cm</td></tr>
        <tr><td>15 cm</td><td>16 cm</td><td>17 cm</td></tr>
        <tr><td>16 cm</td><td>17 cm</td><td>18 cm</td></tr>
        <tr><td>17 cm</td><td>18 cm</td><td>19 cm</td></tr>
        <tr><td>18 cm</td><td>19 cm</td><td>20 cm</td></tr>
    </tbody>
  </table>
  <p class="size-guide-note">Our standard chain is adjustable, so it fits a range of wrists. For a length outside that range, choose it from the list: every bracelet is made to order.</p>
</dialog>

"""
    if p["size_kind"] == "necklace":
        return NECKLACE_GUIDE
    return ""

def gallery_thumbs(p):
    if len(p["imgs"]) < 2:
        return ""
    buttons = []
    for i, src in enumerate(p["imgs"]):
        alt = p["alt"] if i == 0 else f"{p['plain']}, photo {i + 1}"
        current = "true" if i == 0 else "false"
        buttons.append(f'          <button type="button" class="gallery-thumb" data-src="{src}" data-alt="{html.escape(alt, quote=True)}" aria-current="{current}"><img src="{src}" alt="Show photo {i + 1}" loading="lazy" /></button>')
    return '        <div class="gallery-thumbs">\n' + "\n".join(buttons) + "\n        </div>\n"

def grid(items): return "\n\n" + "\n\n".join(card(p) for p in items) + "\n\n"

for p in P:
    mail, wa = links(p)
    others = ([o for o in P if o is not p and o["coll"] == p["coll"] and o["cat"] != p["cat"]]
              + [o for o in P if o is not p and o["coll"] == p["coll"] and o["cat"] == p["cat"]]
              + [o for o in P if o["coll"] != p["coll"]])[:3]
    paras = "\n".join(f"        <p>{b}</p>" for b in p["body"])
    body = f"""<section class="product-detail-section">
  <div class="container">
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="index.html">Home</a> <span>/</span> <a href="shop.html">Shop</a> <span>/</span> <a href="shop.html#{p['coll']}">{COLL[p['coll']][0]}</a> <span>/</span> {p['name']}
    </nav>
    <div class="product-detail">
      <div class="product-gallery reveal">
        <div class="product-detail-media">
          <img class="gallery-main" src="{p['img']}" alt="{p['alt']}" />
        </div>
{gallery_thumbs(p)}      </div>
      <div class="product-detail-info reveal">
        <span class="eyebrow">{COLL[p['coll']][0]} Collection &middot; {p['cat']}</span>
        <h1>{p['name']}</h1>
        <p class="product-price" data-price-for="{p['slug']}">{p['price_text']}</p>
{paras}
{options_html(p)}        <div class="product-buy" data-slug="{p['slug']}" hidden></div>
        <div class="product-actions">
          <a class="btn btn-primary" href="{mail}">Enquire by Email</a>
          <a class="btn btn-outline" href="{wa}" target="_blank" rel="noopener">{WA_ICON}WhatsApp Us</a>
        </div>
        <p class="product-note">We'll reply with sizing and availability. See our <a href="returns.html">exchange &amp; return policy</a>.</p>
{specs_html(p)}      </div>
    </div>
  </div>
</section>

<section class="alt-bg">
  <div class="container">
    <div class="section-head reveal">
      <span class="eyebrow">Complete the Look</span>
      <h2>You May Also Like</h2>
    </div>
    <div class="product-grid">
{grid(others)}    </div>
  </div>
</section>"""
    title = f"{p['name']} — Siaram Jewelry"
    jsonld = [{"@context": "https://schema.org", "@type": "Product", "name": p["plain"], "image": [BASE + i for i in p["imgs"]],
               "description": p["desc"], "sku": p["sku"], "category": p["cat"], "material": "18k yellow gold",
               "offers": {"@type": "Offer", "price": f"{p['price']:.2f}", "priceCurrency": "USD",
                          "availability": "https://schema.org/InStock", "url": url_for(p["page"])},
               "brand": {"@type": "Brand", "name": "Siaram Jewelry"}, "url": url_for(p["page"])},
              breadcrumb([("Home", "index.html"), ("Shop", "shop.html"), (p["plain"], p["page"])])]
    doc = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{title}</title>
<meta name="description" content="{html.escape(p['desc'], quote=True)}" />
{seo_tags(p['page'], html.unescape(title), p['desc'], p['img'], 'product', jsonld)}
<link rel="icon" href="images/logo.jpeg" />
<link rel="stylesheet" href="css/style.css" />
</head>
<body>

{HEADER}

{body}

{guide_dialog(p)}{FOOTER}"""
    open(p["page"], "w", encoding="utf-8").write(doc)

for old in []:
    if os.path.exists(old): git("rm", "-q", "-f", old)

# ---- product grids on shop + home
def replace_grid(fname, items):
    s = open(fname, encoding="utf-8").read()
    start = s.index('<div class="product-grid">') + len('<div class="product-grid">')
    end = s.index("    </div>\n  </div>\n</section>", start)
    s = s[:start] + grid(items) + s[end:]
    open(fname, "w", encoding="utf-8").write(s)
replace_grid("shop.html", P)
by = {p["slug"]: p for p in P}
replace_grid("index.html", [by["horseshoe-necklace"], by["fatima-necklace"], by["sun-ring"]])

# ---- shop filters: type and collection
s = open("shop.html", encoding="utf-8").read()
cats = ["Necklaces", "Earrings", "Rings", "Bracelets", "Anklets"]
bar = ('<div class="filter-bar">\n      <button class="filter-btn active" data-group="category" data-filter="all">All Pieces</button>\n'
       + "".join(f'      <button class="filter-btn" data-group="category" data-filter="{c.lower()}">{c}</button>\n' for c in cats)
       + '    </div>\n    <div class="filter-bar filter-bar-collections">\n'
       + '      <button class="filter-btn active" data-group="collection" data-filter="all">All Collections</button>\n'
       + "".join(f'      <button class="filter-btn" data-group="collection" data-filter="{k}">{n}</button>\n' for k, n, _ in COLLECTIONS)
       + '    </div>\n    <p class="collection-intro" aria-live="polite"></p>\n    <script type="application/json" id="collection-intros">'
       + json.dumps({k: html.unescape(i) for k, _, i in COLLECTIONS}) + '</script>')
s = re.sub(r'<div class="filter-bar">.*?</div>(\s*<div class="filter-bar filter-bar-collections">.*?</div>\s*<p class="collection-intro".*?</p>\s*<script type="application/json" id="collection-intros">.*?</script>)?', lambda m: bar, s, count=1, flags=re.S)
open("shop.html", "w", encoding="utf-8").write(s)

# ---- copy fixes elsewhere
def edit(fname, pairs):
    s = open(fname, encoding="utf-8").read()
    for old, new in pairs:
        assert old in s, (fname, old[:60])
        s = s.replace(old, new)
    open(fname, "w", encoding="utf-8").write(s)

# ---- sitemap
s = open("sitemap.xml").read()
s = re.sub(r"  <url><loc>https://siaramjewelry\.com/product-[^<]+</loc></url>\n", "", s)
prod = "".join(f"  <url><loc>{BASE}{p['page']}</loc></url>\n" for p in P)
s = s.replace(f"  <url><loc>{BASE}shop.html</loc></url>\n", f"  <url><loc>{BASE}shop.html</loc></url>\n" + prod)
open("sitemap.xml", "w").write(s)

# ---- database seed
sql = lambda v: "'" + v.replace("'", "''") + "'"
seed = "insert into public.products (slug, name, category, image, price) values\n" + ",\n".join(
    f"  ({sql(p['slug'])}, {sql(p['plain'])}, {sql(p['cat'])}, {sql(p['img'])}, {p['price']})" for p in P) + "\non conflict (slug) do nothing;"
s = open("supabase/schema.sql", encoding="utf-8").read()
s, n = re.subn(r"insert into public\.products \(slug, name, category, image(, price)?\) values\n.*?on conflict \(slug\) do nothing;", lambda m: seed, s, flags=re.S)
assert n == 1
sizes = "update public.products p set sizes = v.sizes\n  from (values\n" + ",\n".join(
    f"    ({sql(p['slug'])}, array[{', '.join(sql(v) for v, _ in p['sizes'])}])"
    for p in P if p["sizes"]) + "\n  ) as v(slug, sizes)\n where p.slug = v.slug;"
s, n = re.subn(r"(-- product sizes start\n).*?(-- product sizes end)", lambda m: m.group(1) + sizes + "\n" + m.group(2), s, flags=re.S)
assert n == 1
open("supabase/schema.sql", "w", encoding="utf-8").write(s)
print("ok")
