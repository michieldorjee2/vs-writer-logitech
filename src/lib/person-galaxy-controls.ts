/**
 * TEMPORARY — galaxy waypoint editor.
 *
 * A dev-only panel for dialling in the hero galaxy's scroll choreography by
 * eye instead of by guesswork. Open any person page with `?galaxy=edit`.
 *
 * How it works: pick a waypoint (or capture a new one at wherever you have
 * scrolled to), and the galaxy pins to that pose so the sliders read directly —
 * no damping, no scroll drift, what you set is what you see. "Copy JSON" puts
 * the whole sequence on the clipboard, ready to paste back into WAYPOINTS.
 *
 * Everything is expressed the way you'd describe it out loud: x/y are where on
 * the screen (0.5, 0.5 is dead centre), zoom is how big, speed is how fast it
 * turns. Depth is separate from all of that — pushing the galaxy back changes
 * the perspective without moving it on screen.
 *
 * TO REMOVE: delete this file, the `?galaxy=edit` import in PersonPage.tsx, and
 * the four live-editing exports at the top of person-galaxy.ts. Nothing else
 * references any of it.
 */

import type { Pose, Waypoint } from './person-galaxy';
import { getWaypoints, setWaypoints, setOverride, getScrollProgress } from './person-galaxy';

interface Field {
  key: keyof Pose;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Shown instead of the raw value, e.g. radians as degrees. */
  fmt?: (v: number) => string;
}

const FIELDS: Field[] = [
  { key: 'x', label: 'screen x', min: -0.5, max: 1.5, step: 0.005, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'y', label: 'screen y', min: -0.5, max: 1.5, step: 0.005, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'scale', label: 'zoom', min: 0.2, max: 3.5, step: 0.02, fmt: (v) => `${v.toFixed(2)}×` },
  { key: 'depth', label: 'depth', min: -16, max: -1.5, step: 0.1 },
  { key: 'tilt', label: 'tilt', min: -1.45, max: 0, step: 0.01, fmt: (v) => `${Math.round((v * 180) / Math.PI)}°` },
  { key: 'roll', label: 'roll', min: -1, max: 1, step: 0.01, fmt: (v) => `${Math.round((v * 180) / Math.PI)}°` },
  { key: 'opacity', label: 'brightness', min: 0, max: 1.6, step: 0.02 },
  { key: 'spin', label: 'speed', min: 0, max: 6, step: 0.05, fmt: (v) => `${v.toFixed(2)}×` },
];

let root: HTMLDivElement | null = null;
let raf = 0;

const css = (el: HTMLElement, s: Partial<CSSStyleDeclaration>) => Object.assign(el.style, s);

export function initGalaxyControls(): void {
  if (root) return;

  let points = getWaypoints();
  let selected = 0;

  root = document.createElement('div');
  css(root, {
    position: 'fixed', top: '12px', right: '12px', zIndex: '99999',
    width: '286px', maxHeight: 'calc(100vh - 24px)', overflowY: 'auto',
    background: 'rgba(6,20,14,0.94)', backdropFilter: 'blur(10px)',
    border: '1px solid rgba(171,255,68,0.28)', borderRadius: '12px',
    padding: '12px', color: '#eff6e9', fontSize: '11px', lineHeight: '1.45',
    fontFamily: 'ui-monospace, "Roboto Mono", Menlo, monospace',
    boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
  });
  // The panel sits over a scroll-driven scene; don't let wheel events on it
  // scroll the page underneath and move the very thing you're aiming.
  root.addEventListener('wheel', (e) => e.stopPropagation());

  const h = document.createElement('div');
  css(h, { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' });
  h.innerHTML = '<strong style="color:#abff44;letter-spacing:.08em">GALAXY WAYPOINTS</strong>';
  root.appendChild(h);

  const readout = document.createElement('div');
  css(readout, { color: '#a1ac8d', marginBottom: '8px' });
  root.appendChild(readout);

  const list = document.createElement('div');
  css(list, { display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '10px' });
  root.appendChild(list);

  const sliders = document.createElement('div');
  root.appendChild(sliders);

  const btnRow = (...kids: HTMLElement[]) => {
    const r = document.createElement('div');
    css(r, { display: 'flex', gap: '6px', marginTop: '10px' });
    kids.forEach((k) => r.appendChild(k));
    return r;
  };
  const button = (label: string, onClick: () => void, accent = false) => {
    const b = document.createElement('button');
    b.textContent = label;
    css(b, {
      flex: '1', cursor: 'pointer', padding: '6px 4px', borderRadius: '7px',
      border: '1px solid ' + (accent ? 'rgba(171,255,68,.5)' : 'rgba(255,255,255,.16)'),
      background: accent ? 'rgba(171,255,68,.16)' : 'rgba(255,255,255,.05)',
      color: accent ? '#abff44' : '#eff6e9', font: 'inherit',
    });
    b.onclick = onClick;
    return b;
  };

  /** Scroll the document to a waypoint's `at`, so you see it in context. */
  const scrollTo = (at: number) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    window.scrollTo({ top: Math.round(max * at), behavior: 'smooth' });
  };

  const apply = () => {
    setWaypoints(points);
    setOverride(points[selected] ?? null);
  };

  const renderList = () => {
    list.textContent = '';
    points.forEach((w, i) => {
      const chip = document.createElement('button');
      chip.textContent = `${Math.round(w.at * 100)}%`;
      css(chip, {
        cursor: 'pointer', padding: '3px 7px', borderRadius: '6px', font: 'inherit',
        border: '1px solid ' + (i === selected ? 'rgba(171,255,68,.6)' : 'rgba(255,255,255,.14)'),
        background: i === selected ? 'rgba(171,255,68,.2)' : 'rgba(255,255,255,.04)',
        color: i === selected ? '#abff44' : '#d8e4cb',
      });
      chip.onclick = () => { selected = i; scrollTo(w.at); renderList(); renderSliders(); apply(); };
      list.appendChild(chip);
    });
  };

  const renderSliders = () => {
    sliders.textContent = '';
    const w = points[selected];
    if (!w) return;

    // `at` is editable too, so a waypoint can be moved up or down the page.
    const rows: Array<{ label: string; get: () => number; set: (v: number) => void; min: number; max: number; step: number; fmt?: (v: number) => string }> = [
      {
        label: 'at (scroll)', min: 0, max: 1, step: 0.005,
        get: () => w.at, set: (v) => { w.at = v; },
        fmt: (v) => `${Math.round(v * 100)}%`,
      },
      ...FIELDS.map((f) => ({
        label: f.label, min: f.min, max: f.max, step: f.step, fmt: f.fmt,
        get: () => w[f.key], set: (v: number) => { w[f.key] = v; },
      })),
    ];

    for (const r of rows) {
      const wrap = document.createElement('label');
      css(wrap, { display: 'block', marginBottom: '6px' });
      const top = document.createElement('div');
      css(top, { display: 'flex', justifyContent: 'space-between', color: '#a1ac8d' });
      const val = document.createElement('span');
      css(val, { color: '#eff6e9' });
      const show = () => { val.textContent = r.fmt ? r.fmt(r.get()) : r.get().toFixed(2); };
      top.innerHTML = `<span>${r.label}</span>`;
      top.appendChild(val);
      show();

      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(r.min);
      input.max = String(r.max);
      input.step = String(r.step);
      input.value = String(r.get());
      css(input, { width: '100%', accentColor: '#abff44' });
      input.oninput = () => {
        r.set(parseFloat(input.value));
        show();
        // Re-sort on `at` changes so the sequence stays ordered as you drag.
        const cur = points[selected];
        points.sort((m, n) => m.at - n.at);
        selected = points.indexOf(cur);
        apply();
        renderList();
      };

      wrap.appendChild(top);
      wrap.appendChild(input);
      sliders.appendChild(wrap);
    }
  };

  const capture = button('+ capture here', () => {
    const at = +getScrollProgress().toFixed(3);
    const base = points[selected] ?? points[0];
    const next: Waypoint = { ...base, at };
    points.push(next);
    points.sort((a, b) => a.at - b.at);
    selected = points.indexOf(next);
    apply();
    renderList();
    renderSliders();
  });

  const del = button('delete', () => {
    if (points.length <= 2) return; // two is the minimum for an interpolation
    points.splice(selected, 1);
    selected = Math.max(0, selected - 1);
    apply();
    renderList();
    renderSliders();
  });

  const live = button('release (live scroll)', () => {
    setOverride(null);
  });

  const copy = button('copy JSON', async () => {
    const json =
      '[\n' +
      points
        .map(
          (w) =>
            `  { at: ${w.at.toFixed(3)}, x: ${w.x.toFixed(3)}, y: ${w.y.toFixed(3)}, ` +
            `depth: ${w.depth.toFixed(2)}, scale: ${w.scale.toFixed(2)}, ` +
            `tilt: ${w.tilt.toFixed(3)}, roll: ${w.roll.toFixed(3)}, ` +
            `opacity: ${w.opacity.toFixed(2)}, spin: ${w.spin.toFixed(2)} },`,
        )
        .join('\n') +
      '\n]';
    try {
      await navigator.clipboard.writeText(json);
      copy.textContent = 'copied ✓';
      setTimeout(() => { copy.textContent = 'copy JSON'; }, 1400);
    } catch {
      copy.textContent = 'see console';
      setTimeout(() => { copy.textContent = 'copy JSON'; }, 1400);
    }
    // Always log as well — the clipboard needs a focused document and this is
    // the copy you can actually paste to me.
    console.log('%c GALAXY WAYPOINTS ', 'background:#abff44;color:#08251a', '\n' + json);
  }, true);

  root.appendChild(btnRow(capture, del));
  root.appendChild(btnRow(live));
  root.appendChild(btnRow(copy));

  const hint = document.createElement('div');
  css(hint, { marginTop: '8px', color: '#717863', fontSize: '10px' });
  hint.textContent = 'Selecting a waypoint pins the galaxy to it. Release to watch it play through on scroll.';
  root.appendChild(hint);

  document.body.appendChild(root);

  renderList();
  renderSliders();
  apply();

  const tick = () => {
    raf = requestAnimationFrame(tick);
    readout.textContent = `scroll ${Math.round(getScrollProgress() * 100)}%  ·  ${points.length} waypoints`;
  };
  tick();
}

export function cleanupGalaxyControls(): void {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  setOverride(null);
  root?.remove();
  root = null;
}
