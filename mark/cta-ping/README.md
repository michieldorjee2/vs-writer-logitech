# Showcase CTA ping (Mark workflow)

When a visitor clicks "talk to your team" on a Showcase account page, Mark's **Showcase CTA ping** workflow tells the account team. It is a webhook trigger and one code step, with no agent and no model, so a click costs about 4 credits.

- Workflow: `showcase_cta_ping` (`0615de19-4c20-4a61-aed5-1556b3913646`), owned by Michiel. Private, with private runs, because each run stores the request's headers, the trigger key among them.
- Trigger: a webhook that only accepts posts carrying the `x-showcase-key` header. Its URL and key are in Vercel's Production env as `CTA_PING_WEBHOOK_URL` and `CTA_PING_WEBHOOK_KEY`, and nowhere else. Only `api/cta-ping.ts` posts to it.
- Sender: Mark runs a webhook workflow as the person who created the trigger, so the Teams messages come from Michiel's account. Replies to them go to Michiel, not to the visitor.
- Follow-up sheet: [Showcase CTA follow-ups](https://docs.google.com/spreadsheets/d/1ZkyFBynQu4k8UynJmgYhrDmdKlMyJgC7VAQYCHoCnOg/edit), tab `Pings`, in Michiel's Google Drive.

## What the step does

`step.py` is the code on the workflow's one step, copied there as it is. For each click it:

1. Checks the click: its shape, an account page on showcase.optimizely.com, and `check`, the SHA-256 of the rest of the click as canonical JSON. If the click changed on its way, nobody is messaged.
2. With an account executive on the page who has an @optimizely.com address, opens a 1:1 Teams chat with them and sends the message. When Teams doesn't know that address (10 of the 168 account executives on pages use a short alias), it finds them in the directory by name, confirmed by the address.
3. Otherwise, or when the message fails, adds a row to the sheet: time (UTC), account, page, button, why it's on the sheet, the team on the page, campaign, ping id, and an empty "Followed up" column for Michiel.

The message reads like this (HTML in Teams):

> Hi Alex, **someone on the Zürich Versicherung Showcase page just asked to talk to their Optimizely team.**
> They clicked the bar that follows them down the page. The page lists you as the account executive, and it told them we've let you know.
> https://showcase.optimizely.com/zurich-versicherung/ · 4 Nov 2026, 23:06 UTC · source: outreach
> Also on the page: Sam Rep (Sales Development Representative)
> *Sent automatically by Showcase from Michiel's account. The visitor doesn't see this chat.*

Mark retries a step that raises, four attempts in all. Each side effect leaves a marker in `/workspace` before it happens, so a retry never messages a rep or adds a row twice. Only a failed sheet write raises, because that is the one outcome nobody would otherwise see: the run then shows as failed in Mark's workflow logs.

## Changing it

1. Edit `step.py`. If you change the click itself, change `api/cta-ping.ts` with it, regenerate `fixture.json` from `buildPing`, and keep `src/www/__tests__/www.test.tsx` and `test_step.py` agreeing on it.
2. Run the tests (Python 3, no network, Mark's tools stood in):

   ```bash
   npm run check:cta-ping
   ```

3. Paste the new `step.py` into the step in the Mark canvas, or save it with `PUT /agents/workflows/{id}`. Before a change goes live, try it with the step's Run panel. A click whose account executive is Michiel goes to his own Teams notes chat (`48:notes`), which reaches nobody else.

If the Teams or Google connection in Mark expires, the step says so in the sheet ("Mark needs reconnecting") or fails the run. Reconnect Microsoft or Google under Michiel's Mark connectors.
