import type { LivePlanState } from '../lib/limitless/use-live-plan';

/**
 * The loading and error states shared by the two preview routes.
 *
 * The error says different things depending on who is reading it. On a local
 * dev server it names the URL that failed and the variable that moves it —
 * "failed to fetch" with no URL sends you looking in the wrong place. Anywhere
 * else it says only that the preview needs a service that is not reachable from
 * here: these routes are deployed to a public host, and a visitor has no use
 * for a port number, a repo name or a path on someone's laptop.
 */
export default function LivePlanStatus({
  state,
  accountId,
  fallbackHint,
}: {
  state: Extract<LivePlanState, { status: 'loading' } | { status: 'error' }>;
  accountId: string | undefined;
  /** What the reader can do instead, when there is an alternative. */
  fallbackHint?: string;
}) {
  if (state.status === 'loading') {
    return (
      <div style={{ padding: 48, fontFamily: 'monospace' }}>
        Resolving the plan for <strong>{accountId}</strong>&hellip;
      </div>
    );
  }

  return (
    <div style={{ padding: 48, fontFamily: 'monospace', color: '#b00', lineHeight: 1.6 }}>
      Could not resolve a plan for <strong>{accountId}</strong>.
      <br />
      <br />
      {import.meta.env.DEV ? (
        <>
          {state.message} (tried <code>{state.url}</code>). Is aldus-ui running? Start it with{' '}
          <code>npm run dev</code> and point <code>VITE_INTELLIGENCE_API_URL</code> at the port it
          bound.
        </>
      ) : (
        <>This preview needs the Limitless planning service, which is not reachable from here.</>
      )}
      {fallbackHint && (
        <>
          <br />
          <br />
          {fallbackHint}
        </>
      )}
    </div>
  );
}
