#!/usr/bin/env python3
"""Run from the repository root:  python3 tools/build_guides.py

Builds the guide pages (linked from product pages and the custom-order form) and the return and repair request page:
  size-guide.html   rings, bracelets, necklaces and anklets, all on one page
  materials.html    gold colours, gemstones (meaning and durability), cuts, settings and birthstones
  return-repair.html  the return and repair request form
  gift-voucher.html   the gift voucher order form
The page shell (header, footer) is copied from about.html, like the policy pages."""
import glob
import re


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
     "10", "The hardest natural stone: ideal for rings and pieces worn every day.",
     "Any setting. Prong lets in the most light; halo and pav&eacute; add extra sparkle."),
    ("Zircon", "White (colourless) and black in our pieces; also blue", "clarity, wisdom and confidence",
     "6.5&ndash;7.5", "Bright sparkle at a gentle price; good for everyday wear with a little care.",
     "Prong or bezel. A bezel protects the edges in rings worn every day."),
    ("Emerald", "Green", "renewal, love and hope", "7.5&ndash;8",
     "Hard but can have natural inclusions; avoid knocks and ultrasonic cleaners.",
     "Bezel, or prongs that cover the cut corners. A halo also protects it."),
    ("Ruby", "Red", "passion, protection and vitality", "9", "Very durable: excellent for rings and everyday pieces.",
     "Any setting: prong, bezel, halo, channel or cluster."),
    ("Sapphire", "Blue, also pink, yellow and white", "wisdom, loyalty and calm", "9",
     "Very durable: excellent for rings and everyday pieces.",
     "Any setting: prong, bezel, halo, channel or cluster."),
    ("Pearl", "White, cream, pink and blue freshwater pearls", "purity, grace and new beginnings", "2.5&ndash;4.5",
     "Soft and delicate: put perfume on before wearing pearls, and store them apart from other jewelry.",
     "A gold peg and cup (the pearl is glued on a post); bezel for rings."),
    ("Turquoise", "Sky blue to green-blue", "protection, healing and good fortune", "5&ndash;6",
     "Porous: keep away from water, lotions and perfume.",
     "Bezel, as a smooth cabochon."),
    ("Amethyst", "Purple", "calm, balance and clarity", "7", "Durable for everyday wear; keep out of strong sunlight.",
     "Prong or bezel; bezel for rings worn every day."),
    ("Aquamarine", "Pale to sea blue", "serenity, courage and the sea", "7.5&ndash;8", "Durable and easy to wear.",
     "Prong or halo, to show off its pale blue colour."),
    ("Topaz", "Blue, golden, pink and colourless", "strength, friendship and warmth", "8",
     "Hard, but a sharp knock can chip it; fine for everyday wear.",
     "Prong or bezel; bezel for rings worn every day."),
    ("Garnet", "Deep red, also green and orange", "devotion, friendship and energy", "6.5&ndash;7.5",
     "Good for everyday wear.",
     "Prong, bezel or cluster."),
    ("Peridot", "Olive to lime green", "light, positivity and protection", "6.5&ndash;7",
     "Best in pendants and earrings, or rings worn with care.",
     "Bezel for rings; prong for earrings and pendants."),
    ("Opal", "Milky white or dark, with flashes of colour", "creativity, hope and inspiration", "5.5&ndash;6.5",
     "Delicate: best in pendants and earrings; avoid heat and sudden temperature changes.",
     "Bezel, which protects its delicate edges."),
    ("Black Onyx", "Deep black", "strength, focus and protection", "6.5&ndash;7", "Good for everyday wear.",
     "Bezel or flush, often as a smooth cabochon or flat inlay."),
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

# Gemstone cards: a photo of each stone (images/gems, made in Canva), its glow colour and birth month.
STONE_LOOK = {  # name: (photo, glow colour behind it)
    "Diamond": ("diamond", "#dfe6ee"), "Zircon": ("zircon", "#e3e8ef"), "Emerald": ("emerald", "#cfeee0"),
    "Ruby": ("ruby", "#f8d6db"), "Sapphire": ("sapphire", "#d8e1f8"), "Pearl": ("pearl", "#f3ece4"),
    "Turquoise": ("turquoise", "#cdeeea"), "Amethyst": ("amethyst", "#eadcf6"), "Aquamarine": ("aquamarine", "#dcf1f8"),
    "Topaz": ("topaz", "#d6edf9"), "Garnet": ("garnet", "#f0d3d6"), "Peridot": ("peridot", "#eaf4cc"),
    "Opal": ("opal", "#eef0f8"), "Black Onyx": ("onyx", "#e3e1dc"),
}
MONTH_OF = {stone.split(" or ")[0]: month for month, stone in BIRTHSTONES}
MONTH_OF.update({"Opal": "October", "Topaz": "November", "Turquoise": "December", "Zircon": "December"})


def hardness(h):
    vals = [float(x) for x in h.replace("&ndash;", "-").split("-")]
    return min(vals), max(vals)


def meter(h):
    lo, hi = hardness(h)
    cells = "".join(f'<i class="{"on" if i <= lo else "half" if i <= hi + 0.01 else ""}"></i>' for i in range(1, 11))
    return f'<span class="meter" aria-hidden="true">{cells}</span>'


def wear(h):
    lo, hi = hardness(h)
    if hi >= 7.5 or lo >= 7:
        return '<span class="wear-chip ok">Everyday rings</span>'
    if lo >= 6.5:
        return '<span class="wear-chip mid">Rings with care</span>'
    return '<span class="wear-chip soft">Best in earrings &amp; pendants</span>'


def stone_card(name, colours, meaning, hard, note, best):
    photo, glow = STONE_LOOK[name]
    month = f'<span class="gem-month">{MONTH_OF[name]}</span>' if name in MONTH_OF else ""
    return f"""        <article class="gem-card" title="{note}">
          <div class="gem-stage" style="--glow:{glow}"><img src="images/gems/{photo}.jpg" alt="{name}" width="112" height="112" loading="lazy">{month}</div>
          <h3>{name}</h3>
          <p class="gem-meaning">{meaning[0].upper() + meaning[1:]}</p>
          <p class="gem-colours">{colours}</p>
          <p class="gem-hard"><span>Hardness</span>{meter(hard)}<b>{hard}</b></p>
          {wear(hard)}
          <p class="gem-best"><strong>Best settings</strong>{best}</p>
        </article>"""


stone_cards = "\n".join(stone_card(*s) for s in STONES)

# Cut photos (images/cuts, made in Canva); file names follow the cut names.
cut_photo = lambda name: name.lower().replace(" ", "-")
cut_cards = "\n".join(f"""      <div class="cut-card reveal">
        <img class="cut-photo" src="images/cuts/{cut_photo(name)}.jpg" alt="{name} cut" width="96" height="96" loading="lazy">
        <h3>{name}</h3>
        <p>{desc}</p>
      </div>""" for name, desc in CUTS)

# Setting photos (images/settings, made in Canva).
setting_photo = lambda name: {"Prong (claw)": "prong", "Pavé": "pave"}.get(name, name.lower())
setting_cards = "\n".join(f"""      <div class="cut-card setting-card reveal">
        <img class="cut-photo" src="images/settings/{setting_photo(name)}.jpg" alt="{name} setting" width="96" height="96" loading="lazy">
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
      <div class="gem-grid">
{stone_cards}
      </div>
      <p class="size-guide-note">You can also bring a stone you already own; we will check it can be set safely.</p>
    </div>

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

# ------------------------------------------------------------------ return and repair request page
# The form sends to the service-request function (js/service-request.js). Piece names are suggested from the shop.
PIECE_NAMES = sorted({re.search(r"<title>(.*?) — Siaram Jewelry", open(f, encoding="utf-8").read()).group(1)
                      for f in glob.glob("product-*.html")})
piece_options = "\n".join(f'            <option value="{n}"></option>' for n in PIECE_NAMES)

service_body = f"""
<section class="custom-request service-request">
  <div class="container">
    <div class="section-head reveal">
      <span class="eyebrow">Returns &amp; Repairs</span>
      <h2>Tell Us What Happened</h2>
      <p>We reply within 3 to 5 business days with the next steps. Please do not send the piece until you receive our
        instructions. See our <a href="returns.html">Returns</a> and <a href="warranty.html">Warranty</a> policies.</p>
    </div>
    <form class="custom-form service-form reveal" novalidate enctype="multipart/form-data">
      <fieldset>
        <legend>What would you like?</legend>
        <div class="choice-pills">
          <label class="choice-pill"><input type="radio" name="kind" value="Return" required /><span>Return</span></label>
          <label class="choice-pill"><input type="radio" name="kind" value="Exchange" /><span>Exchange</span></label>
          <label class="choice-pill"><input type="radio" name="kind" value="Repair" /><span>Repair</span></label>
        </div>
      </fieldset>
      <div class="form-grid">
        <label class="field"><span>Order or invoice number</span>
          <input name="order_ref" required maxlength="40" placeholder="e.g. S017" autocomplete="off" /></label>
        <label class="field"><span>Name of the piece</span>
          <input name="piece" required maxlength="120" list="piece-names" placeholder="e.g. Horse Shoe Ring" />
          <datalist id="piece-names">
{piece_options}
          </datalist></label>
      </div>
      <label class="field"><span>What's wrong?</span>
        <textarea name="problem" rows="4" required maxlength="3000"
          placeholder="e.g. a stone is loose, the clasp does not close, wrong size, it is not what I expected…"></textarea></label>
      <label class="field"><span>How did the issue happen?</span>
        <textarea name="cause" rows="4" required maxlength="3000"
          placeholder="When you first noticed it and what happened, e.g. it arrived like this, it caught on a sweater, after swimming…"></textarea></label>
      <label class="field"><span>Photos of the piece (1 to 4, 8 MB each; for a problem, a close-up and the whole piece)</span>
        <input type="file" name="files" accept="image/*,application/pdf" multiple required /></label>
      <div class="form-grid">
        <label class="field"><span>Full name</span>
          <input name="name" required maxlength="200" autocomplete="name" /></label>
        <label class="field"><span>WhatsApp number (with country code)</span>
          <input name="phone" type="tel" required maxlength="40" autocomplete="tel" placeholder="+961 70 123 456" /></label>
        <label class="field"><span>Email</span>
          <input name="email" type="email" required maxlength="200" autocomplete="email" /></label>
      </div>
      <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
      <p class="field-note">We use these details only to handle your request; see our <a href="privacy.html">Privacy Policy</a>.</p>
      <p class="form-msg" role="alert"></p>
      <button class="btn btn-primary" type="submit">Send My Request</button>
    </form>
  </div>
</section>
<script type="module" src="js/service-request.js"></script>
"""

# ------------------------------------------------------------------ gift voucher order page
# The form sends to the voucher-request function (js/voucher-request.js); payment is arranged by WhatsApp for now.
AMOUNTS = [100, 150, 200, 250, 300, 500]
amount_pills = "\n".join(
    f'          <label class="choice-pill"><input type="radio" name="amount_choice" value="{a}"{" required" if i == 0 else ""} /><span>${a}</span></label>'
    for i, a in enumerate(AMOUNTS))

voucher_body = f"""
<section class="custom-request voucher-request">
  <div class="container">
    <div class="section-head reveal">
      <span class="eyebrow">A Gift They Choose</span>
      <h2>Order a Gift Voucher</h2>
      <p>A digital Siaram gift voucher from $100, issued to the person you name and valid for six months. We contact you
        on WhatsApp to arrange payment, then send the voucher. See our <a href="gift-vouchers.html">Gift Voucher policy</a>.</p>
    </div>
    <form class="custom-form voucher-form reveal" novalidate>
      <fieldset>
        <legend>Amount</legend>
        <div class="choice-pills">
{amount_pills}
          <label class="choice-pill"><input type="radio" name="amount_choice" value="other" /><span>Other amount</span></label>
        </div>
        <label class="field voucher-other" hidden><span>Other amount in US$ (from 100)</span>
          <input name="amount_other" type="number" min="100" step="1" inputmode="numeric" placeholder="e.g. 400" /></label>
      </fieldset>
      <fieldset>
        <legend>Who is it for?</legend>
        <div class="form-grid">
          <label class="field"><span>Recipient's full name</span>
            <input name="recipient_name" required maxlength="200" autocomplete="off" /></label>
          <span></span>
          <label class="field"><span>Recipient's email</span>
            <input name="recipient_email" type="email" maxlength="200" autocomplete="off" /></label>
          <label class="field"><span>Recipient's WhatsApp (with country code)</span>
            <input name="recipient_phone" type="tel" maxlength="40" autocomplete="off" placeholder="+961 70 123 456" /></label>
        </div>
        <p class="field-note">Give at least one: only the named recipient can use the voucher, and we check it at checkout.</p>
      </fieldset>
      <fieldset>
        <legend>Send the voucher to</legend>
        <div class="choice-pills">
          <label class="choice-pill"><input type="radio" name="send_to" value="recipient" required /><span>The recipient directly</span></label>
          <label class="choice-pill"><input type="radio" name="send_to" value="purchaser" /><span>Me, so I can give it myself</span></label>
        </div>
        <label class="field voucher-date"><span>Send it on (optional, e.g. their birthday)</span>
          <input name="send_on" type="date" /></label>
      </fieldset>
      <fieldset>
        <legend>Your details</legend>
        <div class="form-grid">
          <label class="field"><span>Full name</span>
            <input name="name" required maxlength="200" autocomplete="name" /></label>
          <label class="field"><span>WhatsApp number (with country code)</span>
            <input name="phone" type="tel" required maxlength="40" autocomplete="tel" placeholder="+961 70 123 456" /></label>
          <label class="field"><span>Email</span>
            <input name="email" type="email" required maxlength="200" autocomplete="email" /></label>
        </div>
      </fieldset>
      <label class="check"><input type="checkbox" name="final_sale" required />
        <span>I understand that gift vouchers are final sale: once issued, they cannot be cancelled, refunded or exchanged for cash.</span></label>
      <input type="text" name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
      <p class="field-note">We use these details only for this voucher; see our <a href="privacy.html">Privacy Policy</a>.</p>
      <p class="form-msg" role="alert"></p>
      <button class="btn btn-primary" type="submit">Order My Gift Voucher</button>
    </form>
  </div>
</section>
<script type="module" src="js/voucher-request.js"></script>
"""

PAGES = [
    ("size-guide.html", "Size Guide", "How to find your ring size, bracelet, necklace and anklet length for Siaram Jewelry pieces.",
     hero("Find Your Fit", "Size Guide", "Rings, bracelets, necklaces and anklets: how to measure, and the sizes we make."), size_body),
    ("materials.html", "Gold & Gemstones", "Siaram Jewelry's gold colours, the most popular gemstones with their meaning and "
     "durability, stone cuts, settings and birthstones.",
     hero("Choose Your Materials", "Gold &amp; Gemstones",
          "Gold colours, gemstones and their meaning, cuts, settings and birthstones, to help you choose."), materials_body),
    ("return-repair.html", "Return or Repair Request", "Request a return, exchange or repair for a Siaram Jewelry piece: "
     "send your order number, what is wrong, how it happened and photos.",
     hero("Customer Care", "Return or Repair Request", "Tell us about the piece and what happened, and we will guide you from there."),
     service_body),
    ("gift-voucher.html", "Buy a Gift Voucher", "Order a Siaram Jewelry digital gift voucher from US$100, issued to the person "
     "you name and valid for six months.",
     hero("Gift Vouchers", "Buy a Gift Voucher", "Let them choose their own piece: a digital voucher from $100, valid for six months."),
     voucher_body),
]

sitemap = open("sitemap.xml", encoding="utf-8").read()
for fname, title, desc, top, body in PAGES:
    open(fname, "w", encoding="utf-8").write(head(fname, title, desc) + top + body + FOOTER)
    loc = f"<url><loc>{BASE}{fname.removesuffix('.html')}</loc></url>"
    if loc not in sitemap:
        sitemap = sitemap.replace("</urlset>", f"  {loc}\n</urlset>")
    print("wrote", fname)
open("sitemap.xml", "w", encoding="utf-8").write(sitemap)

# ------------------------------------------------------------------ pop-ups on the Custom page
# The guide links in the custom request form open these on the same page instead of going to the guide pages.
def chunk(body, anchor):
    """One topic from a guide page (its heading, text and any cards that follow), without the scroll animation."""
    start = body.index(f'<div class="guide-section reveal" id="{anchor}">')
    rest = body[start + 1:]
    ends = [i for i in (rest.find('<div class="guide-section'), rest.find('<div class="guide-help'),
                        rest.find('<svg class="gem-defs"')) if i != -1]
    part = body[start:start + 1 + min(ends)]
    return re.sub(r' id="[a-z]+"', "", part).replace(" reveal", "").rstrip() + "\n"


POPUP_HELP = HELP.replace(" reveal", "").replace("<h2>Not sure?</h2>", "<h3>Not sure?</h3>")
POPUPS = [
    ("gold", "Gold colours", chunk(materials_body, "gold")),
    ("gemstones", "Gemstones", chunk(materials_body, "gemstones")),
    ("cuts", "Cuts", chunk(materials_body, "cuts")),
    ("settings", "Settings", chunk(materials_body, "settings")),
    ("size", "Size guide", "".join(chunk(size_body, a) for a in ("rings", "bracelets", "necklaces", "anklets"))),
]
popups = "\n".join(f"""<dialog class="size-guide guide-popup" id="size-guide-{key}" aria-label="{label}">
  <button type="button" class="size-guide-close" aria-label="Close">&times;</button>
{content}{POPUP_HELP}</dialog>""" for key, label, content in POPUPS)

START, END = "<!-- guide pop-ups: made by tools/build_guides.py -->", "<!-- end of guide pop-ups -->"
custom = open("custom.html", encoding="utf-8").read()
block = f"{START}\n{popups}\n{END}"
if START in custom:
    custom = custom[:custom.index(START)] + block + custom[custom.index(END) + len(END):]
else:
    custom = custom.replace("<footer", block + "\n\n<footer", 1)
open("custom.html", "w", encoding="utf-8").write(custom)
print("wrote the guide pop-ups in custom.html")
