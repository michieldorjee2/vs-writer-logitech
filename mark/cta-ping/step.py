"""Showcase CTA ping: the one code step of Mark's "Showcase CTA ping" workflow.

A visitor clicked "talk to your team" on a Showcase account page. showcase.optimizely.com's server
(api/cta-ping.ts) checked the click, read the page's team from the CMS, and posted it here with
the trigger's key. This step:

  1. checks the click: its shape, and that `check` (SHA-256 of the rest as canonical JSON) still
     matches, so a click that changed on its way messages nobody
  2. with an account executive on the page (an @optimizely.com address), messages them in Teams
     from the trigger owner's account (Michiel's)
  3. otherwise, or when the message fails, adds a row to the follow-up sheet so Michiel can
     follow up

Mark retries a step that raises (four attempts). Each side effect leaves a marker in /workspace
BEFORE it happens, so a retry never messages a rep or adds a row twice. A retry that finds the
Teams marker without a result can't know whether the message went, so it logs the row instead
of sending again. Only a failed sheet write raises: that is the one outcome nobody would see.

Source of record: mark/cta-ping/step.py in vs-writer-logitech. Tests: mark/cta-ping/test_step.py.
"""

import hashlib
import html
import json
import os
import re
from datetime import datetime

from opal_tms_sdk import tools

# The trigger's creator: Mark sends as them. Teams needs the sign-in name (UPN), which isn't
# always the address people use: Michiel's is michiel.dorjee@, his address michiel@.
SENDER_UPN = "michiel.dorjee@optimizely.com"
SENDER_EMAILS = {"michiel@optimizely.com", "michiel.dorjee@optimizely.com"}
SHEET_ID = "1ZkyFBynQu4k8UynJmgYhrDmdKlMyJgC7VAQYCHoCnOg"  # "Showcase CTA follow-ups"
SHEET_RANGE = "Pings!A:I"
MARKERS = "/workspace/cta-ping"

# An account page (/<slug>/) or a person page (/<company>/<person>/).
PAGE = re.compile(r"^https://showcase\.optimizely\.com/[a-z0-9](?:[a-z0-9-]{0,198}[a-z0-9])?/(?:[a-z0-9](?:[a-z0-9-]{0,198}[a-z0-9])?/)?$")
PING_ID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
OPTIMIZELY_EMAIL = re.compile(r"^[a-z0-9._%+'-]{1,64}@optimizely\.com$")
CONTROL = re.compile(r"[\x00-\x1f\x7f]+")


def text(value, limit=200):
    if not isinstance(value, str):
        return ""
    return re.sub(r"\s+", " ", CONTROL.sub(" ", value)).strip()[:limit]


def cell(value):
    # The sheet tool takes pipe-delimited rows: a pipe or a newline inside a value would split it.
    return text(value, 500).replace("|", "/")


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


def when(iso):
    try:
        moment = datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except (AttributeError, ValueError):
        return text(iso, 40)
    return moment.strftime("%-d %b %Y, %H:%M UTC")


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
        detail = body.get("details")
        try:
            detail = json.loads(detail).get("title") if isinstance(detail, str) else None
        except (ValueError, AttributeError):
            pass
        return None, text(str(detail or body.get("message") or "the tool failed"), 240)
    return body, None


def safe_call(name, **params):
    try:
        return reply(tools.call(name, **params))
    except Exception as err:  # the proxy raises on transport errors; report them as a value
        return None, "%s: %s" % (type(err).__name__, text(str(err), 160))


def chat_id_of(body):
    """The chat's id, wherever the tool put it."""
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


def directory_id(rep):
    """The rep's directory id, found by name and confirmed by their address; or None."""
    body, err = safe_call("teams_chat_find_user", search=rep["name"], top=5)
    if err or not body:
        return None
    for person in body.get("people") or []:
        if not isinstance(person, dict):
            continue
        addresses = {text(person.get("userPrincipalName"), 254).lower()}
        for entry in person.get("scoredEmailAddresses") or []:
            if isinstance(entry, dict):
                addresses.add(text(entry.get("address"), 254).lower())
        if rep["email"] in addresses and isinstance(person.get("id"), str):
            return person["id"]
    return None


def open_chat(member):
    body, err = safe_call("teams_chat_create_chat", memberUserIds="%s, %s" % (SENDER_UPN, member))
    return (chat_id_of(body) if body else None), err


def message(ping):
    rep_first = text(ping["rep"]["name"], 120).split(" ")[0] or "there"
    where = (
        "the Showcase page we wrote for %s at %s" % (html.escape(ping["person"]), html.escape(ping["account"]))
        if ping["person"]
        else "the %s Showcase page" % html.escape(ping["account"])
    )
    lines = [
        "<p>Hi %s, <b>someone on %s just asked to talk to their Optimizely team.</b></p>"
        % (html.escape(rep_first), where),
        "<p>They clicked %s. The page lists you as the account executive, and it told them"
        " we've let you know.</p>" % html.escape(ping["button"]),
        '<p><a href="%s">%s</a><br>%s%s</p>'
        % (
            html.escape(ping["page"], quote=True),
            html.escape(ping["page"]),
            html.escape(when(ping["requested_at"])),
            (" &middot; " + html.escape(ping["campaign"])) if ping["campaign"] else "",
        ),
    ]
    others = ["%s (%s)" % (m["name"], m["role"]) if m["role"] else m["name"] for m in ping["team"]]
    if others:
        lines.append("<p>Also on the page: %s</p>" % html.escape(", ".join(others)))
    lines.append(
        "<p><em>Sent automatically by Showcase from Michiel's account."
        " The visitor doesn't see this chat.</em></p>"
    )
    return "".join(lines)


def read_ping(raw):
    """The click, cleaned, and whether it arrived as sent; or None when it isn't one."""
    p = parse(raw)
    if not p or p.get("event") != "cta_click":
        return None, False
    ping_id = text(p.get("ping_id"), 36).lower()
    page = text(p.get("page"), 260)
    if not PING_ID.match(ping_id) or not PAGE.match(page):
        return None, False
    intact = False
    given = p.get("check")
    if isinstance(given, str):
        rest = {k: v for k, v in p.items() if k != "check"}
        intact = hashlib.sha256(canonical(rest).encode("utf-8")).hexdigest() == given
    rep = p.get("rep") if isinstance(p.get("rep"), dict) else None
    team = []
    for member in (p.get("team") if isinstance(p.get("team"), list) else [])[:5]:
        if isinstance(member, dict) and text(member.get("name"), 120):
            team.append({"name": text(member.get("name"), 120), "role": text(member.get("role"), 120)})
    ping = {
        "ping_id": ping_id,
        "requested_at": text(p.get("requested_at"), 40),
        "account": text(p.get("account"), 160) or "their account",
        "person": text(p.get("person"), 120),
        "page": page,
        "button": text(p.get("button"), 80) or "the button",
        "campaign": text(p.get("campaign"), 600),
        "rep": {
            "name": text(rep.get("name"), 120),
            "role": text(rep.get("role"), 120),
            "email": text(rep.get("email"), 254).lower(),
        }
        if rep and text(rep.get("name"), 120)
        else None,
        "team": team,
    }
    return ping, intact


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


def send_teams(ping):
    rep = ping["rep"]
    if rep["email"] in SENDER_EMAILS:
        chat = "48:notes"  # the sender's own chat with themself
    else:
        chat, err = open_chat(rep["email"])
        if not chat:
            # The page's address may be an alias Teams doesn't sign in with (10 of the 168 are):
            # find them in the directory by name, confirmed by that address.
            uid = directory_id(rep)
            if uid:
                chat, err = open_chat(uid)
        if not chat:
            return None, "Couldn't open a Teams chat with %s: %s" % (rep["name"], err or "no chat id came back")
    body, err = safe_call("teams_chat_send_message", chatId=chat, body=message(ping))
    if err:
        return None, "Teams message to %s failed: %s" % (rep["name"], err)
    sent = body.get("chatMessage") if isinstance(body.get("chatMessage"), dict) else {}
    return {"to": rep["name"], "web_url": text(sent.get("webUrl"), 500)}, None


def add_row(ping, why):
    team = list(ping["team"])
    if ping["rep"]:
        team.insert(0, {"name": ping["rep"]["name"], "role": ping["rep"]["role"]})
    row = [
        ping["requested_at"],
        "%s, page for %s" % (ping["account"], ping["person"]) if ping["person"] else ping["account"],
        ping["page"],
        ping["button"],
        why,
        "; ".join("%s (%s)" % (m["name"], m["role"]) if m["role"] else m["name"] for m in team) or "Nobody listed",
        ping["campaign"],
        ping["ping_id"],
        "",
    ]
    # RAW: a value is stored as typed, so page content that starts with "=" can't become a formula.
    return safe_call(
        "google_sheets_append_values",
        spreadsheetId=SHEET_ID,
        range=SHEET_RANGE,
        values="|".join(cell(v) for v in row),
        valueInputOption="RAW",
        insertDataOption="INSERT_ROWS",
    )


def handler(input, ctx):
    ping, intact = read_ping(input.get("webhook_body"))
    if not ping:
        print("not a Showcase CTA click: ignored")
        return {"done": "ignored"}
    done_path = os.path.join(MARKERS, ping["ping_id"] + ".done")
    if os.path.exists(done_path):
        with open(done_path) as f:
            return json.load(f)

    why = None
    if not intact:
        why = "The click changed on its way to Mark, so nobody was messaged"
    elif not ping["rep"]:
        why = "No account executive on the page"
    elif not OPTIMIZELY_EMAIL.match(ping["rep"]["email"]):
        why = "The account executive on the page (%s) has no Optimizely email" % ping["rep"]["name"]
    else:
        path, before = marker(ping["ping_id"] + ".teams")
        if before is None:
            sent, err = send_teams(ping)
            finish(path, {"sent": sent, "error": err})
        else:
            prior = json.loads(before) if before.startswith("{") else {"sent": None, "error": "unknown"}
            sent, err = prior.get("sent"), prior.get("error")
            if before == "started":
                err = "A retry couldn't tell whether the Teams message to %s went" % ping["rep"]["name"]
        if sent:
            outcome = {"done": "teams", "to": sent["to"], "web_url": sent.get("web_url", "")}
            print("messaged %s about %s" % (sent["to"], ping["page"]))
            with open(done_path, "w") as f:
                json.dump(outcome, f)
            return outcome
        why = err

    path, before = marker(ping["ping_id"] + ".sheet")
    if before is not None and before.startswith("{"):
        return {"done": "sheet", "why": why}
    if before is not None:
        # An earlier attempt started the write and never finished: the row may be there already.
        raise RuntimeError("Couldn't add the follow-up row for %s (%s): %s" % (ping["account"], ping["page"], why))
    _, err = add_row(ping, why)
    if err:
        # The marker stays: the retries raise this too, and never add a second row.
        raise RuntimeError("Couldn't add the follow-up row for %s (%s): %s. Why it needed one: %s" % (ping["account"], ping["page"], err, why))
    finish(path, {"ok": True})
    outcome = {"done": "sheet", "why": why}
    print("follow-up row for %s: %s" % (ping["page"], why))
    with open(done_path, "w") as f:
        json.dump(outcome, f)
    return outcome
