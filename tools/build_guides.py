#!/usr/bin/env python3
"""Run from the repository root:  python3 tools/build_guides.py

Builds the two guide pages, linked from product pages and the custom-order form:
  size-guide.html   rings, bracelets, necklaces and anklets, all on one page
  materials.html    gold colours, gemstones (meaning and durability), cuts, settings and birthstones
The page shell (header, footer) is copied from about.html, like the policy pages."""
import re

from gem_art import CUT_ART, DEFS, SETTING_ART, art

BASE = "https://siaramjewelry.com/"
TEMPLATE = open("about.html", encoding="utf-8").read()
HEADER = TEMPLATE[:TEMPLATE.index("<section class=\"page-hero\">")]
FOOTER = TEMPLATE[TEMPLATE.index('<footer class="site-footer">'):]

RING_SIZES = [(44, "3"), (45, "3.5"), (47, "4"), (48, "4.5"), (49, "5"), (50, "5.5"), (51, "6"), (52, "6.5"),
              (54, "7"), (55, "7.5"), (56, "8"), (58, "8.5"), (59, "9"), (61, "9.5"), (62, "10"),
              (63, "10.5"), (65, "11"), (66, "11.5"), (67, "12"), (69, "12.5"), (70, "13")]


def head(page, title, description):
    """about.html's <head> and header, with this page's title, description and addresses."""
    url = BASE + page.removesuffix(".html")
    s = re.sub(r"<title>.*?</title>", f"<title>{title} — Siaram Jewelry</title>", HEADER)
    s = re.sub(r'(<meta name="description" content=")[^"]*', rf"\g<1>{description}", s)
    s = re.sub(r'(<meta property="og:description" content=")[^"]*', rf"\g<1>{description}", s)
    s = re.sub(r'(<meta property="og:title" content=")[^"]*', rf"\g<1>{title} — Siaram Jewelry", s)
    s = re.sub(r'(<link rel="canonical" href=")[^"]*', rf"\g<1>{url}", s)
    s = re.sub(r'(<meta property="og:url" content=")[^"]*', rf"\g<1>{url}", s)
    return s


def hero(eyebrow, title, intro):
    return f"""<section class="page-hero">
  <div class="container">
    <span class="eyebrow">{eyebrow}</span>
    <h1>{title}</h1>
    <p class="guide-intro">{intro}</p>
  </div>
</section>
"""


def jump(links):
    items = "".join(f'<a href="#{a}">{t}</a>' for a, t in links)
    return f'<nav class="guide-jump" aria-label="On this page">{items}</nav>'


HELP = """    <div class="guide-help reveal">
      <h2>Not sure?</h2>
      <p>Tell us what you have in mind and we will guide you, from sizing to choosing a stone.</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="mailto:customerservice@siaramjewelry.com?subject=Help%20choosing">Email Us</a>
        <a class="btn btn-outline" href="https://wa.me/96176052068" target="_blank" rel="noopener">WhatsApp</a>
      </div>
    </div>
"""

# ------------------------------------------------------------------ size guide
ring_rows = "\n".join(f"          <tr><td>{eu / 3.14159:.1f} mm</td><td>{eu} mm</td><td>{us}</td><td>{eu}</td></tr>"
                      for eu, us in RING_SIZES)
bracelet_rows = "\n".join(f"          <tr><td>{w} cm</td><td>{w + 1} cm</td><td>{w + 2} cm</td></tr>" for w in range(11, 21))
anklet_rows = "\n".join(f"          <tr><td>{a} cm</td><td>{a + 1}&ndash;{a + 2} cm</td></tr>" for a in range(18, 26))

size_body = f"""
<section class="guide">
  <div class="container guide-container">
    {jump([("rings", "Rings"), ("bracelets", "Bracelets"), ("necklaces", "Necklaces"), ("anklets", "Anklets")])}

    <div class="guide-section reveal" id="rings">
      <h2>Rings</h2>
      <p>Take a ring that fits the right finger well and measure its inside diameter: straight across the centre, at the
        widest part. Or wrap a strip of paper around the base of your finger, mark where it overlaps, and measure that
        length: this is the circumference.</p>
      <div class="table-wrap"><table class="size-table">
        <thead><tr><th>Inside diameter</th><th>Circumference</th><th>US</th><th>EU</th></tr></thead>
        <tbody>
{ring_rows}
        </tbody>
      </table></div>
      <ul class="size-guide-tips">
        <li><strong>Between two sizes?</strong> Choose the larger one, especially for wide bands.</li>
        <li><strong>Measure at the end of the day</strong>, when fingers are a little larger, and not when your hands are cold.</li>
        <li><strong>Knuckles.</strong> The ring has to pass over the knuckle, so check it slides over comfortably.</li>
      </ul>
    </div>

    <div class="guide-section reveal" id="bracelets">
      <h2>Bracelets</h2>
      <p>Wrap a soft tape measure, or a strip of paper you then lay against a ruler, around your wrist just above the
        wrist bone. Add 1 cm for a close fit or 2 cm for a looser drape.</p>
      <div class="table-wrap"><table class="size-table">
        <thead><tr><th>Your wrist</th><th>Close fit</th><th>Loose fit</th></tr></thead>
        <tbody>
{bracelet_rows}
        </tbody>
      </table></div>
      <p class="size-guide-note">Our chain bracelets have two closing rings about 2 cm apart, so each one fits a range of
        wrists. For a length outside that range, choose it on the piece's page; it is then made for you.</p>
    </div>

    <div class="guide-section reveal" id="necklaces">
      <h2>Necklaces</h2>
      <p>Each necklace lists its chain length in its details. This chart shows the usual names for each length.</p>
      <div class="table-wrap"><table class="size-table">
        <thead><tr><th>Style</th><th>Inches</th><th>Centimetres</th></tr></thead>
        <tbody>
          <tr><td>Collar</td><td>12&ndash;13&Prime;</td><td>30&ndash;33 cm</td></tr>
          <tr><td>Choker</td><td>14&ndash;16&Prime;</td><td>35&ndash;40 cm</td></tr>
          <tr><td>Princess</td><td>17&ndash;19&Prime;</td><td>43&ndash;48 cm</td></tr>
          <tr><td>Matinee</td><td>20&ndash;24&Prime;</td><td>50&ndash;60 cm</td></tr>
          <tr><td>Opera</td><td>28&ndash;34&Prime;</td><td>70&ndash;86 cm</td></tr>
          <tr><td>Rope</td><td>over 45&Prime;</td><td>over 115 cm</td></tr>
        </tbody>
      </table></div>
      <ul class="size-guide-tips">
        <li><strong>Your neck.</strong> Wrap a soft tape measure around the base of your neck and add about 5 cm. That is the shortest chain that will sit comfortably.</li>
        <li><strong>Crew necks and high necklines.</strong> Choose a chain that sits above the neckline (35&ndash;40 cm) or well below it (50 cm or more).</li>
        <li><strong>V-necks and open shirts.</strong> A pendant or Y-shaped necklace at 45&ndash;50 cm follows the line of the V.</li>
        <li><strong>Scoop, square and strapless necklines.</strong> A choker (35&ndash;40 cm) or princess length (43&ndash;45 cm) frames the collarbone.</li>
        <li><strong>Layering.</strong> Leave about 5 cm between chains, for example 40, 45 and 50 cm.</li>
      </ul>
    </div>

    <div class="guide-section reveal" id="anklets">
      <h2>Anklets</h2>
      <p>Wrap a soft tape measure around your ankle, just above the ankle bone, where an anklet sits. Add 1 to 2 cm so it
        moves freely without slipping over your foot.</p>
      <div class="table-wrap"><table class="size-table">
        <thead><tr><th>Your ankle</th><th>Anklet length</th></tr></thead>
        <tbody>
{anklet_rows}
        </tbody>
      </table></div>
      <p class="size-guide-note">Our Fatima Anklet is 21&ndash;22 cm, which suits most ankles of 19&ndash;20 cm.</p>
    </div>

{HELP}  </div>
</section>

"""

# ------------------------------------------------------------------ gold and gemstones
GOLD = [
    ("yellow", "18k Yellow Gold", "The classic warm gold of most Siaram pieces. 18k means 75% pure gold, mixed with silver "
     "and copper for strength.", "Warm, rich and timeless; flatters warmer and olive skin tones and layers with everything.",
     "Polish gently with a soft cloth. It keeps its colour for life."),
    ("rose", "18k Rose Gold", "75% gold with a little more copper, which gives its soft pink blush.",
     "Romantic and modern; beautiful on most skin tones and with pearls and pink stones.",
     "Copper makes it slightly harder than yellow gold, and the colour deepens gently over the years."),
    ("white", "18k White Gold", "75% gold mixed with white metals, then finished with a thin layer of rhodium for a bright, "
     "silvery shine.", "Cool and crisp; makes diamonds and white stones look even brighter.",
     "The rhodium finish can soften with wear; it can be renewed (re-plated) by a jeweller every year or two."),
]

# name, colours, traditionally associated with, Mohs hardness, everyday-wear note
STONES = [
    ("Diamond", "Colourless, also yellow, pink and other rare colours", "love, strength and eternity",
     "10", "The hardest natural stone: ideal for rings and pieces worn every day."),
    ("Zircon", "White (colourless) and black in our pieces; also blue", "clarity, wisdom and confidence",
     "6.5&ndash;7.5", "Bright sparkle at a gentle price; good for everyday wear with a little care."),
    ("Emerald", "Green", "renewal, love and hope", "7.5&ndash;8",
     "Hard but can have natural inclusions; avoid knocks and ultrasonic cleaners."),
    ("Ruby", "Red", "passion, protection and vitality", "9", "Very durable: excellent for rings and everyday pieces."),
    ("Sapphire", "Blue, also pink, yellow and white", "wisdom, loyalty and calm", "9",
     "Very durable: excellent for rings and everyday pieces."),
    ("Pearl", "White, cream, pink and blue freshwater pearls", "purity, grace and new beginnings", "2.5&ndash;4.5",
     "Soft and delicate: put perfume on before wearing pearls, and store them apart from other jewelry."),
    ("Turquoise", "Sky blue to green-blue", "protection, healing and good fortune", "5&ndash;6",
     "Porous: keep away from water, lotions and perfume."),
    ("Amethyst", "Purple", "calm, balance and clarity", "7", "Durable for everyday wear; keep out of strong sunlight."),
    ("Aquamarine", "Pale to sea blue", "serenity, courage and the sea", "7.5&ndash;8", "Durable and easy to wear."),
    ("Topaz", "Blue, golden, pink and colourless", "strength, friendship and warmth", "8",
     "Hard, but a sharp knock can chip it; fine for everyday wear."),
    ("Garnet", "Deep red, also green and orange", "devotion, friendship and energy", "6.5&ndash;7.5",
     "Good for everyday wear."),
    ("Peridot", "Olive to lime green", "light, positivity and protection", "6.5&ndash;7",
     "Best in pendants and earrings, or rings worn with care."),
    ("Opal", "Milky white or dark, with flashes of colour", "creativity, hope and inspiration", "5.5&ndash;6.5",
     "Delicate: best in pendants and earrings; avoid heat and sudden temperature changes."),
    ("Black Onyx", "Deep black", "strength, focus and protection", "6.5&ndash;7", "Good for everyday wear."),
]

# name, short description (drawings are in gem_art.py)
CUTS = [
    ('Round brilliant', 'The most popular cut, made for maximum sparkle.'),
    ('Oval', 'A soft, elongated round that flatters the finger.'),
    ('Princess', 'A square cut with brilliant sparkle and clean corners.'),
    ('Cushion', 'A square with soft rounded corners; romantic and vintage.'),
    ('Emerald cut', 'A long rectangle with cut corners and calm, mirror-like steps.'),
    ('Pear', 'A teardrop, round at one end and pointed at the other.'),
    ('Marquise', 'A long boat shape with two points; it makes fingers look longer.'),
    ('Heart', 'A romantic heart outline.'),
    ('Baguette', 'A slim rectangle, often set beside a centre stone or in rows.'),
    ('Cabochon', 'Polished smooth and domed, without facets; used for turquoise, opal and onyx.'),
]

# stone settings: name, short description (drawings are in gem_art.py)
SETTINGS = [
    ('Prong (claw)', 'Small metal claws hold the stone and let in the most light; classic for solitaires.'),
    ('Bezel', 'A thin rim of gold wraps around the stone; smooth, modern and very secure for everyday wear.'),
    ('Pavé', 'Many tiny stones set close together, so the surface looks paved with sparkle.'),
    ('Channel', 'Stones sit in a row between two walls of gold, with no metal between them; sleek and snag-free.'),
    ('Halo', 'A circle of small stones around a centre stone; it makes the centre look larger and brighter.'),
    ('Flush', 'The stone sits level with the gold, almost hidden in the metal; minimal and very protected.'),
    ('Bar', 'Stones in a row with a thin bar of gold between each one; open and airy.'),
    ('Cluster', 'Several stones grouped together to form one larger shape, often a flower.'),
]

BIRTHSTONES = [("January", "Garnet"), ("February", "Amethyst"), ("March", "Aquamarine"), ("April", "Diamond"),
               ("May", "Emerald"), ("June", "Pearl or moonstone"), ("July", "Ruby"), ("August", "Peridot"),
               ("September", "Sapphire"), ("October", "Opal or tourmaline"), ("November", "Topaz or citrine"),
               ("December", "Turquoise, tanzanite or zircon")]

gold_cards = "\n".join(f"""      <article class="guide-card reveal">
        <span class="metal-swatch metal-{key} guide-swatch" aria-hidden="true"></span>
        <h3>{name}</h3>
        <p>{what}</p>
        <p><strong>Look:</strong> {look}</p>
        <p><strong>Care:</strong> {care}</p>
      </article>""" for key, name, what, look, care in GOLD)

stone_rows = "\n".join(f"""          <tr><th scope="row">{name}</th><td>{colours}</td><td>{meaning[0].upper() + meaning[1:]}</td>
            <td>{hard}</td><td>{note}</td></tr>""" for name, colours, meaning, hard, note in STONES)

cut_cards = "\n".join(f"""      <div class="cut-card reveal">
        {art(CUT_ART[name], name + " cut")}
        <h3>{name}</h3>
        <p>{desc}</p>
      </div>""" for name, desc in CUTS)

setting_cards = "\n".join(f"""      <div class="cut-card setting-card reveal">
        {art(SETTING_ART[name], name + " setting")}
        <h3>{name}</h3>
        <p>{desc}</p>
      </div>""" for name, desc in SETTINGS)

birth_rows = "\n".join(f"          <tr><td>{m}</td><td>{s}</td></tr>" for m, s in BIRTHSTONES)

materials_body = f"""
<section class="guide">
  <div class="container guide-container">
    {jump([("gold", "Gold colours"), ("gemstones", "Gemstones"), ("cuts", "Cuts"), ("settings", "Settings"), ("birthstones", "Birthstones")])}

    <div class="guide-section reveal" id="gold">
      <h2>Gold Colours</h2>
      <p>Every Siaram piece is made in solid 18k gold. Each design can be made in yellow, rose or white gold; yellow is
        usually in stock, and rose and white are made to order.</p>
    </div>
    <div class="guide-cards">
{gold_cards}
    </div>

    <div class="guide-section reveal" id="gemstones">
      <h2>Gemstones</h2>
      <p>The most popular stones for fine jewelry, with the meaning traditionally given to each and how well it wears.
        Hardness is on the Mohs scale, from 1 (softest) to 10 (diamond): stones of 7 or more are the most comfortable
        for rings worn every day, while softer stones are lovely in earrings and pendants.</p>
      <div class="table-wrap"><table class="size-table stone-table">
        <thead><tr><th>Stone</th><th>Colours</th><th>Traditionally symbolises</th><th>Hardness</th><th>Everyday wear</th></tr></thead>
        <tbody>
{stone_rows}
        </tbody>
      </table></div>
      <p class="size-guide-note">You can also bring a stone you already own; we will check it can be set safely.</p>
    </div>

    {DEFS}
    <div class="guide-section reveal" id="cuts">
      <h2>Cuts</h2>
      <p>The cut is the shape a stone is given. It changes how the stone catches the light and how the piece looks on you.</p>
    </div>
    <div class="cut-grid">
{cut_cards}
    </div>

    <div class="guide-section reveal" id="settings">
      <h2>Settings</h2>
      <p>The setting is how the gold holds the stone. It changes how much light reaches the stone, how protected it is
        and the overall style of the piece.</p>
    </div>
    <div class="cut-grid setting-grid">
{setting_cards}
    </div>

    <div class="guide-section reveal" id="birthstones">
      <h2>Birthstones</h2>
      <p>A stone for each month, lovely for a personal piece or a gift.</p>
      <div class="table-wrap"><table class="size-table birth-table">
        <thead><tr><th>Month</th><th>Birthstone</th></tr></thead>
        <tbody>
{birth_rows}
        </tbody>
      </table></div>
    </div>

{HELP}  </div>
</section>

"""

PAGES = [
    ("size-guide.html", "Size Guide", "How to find your ring size, bracelet, necklace and anklet length for Siaram Jewelry pieces.",
     hero("Find Your Fit", "Size Guide", "Rings, bracelets, necklaces and anklets: how to measure, and the sizes we make."), size_body),
    ("materials.html", "Gold & Gemstones", "Siaram Jewelry's gold colours, the most popular gemstones with their meaning and "
     "durability, stone cuts, settings and birthstones.",
     hero("Choose Your Materials", "Gold &amp; Gemstones",
          "Gold colours, gemstones and their meaning, cuts, settings and birthstones, to help you choose."), materials_body),
]

sitemap = open("sitemap.xml", encoding="utf-8").read()
for fname, title, desc, top, body in PAGES:
    open(fname, "w", encoding="utf-8").write(head(fname, title, desc) + top + body + FOOTER)
    loc = f"<url><loc>{BASE}{fname.removesuffix('.html')}</loc></url>"
    if loc not in sitemap:
        sitemap = sitemap.replace("</urlset>", f"  {loc}\n</urlset>")
    print("wrote", fname)
open("sitemap.xml", "w", encoding="utf-8").write(sitemap)
