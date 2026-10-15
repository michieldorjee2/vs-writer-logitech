/**
 * /login — where sign-in failures and sign-outs land.
 *
 * Signing in itself never stops here: /search and the sidebar go straight to
 * Opti ID through the wiki (api/_lib/auth.ts), and with a live Okta session the
 * whole round trip needs no click. This page exists for the cases that cannot
 * loop back on their own — a refused or expired sign-in, and signing out (which
 * would otherwise sign the person straight back in).
 *
 * Plain HTML with no app bundle: the SPA's catch-all would read "login" as a
 * company slug.
 */

const MESSAGES: Record<string, { title: string; body: string }> = {
  signed_out: {
    title: "You're signed out",
    body: 'Signing in again may not ask for anything: Optimizely remembers you for a while after you leave.',
  },
  expired: {
    title: 'That sign-in expired',
    body: 'It took longer than a couple of minutes, or it was finished in another browser. Try again.',
  },
  invalid: {
    title: "That sign-in couldn't be checked",
    body: 'Try again. If it keeps happening, tell the Showcase team.',
  },
  not_optimizely: {
    title: 'Showcase tools are for Optimizely people',
    body: 'You signed in with an account outside optimizely.com. These tools publish pages for Optimizely, so they need an Optimizely account.',
  },
  unavailable: {
    title: "Sign-in isn't set up here",
    body: "This deployment can't sign anyone in. Use showcase.optimizely.com.",
  },
};

const DEFAULT_MESSAGE = {
  title: 'Sign in to Showcase',
  body: 'Search, X-ray and Edit are for Optimizely people. Sign in with your Optimizely account.',
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderLoginPage({ reason, signInHref }: { reason: string | null; signInHref: string }): string {
  const message = (reason && MESSAGES[reason]) || DEFAULT_MESSAGE;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<title>Sign in · Optimizely Showcase</title>
<style>
@font-face{font-family:'VC Nudge';src:url('/fonts/vc-nudge/NudgeSemiNormal-SemiNormalExtraBold.woff2') format('woff2');font-weight:800;font-display:swap}
@font-face{font-family:'Die Grotesk B';src:url('/fonts/die-grotesk/die-grotesk-b-regular.woff2') format('woff2');font-weight:400;font-display:swap}
@font-face{font-family:'Die Grotesk B';src:url('/fonts/die-grotesk/die-grotesk-b-bold.woff2') format('woff2');font-weight:700;font-display:swap}
:root{--bg:#08251a;--fg:#eff6e9;--muted:#c3ceaf;--accent:#abff44;--border:rgba(171,255,68,.14)}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%;background:var(--bg);color:var(--fg)}
body{min-height:100vh;display:grid;place-items:center;padding:24px 16px;
  font:16px/1.55 'Die Grotesk B',ui-sans-serif,system-ui,-apple-system,sans-serif;
  background:radial-gradient(circle at 50% 42%,rgba(171,255,68,.12),transparent 55%),var(--bg)}
main{width:100%;max-width:420px;text-align:center}
img{height:34px;width:auto;margin-bottom:40px}
h1{font-family:'VC Nudge','Die Grotesk B',ui-sans-serif,sans-serif;font-weight:800;font-size:clamp(1.9rem,4vw,2.4rem);
  line-height:1.08;letter-spacing:-.02em;margin:0 0 14px;text-wrap:balance}
p{color:var(--muted);margin:0 auto 32px;max-width:34ch;text-wrap:pretty}
a.btn{display:inline-flex;align-items:center;gap:10px;height:52px;padding:0 24px;border-radius:14px;
  border:2px solid var(--accent);background:var(--accent);color:#08251a;font-weight:700;font-size:15px;
  text-decoration:none;box-shadow:4px 4px 0 rgba(171,255,68,.28);transition:transform .15s,box-shadow .15s}
a.btn:hover{transform:translate(-1px,-1px);box-shadow:5px 5px 0 rgba(171,255,68,.34)}
a.btn:focus-visible{outline:2px solid var(--fg);outline-offset:3px}
</style>
</head>
<body>
<main>
<img src="/optimizely-logo.svg" alt="Optimizely" />
<h1>${escapeHtml(message.title)}</h1>
<p>${escapeHtml(message.body)}</p>
<a class="btn" href="${escapeHtml(signInHref)}">Log in with Optimizely</a>
</main>
</body>
</html>`;
}
