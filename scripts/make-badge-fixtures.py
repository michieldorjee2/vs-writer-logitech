#!/usr/bin/env python3
"""Draw the made-up badges `npm run check:badge-ocr` reads (server/fixtures/badges/).

Every name, company and address is invented. They cover the kinds of badge a rep
meets: event badges with a ribbon and the event's name, business cards, a
company-first employee badge, white print on a dark badge, a two-line name, a
title that runs onto a second line, accents, a QR block and a badge number, a
"Hello my name is" sticker, and the same badge photographed badly (tilted,
soft, noisy, unevenly lit) and from too far away.

    python3 scripts/make-badge-fixtures.py      # macOS fonts; writes the JPEGs and truth.json

Deterministic: the same seed draws the same pictures, so the fixtures are only
redrawn when a badge is added or changed here.
"""
import json
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parent.parent / "server" / "fixtures" / "badges"
SUP = "/System/Library/Fonts/Supplemental/"
SYS = "/System/Library/Fonts/"
random.seed(20261104)


def font(name, size, index=0):
    path = SUP + name if Path(SUP + name).exists() else SYS + name
    return ImageFont.truetype(path, size, index=index)


ARIAL_B = lambda s: font("Arial Bold.ttf", s)
ARIAL = lambda s: font("Arial.ttf", s)
HELV_B = lambda s: font("Helvetica.ttc", s, 1)
HELV = lambda s: font("Helvetica.ttc", s, 0)
AVENIR_B = lambda s: font("Avenir Next.ttc", s, 2)
AVENIR = lambda s: font("Avenir Next.ttc", s, 7)
GEORGIA_B = lambda s: font("Georgia Bold.ttf", s)
GEORGIA = lambda s: font("Georgia.ttf", s)
VERDANA_B = lambda s: font("Verdana Bold.ttf", s)
VERDANA = lambda s: font("Verdana.ttf", s)
TREBUCHET_B = lambda s: font("Trebuchet MS Bold.ttf", s)
TREBUCHET = lambda s: font("Trebuchet MS.ttf", s)
DIN_B = lambda s: font("DIN Condensed Bold.ttf", s)
MARKER = lambda s: font("MarkerFelt.ttc", s, 0)


def card(w, h, bg="white"):
    img = Image.new("RGB", (w, h), bg)
    return img, ImageDraw.Draw(img)


def centred(d, w, y, text, f, fill="#111"):
    box = d.textbbox((0, 0), text, font=f)
    d.text(((w - (box[2] - box[0])) / 2, y), text, font=f, fill=fill)


def qr_block(d, x, y, size, cells=21):
    step = size // cells
    for i in range(cells):
        for j in range(cells):
            corner = (i < 7 and j < 7) or (i < 7 and j >= cells - 7) or (i >= cells - 7 and j < 7)
            on = (corner and (i % 6 == 0 or j % 6 == 0 or (2 <= i % 14 <= 4 and 2 <= j % 14 <= 4))) or (not corner and random.random() < 0.5)
            if on:
                d.rectangle([x + i * step, y + j * step, x + (i + 1) * step - 1, y + (j + 1) * step - 1], fill="#111")


def on_table(badge, frame=(1600, 1200), at=None, bg=(88, 96, 112), angle=0):
    """The badge held up in front of a wall: what the camera's frame crop sees."""
    scene = Image.new("RGB", frame, bg)
    b = badge.rotate(angle, expand=True, fillcolor=bg) if angle else badge
    x, y = at or ((frame[0] - b.width) // 2, (frame[1] - b.height) // 2)
    scene.paste(b, (x, y))
    return scene


def photographed(img, blur=1.0, noise=6, light=0.25):
    """Soft focus, sensor noise and light falling off to one side."""
    img = img.filter(ImageFilter.GaussianBlur(blur))
    px = img.load()
    w, h = img.size
    for y in range(0, h):
        for x in range(0, w):
            r, g, b = px[x, y]
            k = 1 - light * (x / w)
            n = random.randint(-noise, noise)
            px[x, y] = (max(0, min(255, int(r * k) + n)), max(0, min(255, int(g * k) + n)), max(0, min(255, int(b * k) + n)))
    return img


badges = []


def add(slug, img, truth):
    badges.append((slug, img, truth))


# 1. An event badge: the event's band, a two-line name, title, company, the role ribbon.
img, d = card(800, 1200)
d.rectangle([0, 0, 800, 190], fill="#0b5f4a")
centred(d, 800, 55, "OPTICON 2026", HELV_B(64), "white")
centred(d, 800, 330, "Thandiwe", ARIAL_B(104))
centred(d, 800, 450, "Okonkwo", ARIAL_B(104))
centred(d, 800, 610, "Head of Cold-Chain Pricing", ARIAL(46))
centred(d, 800, 690, "Quillmoor Freight", ARIAL_B(58))
d.rectangle([0, 1060, 800, 1200], fill="#f2b705")
centred(d, 800, 1095, "ATTENDEE", HELV_B(64))
add("01-event-two-line-name", on_table(img), {"name": "Thandiwe Okonkwo", "title": "Head of Cold-Chain Pricing", "company": "Quillmoor Freight"})

# 2. All capitals, one-line name, a title with a comma, a legal name.
img, d = card(800, 1100)
d.rectangle([0, 0, 800, 120], fill="#1f3b73")
centred(d, 800, 30, "COMMERCE NEXT SUMMIT", VERDANA_B(44), "white")
centred(d, 800, 330, "PRIYA RAMANATHAN", VERDANA_B(58))
centred(d, 800, 450, "VP, Digital Experience", VERDANA(44))
centred(d, 800, 540, "Northwind Traders Inc.", VERDANA_B(50))
add("02-caps-name-legal-company", on_table(img), {"name": "Priya Ramanathan", "title": "VP, Digital Experience", "company": "Northwind Traders Inc."})

# 3. A business card: name, title, company, email, website, phone.
img, d = card(1400, 800, "#fbfaf7")
d.text((90, 110), "Jonas Feldmann", font=GEORGIA_B(84), fill="#111")
d.text((90, 230), "Director of Ecommerce", font=GEORGIA(46), fill="#333")
d.text((90, 330), "Brightwater Outfitters", font=GEORGIA_B(54), fill="#0a4d8c")
d.text((90, 560), "jonas.feldmann@brightwater-outfitters.com", font=GEORGIA(38), fill="#333")
d.text((90, 620), "+49 30 5550 1234", font=GEORGIA(38), fill="#333")
d.text((90, 680), "www.brightwater-outfitters.com", font=GEORGIA(38), fill="#333")
add("03-business-card", on_table(img, frame=(1800, 1200)), {"name": "Jonas Feldmann", "title": "Director of Ecommerce", "company": "Brightwater Outfitters", "domain": "brightwater-outfitters.com"})

# 4. Company first, in big letters above the name: an employee badge.
img, d = card(800, 1200)
centred(d, 800, 120, "LUMENVALE", AVENIR_B(120), "#0037ff")
centred(d, 800, 520, "Marisol Etxeberria", AVENIR_B(72))
centred(d, 800, 630, "Solutions Architect", AVENIR(48))
centred(d, 800, 1020, "marisol@lumenvale.com", AVENIR(40), "#444")
add("04-company-first-employee", on_table(img), {"name": "Marisol Etxeberria", "title": "Solutions Architect", "company": "LUMENVALE", "domain": "lumenvale.com"})

# 5. White print on a dark badge.
img, d = card(800, 1150, "#14213d")
centred(d, 800, 80, "RETAIL TECH WEEK", TREBUCHET_B(52), "#fca311")
centred(d, 800, 360, "Kenji Watanabe", TREBUCHET_B(84), "white")
centred(d, 800, 480, "Chief Marketing Officer", TREBUCHET(48), "#e5e5e5")
centred(d, 800, 570, "Harbor & Pine", TREBUCHET_B(60), "white")
add("05-dark-badge", on_table(img), {"name": "Kenji Watanabe", "title": "Chief Marketing Officer", "company": "Harbor & Pine"})

# 6. No title, accented letters.
img, d = card(800, 1000)
d.rectangle([0, 0, 800, 140], fill="#c1121f")
centred(d, 800, 40, "NORDIC DIGITAL DAYS", HELV_B(50), "white")
centred(d, 800, 360, "Lars Østergaard", HELV_B(80))
centred(d, 800, 500, "Fjordline Shipping", HELV(60))
add("06-no-title-accents", on_table(img), {"name": "Lars Østergaard", "title": "", "company": "Fjordline Shipping"})

# 7. A title on two lines, and an ampersand in the company.
img, d = card(800, 1200)
d.rectangle([0, 0, 800, 150], fill="#3a0ca3")
centred(d, 800, 45, "B2B MARKETING EXCHANGE", ARIAL_B(46), "white")
centred(d, 800, 350, "Aurelia Montgomery", ARIAL_B(74))
centred(d, 800, 470, "Senior Director,", ARIAL(46))
centred(d, 800, 530, "Global E-commerce", ARIAL(46))
centred(d, 800, 630, "Calloway & Finch Co.", ARIAL_B(56))
add("07-two-line-title", on_table(img), {"name": "Aurelia Montgomery", "title": "Senior Director, Global E-commerce", "company": "Calloway & Finch Co."})

# 8. A speaker badge with a QR code and a badge number.
img, d = card(800, 1250)
d.rectangle([0, 0, 800, 160], fill="#111")
centred(d, 800, 45, "DXP CONFERENCE 2026", DIN_B(70), "white")
centred(d, 800, 270, "Rafael Quintero", DIN_B(96))
centred(d, 800, 400, "Principal Engineer", HELV(46))
centred(d, 800, 470, "Tidewell Analytics", HELV_B(54))
qr_block(d, 290, 640, 220)
centred(d, 800, 890, "#10482", HELV(40), "#444")
d.rectangle([0, 1110, 800, 1250], fill="#e63946")
centred(d, 800, 1145, "SPEAKER", HELV_B(64), "white")
add("08-speaker-qr-number", on_table(img), {"name": "Rafael Quintero", "title": "Principal Engineer", "company": "Tidewell Analytics"})

# 9. "Hello my name is": a name and nothing else.
img, d = card(1000, 700)
d.rectangle([0, 0, 1000, 230], fill="#d62828")
centred(d, 1000, 30, "HELLO", ARIAL_B(110), "white")
centred(d, 1000, 160, "my name is", ARIAL(48), "white")
centred(d, 1000, 340, "Dana Kim", MARKER(150), "#1d3557")
add("09-hello-sticker", on_table(img, frame=(1500, 1100)), {"name": "Dana Kim", "title": "", "company": ""})

# 10. Badge 1's layout photographed badly: tilted, soft, noisy, unevenly lit.
img, d = card(800, 1200)
d.rectangle([0, 0, 800, 190], fill="#0b5f4a")
centred(d, 800, 55, "OPTICON 2026", HELV_B(64), "white")
centred(d, 800, 330, "Ingrid", ARIAL_B(104))
centred(d, 800, 450, "Halvorsen", ARIAL_B(104))
centred(d, 800, 610, "Director of Product", ARIAL(46))
centred(d, 800, 690, "Kestrel Mobility", ARIAL_B(58))
d.rectangle([0, 1060, 800, 1200], fill="#f2b705")
centred(d, 800, 1095, "ATTENDEE", HELV_B(64))
add("10-photographed-badly", photographed(on_table(img, angle=4)), {"name": "Ingrid Halvorsen", "title": "Director of Product", "company": "Kestrel Mobility"})

# 11. Held too far away: the badge small in the frame.
img, d = card(800, 1100)
d.rectangle([0, 0, 800, 120], fill="#1f3b73")
centred(d, 800, 30, "COMMERCE NEXT SUMMIT", VERDANA_B(44), "white")
centred(d, 800, 330, "Oliver Brandt", VERDANA_B(76))
centred(d, 800, 450, "Head of Growth", VERDANA(46))
centred(d, 800, 540, "Acme Robotics GmbH", VERDANA_B(52))
small = img.resize((330, 454), Image.LANCZOS)
add("11-far-away", photographed(on_table(small, frame=(900, 700)), blur=0.6, noise=4, light=0.1), {"name": "Oliver Brandt", "title": "Head of Growth", "company": "Acme Robotics GmbH"})

# 12. Name and company only, the company found in a free-mail-free email.
img, d = card(800, 1000)
centred(d, 800, 300, "Sofia Marchetti", GEORGIA_B(76))
centred(d, 800, 420, "Customer Success Manager", GEORGIA(44))
centred(d, 800, 800, "sofia.marchetti@verdantia.io", GEORGIA(38), "#444")
add("12-company-only-in-email", on_table(img), {"name": "Sofia Marchetti", "title": "Customer Success Manager", "company": "Verdantia", "domain": "verdantia.io"})

# 13. A sponsor's badge: the company above the name, the SPONSOR ribbon below.
img, d = card(800, 1200)
d.rectangle([0, 0, 800, 150], fill="#0b5f4a")
centred(d, 800, 45, "COMMERCE NEXT 2026", HELV_B(54), "white")
centred(d, 800, 250, "Halcyon Data", HELV_B(56), "#0037ff")
centred(d, 800, 400, "Michael Osei", ARIAL_B(86))
centred(d, 800, 520, "Sales Engineer", ARIAL(46))
d.rectangle([0, 1060, 800, 1200], fill="#7b2cbf")
centred(d, 800, 1095, "SPONSOR", HELV_B(64), "white")
add("13-sponsor-company-above", on_table(img), {"name": "Michael Osei", "title": "Sales Engineer", "company": "Halcyon Data"})

# 14. A GOLD SPONSOR band under the company.
img, d = card(800, 1150)
d.rectangle([0, 0, 800, 130], fill="#14213d")
centred(d, 800, 38, "RETAIL TECH WEEK", TREBUCHET_B(52), "white")
centred(d, 800, 330, "Grace Adeyemi", TREBUCHET_B(80))
centred(d, 800, 450, "Account Executive", TREBUCHET(46))
centred(d, 800, 540, "Cobalt Commerce", TREBUCHET_B(56))
d.rectangle([0, 1010, 800, 1150], fill="#e9c46a")
centred(d, 800, 1045, "GOLD SPONSOR", TREBUCHET_B(60), "#111")
add("14-gold-sponsor-band", on_table(img), {"name": "Grace Adeyemi", "title": "Account Executive", "company": "Cobalt Commerce"})

# 15. The SPONSOR strip right under the name, the company after it.
img, d = card(800, 1150)
centred(d, 800, 200, "Yuki Tanaka", VERDANA_B(80))
d.rectangle([0, 340, 800, 430], fill="#e63946")
centred(d, 800, 355, "SPONSOR", VERDANA_B(52), "white")
centred(d, 800, 500, "Partner Manager", VERDANA(44))
centred(d, 800, 580, "Meridian Cloudworks", VERDANA_B(50))
add("15-sponsor-strip-under-name", on_table(img), {"name": "Yuki Tanaka", "title": "Partner Manager", "company": "Meridian Cloudworks"})

# 16. The company in a brand colour and white SPONSOR on a coloured band: Tesseract finds neither
#     unless the photo is made grey first (readablePixels), and the ribbon would be the company.
img, d = card(380, 600)
d.text((40, 150), "Noor", font=HELV_B(50), fill="#111")
d.text((40, 210), "Haddad", font=HELV_B(50), fill="#111")
d.text((40, 280), "Field Engineer", font=HELV(28), fill="#111")
d.text((40, 345), "Lumora", font=HELV_B(34), fill="#0037ff")
d.rectangle([0, 500, 380, 600], fill="#7b2cbf")
d.text((95, 525), "SPONSOR", font=HELV_B(44), fill="white")
add("16-colour-print-sponsor", on_table(img, frame=(465, 720), at=(43, 60), bg=(90, 96, 112)), {"name": "Noor Haddad", "title": "Field Engineer", "company": "Lumora"})

OUT.mkdir(parents=True, exist_ok=True)
truth = {}
for slug, img, t in badges:
    img.save(OUT / f"{slug}.jpg", "JPEG", quality=82)
    truth[slug] = t
(OUT / "truth.json").write_text(json.dumps(truth, indent=2, ensure_ascii=False) + "\n")
print("wrote %d badges to %s" % (len(badges), OUT))
