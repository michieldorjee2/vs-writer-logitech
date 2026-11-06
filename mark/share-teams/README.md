# Showcase share to Teams (Mark workflow)

When a rep presses **Send on Teams** on a Showcase page's Share card, Mark's **Showcase share to Teams** workflow messages that rep the page's link, with their personal link and note when they made one, and what the page has seen. It is a webhook trigger and one code step, with no agent and no model, so a message costs about 4 credits.

- Workflow: `showcase_share_teams` (`dfaa30dc-53a1-4123-a672-9c25211955c6`), owned by Michiel. Private, with private runs, because each run stores the request's headers, the trigger key among them.
- Trigger: a webhook (`d2bade82-daaf-43d8-a37a-c1053a45c9bb`) that only accepts posts carrying the `x-showcase-key` header. Its URL and key are in Vercel as `SHARE_TEAMS_WEBHOOK_URL` and `SHARE_TEAMS_WEBHOOK_KEY`, on `feat/admin-analytics` previews for now. Only `api/share-send.ts` posts to it.
- Sender: Mark runs a webhook workflow as the person who created the trigger, so the messages come from Michiel's account. Michiel's own requests go to his Teams notes chat (`48:notes`); anyone else's open a 1:1 chat between them and Michiel.

## What the step does

`step.py` is the code on the workflow's one step, copied there as it is. For each request it:

1. Checks it: the shape, a Showcase page (showcase.optimizely.com, or a preview of it), an @optimizely.com address in `to`, and `check`, the SHA-256 of the rest of the request as canonical JSON. If the request changed on its way, nobody is messaged.
2. Messages `to`, and only `to`: the server sets it to the signed-in rep, never to an address the browser named.

The message (HTML in Teams):

> Hi Michiel, here's the link to **Zürich Versicherung**, with your note.
> https://showcase.optimizely.com/s/Ab3dE9xY
> > **For Lena Brunner, Head of Digital** Hi Lena, great to meet you at Opticon…
> | Your link | opened 2 times, last 7 Nov 2026 |
> | From your link | 1 CTA click |
> | Visits | 12 visits by 4 people |
> | Last seen | 7 Nov 2026 |
> | CTA clicks | 1 |
> | Stage | Prospect |
> Open the page with your tools for the whole report.

The numbers are the Report's last build when the rail asked for one in the last five minutes (account pages); without one, or on a person page, the message has the link's numbers only.

Mark retries a step that raises, four attempts in all. The Teams marker in `/workspace` is written before the message goes, so a retry never sends twice; a failed send raises, so the run shows as failed in Mark's workflow logs.

## Changing it

1. Edit `step.py`. If you change the request, change `buildShareTeams` in `api/share-send.ts` with it and regenerate `fixture.json` (`scripts/check-share-links.ts` holds them equal).
2. Run the tests (Python 3, no network, Teams stood in):

   ```bash
   npm run check:share-teams
   ```

3. Save the new `step.py` to the step with `PUT /agents/workflows/{id}` (keep `private_executions`), or paste it into the step in the Mark canvas. The step's Run panel runs it for real: a request whose `to` is Michiel goes to his own notes chat.
