"""Tests for mark/cta-ping/step.py, with Mark's tools stood in: nothing here reaches Teams or Google.

    python3 mark/cta-ping/test_step.py

fixture.json is a ping exactly as api/cta-ping.ts builds it (src/www/__tests__/www.test.tsx checks
that), so the `check` the server computes in Node is the one this step recomputes in Python.
"""

import copy
import json
import os
import sys
import tempfile
import types
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))


class FakeTools:
    """opal_tms_sdk.tools, stood in: records every call, answers from `answers` by tool name."""

    def __init__(self):
        self.calls = []
        self.answers = {}

    def call(self, name, **params):
        self.calls.append((name, params))
        answer = self.answers.get(name)
        if isinstance(answer, Exception):
            raise answer
        if callable(answer):
            return answer(params)
        return answer if answer is not None else {"response_type": "application/json", "response": {}}

    def names(self):
        return [name for name, _ in self.calls]


FAKE = FakeTools()
sys.modules["opal_tms_sdk"] = types.SimpleNamespace(tools=FAKE)
sys.path.insert(0, HERE)
import step  # noqa: E402

FIXTURE = json.load(open(os.path.join(HERE, "fixture.json"), encoding="utf-8"))
# The same page's ping from a visitor who came in by a personal link (`shared`).
SHARED = json.load(open(os.path.join(HERE, "fixture-shared.json"), encoding="utf-8"))
OK = {"response_type": "application/json"}


def resign(ping):
    """The ping with its check recomputed, as the server would have sent it."""
    import hashlib

    rest = {k: v for k, v in ping.items() if k != "check"}
    ping["check"] = hashlib.sha256(step.canonical(rest).encode("utf-8")).hexdigest()
    return ping


class Base(unittest.TestCase):
    def setUp(self):
        FAKE.calls.clear()
        FAKE.answers = {
            # The shapes Mark's Microsoft 365 tools answered with on 4 Nov 2026.
            "teams_chat_create_chat": dict(OK, response={"chat": {"id": "19:abc@unq.gbl.spaces", "chatType": "oneOnOne"}, "message": "ok"}),
            "teams_chat_send_message": dict(OK, response={"chatMessage": {"webUrl": "https://teams.example/m/1"}, "message": "Chat message sent successfully."}),
            "google_sheets_append_values": dict(OK, response={"updates": {"updatedRows": 1}}),
        }
        self.tmp = tempfile.TemporaryDirectory()
        step.MARKERS = self.tmp.name

    def tearDown(self):
        self.tmp.cleanup()

    def run_step(self, ping):
        return step.handler({"webhook_body": ping}, {"output_dir": self.tmp.name})

    def row(self):
        (name, params), = [c for c in FAKE.calls if c[0] == "google_sheets_append_values"]
        return params, params["values"].split("|")


class Teams(Base):
    def test_fixture_check_matches_the_server(self):
        _, intact = step.read_ping(copy.deepcopy(FIXTURE))
        self.assertTrue(intact, "the check api/cta-ping.ts computed doesn't match in Python")

    def test_the_account_executive_gets_one_message_from_the_sender(self):
        out = self.run_step(copy.deepcopy(FIXTURE))
        self.assertEqual(out["done"], "teams")
        self.assertEqual(FAKE.names(), ["teams_chat_create_chat", "teams_chat_send_message"])
        self.assertEqual(FAKE.calls[0][1]["memberUserIds"], "michiel.dorjee@optimizely.com, alex.exec@optimizely.com")
        sent = FAKE.calls[1][1]
        self.assertEqual(sent["chatId"], "19:abc@unq.gbl.spaces")
        body = sent["body"]
        self.assertIn("Hi Alex,", body)
        self.assertIn("Zürich Versicherung", body)
        self.assertIn("q4 &lt;takeout&gt;", body, "page content must be escaped in the message")
        self.assertNotIn("<takeout>", body)
        self.assertIn("Sam Rep (Sales Development Representative)", body)
        self.assertIn('href="https://showcase.optimizely.com/zurich-versicherung/"', body)
        self.assertIn("4 Nov 2026, 23:06 UTC", body)
        self.assertIn("Michiel's account", body)

    def test_a_person_page_says_whose_page_it_was(self):
        ping = copy.deepcopy(FIXTURE)
        ping.update(person="Ben <Yu>", page="https://showcase.optimizely.com/logitech/ben-yu/", account="Logitech G")
        self.assertEqual(self.run_step(resign(ping))["done"], "teams")
        body = FAKE.calls[1][1]["body"]
        self.assertIn("the Showcase page we wrote for Ben &lt;Yu&gt; at Logitech G", body)
        self.assertIn('href="https://showcase.optimizely.com/logitech/ben-yu/"', body)

    def test_a_person_page_row_names_the_person(self):
        ping = copy.deepcopy(FIXTURE)
        ping.update(person="Ben Yu", page="https://showcase.optimizely.com/logitech/ben-yu/", account="Logitech G", rep=None)
        self.assertEqual(self.run_step(resign(ping))["done"], "sheet")
        _, cells = self.row()
        self.assertEqual(cells[1], "Logitech G, page for Ben Yu")
        self.assertEqual(cells[2], "https://showcase.optimizely.com/logitech/ben-yu/")

    def test_a_message_to_the_sender_goes_to_their_own_notes(self):
        ping = copy.deepcopy(FIXTURE)
        ping["rep"]["email"] = "michiel@optimizely.com"
        self.assertEqual(self.run_step(resign(ping))["done"], "teams")
        self.assertEqual(FAKE.names(), ["teams_chat_send_message"])
        self.assertEqual(FAKE.calls[0][1]["chatId"], "48:notes")

    def test_an_alias_address_is_found_in_the_directory_by_name_and_address(self):
        no_such_upn = {"response_type": "error", "response": {"message": "Tool encountered an internal error.", "details": '{"title":"Failed to create chat: Failed to find users with user principal name \'alex.exec@optimizely.com\'","status":500}', "error_type": "server_error", "status_code": "500"}}
        FAKE.answers["teams_chat_create_chat"] = lambda p: no_such_upn if "@" in p["memberUserIds"].split(", ")[1] else dict(OK, response={"chat": {"id": "19:found"}})
        FAKE.answers["teams_chat_find_user"] = dict(OK, response={"people": [
            {"id": "wrong-person", "userPrincipalName": "alex.exec2@optimizely.com", "scoredEmailAddresses": [{"address": "alex2@optimizely.com"}]},
            {"id": "aad-guid-alex", "userPrincipalName": "alexander.exec@optimizely.com", "scoredEmailAddresses": [{"address": "Alex.Exec@optimizely.com"}]},
        ]})
        self.assertEqual(self.run_step(copy.deepcopy(FIXTURE))["done"], "teams")
        self.assertEqual(FAKE.names(), ["teams_chat_create_chat", "teams_chat_find_user", "teams_chat_create_chat", "teams_chat_send_message"])
        self.assertEqual(FAKE.calls[1][1]["search"], "Alex Exec")
        self.assertEqual(FAKE.calls[2][1]["memberUserIds"], "michiel.dorjee@optimizely.com, aad-guid-alex")
        self.assertEqual(FAKE.calls[3][1]["chatId"], "19:found")

    def test_nobody_in_the_directory_with_that_address_goes_on_the_sheet(self):
        FAKE.answers["teams_chat_create_chat"] = {"response_type": "error", "response": {"message": "Tool encountered an internal error.", "details": '{"title":"Failed to create chat: no such user"}'}}
        FAKE.answers["teams_chat_find_user"] = dict(OK, response={"people": [{"id": "someone-else", "userPrincipalName": "alex.other@optimizely.com", "scoredEmailAddresses": []}]})
        out = self.run_step(copy.deepcopy(FIXTURE))
        self.assertEqual(out["done"], "sheet")
        self.assertIn("Couldn't open a Teams chat with Alex Exec: Failed to create chat: no such user", out["why"])
        self.assertNotIn("teams_chat_send_message", FAKE.names())

    def test_a_webhook_body_as_text_works_too(self):
        self.assertEqual(self.run_step(json.dumps(FIXTURE))["done"], "teams")

    def test_a_retry_sends_nothing_twice(self):
        first = self.run_step(copy.deepcopy(FIXTURE))
        again = self.run_step(copy.deepcopy(FIXTURE))
        self.assertEqual(first, again)
        self.assertEqual(FAKE.names(), ["teams_chat_create_chat", "teams_chat_send_message"])

    def test_a_retry_after_a_crash_mid_send_logs_instead_of_resending(self):
        os.makedirs(step.MARKERS, exist_ok=True)
        with open(os.path.join(step.MARKERS, FIXTURE["ping_id"] + ".teams"), "w") as f:
            f.write("started")
        out = self.run_step(copy.deepcopy(FIXTURE))
        self.assertEqual(out["done"], "sheet")
        self.assertNotIn("teams_chat_send_message", FAKE.names())
        _, cells = self.row()
        self.assertIn("couldn't tell whether the Teams message to Alex Exec went", cells[4])


class Shared(Base):
    """A visitor who came in by a personal link: the message and the row say whose link it was."""

    def test_the_shared_fixture_check_matches_the_server(self):
        self.assertEqual(step.read_ping(copy.deepcopy(SHARED))[1], True)

    def test_the_message_says_who_the_link_was_for_and_who_sent_it(self):
        self.assertEqual(self.run_step(copy.deepcopy(SHARED))["done"], "teams")
        body = FAKE.calls[1][1]["body"]
        self.assertIn(
            "They came in by the personal link Michiel Dorjee sent to Lena Brunner"
            " (Head of Digital &lt;Experience&gt;, lena.brunner@zurich.example).",
            body,
        )
        self.assertNotIn("<Experience>", body, "what the rep typed is escaped")

    def test_the_row_says_it_too(self):
        ping = copy.deepcopy(SHARED)
        ping["rep"] = None
        self.assertEqual(self.run_step(resign(ping))["done"], "sheet")
        _, cells = self.row()
        self.assertEqual(len(cells), 9)
        self.assertEqual(
            cells[6],
            "Came in by the personal link Michiel Dorjee sent to Lena Brunner (Head of Digital <Experience>, lena.brunner@zurich.example)",
        )

    def test_a_changed_link_messages_nobody(self):
        ping = copy.deepcopy(SHARED)
        ping["shared"]["recipient"]["email"] = "someone.else@example.com"
        self.assertEqual(self.run_step(ping)["done"], "sheet")
        self.assertNotIn("teams_chat_send_message", FAKE.names())

    def test_a_click_without_a_link_says_nothing_about_one(self):
        self.run_step(copy.deepcopy(FIXTURE))
        self.assertNotIn("personal link", FAKE.calls[1][1]["body"])

    def test_a_malformed_link_is_left_out(self):
        ping = copy.deepcopy(SHARED)
        ping["shared"]["code"] = "../../x"
        self.assertEqual(self.run_step(resign(ping))["done"], "teams")
        self.assertNotIn("personal link", FAKE.calls[1][1]["body"])


class Sheet(Base):
    def test_no_account_executive_adds_a_row_and_messages_nobody(self):
        ping = copy.deepcopy(FIXTURE)
        ping["rep"] = None
        out = self.run_step(resign(ping))
        self.assertEqual(out, {"done": "sheet", "why": "No account executive on the page"})
        self.assertEqual(FAKE.names(), ["google_sheets_append_values"])
        params, cells = self.row()
        self.assertEqual(params["spreadsheetId"], step.SHEET_ID)
        self.assertEqual(params["range"], "Pings!A:I")
        self.assertEqual(params["valueInputOption"], "RAW", "RAW keeps page text from becoming a formula")
        self.assertEqual(len(cells), 9)
        self.assertEqual(cells[0], "2026-11-04T23:06:28.545Z")
        self.assertEqual(cells[1], "Zürich Versicherung – “Group” / AG", "a pipe in a value must not split the row")
        self.assertEqual(cells[2], "https://showcase.optimizely.com/zurich-versicherung/")
        self.assertEqual(cells[5], "Sam Rep (Sales Development Representative)")
        self.assertEqual(cells[7], FIXTURE["ping_id"])
        self.assertEqual(cells[8], "")

    def test_a_changed_click_messages_nobody(self):
        ping = copy.deepcopy(FIXTURE)
        ping["rep"]["email"] = "someone.else@optimizely.com"  # check not recomputed
        out = self.run_step(ping)
        self.assertEqual(out["done"], "sheet")
        self.assertEqual(FAKE.names(), ["google_sheets_append_values"])
        self.assertIn("changed on its way", out["why"])

    def test_an_account_executive_without_an_optimizely_email_goes_on_the_sheet(self):
        ping = copy.deepcopy(FIXTURE)
        ping["rep"]["email"] = "alex@gmail.com"
        out = self.run_step(resign(ping))
        self.assertEqual(out["done"], "sheet")
        self.assertIn("has no Optimizely email", out["why"])
        self.assertEqual(FAKE.names(), ["google_sheets_append_values"])
        _, cells = self.row()
        self.assertTrue(cells[5].startswith("Alex Exec (Enterprise Account Executive)"))

    def test_teams_needing_a_reconnect_goes_on_the_sheet(self):
        FAKE.answers["teams_chat_create_chat"] = {"response_type": "auth_required", "response": {"requirements": [{"provider": "ocp_microsoft_graph_opal_tool"}]}}
        out = self.run_step(copy.deepcopy(FIXTURE))
        self.assertEqual(out["done"], "sheet")
        self.assertIn("Mark needs reconnecting", out["why"])
        self.assertNotIn("teams_chat_send_message", FAKE.names())

    def test_a_failed_send_goes_on_the_sheet(self):
        FAKE.answers["teams_chat_send_message"] = RuntimeError("upstream 500")
        out = self.run_step(copy.deepcopy(FIXTURE))
        self.assertEqual(out["done"], "sheet")
        self.assertIn("Teams message to Alex Exec failed", out["why"])

    def test_a_failed_row_raises_and_its_retries_never_add_a_second(self):
        ping = copy.deepcopy(FIXTURE)
        ping["rep"] = None
        ping = resign(ping)
        FAKE.answers["google_sheets_append_values"] = {"response_type": "auth_required", "response": {}}
        with self.assertRaises(RuntimeError):
            self.run_step(copy.deepcopy(ping))
        FAKE.answers["google_sheets_append_values"] = dict(OK, response={})
        with self.assertRaises(RuntimeError):
            self.run_step(copy.deepcopy(ping))
        self.assertEqual(FAKE.names().count("google_sheets_append_values"), 1)


class Ignored(Base):
    def test_anything_else_is_ignored_and_calls_nothing(self):
        bad_page = copy.deepcopy(FIXTURE)
        bad_page["page"] = "https://evil.example/zurich/"
        too_deep = copy.deepcopy(FIXTURE)
        too_deep["page"] = "https://showcase.optimizely.com/logitech/ben-yu/extra/"
        bad_id = copy.deepcopy(FIXTURE)
        bad_id["ping_id"] = "../../etc/passwd"
        for raw in [None, "", "not json", [], {"event": "other"}, resign(bad_page), resign(bad_id), resign(too_deep)]:
            self.assertEqual(self.run_step(raw), {"done": "ignored"}, raw)
        self.assertEqual(FAKE.calls, [])


if __name__ == "__main__":
    unittest.main(verbosity=1)
