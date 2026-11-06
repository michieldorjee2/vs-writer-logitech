"""Showcase share to Teams: the one code step of Mark's "Showcase share to Teams" workflow.

A rep pressed "Send on Teams" on a Showcase page's Share card. showcase.optimizely.com's server
(api/share-send.ts) checked they are signed in, read what the page has seen, and posted it here
with the trigger's key. This step:

  1. checks the request: its shape, that `to` is an @optimizely.com address, and that `check`
     (SHA-256 of the rest as canonical JSON) still matches, so a request that changed on its way
     messages nobody
  2. messages the rep, and only the rep, in Teams from the trigger owner's account (Michiel's):
     the link (their personal link when they made one, with their note), and the page's numbers

Mark retries a step that raises (four attempts). The Teams marker in /workspace is written BEFORE
the message goes, so a retry never messages twice; a retry that finds it without a result can't
know whether the message went, and says so instead of sending again.

Source of record: mark/share-teams/step.py in vs-writer-logitech. Tests: mark/share-teams/test_step.py.
"""

import hashlib
import html
import json
import os
import re

from opal_tms_sdk import tools

# The trigger's creator: Mark sends as them. Teams needs the sign-in name (UPN).
SENDER_UPN = "michiel.dorjee@optimizely.com"
SENDER_EMAILS = {"michiel@optimizely.com", "michiel.dorjee@optimizely.com"}
MARKERS = "/workspace/share-teams"

SITE = r"https://(?:showcase\.optimizely\.com|aldus-[a-z0-9-]+\.vercel\.app)"
SEG = r"[a-z0-9](?:[a-z0-9-]{0,198}[a-z0-9])?"
PAGE = re.compile(r"^%s/%s/(?:%s/)?$" % (SITE, SEG, SEG))
LINK = re.compile(r"^%s/s/[A-Za-z0-9]{8}$" % SITE)
PING_ID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
OPTIMIZELY_EMAIL = re.compile(r"^[a-z0-9._%+'-]{1,64}@optimizely\.com$")
CONTROL = re.compile(r"[\x00-\x09\x0b-\x1f\x7f]+")


def text(value, limit=200):
    if not isinstance(value, str):
        return ""
    return re.sub(r"\s+", " ", CONTROL.sub(" ", value.replace("\n", " "))).strip()[:limit]


def note(value, limit=1200):
    """A note: line breaks kept, everything else one line."""
    if not isinstance(value, str):
        return ""
    lines = [re.sub(r"\s+", " ", CONTROL.sub(" ", l)).strip() for l in value.replace("\r", "").split("\n")]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()[:limit]


def count(value):
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else 0


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def parse(raw):
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            value = json.loads(raw)
        except ValueError:
            return None
        return value if isinstance(value, dict) else None
    return None


def reply(result):
    """The tool's answer as a dict, or an error string."""
    if not isinstance(result, dict):
        return None, "no answer"
    if result.get("response_type") == "auth_required":
        return None, "Mark needs reconnecting (%s)" % text(str(result.get("response"))[:200], 200)
    body = result.get("response")
    if isinstance(body, str):
        try:
            body = json.loads(body)
        except ValueError:
            return None, text(body, 200) or "no answer"
    if not isinstance(body, dict):
        return None, "no answer"
    if body.get("error"):
        return None, text(str(body.get("error")), 200)
    if result.get("response_type") == "error":
        return None, text(str(body.get("message") or "the tool failed"), 240)
    return body, None


def safe_call(name, **params):
    try:
        return reply(tools.call(name, **params))
    except Exception as err:  # the proxy raises on transport errors; report them as a value
        return None, "%s: %s" % (type(err).__name__, text(str(err), 160))


def chat_id_of(body):
    for key in ("chatId", "id"):
        value = body.get(key)
        if isinstance(value, str) and value.startswith(("19:", "48:")):
            return value
    for key in ("chat", "data", "result"):
        inner = body.get(key)
        if isinstance(inner, dict):
            found = chat_id_of(inner)
            if found:
                return found
    return None


def directory_id(person):
    """Their directory id, found by name and confirmed by their address; or None."""
    body, err = safe_call("teams_chat_find_user", search=person["name"], top=5)
    if err or not body:
        return None
    for entry in body.get("people") or []:
        if not isinstance(entry, dict):
            continue
        addresses = {text(entry.get("userPrincipalName"), 254).lower()}
        for a in entry.get("scoredEmailAddresses") or []:
            if isinstance(a, dict):
                addresses.add(text(a.get("address"), 254).lower())
        if person["email"] in addresses and isinstance(entry.get("id"), str):
            return entry["id"]
    return None


def open_chat(member):
    body, err = safe_call("teams_chat_create_chat", memberUserIds="%s, %s" % (SENDER_UPN, member))
    return (chat_id_of(body) if body else None), err


def read_request(raw):
    """The request, cleaned, and whether it arrived as sent; or None when it isn't one."""
    p = parse(raw)
    if not p or p.get("event") != "share_teams":
        return None, False
    ping_id = text(p.get("ping_id"), 36).lower()
    to = p.get("to") if isinstance(p.get("to"), dict) else {}
    page = p.get("page") if isinstance(p.get("page"), dict) else {}
    email = text(to.get("email"), 254).lower()
    url = text(page.get("url"), 300)
    if not PING_ID.match(ping_id) or not OPTIMIZELY_EMAIL.match(email) or not PAGE.match(url):
        return None, False
    intact = False
    given = p.get("check")
    if isinstance(given, str):
        rest = {k: v for k, v in p.items() if k != "check"}
        intact = hashlib.sha256(canonical(rest).encode("utf-8")).hexdigest() == given
    link = p.get("link") if isinstance(p.get("link"), dict) else None
    if link and not LINK.match(text(link.get("url"), 120)):
        link = None
    stats = p.get("analytics") if isinstance(p.get("analytics"), dict) else None
    req = {
        "ping_id": ping_id,
        "to": {"name": text(to.get("name"), 120) or email.split("@")[0], "email": email},
        "page": {"url": url, "title": text(page.get("title"), 160) or "your Showcase page", "person": page.get("person") is True},
        "link": {
            "url": text(link.get("url"), 120),
            "recipient": text(link.get("recipient"), 250),
            "message": note(link.get("message")),
            "opens": count(link.get("opens")),
            "last_open": text(link.get("last_open"), 40),
            "ctas": count(link.get("ctas")),
        }
        if link
        else None,
        "analytics": {
            "visits": count(stats.get("visits")),
            "visitors": count(stats.get("visitors")),
            "last_seen": text(stats.get("last_seen"), 40),
            "cta_clicks": count(stats.get("cta_clicks")),
            "stage": text(stats.get("stage"), 60),
            "last_channel": text(stats.get("last_channel"), 60),
        }
        if stats
        else None,
    }
    return req, intact


def plural(n, one, many):
    return "%d %s" % (n, one if n == 1 else many)


def row(label, value):
    return (
        '<tr><td style="padding:2px 16px 2px 0;color:#616755">%s</td><td style="padding:2px 0"><b>%s</b></td></tr>'
        % (html.escape(label), html.escape(value))
    )


def message(req):
    first = req["to"]["name"].split(" ")[0]
    link, stats = req["link"], req["analytics"]
    url = link["url"] if link else req["page"]["url"]
    lines = [
        "<p>Hi %s, here's the link to <b>%s</b>%s.</p>"
        % (
            html.escape(first),
            html.escape(req["page"]["title"]),
            ", with your note" if link else "",
        ),
        '<p><a href="%s">%s</a></p>' % (html.escape(url, quote=True), html.escape(url)),
    ]
    if link:
        lines.append(
            "<blockquote><b>For %s</b><br>%s</blockquote>"
            % (html.escape(link["recipient"]), html.escape(link["message"]).replace("\n", "<br>"))
        )
    rows = []
    if link:
        if link["opens"]:
            rows.append(row("Your link", "opened %s, last %s" % (plural(link["opens"], "time", "times"), link["last_open"] or "recently")))
        else:
            rows.append(row("Your link", "not opened yet"))
        if link["ctas"]:
            rows.append(row("From your link", plural(link["ctas"], "CTA click", "CTA clicks")))
    if stats:
        rows.append(row("Visits", "%s by %s" % (plural(stats["visits"], "visit", "visits"), plural(stats["visitors"], "person", "people")) if stats["visits"] else "none yet"))
        if stats["last_seen"]:
            rows.append(row("Last seen", stats["last_seen"]))
        rows.append(row("CTA clicks", str(stats["cta_clicks"])))
        if stats["stage"]:
            rows.append(row("Stage", stats["stage"]))
        if stats["last_channel"]:
            rows.append(row("Last channel", stats["last_channel"]))
    if rows:
        lines.append("<table>%s</table>" % "".join(rows))
    tools_url = req["page"]["url"] + "?search=1"
    lines.append('<p><a href="%s">Open the page with your tools</a> for the whole report.</p>' % html.escape(tools_url, quote=True))
    lines.append("<p><em>Sent by Showcase because you pressed Send on Teams. Only you get this.</em></p>")
    return "".join(lines)


def marker(name):
    os.makedirs(MARKERS, exist_ok=True)
    path = os.path.join(MARKERS, name)
    if os.path.exists(path):
        with open(path) as f:
            return path, f.read()
    with open(path, "w") as f:
        f.write("started")
    return path, None


def finish(path, outcome):
    with open(path, "w") as f:
        f.write(json.dumps(outcome))


def send_teams(req):
    to = req["to"]
    if to["email"] in SENDER_EMAILS:
        chat = "48:notes"  # the sender's own chat with themself
    else:
        chat, err = open_chat(to["email"])
        if not chat:
            uid = directory_id(to)
            if uid:
                chat, err = open_chat(uid)
        if not chat:
            return None, "Couldn't open a Teams chat with %s: %s" % (to["name"], err or "no chat id came back")
    body, err = safe_call("teams_chat_send_message", chatId=chat, body=message(req))
    if err:
        return None, "Teams message to %s failed: %s" % (to["name"], err)
    sent = body.get("chatMessage") if isinstance(body.get("chatMessage"), dict) else {}
    return {"to": to["name"], "web_url": text(sent.get("webUrl"), 500)}, None


def handler(input, ctx):
    req, intact = read_request(input.get("webhook_body"))
    if not req:
        print("not a Showcase share request: ignored")
        return {"done": "ignored"}
    if not intact:
        print("the request changed on its way to Mark: nobody messaged")
        return {"done": "ignored", "why": "check"}
    path, before = marker(req["ping_id"] + ".teams")
    if before is not None:
        prior = json.loads(before) if before.startswith("{") else None
        if prior and prior.get("sent"):
            return {"done": "teams", **prior["sent"]}
        if prior:
            raise RuntimeError(prior.get("error") or "The Teams message failed")
        raise RuntimeError("A retry couldn't tell whether the Teams message to %s went" % req["to"]["name"])
    sent, err = send_teams(req)
    finish(path, {"sent": sent, "error": err})
    if not sent:
        # The marker stays: a retry raises this too, and never sends twice.
        raise RuntimeError(err)
    print("messaged %s the link to %s" % (sent["to"], req["page"]["url"]))
    return {"done": "teams", **sent}
