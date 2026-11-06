"""Tests for mark/share-teams/step.py, with Mark's tools stood in: nothing here reaches Teams.

    python3 mark/share-teams/test_step.py

fixture.json is a request exactly as api/share-send.ts builds it (scripts/check-share-links.ts
checks that), so the `check` the server computes in Node is the one this step recomputes in Python.
"""

import copy
import hashlib
import json
import os
import sys
import tempfile
import types
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))


class FakeTools:
    def __init__(self):
        self.calls = []
        self.answers = {}

    def call(self, name, **params):
        self.calls.append((name, params))
        answer = self.answers.get(name)
        if isinstance(answer, Exception):
            raise answer
        return answer if answer is not None else {"response_type": "application/json", "response": {}}

    def names(self):
        return [name for name, _ in self.calls]


FAKE = FakeTools()
sys.modules["opal_tms_sdk"] = types.SimpleNamespace(tools=FAKE)
sys.path.insert(0, HERE)
import step  # noqa: E402

FIXTURE = json.load(open(os.path.join(HERE, "fixture.json"), encoding="utf-8"))
OK = {"response_type": "application/json"}


def resign(req):
    rest = {k: v for k, v in req.items() if k != "check"}
    req["check"] = hashlib.sha256(step.canonical(rest).encode("utf-8")).hexdigest()
    return req


class Base(unittest.TestCase):
    def setUp(self):
        FAKE.calls.clear()
        FAKE.answers = {
            "teams_chat_create_chat": dict(OK, response={"chat": {"id": "19:abc@unq.gbl.spaces"}}),
            "teams_chat_send_message": dict(OK, response={"chatMessage": {"webUrl": "https://teams.example/m/1"}}),
        }
        self.tmp = tempfile.TemporaryDirectory()
        step.MARKERS = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()

    def run_step(self, req):
        return step.handler({"webhook_body": req}, {})

    def body(self):
        (_, params), = [c for c in FAKE.calls if c[0] == "teams_chat_send_message"]
        return params


class Sends(Base):
    def test_fixture_check_matches_the_server(self):
        self.assertTrue(step.read_request(copy.deepcopy(FIXTURE))[1])

    def test_michiel_gets_it_in_his_own_notes(self):
        out = self.run_step(copy.deepcopy(FIXTURE))
        self.assertEqual(out["done"], "teams")
        self.assertEqual(FAKE.names(), ["teams_chat_send_message"])
        self.assertEqual(self.body()["chatId"], "48:notes")

    def test_the_card_has_the_link_the_note_and_the_numbers(self):
        self.run_step(copy.deepcopy(FIXTURE))
        html = self.body()["body"]
        self.assertIn("Hi Michiel, here's the link to <b>Zürich Versicherung – “Group” | AG</b>, with your note.", html)
        self.assertIn('href="https://showcase.optimizely.com/s/Ab3dE9xY"', html)
        self.assertIn("<b>For Lena Brunner, Head of Digital</b><br>Hi Lena,<br><br>Great to meet you at &lt;Opticon&gt;.", html)
        self.assertNotIn("<Opticon>", html, "the rep's note is escaped")
        self.assertIn("opened 2 times, last 7 Nov 2026", html)
        self.assertIn("1 CTA click", html)
        self.assertIn("12 visits by 4 people", html)
        self.assertIn("Prospect", html)
        self.assertIn('href="https://showcase.optimizely.com/zurich-versicherung/?search=1"', html)
        self.assertIn("Only you get this", html)

    def test_another_rep_gets_a_chat_with_michiel(self):
        req = copy.deepcopy(FIXTURE)
        req["to"] = {"name": "Alex Exec", "email": "alex.exec@optimizely.com"}
        self.assertEqual(self.run_step(resign(req))["done"], "teams")
        self.assertEqual(FAKE.calls[0][1]["memberUserIds"], "michiel.dorjee@optimizely.com, alex.exec@optimizely.com")
        self.assertEqual(self.body()["chatId"], "19:abc@unq.gbl.spaces")

    def test_the_public_link_and_no_numbers(self):
        req = copy.deepcopy(FIXTURE)
        req["link"] = None
        req["analytics"] = None
        self.run_step(resign(req))
        html = self.body()["body"]
        self.assertIn("here's the link to <b>Zürich Versicherung – “Group” | AG</b>.</p>", html)
        self.assertIn('href="https://showcase.optimizely.com/zurich-versicherung/"', html)
        self.assertNotIn("<table>", html)
        self.assertNotIn("blockquote", html)

    def test_a_preview_link_is_fine(self):
        req = copy.deepcopy(FIXTURE)
        req["page"]["url"] = "https://aldus-preprod.vercel.app/zurich-versicherung/"
        req["link"]["url"] = "https://aldus-preprod.vercel.app/s/Ab3dE9xY"
        self.assertEqual(self.run_step(resign(req))["done"], "teams")

    def test_a_retry_sends_nothing_twice(self):
        self.run_step(copy.deepcopy(FIXTURE))
        self.assertEqual(self.run_step(copy.deepcopy(FIXTURE))["done"], "teams")
        self.assertEqual(FAKE.names(), ["teams_chat_send_message"])

    def test_a_failed_send_raises_and_its_retry_never_resends(self):
        FAKE.answers["teams_chat_send_message"] = {"response_type": "error", "response": {"message": "throttled"}}
        with self.assertRaises(RuntimeError):
            self.run_step(copy.deepcopy(FIXTURE))
        FAKE.answers["teams_chat_send_message"] = dict(OK, response={"chatMessage": {}})
        with self.assertRaises(RuntimeError):
            self.run_step(copy.deepcopy(FIXTURE))
        self.assertEqual(FAKE.names().count("teams_chat_send_message"), 1)

    def test_a_crash_mid_send_is_not_resent(self):
        os.makedirs(step.MARKERS, exist_ok=True)
        with open(os.path.join(step.MARKERS, FIXTURE["ping_id"] + ".teams"), "w") as f:
            f.write("started")
        with self.assertRaises(RuntimeError):
            self.run_step(copy.deepcopy(FIXTURE))
        self.assertEqual(FAKE.calls, [])


class Refused(Base):
    def test_a_changed_request_messages_nobody(self):
        req = copy.deepcopy(FIXTURE)
        req["to"]["email"] = "someone.else@optimizely.com"
        self.assertEqual(self.run_step(req)["done"], "ignored")
        self.assertEqual(FAKE.calls, [])

    def test_only_optimizely_addresses(self):
        req = copy.deepcopy(FIXTURE)
        req["to"]["email"] = "rep@optimizely.com.evil.example"
        self.assertEqual(self.run_step(resign(req))["done"], "ignored")
        self.assertEqual(FAKE.calls, [])

    def test_only_showcase_pages(self):
        for url in ("https://evil.example/zurich-versicherung/", "javascript:alert(1)", "https://showcase.optimizely.com/a/b/c/"):
            req = copy.deepcopy(FIXTURE)
            req["page"]["url"] = url
            self.assertEqual(self.run_step(resign(req))["done"], "ignored", url)
        self.assertEqual(FAKE.calls, [])

    def test_a_link_elsewhere_is_dropped(self):
        req = copy.deepcopy(FIXTURE)
        req["link"]["url"] = "https://evil.example/s/Ab3dE9xY"
        self.run_step(resign(req))
        self.assertNotIn("evil", self.body()["body"])

    def test_anything_else_is_ignored(self):
        for raw in (None, "not json", {"event": "cta_click"}, []):
            self.assertEqual(self.run_step(raw)["done"], "ignored")
        self.assertEqual(FAKE.calls, [])


if __name__ == "__main__":
    unittest.main(verbosity=1)
