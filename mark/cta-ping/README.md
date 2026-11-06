# Showcase CTA ping (Mark workflow)

When a visitor clicks "talk to your team" on a Showcase account page or person page, Mark's **Showcase CTA ping** workflow tells the account team. It is a webhook trigger and one code step, with no agent and no model, so a click costs about 4 credits.

- Workflow: `showcase_cta_ping` (`0615de19-4c20-4a61-aed5-1556b3913646`), owned by Michiel. Private, with private runs, because each run stores the request's headers, the trigger key among them.
- Trigger: a webhook that only accepts posts carrying the `x-showcase-key` header. Its URL and key are in Vercel's Production env as `CTA_PING_WEBHOOK_URL` and `CTA_PING_WEBHOOK_KEY`, and nowhere else. Only `api/cta-ping.ts` posts to it.
- Sender: Mark runs a webhook workflow as the person who created the trigger, so the Teams messages come from Michiel's account. Replies to them go to Michiel, not to the visitor.
- Follow-up sheet: [Showcase CTA follow-ups](https://docs.google.com/spreadsheets/d/1ZkyFBynQu4k8UynJmgYhrDmdKlMyJgC7VAQYCHoCnOg/edit), tab `Pings`, in Michiel's Google Drive.

## What the step does

`step.py` is the code on the workflow's one step, copied there as it is. For each click it:

1. Checks the click: its shape, an account page (`/<slug>/`) or person page (`/<company>/<person>/`) on showcase.optimizely.com, and `check`, the SHA-256 of the rest of the click as canonical JSON. If the click changed on its way, nobody is messaged.
2. With an account executive on the page who has an @optimizely.com address, opens a 1:1 Teams chat with them and sends the message. When Teams doesn't know that address (10 of the 168 account executives on pages use a short alias), it finds them in the directory by name, confirmed by the address.
3. Otherwise, or when the message fails, adds a row to the sheet: time (UTC), account (with whose page it was, on a person page), page, button, why it's on the sheet, the team on the page, campaign, ping id, and an empty "Followed up" column for Michiel.

The message reads like this (HTML in Teams):

> (Mark's animated `mark-party` emoji) Mark here! Hi Alex, **someone on the Zürich Versicherung Showcase page just asked to talk to their Optimizely team.**
> They clicked the bar that follows them down the page. The page lists you as the account executive, and it told them we've let you know.
> [Open Zürich Versicherung page](https://showcase.optimizely.com/zurich-versicherung/) · 4 Nov 2026, 23:06 UTC · source: outreach
> Also on the page: Sam Rep (Sales Development Representative)

On a person page the first line reads "someone on the Showcase page we wrote for Ben Yu at Logitech G just asked to talk to their Optimizely team" and the link reads "Open Ben Yu's page".

The emoji is a Teams custom emoji, sent as `<customemoji id="…" alt="mark-party">` (`MARK_EMOJI` in `step.py`). Teams fills in the image from the id when it sends, and the id belongs to the emoji uploaded to Michiel's Teams, so renaming or re-uploading it means reading the new id back from a message that uses it.

When the visitor came in by a personal link (a rep's note to one person, from the page's Share card), the click carries `shared`: the link's code, who it was for (name, title, address) and who sent it. The message then adds **"They came in by the personal link Michiel Dorjee sent to Lena Brunner (Head of Digital, lena.brunner@zurich.example)."**, and a sheet row says the same after the campaign. `fixture-shared.json` is such a click, built by `buildPing` (`scripts/check-share-links.ts` checks that); a click without a link has no `shared` at all, so `fixture.json` is unchanged.

Mark retries a step that raises, four attempts in all. Each side effect leaves a marker in `/workspace` before it happens, so a retry never messages a rep or adds a row twice. Only a failed sheet write raises, because that is the one outcome nobody would otherwise see: the run then shows as failed in Mark's workflow logs.

## Changing it

1. Edit `step.py`. If you change the click itself, change `api/cta-ping.ts` with it, regenerate `fixture.json` and `fixture-shared.json` from `buildPing`, and keep `src/www/__tests__/www.test.tsx`, `scripts/check-share-links.ts` and `test_step.py` agreeing on them.
2. Run the tests (Python 3, no network, Mark's tools stood in):

   ```bash
   npm run check:cta-ping
   ```

3. Paste the new `step.py` into the step in the Mark canvas, or save it with `PUT /agents/workflows/{id}`. Before a change goes live, try it with the step's Run panel. A click whose account executive is Michiel goes to his own Teams notes chat (`48:notes`), which reaches nobody else.

If the Teams or Google connection in Mark expires, the step says so in the sheet ("Mark needs reconnecting") or fails the run. Reconnect Microsoft or Google under Michiel's Mark connectors.
