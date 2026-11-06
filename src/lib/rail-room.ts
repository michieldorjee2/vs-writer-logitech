/**
 * The booth rail's room, made before the first paint on a page opened from the search page with
 * the rail open (src/lib/view-transitions-boot.js adds `vt-rail-room` to <html>; the padding is in
 * src/styles/view-transitions.css). The page's parts then land, at the end of the view transition,
 * where they stay. The rail (FloatingSidebar.tsx) mounts later, slides into that room and takes it
 * over with its own class (booth-page--rail); a page that gets no rail gives the room back.
 */
export const RAIL_ROOM = 'vt-rail-room';

/** Whether the room was made for the rail, read as the rail mounts. */
export function railRoomMade(): boolean {
  return typeof document !== 'undefined' && document.documentElement.classList.contains(RAIL_ROOM);
}

/**
 * The rail holds the room now (or there is no rail): the boot script's class goes, and its stand-in
 * for the rail's ground (`.vt-rail-shell`) after `shellAfterMs`, once the rail has slid over it.
 */
export function dropRailRoom(shellAfterMs = 0): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.remove(RAIL_ROOM);
  const shell = document.querySelector('.vt-rail-shell');
  if (!shell) return;
  if (shellAfterMs > 0) window.setTimeout(() => shell.remove(), shellAfterMs);
  else shell.remove();
}
