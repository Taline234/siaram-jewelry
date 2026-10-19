"""Build the eight policy pages from policies.md (converted from the owner's Word document).

Run from the repository root:  python3 tools/build_policies.py tools/policies-source.md
Placeholders in the document are filled with the facts we know; the legal operator
name, address and registration are left out until the owner supplies them.
"""
import html
import pathlib
import re
import sys

SRC = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parent.parent  # the repository
TEMPLATE = (ROOT / "terms.html").read_text(encoding="utf-8")
HEADER = TEMPLATE[TEMPLATE.index("<header"):TEMPLATE.index("</header>") + len("</header>")]
FOOTER_START = TEMPLATE.index('<footer class="site-footer">')
FOOTER = TEMPLATE[FOOTER_START:]

PAGES = [
    # (doc heading, file, page title, eyebrow, description)
    ("Terms and conditions", "terms.html", "Terms &amp; Conditions",
     "Terms for buying Siaram Jewelry pieces in Lebanon: product information, prices, orders, payment by Whish or cash on delivery, accounts and your rights."),
    ("Shipping and collection", "shipping.html", "Shipping &amp; Collection",
     "Siaram Jewelry delivers within Lebanon (not currently to South Lebanon) and offers free collection by appointment. Delivery times, fees and claims."),
    ("Returns and exchanges", "returns.html", "Returns &amp; Exchanges",
     "Our 14-day returns and exchanges offer, legal withdrawal rights, and what to do if a piece arrives damaged, defective or incorrect."),
    ("Warranty and repairs", "warranty.html", "Warranty &amp; Repairs",
     "Siaram Jewelry's one-year manufacturing warranty, what it covers, how claims are assessed, and paid repair and resizing services."),
    ("Custom orders", "custom-orders.html", "Custom Orders",
     "How bespoke Siaram Jewelry pieces are designed, approved, paid for (50% deposit) and made, and how customer stones are handled."),
    ("Digital gift vouchers", "gift-vouchers.html", "Gift Vouchers",
     "Siaram Jewelry digital gift vouchers: from US$100, valid for six months, issued to a named recipient, and how to redeem them."),
    ("Privacy policy", "privacy.html", "Privacy Policy",
     "What personal information Siaram Jewelry collects, why, who it is shared with, how long it is kept and how to make a privacy request."),
    ("Cookie policy", "cookies.html", "Cookie Policy",
     "The browser storage the Siaram Jewelry website uses. We use only necessary storage and no analytics or advertising cookies."),
]
FILE_FOR = {p[0]: p[1] for p in PAGES}

# ------------------------------------------------------------------ parse
docs = {}
current = None
for line in SRC.splitlines():
    line = line.rstrip()
    if line.startswith("# "):
        name = line[2:].replace(" continued", "")
        current = docs.setdefault(name, {"updated": "", "sections": []})
    elif line.startswith("## "):
        current["sections"].append([line[3:], []])
    elif line.startswith("*Last updated"):
        current["updated"] = line.strip("*")
    elif line:
        current["sections"][-1][1].append(line.replace("\\", ""))

# Section headings in the document drop punctuation; restore it for display.
HEADINGS = {
    "Our 14 day offer": "Our 14-day offer",
    "Delayed lost or damaged deliveries": "Delayed, lost or damaged deliveries",
    "Defective damaged or incorrect arrivals": "Defective, damaged or incorrect arrivals",
    "Exchanges gifts and store credit": "Exchanges, gifts and store credit",
    "Security children and policy changes": "Security, children and policy changes",
    "Marketing photographs and reviews": "Marketing, photographs and reviews",
    "One year manufacturing warranty": "One-year manufacturing warranty",
    "Returns and customer supplied materials": "Returns and customer-supplied materials",
}

# ------------------------------------------------------------------ fill placeholders
EMAIL = "customerservice@siaramjewelry.com"
REPLACE = [
    # Operator details are not known yet: keep the sentence about where we trade and how to reach us.
    ("Siaram Jewelry is operated by [LEGAL OPERATOR NAME], trading as Siaram Jewelry, at [BUSINESS ADDRESS], Lebanon. "
     "Registration details: [REGISTRATION NUMBER AND PLACE, AS APPLICABLE]. Contact us at customerservice@siaramjewelry.com or +961 76052068",
     "This website and our shop are operated by Siaram Jewelry, a jewellery business based in Lebanon. Contact us at customerservice@siaramjewelry.com "
     "or on WhatsApp at +961 76 052 068."),
    ("Available online payment methods are [CONFIRMED CARD PROVIDER AND/OR WHISH PAYMENT METHOD]. "
     "Follow our official checkout or payment link and do not send card numbers or security codes through messages.",
     "Online orders can be paid by Whish or in cash on delivery, as you choose at checkout. With Whish, you send the amount "
     "shown at checkout via Whish with your order reference. With cash on delivery, you pay the courier in cash when your "
     "order arrives. Follow the payment details in our official checkout or order confirmation and do not send card "
     "numbers or security codes through messages."),
    ("Ordinary orders delivered by courier must be paid in full before dispatch. The disclosed courier delivery fee is payable to the courier in cash.",
     "Orders paid by Whish must be paid in full before dispatch. With cash on delivery, you pay the full order amount to the "
     "courier when your order arrives. The disclosed courier delivery fee is payable to the courier in cash."),
    ("Payment providers process payments and any payment credentials you choose to save through their supported features. ",
     "Whish processes your payment under its own terms. "),
    (" [SAVED-PAYMENT FEATURE AND STORAGE ARRANGEMENT]",
     " Our website does not store card or Whish account details."),
    ("Accounts: while active, then reviewed after 24 months of inactivity; we notify you before deleting the account profile.",
     "Accounts: while active. After 12 months without activity we send a reminder; after 24 months we notify you that "
     "the account profile, saved addresses and wishlist will be deleted 30 days later unless you sign in."),
    ("Please use the listed measurements.", "Please use the listed measurements, or ask us for them."),
]


def fill(text):
    for old, new in REPLACE:
        text = text.replace(old, new)
    return text


PROVIDERS = """<p>Other main providers and processing locations are:</p>
      <ul>
        <li><strong>Netlify</strong> (United States) hosts the website and runs our order functions.
          <a href="https://www.netlify.com/privacy/" target="_blank" rel="noopener">Privacy policy</a></li>
        <li><strong>Supabase</strong> (database hosted in the European Union, Frankfurt) stores accounts, saved addresses,
          wishlists and orders. <a href="https://supabase.com/privacy" target="_blank" rel="noopener">Privacy policy</a></li>
        <li><strong>Resend</strong> (United States) sends order confirmations and account emails.
          <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener">Privacy policy</a></li>
        <li><strong>Microsoft Outlook</strong> hosts our customer service mailbox.
          <a href="https://privacy.microsoft.com/privacystatement" target="_blank" rel="noopener">Privacy statement</a></li>
        <li><strong>Whish</strong> (Lebanon) processes Whish payments.</li>
        <li><strong>Google Fonts</strong> and <strong>jsDelivr</strong> deliver the website's fonts and sign-in library;
          your browser's request shares your IP address with them, but they set no cookies.</li>
        <li><strong>Our courier</strong> (Lebanon) delivers orders and collects cash-on-delivery payments; it receives the
          recipient's name, phone number, delivery address and the amount to collect.</li>
      </ul>
      <p>Technical logs kept by our hosting and database providers are kept for short periods set by those providers
        (typically days to weeks) for security and troubleshooting."""

PROVIDERS_OLD = ("Other main providers and processing locations are: [WEBSITE HOST AND ACCOUNT SERVICE; PAYMENT PROVIDER; "
                 "MAILBOX HOST AND CLOUD STORAGE, WHERE USED; COURIER; RELEVANT PROCESSING COUNTRIES AND PROVIDER PRIVACY LINKS; "
                 "TECHNICAL LOG RETENTION PERIODS]. ")

COOKIE_TABLE = """<div class="table-wrap"><table class="legal-table">
        <thead><tr><th>Name</th><th>Type</th><th>Purpose</th><th>Category</th><th>How long</th></tr></thead>
        <tbody>
          <tr><td data-label="Name"><code>siaram-cart</code></td><td data-label="Type">Local storage, first party</td><td data-label="Purpose">Remembers the pieces in your shopping cart</td>
            <td data-label="Category">Necessary</td><td data-label="How long">Until you empty the cart or place your order</td></tr>
          <tr><td data-label="Name"><code>sb-&hellip;-auth-token</code></td><td data-label="Type">Local storage, first party (set by our Supabase sign-in)</td>
            <td data-label="Purpose">Keeps you signed in to your account</td><td data-label="Category">Necessary</td><td data-label="How long">Until you sign out</td></tr>
          <tr><td data-label="Name"><code>siaram-last-active</code></td><td data-label="Type">Local storage, first party</td>
            <td data-label="Purpose">Records when you last used your account, so inactive accounts can be reminded and later deleted as our Privacy Policy explains</td>
            <td data-label="Category">Necessary</td><td data-label="How long">Until you clear your browser storage</td></tr>
        </tbody></table></div>
      <p>We do not set any cookies. If you never add to the cart or sign in, nothing is stored.</p>"""

EMBEDDED = ("<p>No payment or embedded services on our website store anything on your device. Whish payments happen in the "
            "Whish app, outside our website. Our pages load fonts from Google Fonts and our sign-in library from jsDelivr; "
            "these set no cookies.</p>")

# Link mentions of other policies. Longest phrases first.
LINKS = [
    ("Privacy and Cookie policies", '<a href="privacy.html">Privacy</a> and <a href="cookies.html">Cookie</a> policies'),
    ("Shipping, Returns and exchanges, Warranty and repairs, Custom orders and Gift vouchers policies",
     '<a href="shipping.html">Shipping</a>, <a href="returns.html">Returns and exchanges</a>, '
     '<a href="warranty.html">Warranty and repairs</a>, <a href="custom-orders.html">Custom orders</a> and '
     '<a href="gift-vouchers.html">Gift vouchers</a> policies'),
    ("Returns and Warranty policies", '<a href="returns.html">Returns</a> and <a href="warranty.html">Warranty</a> policies'),
    ("Returns and exchanges policy", '<a href="returns.html">Returns and exchanges policy</a>'),
    ("returns and exchanges policy", '<a href="returns.html">returns and exchanges policy</a>'),
    ("Warranty and repairs policy", '<a href="warranty.html">Warranty and repairs policy</a>'),
    ("Custom orders policy", '<a href="custom-orders.html">Custom orders policy</a>'),
    ("Returns policy", '<a href="returns.html">Returns policy</a>'),
    ("Cookie policy", '<a href="cookies.html">Cookie policy</a>'),
    ("Privacy policy", '<a href="privacy.html">Privacy policy</a>'),
]


def paragraph(text, own_file):
    if text.startswith("[VERIFIED STORAGE REGISTER"):
        return COOKIE_TABLE
    if text.startswith("[PAYMENT OR EMBEDDED SERVICES"):
        return EMBEDDED
    text = fill(text)
    providers = PROVIDERS_OLD in text
    if providers:
        before, after = text.split(PROVIDERS_OLD)
    else:
        before, after = text, ""
    out = []
    for part in (before, after):
        part = html.escape(part, quote=False)
        part = part.replace(EMAIL, f'<a href="mailto:{EMAIL}">{EMAIL}</a>')
        part = part.replace("+961 76 052 068", '<a href="https://wa.me/96176052068" target="_blank" rel="noopener">+961 76 052 068</a>')
        # One pass so a replacement is never matched again by a shorter phrase.
        pattern = re.compile("|".join(re.escape(p) for p, _ in LINKS))
        part = pattern.sub(lambda m: dict(LINKS)[m.group(0)] if f'href="{own_file}"' not in dict(LINKS)[m.group(0)] else m.group(0), part)
        part = part.replace("US$", "US$")
        out.append(part)
    if providers:
        return f"<p>{out[0]}</p>\n      {PROVIDERS}</p>\n      <p>{out[1]}</p>"
    return f"<p>{out[0]}</p>"


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


FOOTER_POLICIES = """<h4>Policies</h4>
        <ul>
          <li><a href="terms.html">Terms &amp; Conditions</a></li>
          <li><a href="shipping.html">Shipping &amp; Collection</a></li>
          <li><a href="returns.html">Returns &amp; Exchanges</a></li>
          <li><a href="warranty.html">Warranty &amp; Repairs</a></li>
          <li><a href="custom-orders.html">Custom Orders</a></li>
          <li><a href="gift-vouchers.html">Gift Vouchers</a></li>
          <li><a href="privacy.html">Privacy Policy</a></li>
          <li><a href="cookies.html">Cookie Policy</a></li>
        </ul>"""
FOOTER_RE = re.compile(r"<h4>Policies</h4>\s*<ul>.*?</ul>", re.S)

for doc_name, fname, title, desc in PAGES:
    doc = docs[doc_name]
    toc = []
    body = []
    for n, (heading, paras) in enumerate(doc["sections"], 1):
        heading = HEADINGS.get(heading, heading)
        sid = slug(heading)
        toc.append(f'        <li><a href="#{sid}">{html.escape(heading)}</a></li>')
        inner = "\n      ".join(paragraph(p, fname) for p in paras)
        body.append(f'    <div class="legal-section reveal" id="{sid}">\n      <h2>{n}. {html.escape(heading)}</h2>\n      {inner}\n    </div>')
    related = " &middot; ".join(f'<a href="{f}">{t}</a>' for _, f, t, _ in PAGES if f != fname)
    url = f"https://siaramjewelry.com/{fname}"
    page = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{title} — Siaram Jewelry</title>
<meta name="description" content="{desc}" />
<link rel="canonical" href="{url}" />
<meta property="og:site_name" content="Siaram Jewelry" />
<meta property="og:type" content="website" />
<meta property="og:title" content="{title} — Siaram Jewelry" />
<meta property="og:description" content="{desc}" />
<meta property="og:url" content="{url}" />
<meta property="og:image" content="https://siaramjewelry.com/images/hero-arena.jpg" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" href="images/logo.jpeg" />
<link rel="stylesheet" href="css/style.css" />
</head>
<body>

{HEADER}

<section class="page-hero">
  <div class="container">
    <span class="eyebrow">Policies</span>
    <h1>{title}</h1>
  </div>
</section>

<section>
  <div class="container legal-page">


    <nav class="legal-toc reveal" aria-label="Table of contents">
      <h2>On This Page</h2>
      <ol>
{chr(10).join(toc)}
      </ol>
    </nav>

{chr(10).join(body)}

    <div class="legal-section reveal" id="contact">
      <h2>Questions?</h2>
      <p>Email <a href="mailto:{EMAIL}">{EMAIL}</a> or WhatsApp
        <a href="https://wa.me/96176052068" target="_blank" rel="noopener">+961 76 052 068</a>.</p>
      <div class="legal-cross-link"><p>Our other policies: {related}</p></div>
    </div>

  </div>
</section>

{FOOTER}"""
    page = FOOTER_RE.sub(FOOTER_POLICIES, page)
    assert "[" not in re.sub(r"<[^>]+>", "", page.split("<body>")[1]).replace("[0]", ""), f"placeholder left in {fname}"
    (ROOT / fname).write_text(page, encoding="utf-8")
    print("wrote", fname, len(doc["sections"]), "sections")

# ------------------------------------------------------------------ site-wide links and footer
OLD_LINKS = {
    'href="terms.html#returns"': 'href="returns.html"',
    'href="privacy.html#cookies"': 'href="cookies.html"',
    'href="privacy.html#retention"': 'href="privacy.html#how-long-we-keep-information"',
}
for path in sorted(ROOT.glob("*.html")):
    s = path.read_text(encoding="utf-8")
    new = FOOTER_RE.sub(FOOTER_POLICIES, s)
    for a, b in OLD_LINKS.items():
        new = new.replace(a, b)
    if new != s:
        path.write_text(new, encoding="utf-8")

sm = (ROOT / "sitemap.xml").read_text()
for _, fname, _, _ in PAGES:
    loc = f"<url><loc>https://siaramjewelry.com/{fname}</loc></url>"
    if loc not in sm:
        sm = sm.replace("</urlset>", f"  {loc}\n</urlset>")
(ROOT / "sitemap.xml").write_text(sm)
