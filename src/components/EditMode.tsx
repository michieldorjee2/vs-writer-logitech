import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import type { CompetitorComparisonPage } from '../lib/graph-types';
import {
  ABM_XRAY_DEFAULTS,
  DYNAMIC_XRAY_DEFAULTS,
  PERSON_XRAY_DEFAULTS,
  resolveXraySections,
  type XraySectionInfo,
} from '../lib/xray-defaults';
import { deriveCustomerName, getPageSlug } from '../lib/page-identity';
import { isValidOptimizelyEmail, loadStoredEmail, saveStoredEmail } from '../lib/stored-email';
import { streamEdit, editKind, type EditKind } from '../lib/opal-edit-stream';
import { animateSectionEdit } from '../lib/inplace-edit';
import '../styles/edit-mode.css';

interface Props {
  active: boolean;
  onClose: () => void;
  /**
   * Fired exactly once after the feedback webhook resolves (success or
   * failure — the user has already let go of the page either way).
   * The parent uses this to start the "Working…" countdown on the
   * Edit sidebar button.
   */
  onSent?: () => void;
  page: CompetitorComparisonPage;
  variant: 'abm' | 'dynamic' | 'person';
}

type DocSize = { w: number; h: number };
type OutlineBox = { left: number; top: number; width: number; height: number };

const OUTLINE_PADDING = 14;
const OUTLINE_RADIUS = 10;
const POPUP_WIDTH = 340;
const POPUP_GAP = 14;
const DOC_MARGIN = 16;

/* Live edit-mode streams the account_page_live_edit agent and animates
 * its thinking + edits on the page, then commits once. (The old
 * fire-and-forget webhook lived at /api/opal-feedback.) */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type AppliedEdit = {
  id: number;
  section: string;
  target?: string;
  kind: EditKind;
  status: 'applied' | 'skipped';
  reason?: string;
  old?: string;
  newText?: string;
};
type ActiveCard = {
  sectionId: string | null;
  section: string;
  target?: string;
  kind: EditKind;
  old?: string;
  newText?: string;
  key: number;
};

/* Wait for Opal's republish to land by polling the same /api/edit-status
 * ping the sidebar uses: when the page's Graph `published` timestamp moves
 * past the baseline we captured at submit, the edit is live (and the
 * endpoint has already purged the edge cache). Resolves true on change,
 * false on timeout/abort. */
async function waitForRepublish(
  key: string,
  since: string,
  signal: AbortSignal,
  deadlineMs = 120_000,
): Promise<boolean> {
  const end = Date.now() + deadlineMs;
  await sleep(1500);
  while (Date.now() < end && !signal.aborted) {
    try {
      const qs = `key=${encodeURIComponent(key)}&since=${encodeURIComponent(since)}`;
      const res = await fetch(`/api/edit-status?${qs}`, { cache: 'no-store', signal });
      if (res.ok) {
        const data = (await res.json()) as { changed?: boolean };
        if (data?.changed) return true;
      }
    } catch {
      /* network blip — retry */
    }
    await sleep(2500);
  }
  return false;
}

function getDocSize(): DocSize {
  if (typeof window === 'undefined') return { w: 1280, h: 720 };
  const doc = document.documentElement;
  return {
    w: Math.max(doc.scrollWidth, doc.clientWidth),
    h: Math.max(doc.scrollHeight, doc.clientHeight),
  };
}

function buildOutlineFromElements(els: Element[]): OutlineBox | null {
  let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity;
  for (const el of els) {
    const r = (el as HTMLElement).getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    minLeft = Math.min(minLeft, r.left);
    minTop = Math.min(minTop, r.top);
    maxRight = Math.max(maxRight, r.right);
    maxBottom = Math.max(maxBottom, r.bottom);
  }
  if (minLeft === Infinity) return null;
  const scrollX = window.scrollX || window.pageXOffset || 0;
  const scrollY = window.scrollY || window.pageYOffset || 0;
  return {
    left: minLeft + scrollX - OUTLINE_PADDING,
    top: minTop + scrollY - OUTLINE_PADDING,
    width: maxRight - minLeft + 2 * OUTLINE_PADDING,
    height: maxBottom - minTop + 2 * OUTLINE_PADDING,
  };
}

/** Pick the best popup placement: prefer to the right, then left, then below, then above. */
function placePopup(
  outline: OutlineBox,
  doc: DocSize,
  popupH: number,
): { left: number; top: number } {
  const m = DOC_MARGIN;
  const cw = POPUP_WIDTH;

  // Right side
  const rightX = outline.left + outline.width + POPUP_GAP;
  if (rightX + cw + m <= doc.w) {
    const top = clamp(outline.top + Math.max(0, (outline.height - popupH) / 2), m, doc.h - popupH - m);
    return { left: rightX, top };
  }

  // Left side
  const leftX = outline.left - cw - POPUP_GAP;
  if (leftX >= m) {
    const top = clamp(outline.top + Math.max(0, (outline.height - popupH) / 2), m, doc.h - popupH - m);
    return { left: leftX, top };
  }

  // Below — right-align so the corner stays anchored
  const belowTop = outline.top + outline.height + POPUP_GAP;
  if (belowTop + popupH + m <= doc.h) {
    const left = clamp(outline.left + outline.width - cw, m, doc.w - cw - m);
    return { left, top: belowTop };
  }

  // Above
  const aboveTop = outline.top - popupH - POPUP_GAP;
  const left = clamp(outline.left + outline.width - cw, m, doc.w - cw - m);
  return { left, top: Math.max(m, aboveTop) };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/* `getPageSlug` and `deriveCustomerName` live in lib/page-identity so
 * the sticky CTA, edit-mode webhook, and any future consumer all
 * agree on the answer for a given page. */

type Phase = 'editing' | 'working' | 'thanks';

function EditMode({ active, onClose, onSent, page, variant }: Props) {
  const defaults =
    variant === 'abm' ? ABM_XRAY_DEFAULTS
      : variant === 'person' ? PERSON_XRAY_DEFAULTS
        : DYNAMIC_XRAY_DEFAULTS;
  const sections = useMemo(
    () => resolveXraySections(defaults, page.xraySections),
    [defaults, page.xraySections],
  );

  const [phase, setPhase] = useState<Phase>('editing');
  const [outlines, setOutlines] = useState<Array<{ section: XraySectionInfo; box: OutlineBox }>>([]);
  const [docSize, setDocSize] = useState<DocSize>({ w: 0, h: 0 });

  // Email state
  const [email, setEmail] = useState<string>('');
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  /** Tracks whether the *currently open* modal is the first-time-prompt
   *  (cancel = exit mode) or an edit (cancel = just close modal). */
  const emailModalIsBlocking = useRef(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Comments — keyed by section id
  const [comments, setComments] = useState<Record<string, string>>({});

  // Open comment popup for a single section at a time
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [draftComment, setDraftComment] = useState('');
  const [popupHeight, setPopupHeight] = useState(220);
  const popupRef = useRef<HTMLDivElement | null>(null);

  // Refs the rAF loop reads + writes
  const elementsRef = useRef<Array<{ section: XraySectionInfo; els: Element[] }>>([]);
  const rectRefs = useRef<Map<string, SVGRectElement | null>>(new Map());
  const docSizeRef = useRef<DocSize>({ w: 0, h: 0 });

  const sendError = useRef<string | null>(null);

  /* ---- Live edit-stream state (the on-page animation) ---- */
  const [liveStatus, setLiveStatus] = useState('');
  const [liveSummary, setLiveSummary] = useState('');
  const [focusSectionId, setFocusSectionId] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<ActiveCard | null>(null);
  const [applied, setApplied] = useState<AppliedEdit[]>([]);
  const [liveDone, setLiveDone] = useState<{ changes?: string[]; skipped?: string[] } | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [willReload, setWillReload] = useState(false);
  const liveAbort = useRef<AbortController | null>(null);

  /** Match an agent's section name to one of our x-ray sections. The send
   *  payload labels each comment "Section: <title>", so the agent usually
   *  echoes a title; fall back to a fuzzy contains match. */
  const matchSectionId = useCallback(
    (name?: string): string | null => {
      if (!name) return null;
      const k = name.toLowerCase().trim();
      for (const s of sections) if (s.title.toLowerCase().trim() === k) return s.id;
      for (const s of sections) {
        const t = s.title.toLowerCase();
        if (t.includes(k) || k.includes(t)) return s.id;
      }
      return null;
    },
    [sections],
  );

  const scrollToSection = useCallback((id: string | null) => {
    if (!id) return;
    const entry = elementsRef.current.find((x) => x.section.id === id);
    const el = entry?.els[0] as HTMLElement | undefined;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  /* ---- Lifecycle: opening / closing the mode ---- */
  useEffect(() => {
    if (!active) {
      setPhase('editing');
      setOutlines([]);
      setComments({});
      setActiveSection(null);
      setEmailModalOpen(false);
      setEmailError(null);
      liveAbort.current?.abort();
      liveAbort.current = null;
      setLiveStatus('');
      setLiveSummary('');
      setFocusSectionId(null);
      setActiveCard(null);
      setApplied([]);
      setLiveDone(null);
      setLiveError(null);
      setWillReload(false);
      document.body.classList.remove('edit-active');
      return;
    }

    document.body.classList.add('edit-active');

    // Decide: stored email? jump straight in. Otherwise open the blocking modal.
    const stored = loadStoredEmail();
    if (stored) {
      setEmail(stored);
      setEmailModalOpen(false);
    } else {
      setEmailDraft('');
      emailModalIsBlocking.current = true;
      setEmailModalOpen(true);
    }
  }, [active]);

  /* ---- Measure sections once active + whenever doc geometry shifts ---- */
  useLayoutEffect(() => {
    if (!active) return;

    const ds = getDocSize();
    setDocSize(ds);
    docSizeRef.current = ds;

    const matched: typeof elementsRef.current = [];
    const initialOutlines: Array<{ section: XraySectionInfo; box: OutlineBox }> = [];

    for (const s of sections) {
      let nodes: NodeListOf<Element>;
      try { nodes = document.querySelectorAll(s.selector); } catch { continue; }
      if (nodes.length === 0) continue;
      const box = buildOutlineFromElements(Array.from(nodes));
      if (!box) continue;
      matched.push({ section: s, els: Array.from(nodes) });
      initialOutlines.push({ section: s, box });
    }
    elementsRef.current = matched;
    setOutlines(initialOutlines);

    const onResize = () => {
      const ds2 = getDocSize();
      setDocSize(ds2);
      docSizeRef.current = ds2;
    };
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(document.body);
    ro.observe(document.documentElement);

    return () => {
      window.removeEventListener('resize', onResize);
      ro.disconnect();
    };
  }, [active, sections]);

  /* ---- rAF loop: re-measure each frame so boxes stay glued through
   *      lazy-image loads, GSAP animations, scroll-driven shifts. */
  useEffect(() => {
    if (!active || elementsRef.current.length === 0) return;

    let raf = 0;
    let running = true;

    type Last = { l: number; t: number; w: number; h: number };
    const lastBox = new Map<string, Last>();

    const tick = () => {
      if (!running) return;
      const elems = elementsRef.current;

      for (const e of elems) {
        const rect = rectRefs.current.get(e.section.id);
        if (!rect) continue;
        const o = buildOutlineFromElements(e.els);
        if (!o) continue;
        const last = lastBox.get(e.section.id);
        if (!last || last.l !== o.left || last.t !== o.top || last.w !== o.width || last.h !== o.height) {
          rect.setAttribute('x', String(o.left));
          rect.setAttribute('y', String(o.top));
          rect.setAttribute('width', String(o.width));
          rect.setAttribute('height', String(o.height));
          lastBox.set(e.section.id, { l: o.left, t: o.top, w: o.width, h: o.height });
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [active, outlines]);

  /* ---- Track popup height for accurate placement ---- */
  useLayoutEffect(() => {
    if (!activeSection || !popupRef.current) return;
    setPopupHeight(popupRef.current.offsetHeight);
  }, [activeSection, draftComment]);

  /* ---- Auto-scroll the popup into view when it opens ---- */
  useEffect(() => {
    if (!activeSection || !popupRef.current) return;
    const r = popupRef.current.getBoundingClientRect();
    const margin = 80; // keep clear of the top hud
    const belowFold = r.bottom > window.innerHeight - 24;
    const aboveFold = r.top < margin;
    if (belowFold || aboveFold) {
      const target = window.scrollY + r.top - margin;
      window.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
    }
  }, [activeSection]);

  /* ---- Focus the email input when the modal opens ---- */
  useEffect(() => {
    if (emailModalOpen) {
      const t = setTimeout(() => emailInputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [emailModalOpen]);

  /* ---- ESC handling: prefer to close popup → email modal → exit mode ---- */
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (activeSection) {
        setActiveSection(null);
        return;
      }
      if (emailModalOpen) {
        cancelEmailModal();
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, emailModalOpen, activeSection, onClose]);

  /* ---- Email modal handlers ---- */
  const openEmailEdit = useCallback(() => {
    setEmailDraft(email);
    setEmailError(null);
    emailModalIsBlocking.current = false;
    setEmailModalOpen(true);
  }, [email]);

  const cancelEmailModal = useCallback(() => {
    setEmailModalOpen(false);
    if (emailModalIsBlocking.current && !email) {
      // First-time entry, no email committed → exit mode entirely
      onClose();
    }
  }, [email, onClose]);

  const commitEmail = useCallback(() => {
    const trimmed = emailDraft.trim();
    if (!isValidOptimizelyEmail(trimmed)) {
      setEmailError('Please enter a valid @optimizely.com email');
      return;
    }
    setEmail(trimmed);
    saveStoredEmail(trimmed);
    setEmailModalOpen(false);
    setEmailError(null);
    emailModalIsBlocking.current = false;
  }, [emailDraft]);

  /* ---- Comment popup handlers ---- */
  const openCommentForSection = useCallback((sectionId: string) => {
    setDraftComment(comments[sectionId] || '');
    setActiveSection(sectionId);
  }, [comments]);

  const saveComment = useCallback(() => {
    if (!activeSection) return;
    const text = draftComment.trim();
    setComments((prev) => {
      const next = { ...prev };
      if (text) next[activeSection] = text;
      else delete next[activeSection];
      return next;
    });
    setActiveSection(null);
    setDraftComment('');
  }, [activeSection, draftComment]);

  const deleteComment = useCallback(() => {
    if (!activeSection) return;
    setComments((prev) => {
      const next = { ...prev };
      delete next[activeSection];
      return next;
    });
    setActiveSection(null);
    setDraftComment('');
  }, [activeSection]);

  /* ---- Send-feedback handler ----
   *
   * One webhook call per submission, regardless of how many sections
   * the user commented on. Section comments are concatenated into a
   * single `suggested_edit` block, separated with `---` rules so the
   * agent can split them back apart on its end. */
  const send = useCallback(async () => {
    const entries = Object.entries(comments);
    if (entries.length === 0 || !email) return;

    sendError.current = null;
    setActiveSection(null);
    setLiveStatus('Connecting to Opal…');
    setLiveSummary('');
    setFocusSectionId(null);
    setActiveCard(null);
    setApplied([]);
    setLiveDone(null);
    setLiveError(null);
    setWillReload(false);
    setPhase('working');

    const slug = getPageSlug(page);
    const companyName = deriveCustomerName(page);

    // Map sectionId → display title for nicer prompts
    const titleById = new Map(sections.map((s) => [s.id, s.title]));

    const suggestedEdit = entries
      .map(([sectionId, feedback]) =>
        `Section: ${titleById.get(sectionId) || sectionId}\nFeedback: ${feedback}`,
      )
      .join('\n\n---\n\n');

    const payload = {
      company_name: companyName,
      company_slug: slug,
      suggested_edit: suggestedEdit,
      edit_user_email: email,
    };

    const baselinePublished = page._metadata?.published ?? null;
    const pageKey = page._metadata?.key ?? null;

    const ac = new AbortController();
    liveAbort.current = ac;
    let editSeq = 0;
    let committed = false; // update_page succeeded (tool result or done.saved)
    let sawDone = false;
    let sawError = false;
    let curFocus: string | null = null;

    try {
      for await (const e of streamEdit(payload, ac.signal)) {
        if (e.kind === 'error') {
          sawError = true;
          setLiveError(e.message);
          setLiveStatus('Something went wrong');
          continue;
        }
        if (e.kind === 'tool') {
          if (e.name === 'get_page') {
            setLiveStatus(e.phase === 'call' ? 'Reading the page…' : 'Page loaded');
          } else if (e.name === 'update_page') {
            if (e.phase === 'call') setLiveStatus('Saving changes…');
            else {
              setLiveStatus('Changes saved');
              if (e.ok !== false) committed = true;
            }
          } else if (e.name === 'take_webpage_screenshot') {
            setLiveStatus(e.phase === 'call' ? 'Taking a fresh screenshot…' : 'Screenshot captured');
          }
          await sleep(160);
          continue;
        }
        const ev = e.ev;
        if (ev.type === 'plan') {
          setLiveSummary(ev.summary ?? '');
          setLiveStatus('Planning the edits…');
          await sleep(700);
        } else if (ev.type === 'section_focus') {
          const id = matchSectionId(ev.section);
          curFocus = id;
          setFocusSectionId(id);
          setActiveCard(null);
          setLiveStatus(`Working on “${ev.section}”…`);
          scrollToSection(id);
          await sleep(650);
        } else if (ev.type === 'edit') {
          const id = matchSectionId(ev.section) ?? curFocus;
          curFocus = id;
          setFocusSectionId(id);
          const key = ev.index ?? ++editSeq;
          const kind = editKind(ev);
          const skipped = ev.status === 'skipped';

          if (skipped) {
            // Nothing to apply on-page — just surface it so it stays visible.
            scrollToSection(id);
            setLiveStatus(`Skipped: ${ev.target ?? ev.section}`);
            await sleep(700);
          } else {
            const els = id ? elementsRef.current.find((x) => x.section.id === id)?.els ?? [] : [];
            let appliedInPlace = false;
            if (els.length) {
              appliedInPlace = await animateSectionEdit(
                els,
                { kind, old: ev.old, new: ev.new, newUrl: ev.newUrl },
                ac.signal,
              );
            }
            // Couldn't locate the target on the page → fall back to the card.
            if (!appliedInPlace) {
              scrollToSection(id);
              setActiveCard({ sectionId: id, section: ev.section, target: ev.target, kind, old: ev.old, newText: ev.new, key });
              const typeLen = ev.new?.length ?? 0;
              await sleep(1100 + Math.min(typeLen * 22, 2600));
              setActiveCard(null);
            }
          }

          setApplied((prev) => [
            ...prev,
            {
              id: key,
              section: ev.section,
              target: ev.target,
              kind,
              status: skipped ? 'skipped' : 'applied',
              reason: ev.reason,
              old: ev.old,
              newText: ev.new,
            },
          ]);
        } else if (ev.type === 'commit') {
          curFocus = null;
          setFocusSectionId(null);
          setActiveCard(null);
          setLiveStatus('Saving changes…');
          await sleep(300);
        } else if (ev.type === 'done') {
          sawDone = true;
          if (ev.saved) committed = true;
          setLiveDone({ changes: ev.changes, skipped: ev.skipped });
          setLiveStatus(ev.saved ? 'Done — changes are live' : 'Done');
          await sleep(200);
        } else if (ev.type === 'error') {
          sawError = true;
          setLiveError(ev.message ?? 'The agent reported an error.');
          setLiveStatus('Something went wrong');
        }
      }
    } catch (err) {
      if (!ac.signal.aborted) {
        sawError = true;
        setLiveError(err instanceof Error ? err.message : 'Stream error');
        setLiveStatus('Something went wrong');
      }
    }

    // Never hang: if the stream ended without a terminal event, finalize now.
    if (!sawDone && !sawError && !ac.signal.aborted) {
      if (committed) {
        setLiveDone({ changes: ['Changes saved.'] });
        setLiveStatus('Changes saved');
      } else {
        setLiveError('Opal stopped before confirming. Some edits may not have been applied — try again.');
        setLiveStatus('Incomplete');
      }
    }

    // Notify the parent (sidebar countdown) regardless of outcome.
    onSent?.();

    // If the agent committed, WAIT for the republish to actually land —
    // poll the Graph `published` ping — then cache-bust reload so the
    // visitor sees the real, freshly-published change (not just our
    // optimistic in-place animation).
    if (committed) {
      setWillReload(true);
      setLiveStatus('Publishing… waiting for it to go live');
      if (pageKey && baselinePublished) {
        await waitForRepublish(pageKey, baselinePublished, ac.signal);
      } else {
        await sleep(2500);
      }
      if (!ac.signal.aborted) {
        const u = new URL(window.location.href);
        u.searchParams.set('refresh', String(Date.now()));
        window.location.assign(u.toString());
      }
    }
    liveAbort.current = null;
  }, [comments, email, page, sections, onSent, matchSectionId, scrollToSection]);

  /** Dismiss the live overlay without reloading (Close on the live HUD). */
  const dismissLive = useCallback(() => {
    liveAbort.current?.abort();
    liveAbort.current = null;
    onClose();
  }, [onClose]);

  if (!active) return null;

  const commentCount = Object.keys(comments).length;
  const canSend = commentCount > 0 && !!email && phase === 'editing';

  /* ============== RENDER LAYERS ============== */

  /** Document-sized SVG layer with the outline boxes. */
  const docLayer = (
    <div
      className={'edit-overlay' + (phase === 'working' ? ' edit-overlay--working' : '')}
      style={{ width: docSize.w, height: docSize.h }}
      aria-label="Edit mode overlay"
    >
      <svg
        className="edit-overlay__svg"
        width={docSize.w}
        height={docSize.h}
        viewBox={`0 0 ${docSize.w} ${docSize.h}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {outlines.map(({ section, box }, i) => {
          const hasComment = !!comments[section.id];
          return (
            <g
              key={section.id}
              className={
                'edit-box' +
                (hasComment ? ' edit-box--commented' : '') +
                (activeSection === section.id ? ' edit-box--active' : '') +
                (phase === 'working' && focusSectionId === section.id ? ' edit-box--live' : '')
              }
              style={{ ['--reveal-index']: i } as CSSProperties}
              onClick={() => openCommentForSection(section.id)}
              role="button"
              aria-label={`Leave feedback on ${section.title}`}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openCommentForSection(section.id);
                }
              }}
            >
              <rect
                ref={(el) => { rectRefs.current.set(section.id, el); }}
                x={box.left}
                y={box.top}
                width={box.width}
                height={box.height}
                rx={OUTLINE_RADIUS}
                ry={OUTLINE_RADIUS}
                /* `pathLength=100` normalises the stroke-dash math so the
                 * draw-in animation reads as a clean 0–100 percentage,
                 * regardless of the actual perimeter of each box. */
                pathLength={100}
                className="edit-box__rect"
              />
              {hasComment && (
                <g className="edit-box__badge">
                  <circle
                    cx={box.left + box.width - 18}
                    cy={box.top + 18}
                    r={12}
                    className="edit-box__badge-bg"
                  />
                  <text
                    x={box.left + box.width - 18}
                    y={box.top + 22}
                    textAnchor="middle"
                    className="edit-box__badge-text"
                  >
                    1
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );

  /** Comment popup, anchored to the active section's outline. */
  let commentPopup: ReactElement | null = null;
  if (activeSection) {
    const entry = outlines.find((o) => o.section.id === activeSection);
    if (entry) {
      const placement = placePopup(entry.box, docSize, popupHeight);
      const existing = !!comments[activeSection];
      commentPopup = (
        <div
          ref={popupRef}
          className="edit-popup"
          role="dialog"
          aria-label={`Feedback for ${entry.section.title}`}
          style={{
            top: `${placement.top}px`,
            left: `${placement.left}px`,
            width: `${POPUP_WIDTH}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="edit-popup__head">
            <div>
              <div className="edit-popup__eyebrow">Section</div>
              <div className="edit-popup__title">{entry.section.title}</div>
            </div>
            <button
              type="button"
              className="edit-popup__close"
              onClick={() => setActiveSection(null)}
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <textarea
            className="edit-popup__textarea"
            value={draftComment}
            onChange={(e) => setDraftComment(e.target.value)}
            placeholder="What should change here?"
            rows={4}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                saveComment();
              }
            }}
          />
          <div className="edit-popup__actions">
            {existing && (
              <button
                type="button"
                className="edit-popup__btn edit-popup__btn--delete"
                onClick={deleteComment}
              >
                Delete
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button
              type="button"
              className="edit-popup__btn edit-popup__btn--ghost"
              onClick={() => setActiveSection(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="edit-popup__btn edit-popup__btn--primary"
              onClick={saveComment}
              disabled={!draftComment.trim()}
            >
              Comment
            </button>
          </div>
        </div>
      );
    }
  }

  /** Viewport-fixed HUD: title, email pill, send button, exit. */
  const hudLayer = (
    <div className={'edit-fixed-layer edit-fixed-layer--' + phase}>
      <div className="edit-hud" role="toolbar" aria-label="Edit toolbar">
        <div className="edit-hud__brand">
          <span className="edit-hud__dot" />
          <span className="edit-hud__title">Edit Mode</span>
          <span className="edit-hud__hint">
            Click any section to leave feedback for Opal
          </span>
        </div>
        <div className="edit-hud__right">
          {email && (
            <button
              type="button"
              className="edit-hud__email"
              onClick={openEmailEdit}
              aria-label={`Edit email (${email})`}
              title="Click to edit your email"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
              <span>{email}</span>
            </button>
          )}
          <button
            type="button"
            className={'edit-hud__send' + (canSend ? '' : ' edit-hud__send--disabled')}
            onClick={canSend ? send : undefined}
            disabled={!canSend}
            aria-label="Send feedback"
          >
            {phase === 'working' ? (
              <>
                <span className="edit-hud__spinner" aria-hidden="true" />
                <span>Editing live…</span>
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13" />
                  <path d="M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
                <span>
                  Send feedback
                  {commentCount > 0 && (
                    <span className="edit-hud__count">{commentCount}</span>
                  )}
                </span>
              </>
            )}
          </button>
          <button
            type="button"
            className="edit-hud__close"
            onClick={onClose}
            aria-label="Exit edit mode"
            title="Exit edit mode"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  /** Email modal — first-time blocking prompt or later edit. */
  const emailModal = emailModalOpen ? (
    <div
      className="edit-email-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Set your email"
      onClick={cancelEmailModal}
    >
      <div className="edit-email-modal__card" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="edit-email-modal__close"
          onClick={cancelEmailModal}
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <div className="edit-email-modal__icon" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <h3 className="edit-email-modal__title">
          {email ? 'Update your email' : 'Who is leaving feedback?'}
        </h3>
        <p className="edit-email-modal__sub">
          We'll attach this to the edits you send to Opal so the right person can follow up.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            commitEmail();
          }}
        >
          <input
            ref={emailInputRef}
            type="email"
            inputMode="email"
            autoComplete="email"
            className={'edit-email-modal__input' + (emailError ? ' edit-email-modal__input--error' : '')}
            value={emailDraft}
            placeholder="you@optimizely.com"
            onChange={(e) => {
              setEmailDraft(e.target.value);
              if (emailError) setEmailError(null);
            }}
          />
          {emailError && <div className="edit-email-modal__error">{emailError}</div>}
          <div className="edit-email-modal__actions">
            <button
              type="button"
              className="edit-email-modal__btn edit-email-modal__btn--ghost"
              onClick={cancelEmailModal}
            >
              {email ? 'Cancel' : 'Cancel & exit'}
            </button>
            <button
              type="submit"
              className="edit-email-modal__btn edit-email-modal__btn--primary"
            >
              Set
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  /** Thanks splash that animates in, holds, then animates out. */
  const thanksSplash = phase === 'thanks' ? (
    <div className="edit-thanks" role="status" aria-live="polite">
      <div className="edit-thanks__burst" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="edit-thanks__particle"
            style={{
              ['--angle' as string]: `${(i / 24) * 360}deg`,
              ['--delay' as string]: `${(i % 6) * 40}ms`,
              ['--hue' as string]: `${(i * 53) % 360}`,
            } as CSSProperties}
          />
        ))}
      </div>
      <div className="edit-thanks__panel">
        <div className="edit-thanks__check">
          <svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <div className="edit-thanks__title">Thanks! I'll get right on that</div>
        <div className="edit-thanks__sig">~ Opal</div>
      </div>
    </div>
  ) : null;

  /** Anchored diff card for the edit Opal is currently making. */
  let liveCard: ReactElement | null = null;
  if (phase === 'working' && activeCard) {
    const entry = activeCard.sectionId
      ? outlines.find((o) => o.section.id === activeCard.sectionId)
      : null;
    const CARD_H = 168;
    const style: CSSProperties = entry
      ? (() => {
          const p = placePopup(entry.box, docSize, CARD_H);
          return { top: p.top, left: p.left, width: POPUP_WIDTH, position: 'absolute' };
        })()
      : { position: 'fixed', top: '42%', left: '50%', transform: 'translate(-50%, -50%)', width: POPUP_WIDTH };
    liveCard = <LiveCard card={activeCard} style={style} />;
  }

  /** Fixed live status HUD (bottom): narration, applied edits, done/error. */
  const liveHud = phase === 'working' ? (
    <div className="live-hud" role="status" aria-live="polite">
      <div className="live-hud__bar">
        {liveDone ? (
          <span className="live-hud__check" aria-hidden="true">✓</span>
        ) : liveError ? (
          <span className="live-hud__bang" aria-hidden="true">!</span>
        ) : (
          <span className="edit-hud__spinner" aria-hidden="true" />
        )}
        <span className="live-hud__status">{liveStatus}</span>
        <button
          type="button"
          className="live-hud__close"
          onClick={dismissLive}
          aria-label="Close live edit"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      {liveSummary && !liveDone && !liveError && (
        <div className="live-hud__summary">{liveSummary}</div>
      )}
      {applied.length > 0 && !liveDone && (
        <ul className="live-hud__applied">
          {applied.map((a) => (
            <li key={a.id} className={a.status === 'skipped' ? 'is-skipped' : ''}>
              <span className={'live-hud__tag live-hud__tag--' + (a.status === 'skipped' ? 'skipped' : a.kind)}>
                {a.status === 'skipped' ? 'skipped' : a.kind.replace('item-', '')}
              </span>
              <b>{a.section}</b>
              {a.target ? ` · ${a.target}` : ''}
              {a.status === 'skipped' && a.reason ? <em className="live-hud__reason"> — {a.reason}</em> : null}
            </li>
          ))}
        </ul>
      )}
      {liveDone && (
        <div className="live-hud__done">
          {(liveDone.changes ?? []).map((c, i) => (
            <div key={i} className="live-hud__change">✓ {c}</div>
          ))}
          {(liveDone.skipped ?? []).map((c, i) => (
            <div key={'s' + i} className="live-hud__skip">⊘ {c}</div>
          ))}
          {willReload && <div className="live-hud__reload">Reloading to show your changes…</div>}
        </div>
      )}
      {liveError && <div className="live-hud__errbox">{liveError}</div>}
    </div>
  ) : null;

  return createPortal(
    <>
      {docLayer}
      {commentPopup}
      {hudLayer}
      {emailModal}
      {thanksSplash}
      {liveCard}
      {liveHud}
    </>,
    document.body,
  );
}

/** Fallback card for an edit that couldn't be located on the page. */
function LiveCard({ card, style }: { card: ActiveCard; style: CSSProperties }) {
  const isRemove = card.kind === 'item-remove';
  const isAdd = card.kind === 'item-add' || card.kind === 'image';
  const showOld = !isAdd && !!card.old;
  const showNew = !isRemove && !!card.newText;
  const badge =
    card.kind === 'item-add' ? 'add'
    : card.kind === 'item-remove' ? 'remove'
    : card.kind === 'image' ? 'image'
    : 'edit';

  const [struck, setStruck] = useState(false);
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setStruck(true), showOld ? 450 : 0);
    const t2 = setTimeout(() => setTyping(true), showOld ? 950 : 200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [card.key, showOld]);

  return (
    <div className="live-card" style={style} role="status">
      <div className="live-card__head">
        <span className={'live-card__badge live-card__badge--' + badge}>{badge}</span>
        <span className="live-card__target">{card.target ?? card.section}</span>
      </div>
      <div className="live-card__diff">
        {showOld && (
          <span className={'live-card__old' + (struck ? ' is-struck' : '')}>{card.old}</span>
        )}
        {showOld && showNew && <span className="live-card__arrow">→</span>}
        {showNew && typing && (
          <span className="live-card__new">
            <Typewriter text={card.newText ?? ''} cps={55} caret />
          </span>
        )}
      </div>
    </div>
  );
}

function Typewriter({ text, cps, caret }: { text: string; cps: number; caret?: boolean }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!text) return;
    const step = Math.max(12, 1000 / cps);
    const id = setInterval(() => {
      setN((p) => {
        if (p >= text.length) {
          clearInterval(id);
          return p;
        }
        return p + 1;
      });
    }, step);
    return () => clearInterval(id);
  }, [text, cps]);
  const done = n >= text.length;
  return (
    <>
      {text.slice(0, n)}
      {caret && !done && <span className="live-card__caret">&nbsp;</span>}
    </>
  );
}

export default EditMode;
