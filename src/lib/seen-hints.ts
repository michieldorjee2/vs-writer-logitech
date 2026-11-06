/*
 * Which "New" hints this browser has had enough of: a hint shows on a rep's
 * first few visits, until they use what it points at. Kept per browser
 * (localStorage), which can be empty or refuse (a private window, blocked site
 * data): then the hint just shows, as on a first visit.
 */
const KEY = 'showcase-hints-v1';
/** A hint shows on this many visits at most. */
const MAX_SHOWS = 3;

type Seen = Record<string, number>;

function read(): Seen {
  try {
    const raw = window.localStorage.getItem(KEY);
    const value = raw ? (JSON.parse(raw) as unknown) : null;
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Seen) : {};
  } catch {
    return {};
  }
}

function write(seen: Seen) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(seen));
  } catch {
    /* Not kept: the hint shows again next time. */
  }
}

/* This visit's answer per hint: asked again (React runs effects twice in development, a
   component can mount twice), it is the same answer and the visit is counted once. */
const thisVisit = new Map<string, boolean>();

/** Whether to show the hint on this visit; counts the visit when it does. */
export function takeHint(name: string): boolean {
  const known = thisVisit.get(name);
  if (known !== undefined) return known;
  const seen = read();
  const shown = Number(seen[name]) || 0;
  const show = shown < MAX_SHOWS;
  if (show) write({ ...seen, [name]: shown + 1 });
  thisVisit.set(name, show);
  return show;
}

/** The rep used the thing: its hint never shows again. */
export function doneWithHint(name: string) {
  thisVisit.set(name, false);
  const seen = read();
  if ((Number(seen[name]) || 0) >= MAX_SHOWS) return;
  write({ ...seen, [name]: MAX_SHOWS });
}
