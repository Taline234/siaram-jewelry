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

# Cloudflare serves /shop.html at /shop, so canonical links and the sitemap use the short address.
# Messages from clients, shown on the piece's page (and on the home page, see REVIEW section in index.html).
REVIEWS = {
    "horseshoe-bracelet": [
        ("Obsessed &#128525;", "", "images/reviews/horseshoe-bracelet.jpg"),
        ("Thank u girlie, I love it so much &#129293;&#129293;&#129293;", "", "images/reviews/horseshoe-bracelet-flat.jpg"),
    ],
}


def reviews_html(p):
    items = REVIEWS.get(p["slug"])
    if not items:
        return ""
    cards = "\n".join(f"""      <figure class="review-card reveal">{f'<img src="{img}" alt="A client wearing the {p["plain"]}" loading="lazy" />' if img else ''}
        <blockquote>&ldquo;{quote}&rdquo;</blockquote>{f'<p class="review-translation">{tr}</p>' if tr else ''}
      </figure>""" for quote, tr, img in items)
    return f"""<section class="reviews">
  <div class="container">
    <div class="section-head reveal"><span class="eyebrow">From Our Clients</span><h2>Loved and Worn</h2></div>
    <div class="review-grid">
{cards}
    </div>
  </div>
</section>

"""


def url_for(page): return BASE if page == "index.html" else BASE + page.removesuffix(".html")

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
    ("fatima", "Hamsa", "An enduring symbol reimagined through delicate details and contemporary elegance."),
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
    item("horseshoe-necklace", "Fortune Necklace", "Necklaces", "equestrian", 490,
         "Our signature horseshoe pendant on a fine 18k yellow gold chain, with a long drop ending in a white zircon.",
         "White zircon", "Gold horseshoe pendant necklace with a long drop, worn with a green top",
         "Designed as a subtle charm for everyday wear.", imgs=3),
    item("horseshoe-necklace-black-stone", "Midnight Horseshoe Necklace", "Necklaces", "equestrian", 525,
         "A Y-shaped 18k yellow gold necklace featuring a horseshoe set with black zircons, finished with a fine drop chain ending in a white zircon.",
         "Black and white zircon", "Y-shaped gold necklace with a black zircon horseshoe, worn with a white top",
         "Designed as a subtle charm for everyday wear.", imgs=3),
    item("horseshoe-bracelet", "Midnight Horseshoe Bracelet", "Bracelets", "equestrian", 450,
         "A fine 18k yellow gold chain bracelet featuring a horseshoe set with black zircons, paired with a brilliant white zircon.",
         "Black and white zircon", "Gold chain bracelet with a black zircon horseshoe and a white zircon, on the wrist", imgs=3),
    item("horseshoe-ring", "Fortune Ring", "Rings", "equestrian", 350,
         "A horseshoe ring in 18k yellow gold, set with sparkling pav&eacute; white zircon.",
         "Pav&eacute; white zircon", "Gold horseshoe ring set with pavé zircon, worn on the hand",
         "A nod to the bond between a horse and its rider that gave Siaram its name. Delicate enough to stack, easy to wear every day.",
         imgs=3),
    item("horseshoe-chain-earrings", "Midnight Horseshoe Earring", "Earrings", "equestrian", 420,
         "An 18k yellow gold earring featuring a black zircon horseshoe, connected by a fine gold chain to a sparkling white zircon stud.",
         "Black and white zircon", "Gold horseshoe chain earring with a white zircon stud, worn on the ear",
         "Made for two piercings in one ear: the chain drapes between them and catches the light as you move.",
         imgs=3),
    # Equestrian: horse eye
    item("horse-eye-ring", "Regard Ring", "Rings", "equestrian", 555,
         "An open 18k yellow gold ring in the shape of a horse eye, with a striking marquise-cut red zircon and white zircons along its curved silhouette.",
         "Marquise-cut red zircon and white zircon", "Gold horse eye ring with a red zircon, worn on a hand resting on a horse", imgs=3),
    item("horse-eye-stud", "Regard Stud Earrings", "Earrings", "equestrian", 410,
         "A bold 18k yellow gold horse eye stud with a marquise-cut red zircon at its centre, framed by subtle sparkling white zircons.",
         "Marquise-cut red zircon and white zircon", "Gold horse eye stud earring, worn on the ear", imgs=3),
    item("horse-eye-bracelet", "Regard Bracelet", "Bracelets", "equestrian", 450,
         "An 18k yellow gold chain bracelet featuring an elegant horse eye motif, set with a rich marquise-shaped red zircon and sparkling white zircons.",
         "Marquise-cut red zircon and white zircon", "Gold horse eye bracelet laid out with other Siaram pieces", imgs=1),
    item("horse-eye-necklace", "Regard Necklace", "Necklaces", "equestrian", 620,
         "An eye-catching 18k yellow gold necklace with a horse eye motif, set with a striking marquise-cut red zircon and finished with delicate stone detailing along the eye.",
         "Marquise-cut red zircon and white zircon", "Gold horse eye necklace worn in dappled light", imgs=3),
    # Core
    item("curved-marquise-necklace", "Aria Necklace", "Necklaces", "core", 610,
         "An 18k yellow gold necklace with a fluid curved motif, accented with a sparkling marquise-cut white zircon and smaller white zircon details.",
         "Marquise-cut and round white zircon", "Gold curved marquise necklace set with zircon, worn with a white top",
         'It layers beautifully with the <a href="product-v-bird-necklace.html">Envole Necklace</a> and <a href="product-v-pendant-necklace.html">Vertex Necklace</a>; each is sold separately.',
         imgs=3),
    item("curved-marquise-bracelet", "Aria Bracelet", "Bracelets", "core", 465,
         "An 18k yellow gold chain bracelet featuring a fluid marquise-inspired curve, partially set with sparkling white zircons.",
         "White zircon", "Gold curved marquise bracelet on the wrist", imgs=3),
    item("curved-marquise-earrings", "Aria Earrings", "Earrings", "core", 540,
         "Delicate drop earrings in 18k yellow gold: a white zircon stud, a fine chain and a sculpted curve, finished with a marquise-cut white zircon surrounded by smaller white zircons.",
         "Marquise-cut and round white zircon", "Gold curved marquise drop earrings displayed on a portrait vase",
         imgs=3),
    item("eye-necklace", "Nazar Necklace", "Necklaces", "core", 630,
         "A delicate 18k yellow gold chain adorned with white freshwater pearls, with an eye-shaped pendant embellished with white zircons and a striking turquoise centre.",
         "White zircon, turquoise centre stone and white freshwater pearls", "Gold eye necklace with pearls and a turquoise centre, in warm light", imgs=3),
    # Fatima
    item("fatima-pearl-earrings", "Hamsa Pearl Asymmetric Earrings", "Earrings", "fatima", 450,
         "An asymmetric pair in 18k yellow gold: a geometric triangle stud with a fine drop chain finished with a luminous white freshwater pearl, and an openwork Hamsa hand charm.",
         "White freshwater pearl", "Asymmetric gold Hamsa and pearl drop earrings, worn", imgs=3),
    item("fatima-necklace", "Hamsa Necklace", "Necklaces", "fatima", 645,
         "A delicate Y-shaped 18k yellow gold necklace with an intricate Hamsa hand charm, accented with three blue freshwater pearls and finished with a dangling white freshwater pearl.",
         "Blue freshwater pearls and a white freshwater pearl", "Y-shaped gold Hamsa hand necklace with blue freshwater pearls, worn with a white shirt", imgs=3),
    item("fatima-ring", "Hamsa Ring", "Rings", "fatima", 355,
         "A minimal open ring in 18k yellow gold with a fine chain and a small Hamsa hand outline set with a white zircon.",
         "White zircon", "Minimal gold Hamsa ring worn by the sea", imgs=3),
    item("fatima-anklet", "Hamsa Anklet", "Anklets", "fatima", 420,
         "A delicate 18k yellow gold chain anklet with an open Hamsa hand charm and three blue freshwater pearls along the chain.",
         "Blue freshwater pearls", "Gold Hamsa anklet with blue freshwater pearls, laid out with other pieces", imgs=3),
    # Geometric
    item("v-pendant-necklace", "Vertex Necklace", "Necklaces", "geometric", 489,
         "A Y-shaped 18k yellow gold necklace with a sleek V-shaped centrepiece, finished with a fine drop chain and a geometric pendant accented with a white zircon.",
         "White zircon", "Gold V pendant necklace with a white zircon drop, layered",
         'It layers beautifully with the <a href="product-curved-marquise-necklace.html">Aria</a> and <a href="product-v-bird-necklace.html">Envole</a> necklaces; each is sold separately.',
         imgs=3),
    item("triangle-necklace", "Tria Necklace", "Necklaces", "geometric", 519,
         "An open triangle necklace in 18k yellow gold, centred with a white zircon.",
         "White zircon", "Gold open triangle necklace with a white zircon, on an open book", imgs=3),
    item("v-bird-necklace", "Envole Necklace", "Necklaces", "geometric", 559,
         "An 18k yellow gold necklace with a sculpted V-shaped bird motif embellished with sparkling white zircons.",
         "Pav&eacute; white zircon", "Gold V bird necklace set with white zircon, on an open book",
         'It layers beautifully with the <a href="product-curved-marquise-necklace.html">Aria Necklace</a> and <a href="product-v-pendant-necklace.html">Vertex Necklace</a>; each is sold separately.',
         imgs=3),
    # Celestial
    item("moon-star-handchain", "Celeste Handchain", "Bracelets", "celestial", 622,
         "A delicate 18k yellow gold hand chain featuring an intricate crescent moon with a white zircon, connecting to an open star charm and a fine chain ring.",
         "White zircon", "Gold moon and star hand chain, worn with a white shirt", imgs=3),
    item("moon-star-pendant-earring", "Celeste Drop Earrings", "Earrings", "celestial", 450,
         "A white zircon stud drop earring in 18k yellow gold, with a star suspended from a gold chain and a moon set with a black stone.",
         "White and black zircon", "Gold moon and star drop earring, worn by the sea", imgs=3),
    item("crescent-moon-earrings", "Lune Pearl Earrings", "Earrings", "celestial", 499,
         "Crescent moon studs in 18k yellow gold set with white zircons, finished with a fine chain and a dangling white freshwater pearl.",
         "White zircon and white freshwater pearls", "Gold crescent moon earrings with pearl drops", imgs=2),
    item("star-moon-necklace", "Celestial Necklace", "Necklaces", "celestial", 470,
         "A delicate Y-shaped 18k yellow gold necklace with a hollow star connector and a small crescent moon drop.",
         "White zircon", "Y-shaped gold star and moon necklace displayed on a candle", imgs=3),
    item("qamar-ring", "Qamar Ring", "Rings", "celestial", 430,
         "The Arabic word &ldquo;&#1602;&#1605;&#1585;&rdquo; (qamar, moon) crafted into an 18k yellow gold ring with a white zircon.",
         "White zircon", "Gold ring spelling qamar in Arabic, among white roses", imgs=3),
    item("crescent-moon-ring", "Lune Ring", "Rings", "celestial", 340,
         "A bold 18k yellow gold open crescent moon ring with a central stone detail.",
         "White zircon", "Gold open crescent moon ring with a zircon, on a wooden block", imgs=3),
    item("sun-necklace", "Sol Necklace", "Necklaces", "celestial", 579,
         "An open sun pendant in 18k yellow gold framed with shimmering white zircons and finished with a single suspended white freshwater pearl.",
         "White zircon and a white freshwater pearl", "Gold open sun necklace with a pearl, worn with a white shirt", imgs=3),
    item("sun-ring", "Sol Ring", "Rings", "celestial", 540,
         "A radiant open ring in 18k yellow gold with a white zircon-set sun motif and a sweeping curved band of shining stones.",
         "White zircon", "Gold sun ring set with white zircon, worn on the hand", imgs=3),
    item("sun-stud-earrings", "Sol Stud Earrings", "Earrings", "celestial", 569,
         "A statement sun-shaped stud in 18k yellow gold with an open centre, surrounded by sparkling white zircons and polished golden rays.",
         "White zircon", "Gold sun stud earring with white zircon, worn", imgs=3),
    # Ocean
    item("seahorse-pearl-bracelet", "Seahorse Bracelet", "Bracelets", "ocean", 420,
         "A fine 18k yellow gold chain bracelet with a seahorse charm and a subtle white zircon detail, accented by three small white freshwater pearls.",
         "White zircon and white freshwater pearls", "Gold seahorse bracelet with white freshwater pearls, on the wrist", imgs=3),
    item("wave-bracelet", "Mar&eacute;e Bracelet", "Bracelets", "ocean", 410,
         "An 18k yellow gold chain bracelet with a fluid wave-inspired design, centred with a luminous white freshwater pearl.",
         "White freshwater pearls", "Gold wave bracelet with a pearl, on the wrist", imgs=3),
    # Arrow
    item("arrow-necklace", "Arrow Necklace", "Necklaces", "arrow", 489,
         "A Y-shaped 18k yellow gold necklace with an arrow motif and a subtle white zircon accent, finished with a fine drop chain and arrow tip.",
         "White zircon", "Y-shaped gold arrow necklace worn with a black top", imgs=3),
    item("arrow-bracelet", "Arrow Bracelet", "Bracelets", "arrow", 689,
         "A delicate 18k yellow gold bracelet featuring a geometric arrow, accented with sparkling white zircons and a vibrant red zircon at its centre.",
         "White zircon and a red zircon centre", "Gold arrow bracelet with a red zircon, in warm light", imgs=3),
    item("arrow-earrings", "Arrow Drop Earrings", "Earrings", "arrow", 499,
         "An 18k yellow gold threader earring with a fine chain and a geometric arrowhead, accented with sparkling white zircons and a vibrant red zircon at its centre.",
         "White zircon and a red zircon centre", "Gold arrow threader earring, worn", imgs=3),
    item("arrow-open-ring", "Diverge Arrow Ring", "Rings", "arrow", 589,
         "An open 18k yellow gold ring with the two ends of an arrow facing in opposite directions, set with contrasting black and white zircons.",
         "Black and white zircon", "Gold open arrow ring with black and white zircons", imgs=3),
    item("arrow-ring", "Sahm Ring", "Rings", "arrow", 679,
         "An 18k yellow gold ring where two arrowheads meet: one traced with white zircons around a vivid red zircon at the centre, the other polished gold.",
         "White zircon and a red zircon centre", "Gold arrow ring with a coloured centre stone", imgs=3),
]

# ---- approved names (November 2026): the meaning behind each name, shown in the description,
#      and the former name, so earlier records and links can still be matched.
MEANING = {
    "horseshoe-necklace": "Named for good fortune, this horseshoe is a reminder of luck, protection and the possibilities ahead.",
    "horseshoe-necklace-black-stone": "Midnight evokes the depth of its black zircons, while the horseshoe celebrates luck and the bond between horse and rider.",
    "horseshoe-bracelet": "Midnight evokes the depth of its black zircons, while the horseshoe celebrates luck and the bond between horse and rider.",
    "horseshoe-ring": "Named for good fortune, this horseshoe is a reminder of luck, protection and the possibilities ahead.",
    "horseshoe-chain-earrings": "Midnight evokes the depth of its black zircons, while the horseshoe celebrates luck and the bond between horse and rider.",
    "horse-eye-necklace": "Regard means &ldquo;gaze&rdquo; in French, honouring the quiet trust and connection shared through a horse&rsquo;s eyes.", "horse-eye-bracelet": "Regard means &ldquo;gaze&rdquo; in French, honouring the quiet trust and connection shared through a horse&rsquo;s eyes.", "horse-eye-ring": "Regard means &ldquo;gaze&rdquo; in French, honouring the quiet trust and connection shared through a horse&rsquo;s eyes.", "horse-eye-stud": "Regard means &ldquo;gaze&rdquo; in French, honouring the quiet trust and connection shared through a horse&rsquo;s eyes.",
    "curved-marquise-necklace": "Aria is a musical term for a solo vocal piece, chosen to evoke the design&rsquo;s flowing movement and graceful lines.", "curved-marquise-bracelet": "Aria is a musical term for a solo vocal piece, chosen to evoke the design&rsquo;s flowing movement and graceful lines.", "curved-marquise-earrings": "Aria is a musical term for a solo vocal piece, chosen to evoke the design&rsquo;s flowing movement and graceful lines.",
    "eye-necklace": "Named for the protective-eye tradition, Nazar symbolises a wish to ward off ill intent and welcome good fortune.",
    "fatima-necklace": "Named after the hand symbol traditionally associated with protection, Hamsa represents a wish for wellbeing and good fortune.", "fatima-pearl-earrings": "Named after the hand symbol traditionally associated with protection, Hamsa represents a wish for wellbeing and good fortune.", "fatima-ring": "Named after the hand symbol traditionally associated with protection, Hamsa represents a wish for wellbeing and good fortune.", "fatima-anklet": "Named after the hand symbol traditionally associated with protection, Hamsa represents a wish for wellbeing and good fortune.",
    "v-pendant-necklace": "Vertex names the point where lines meet, reflecting the necklace&rsquo;s precise V shape and clean geometry.",
    "triangle-necklace": "Inspired by the idea of three, Tria celebrates the balance and simplicity of the triangle&rsquo;s three sides.",
    "v-bird-necklace": "Inspired by the French expression for taking flight, Envole celebrates freedom and the courage to spread your wings.",
    "moon-star-handchain": "Celeste evokes the heavens, celebrating the moon and star as symbols of light and hope.",
    "moon-star-pendant-earring": "Celeste evokes the heavens, bringing the moon and stars together in a delicate expression of celestial light.",
    "crescent-moon-earrings": "Lune means &ldquo;moon&rdquo; in French, pairing the crescent&rsquo;s gentle light with the soft lustre of pearls.",
    "star-moon-necklace": "Celestial means relating to the sky or heavens, celebrating the moon and stars as reminders of light in darker moments.",
    "qamar-ring": "Qamar means &ldquo;moon&rdquo; in Arabic, celebrating its beauty, femininity and gentle light.",
    "crescent-moon-ring": "Lune means &ldquo;moon&rdquo; in French, celebrating the quiet beauty of the crescent.",
    "sun-necklace": "Sol means &ldquo;sun,&rdquo; celebrating warmth, radiance and the light you bring into the world.", "sun-ring": "Sol means &ldquo;sun,&rdquo; celebrating warmth, radiance and the light you bring into the world.", "sun-stud-earrings": "Sol means &ldquo;sun,&rdquo; celebrating warmth, radiance and the light you bring into the world.",
    "seahorse-pearl-bracelet": "Named for its delicate sea creature motif, Seahorse celebrates the beauty and quiet wonder of the ocean.",
    "wave-bracelet": "Mar&eacute;e means &ldquo;tide&rdquo; in French, reflecting the sea&rsquo;s flowing movement and natural rhythm.",
    "arrow-necklace": "Arrow is a reminder that when life pulls you backwards, it can be preparing to launch you into something greater.", "arrow-bracelet": "Arrow is a reminder that when life pulls you backwards, it can be preparing to launch you into something greater.", "arrow-earrings": "Arrow is a reminder that when life pulls you backwards, it can be preparing to launch you into something greater.",
    "arrow-open-ring": "Two paths, one journey: Diverge is the courage to choose your own direction.", "arrow-ring": "Sahm means arrow in Arabic: strength, focus and the courage to follow your own path.",
}
FORMER_NAME = {
    "horseshoe-necklace": "Horse Shoe Necklace", "horseshoe-necklace-black-stone": "Midnight Horse Shoe Necklace",
    "horseshoe-bracelet": "Midnight Horse Shoe Bracelet", "horseshoe-ring": "Horse Shoe Ring",
    "horseshoe-chain-earrings": "Horse Shoe Earring", "horse-eye-necklace": "Horse Eye Necklace",
    "horse-eye-bracelet": "Horse Eye Bracelet", "horse-eye-ring": "Horse Eye Ring", "horse-eye-stud": "Horse Eye Studs",
    "curved-marquise-necklace": "Curved Marquise Necklace", "curved-marquise-bracelet": "Curved Marquise Bracelet",
    "curved-marquise-earrings": "Curved Marquise Earrings", "eye-necklace": "Eye Necklace",
    "fatima-necklace": "Fatima Necklace", "fatima-pearl-earrings": "Fatima & Pearl Drop Asymmetric Earrings",
    "fatima-ring": "Fatima Ring", "fatima-anklet": "Fatima Anklet", "v-pendant-necklace": "V Pendant",
    "triangle-necklace": "Triangle Necklace", "v-bird-necklace": "V Bird Necklace",
    "moon-star-handchain": "Moon/Star Handchain", "moon-star-pendant-earring": "Moon/Star Pendant Earrings",
    "crescent-moon-earrings": "Crescent Moon Earrings", "star-moon-necklace": "Moon/Star Necklace",
    "qamar-ring": "Qamar Ring", "crescent-moon-ring": "Crescent Moon Ring", "sun-necklace": "Sun Necklace",
    "sun-ring": "Sun Ring", "sun-stud-earrings": "Sun Stud Earrings", "seahorse-pearl-bracelet": "Seahorse Bracelet",
    "wave-bracelet": "Wave Bracelet", "arrow-necklace": "Arrow Necklace", "arrow-bracelet": "Arrow Bracelet",
    "arrow-earrings": "Arrow Earrings", "arrow-open-ring": "Diverge Arrow Ring", "arrow-ring": "Sahm Ring",
}
assert set(MEANING) == set(FORMER_NAME) == {p["slug"] for p in P}
for p in P:
    p["meaning"] = MEANING[p["slug"]]
    p["body"].insert(1, p["meaning"])

# ---- details from the owner (24 October 2026): SKU from the finance workbook, stones, other
#      materials, and sizes. ring = the size the ring is made in; wrist = adjustable chain (cm).
D = {
    "horseshoe-necklace": dict(sku="NK-01", stone="White zircon", dims=[("Length", "40 cm chain + 6 cm drop chain")]),
    "horseshoe-necklace-black-stone": dict(sku="NK-05", stone="Black zircon, white zircon", dims=[("Length", "39.5&ndash;41.5 cm chain (adjustable) + 5 cm drop chain")]),
    "horseshoe-bracelet": dict(sku="BR-02", stone="Black zircon, white zircon", wrist=(15, 17)),
    "horseshoe-ring": dict(sku="RG-04", stone="White zircon", ring=54),
    "horseshoe-chain-earrings": dict(sku="EA-02", stone="Black zircon, white zircon",
                                     dims=[("Piercings", "Two in the same ear, joined by the chain")]),
    "horse-eye-ring": dict(sku="RG-07", stone="Red zircon (marquise cut), white zircon", ring=54),
    "horse-eye-stud": dict(sku="EA-06", stone="Red zircon (marquise cut), white zircon"),
    "horse-eye-bracelet": dict(sku="BR-08", stone="Red zircon (marquise cut), white zircon", wrist=(16, 17.5)),
    "horse-eye-necklace": dict(sku="NK-10", stone="Red zircon (marquise cut), white zircon", dims=[("Length", "37&ndash;40 cm chain (adjustable)")]),
    "curved-marquise-necklace": dict(sku="NK-12", stone="White zircon", dims=[("Length", "50&ndash;52 cm chain (adjustable)")]),
    "curved-marquise-bracelet": dict(sku="BR-07", stone="White zircon", wrist=(15, 17)),
    "curved-marquise-earrings": dict(sku="EA-08", stone="White zircon", dims=[("Drop chain", "2 cm")]),
    "eye-necklace": dict(sku="NK-02", stone="Turquoise stone (centre), white zircon", other="White freshwater pearls", dims=[("Length", "40&ndash;52.5 cm chain (adjustable)")]),
    "fatima-pearl-earrings": dict(sku="EA-01", other="White freshwater pearl", dims=[("Drop chain", "3 cm")]),
    "fatima-necklace": dict(sku="NK-06", other="Blue freshwater pearls, white freshwater pearl", dims=[("Length", "38&ndash;40 cm chain (adjustable) + 5.5 cm drop chain (blue pearls to white freshwater pearl)")]),
    "fatima-ring": dict(sku="RG-03", stone="White zircon", ring=54),
    "fatima-anklet": dict(sku="AK-01", other="Blue freshwater pearls", dims=[("Chain", "21&ndash;22 cm (adjustable)")]),
    "v-pendant-necklace": dict(sku="NK-08", stone="White zircon", dims=[("Length", "50&ndash;52 cm chain (adjustable)")]),
    "triangle-necklace": dict(sku="NK-09", stone="White zircon", dims=[("Length", "50&ndash;52 cm chain (adjustable)")]),
    "v-bird-necklace": dict(sku="NK-07", stone="White zircon", dims=[("Length", "39&ndash;41.5 cm chain (adjustable)")]),
    "moon-star-handchain": dict(sku="BR-04", stone="White zircon", wrist=(16, 18), dims=[("Moon to star", "2.5 cm"), ("Finger chain", "7 cm")]),
    "moon-star-pendant-earring": dict(sku="EA-03", stone="White zircon, black zircon", dims=[("Star chain", "2.5 cm"), ("Moon chain", "3.5 cm")]),
    "crescent-moon-earrings": dict(sku="EA-05", stone="White zircon", other="White freshwater pearls"),
    "star-moon-necklace": dict(sku="NK-03", stone="White zircon", dims=[("Length", "43 cm chain + 3 cm drop chain")]),
    "qamar-ring": dict(sku="RG-02", stone="White zircon", ring=55),
    "crescent-moon-ring": dict(sku="RG-01", stone="White zircon", ring=54),
    "sun-necklace": dict(sku="NK-11", stone="White zircon", other="White freshwater pearl", dims=[("Length", "35&ndash;38 cm chain (adjustable)")]),
    "sun-ring": dict(sku="RG-08", stone="White zircon", ring=54),
    "sun-stud-earrings": dict(sku="EA-07", stone="White zircon"),
    "seahorse-pearl-bracelet": dict(sku="BR-01", stone="White zircon", other="White freshwater pearls", wrist=(15, 16)),
    "wave-bracelet": dict(sku="BR-06", other="White freshwater pearl", wrist=(15, 16.5)),
    "arrow-necklace": dict(sku="NK-04", stone="White zircon", dims=[("Length", "41 cm chain + 5.5 cm drop chain")]),
    "arrow-bracelet": dict(sku="BR-05", stone="Red zircon (centre), white zircon", wrist=(16, 17)),
    "arrow-earrings": dict(sku="EA-04", stone="Red zircon (centre), white zircon", dims=[("Drop chain", "4 cm")]),
    "arrow-open-ring": dict(sku="RG-05", stone="Black zircon, white zircon", ring=55),
    "arrow-ring": dict(sku="RG-06", stone="Red zircon (centre), white zircon", ring=55),
}
assert set(D) == {p["slug"] for p in P}

# Ring sizes from the size guide: EU size (the inside circumference in mm) and its US equivalent.
RING_SIZES = [(44, "3"), (45, "3.5"), (47, "4"), (48, "4.5"), (49, "5"), (50, "5.5"), (51, "6"), (52, "6.5"),
              (54, "7"), (55, "7.5"), (56, "8"), (58, "8.5"), (59, "9"), (61, "9.5"), (62, "10"),
              (63, "10.5"), (65, "11"), (66, "11.5"), (67, "12"), (69, "12.5"), (70, "13")]
CUSTOM_WRISTS = [n / 2 for n in range(22, 45)]  # other chain lengths, 11 to 22 cm in half-centimetre steps
cm = lambda v: f"{v:g}"

def size_options(d):
    """[(value, label)] for the size picker, or [] when the piece has no size."""
    if "ring" in d:
        return [(f"EU {eu}", f"EU {eu} &middot; US {us}") for eu, us in RING_SIZES]
    if "wrist" in d:
        lo, hi = d["wrist"]
        std = f"{cm(lo)}&ndash;{cm(hi)} cm"
        smaller = [(f"{cm(n)} cm", f"{cm(n)} cm") for n in CUSTOM_WRISTS if n < lo]
        larger = [(f"{cm(n)} cm", f"{cm(n)} cm") for n in CUSTOM_WRISTS if n > hi]
        return smaller + [(html.unescape(std), f"{std} (adjustable, standard)")] + larger
    return []

for p in P:
    d = D[p["slug"]]
    p.update(sku=d["sku"], stone=d.get("stone"), other=d.get("other"), sizes=size_options(d),
             size_kind="ring" if "ring" in d else "bracelet" if "wrist" in d else "necklace" if p["cat"] == "Necklaces" else None)
    dims = list(d.get("dims", []))
    if "wrist" in d:
        dims.insert(0, ("Wrist chain" if p["slug"] == "moon-star-handchain" else "Length",
                        f"{cm(d['wrist'][0])}&ndash;{cm(d['wrist'][1])} cm (adjustable)"))
    if "ring" in d:  # the ring in the photos; every size in the picker can be ordered
        us = dict(RING_SIZES).get(d["ring"])
        dims.insert(0, ("Size in the photos", f"EU {d['ring']}" + (f" &middot; US {us}" if us else "")))
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

# The horseshoe pieces (Equestrian Collection) are the bestsellers: a badge on their cards and pages,
# and their own home section.
BESTSELLER = "equestrian"
BESTSELLERS = ["horseshoe-necklace-black-stone", "horseshoe-bracelet", "horseshoe-ring", "horseshoe-chain-earrings"]
BADGE = '<span class="card-badge">Bestseller</span>'

def card(p):
    mail, _ = links(p)
    badge = f"\n        {BADGE}" if p["slug"] in BESTSELLERS else ""
    return f"""      <article class="product-card" data-category="{p['cat'].lower()}" data-collection="{p['coll']}">{badge}
        <a href="{p['page']}" class="product-media" data-photos="{','.join(p['imgs'])}"><img src="{p['img']}" alt="{p['alt']}" loading="lazy" /></a>
        <div class="product-body">
          <span class="product-cat">{COLL[p['coll']][0]} Collection</span>
          <h3><a href="{p['page']}">{p['name']}</a></h3>
          <span class="card-price" data-price-for="{p['slug']}">{p['price_text']}</span>{card_sold_as(p)}
          <p>{p['short']}</p>
          <a class="product-link" href="{p['page']}">View Details</a>
          <a class="btn btn-contact" href="{mail}">
            Enquire by Email
          </a>
        </div>
      </article>"""

METALS = [("yellow", "18k yellow gold"), ("rose", "18k rose gold"), ("white", "18k white gold")]

# Necklace length guide, laid out like the ring and bracelet guides.
NECKLACE_GUIDE = """<dialog class="size-guide" id="size-guide-necklace" aria-labelledby="necklace-guide-title">
  <button type="button" class="size-guide-close" aria-label="Close">&times;</button>
  <h2 id="necklace-guide-title">Necklace Length Guide</h2>
  <p>Each necklace lists its chain length in the details. This chart shows the usual names for each length.</p>
  <table class="size-table">
    <thead><tr><th>Style</th><th>Inches</th><th>Centimetres</th></tr></thead>
    <tbody>
        <tr><td>Collar</td><td>12&ndash;13&Prime;</td><td>30&ndash;33 cm</td></tr>
        <tr><td>Choker</td><td>14&ndash;16&Prime;</td><td>35&ndash;40 cm</td></tr>
        <tr><td>Princess</td><td>17&ndash;19&Prime;</td><td>43&ndash;48 cm</td></tr>
        <tr><td>Matinee</td><td>20&ndash;24&Prime;</td><td>50&ndash;60 cm</td></tr>
        <tr><td>Opera</td><td>28&ndash;34&Prime;</td><td>70&ndash;86 cm</td></tr>
        <tr><td>Rope</td><td>over 45&Prime;</td><td>over 115 cm</td></tr>
    </tbody>
  </table>
  <h3 class="size-guide-sub">Choosing your length</h3>
  <ul class="size-guide-tips">
    <li><strong>Your neck.</strong> Wrap a soft tape measure around the base of your neck and add about 5 cm. That is the shortest chain that will sit comfortably; anything shorter sits close like a choker. On a fuller neck, the same chain sits higher.</li>
    <li><strong>Crew necks and high necklines.</strong> Choose a chain that sits clearly above the neckline (35&ndash;40 cm) or one that falls well below it over the fabric (50 cm or more).</li>
    <li><strong>V-necks and open shirts.</strong> A pendant or Y-shaped necklace at 45&ndash;50 cm follows the line of the V.</li>
    <li><strong>Scoop, square and strapless necklines.</strong> A collar or choker (35&ndash;40 cm) or a princess length (43&ndash;45 cm) frames the collarbone.</li>
    <li><strong>Layering.</strong> Leave about 5 cm between chains, for example 40, 45 and 50 cm, so each one sits on its own.</li>
  </ul>
</dialog>

"""

# A different stone or pearl, chosen on the product page: always made to order, and confirmed with the customer
# (stone, availability and price) before anything is made (owner, 10 and 11 November 2026). The stones are the
# zircon colours we use and the gemstones in the Materials guide; the pearls are the freshwater pearl colours there.
# Keep the values in step with ALT_STONES in supabase/schema.sql (place_order).
ZIRCONS = ["white zircon", "black zircon", "red zircon", "blue zircon"]
GEMSTONES = ["emerald", "ruby", "sapphire", "amethyst", "aquamarine", "topaz", "garnet", "peridot", "turquoise"]
PEARLS = ["white freshwater pearls", "cream freshwater pearls", "pink freshwater pearls", "blue freshwater pearls"]


def alt_choices(p):
    """What this piece could be made with instead: (kind, [(group label, options)])."""
    text = html.unescape(p["stones"]).lower()
    out = []
    if "zircon" in text:
        have = [z for z in ZIRCONS if z.split()[0] in text]
        out.append(("stone", [("Zircon", [z for z in ZIRCONS if have != [z]]), ("Other gemstones", GEMSTONES)]))
    if "pearl" in text:
        have = [x for x in PEARLS if x.split()[0] + " freshwater" in text]
        out.append(("pearl", [("Freshwater pearls", [x for x in PEARLS if have != [x]])]))
    return out


MTO_DIALOG = """          <dialog class="size-guide mto-dialog" id="alt-stone-dialog" aria-labelledby="alt-stone-title" aria-describedby="alt-stone-text">
            <button type="button" class="size-guide-close" aria-label="Cancel">&times;</button>
            <h2 id="alt-stone-title">Made to order: please confirm</h2>
            <div id="alt-stone-text">
              <p>With <strong class="alt-stone-choice">a different stone</strong>, this piece is made to order for you. Please allow 3 to 4 weeks.</p>
              <p class="size-guide-note">We will contact you to confirm the stone, its availability and the price before anything is made.
                Made-to-order pieces are paid in full by Whish payment link before production and are final sale.</p>
            </div>
            <div class="mto-actions">
              <button type="button" class="btn btn-primary mto-ok">Confirm</button>
              <button type="button" class="btn btn-outline mto-cancel">Cancel</button>
            </div>
          </dialog>
"""


def alt_stone_html(p):
    groups = []
    for kind, sets in alt_choices(p):
        opts = "\n".join(
            f'                <optgroup label="{label}">\n' + "\n".join(
                f'                  <option value="{v}">{v[0].upper() + v[1:]}</option>' for v in values) + "\n                </optgroup>"
            for label, values in sets if values)
        groups.append(f"""          <details class="option-group alt-stone">
            <summary>Select a different {kind}</summary>
            <label class="alt-stone-label" for="alt-{kind}">Different {kind} (made to order, confirmed with you)</label>
            <select id="alt-{kind}" class="alt-stone-select" name="alt_{kind}">
                <option value="">As shown</option>
{opts}
            </select>
          </details>
""")
    return "".join(groups) + (MTO_DIALOG if groups else "")


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
        length = dict(p["dims"]).get("Length", "")
        necklace_guide = f"""          <div class="option-group">
            <div class="option-head"><span class="option-label">Length</span>
              <button type="button" class="link-btn size-guide-open" data-guide="necklace">Necklace length guide</button></div>
            <p class="option-value">{length}</p>
          </div>
"""
    return f"""        <div class="product-options" data-size-kind="{p['size_kind'] or ''}">
          <fieldset class="option-group">
            <legend>Metal</legend>
            <div class="metal-choices">
{metals}
            </div>
          </fieldset>
{size}{necklace_guide}{alt_stone_html(p)}          <p class="made-to-order-note" data-metal-note="yellow">If this piece is out of stock in yellow gold, it is made to order: allow 3 to 4 weeks. In-stock pieces are paid in cash on delivery.</p>
          <p class="made-to-order-note" data-metal-note="other" hidden>18k rose and white gold are made to order: allow 3 to 4 weeks.</p>
          <p class="made-to-order-terms">Made-to-order pieces, including any piece with a different stone or pearl, are paid in full by
            Whish payment link before production and are final sale. A different stone or pearl is confirmed with you first.</p>
        </div>
"""

# Earrings are sold as a pair, except the Horse Shoe Earring, which is a single earring (owner, 4 November 2026).
SINGLE_EARRINGS = {"horseshoe-chain-earrings"}

def card_sold_as(p):
    """Beside the price on shop and home cards: whether earrings are one earring or a pair."""
    if p["cat"] != "Earrings":
        return ""
    return f'<span class="card-sold-as">{"Single earring" if p["slug"] in SINGLE_EARRINGS else "Pair"}</span>'


# Earrings that are worn across two piercings in the same ear (owner, 11 November 2026): said clearly on the page.
TWO_PIERCINGS = {"horseshoe-chain-earrings"}


def piercing_note(p):
    if p["slug"] not in TWO_PIERCINGS:
        return ""
    return ('        <p class="piercing-note"><strong>Needs two piercings in the same ear.</strong> '
            'The stud goes in one hole and the horseshoe in the other, joined by the chain.</p>\n')


def sold_as(p):
    if p["cat"] != "Earrings":
        return ""
    return "Sold as a single earring" if p["slug"] in SINGLE_EARRINGS else "Sold as a pair"

def specs_html(p):
    rows = [("SKU", p["sku"]), ("Collection", COLL[p["coll"]][0]), ("Category", p["cat"]),
            ("Metal", "18k yellow, rose or white gold")]
    if sold_as(p):
        rows.insert(3, ("Sold as", "A single earring" if p["slug"] in SINGLE_EARRINGS else "A pair"))
    if p["stone"]:
        rows.append(("Stone", p["stone"]))
    if p["other"]:
        rows.append(("Other", p["other"]))
    rows += p["dims"]
    rows.append(("Care", "Store separately; avoid perfume, lotion and harsh chemicals; clean with a soft, dry cloth"))
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
  <p class="size-guide-note">Between two sizes? Choose the larger one. If your size is out of stock, it may take 3 to 4 weeks to make.</p>
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
        <tr><td>11 cm</td><td>12 cm</td><td>13 cm</td></tr>
        <tr><td>12 cm</td><td>13 cm</td><td>14 cm</td></tr>
        <tr><td>13 cm</td><td>14 cm</td><td>15 cm</td></tr>
        <tr><td>14 cm</td><td>15 cm</td><td>16 cm</td></tr>
        <tr><td>15 cm</td><td>16 cm</td><td>17 cm</td></tr>
        <tr><td>16 cm</td><td>17 cm</td><td>18 cm</td></tr>
        <tr><td>17 cm</td><td>18 cm</td><td>19 cm</td></tr>
        <tr><td>18 cm</td><td>19 cm</td><td>20 cm</td></tr>
        <tr><td>19 cm</td><td>20 cm</td><td>21 cm</td></tr>
        <tr><td>20 cm</td><td>21 cm</td><td>22 cm</td></tr>
    </tbody>
  </table>
  <p class="size-guide-note">Our standard chain is adjustable, so it fits a range of wrists. For a length outside that range, choose it from the list. If it is out of stock, it may take 3 to 4 weeks to make.</p>
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
    # The short description stays at the top with the price and options; the meaning of the name and the collection
    # story follow the buy button, in a section the customer can open.
    paras = f"        <p>{p['body'][0]}</p>" if p["body"] else ""
    story = "".join(f"\n          <p>{b}</p>" for b in p["body"][1:])
    story_html = (f"""        <details class="product-story" open>
          <summary>The story behind the {p['plain'] if 'plain' in p else p['name']}</summary>{story}
        </details>
""" if story else "")
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
        <span class="eyebrow">{COLL[p['coll']][0]} Collection &middot; {p['cat']}</span>{f" {BADGE}" if p["slug"] in BESTSELLERS else ""}
        <h1>{p['name']}</h1>
        <p class="product-price" data-price-for="{p['slug']}">{p['price_text']}</p>
{('        <p class="sold-as">' + sold_as(p) + '</p>' + chr(10)) if sold_as(p) else ''}{piercing_note(p)}{paras}
{options_html(p)}        <div class="product-buy" data-slug="{p['slug']}" hidden></div>
        <div class="product-actions">
          <a class="btn btn-primary" href="{mail}">Enquire by Email</a>
        </div>
{story_html}        <p class="product-note">Questions about sizing or a custom version? <a href="contact.html">Contact us</a>.
          See our <a href="shipping.html">delivery</a>, <a href="returns.html">returns &amp; exchanges</a> and
          <a href="warranty.html">warranty</a> policies.</p>
{specs_html(p)}      </div>
    </div>
  </div>
</section>

{reviews_html(p)}<section class="alt-bg">
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
def replace_grid(fname, items, opening='<div class="product-grid">'):
    s = open(fname, encoding="utf-8").read()
    start = s.index(opening) + len(opening)
    end = s.index("\n    </div>", start) + 1
    s = s[:start] + grid(items) + s[end:]
    open(fname, "w", encoding="utf-8").write(s)
replace_grid("shop.html", P)
by = {p["slug"]: p for p in P}
# Home: the bestsellers section (added once, above "New & Loved"), then the featured pieces.
BEST_GRID = '<div class="product-grid" data-grid="bestsellers">'
home = open("index.html", encoding="utf-8").read()
if BEST_GRID not in home:
    featured = '<section>\n  <div class="container">\n    <div class="section-head reveal">\n      <span class="eyebrow">Featured Pieces</span>'
    home = home.replace(featured, f"""<section class="bestsellers">
  <div class="container">
    <div class="section-head reveal">
      <span class="eyebrow">Bestsellers</span>
      <h2>Our Horseshoe Pieces</h2>
      <p>{COLL[BESTSELLER][1]}</p>
    </div>

    {BEST_GRID}
    </div>
    <div class="section-cta reveal"><a class="btn btn-outline" href="shop.html#{BESTSELLER}">Shop the Equestrian Collection</a></div>
  </div>
</section>

""" + featured, 1)
    open("index.html", "w", encoding="utf-8").write(home)
replace_grid("index.html", [by[slug] for slug in BESTSELLERS], BEST_GRID)
# (The home page's second product row became Shop by Category, so only the bestsellers grid is filled here.)

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
prod = "".join(f"  <url><loc>{url_for(p['page'])}</loc></url>\n" for p in P)
s = s.replace(f"  <url><loc>{url_for('shop.html')}</loc></url>\n", f"  <url><loc>{url_for('shop.html')}</loc></url>\n" + prod)
open("sitemap.xml", "w").write(s)

# ---- database seed
sql = lambda v: "'" + v.replace("'", "''") + "'"
seed = "insert into public.products (slug, name, category, image, price) values\n" + ",\n".join(
    f"  ({sql(p['slug'])}, {sql(p['plain'])}, {sql(p['cat'])}, {sql(p['img'])}, {p['price']})" for p in P) + "\non conflict (slug) do update set name = excluded.name, category = excluded.category, image = excluded.image;"
s = open("supabase/schema.sql", encoding="utf-8").read()
s, n = re.subn(r"insert into public\.products \(slug, name, category, image(, price)?\) values\n.*?on conflict \(slug\) do [^;]*;", lambda m: seed, s, flags=re.S)
assert n == 1
sizes = "update public.products p set sizes = v.sizes\n  from (values\n" + ",\n".join(
    f"    ({sql(p['slug'])}, array[{', '.join(sql(v) for v, _ in p['sizes'])}])"
    for p in P if p["sizes"]) + "\n  ) as v(slug, sizes)\n where p.slug = v.slug;"
s, n = re.subn(r"(-- product sizes start\n).*?(-- product sizes end)", lambda m: m.group(1) + sizes + "\n" + m.group(2), s, flags=re.S)
assert n == 1
open("supabase/schema.sql", "w", encoding="utf-8").write(s)
# ---- product details for the order documents (receipt item descriptions), keyed by SKU
cat = {p["sku"]: {"name": p["plain"], "category": p["cat"], "collection": COLL[p["coll"]][0],
                  "stone": html.unescape(p["stone"] or ""), "other": html.unescape(p["other"] or ""),
                  "details": ([["Sold as", "A single earring" if p["slug"] in SINGLE_EARRINGS else "A pair"]] if p["cat"] == "Earrings" else [])
                             + [[k, html.unescape(v)] for k, v in p["dims"]]} for p in P}
open("supabase/functions/_shared/catalogue.mjs", "w", encoding="utf-8").write(
    "// Generated by tools/build_products.py: what each piece is made of, for receipts and customs.\n"
    "export const CATALOGUE = " + json.dumps(cat, indent=2, ensure_ascii=False) + ";\n")
print("ok")
