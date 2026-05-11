/**
 * RetailCustomerPage — the Maison Aurelle landing template.
 *
 * Architecture mirrors ABMHyperPage: a single composition orchestrating
 * section components, with a useEffect that initializes the GSAP
 * scroll choreography and custom cursor.
 *
 * Visual language: editorial typography, full-bleed image slates with
 * parallax, magazine-grade spreads, custom cursor, slow reveals.
 * NOT a recommendation grid.
 */

import { useEffect } from 'react';
import type { RetailCustomerPage as RetailPageType } from '../lib/graph-types';
import { initRetailAnimations, cleanupRetailAnimations } from '../lib/retail-animations';
import { initRetailInteractions, cleanupRetailInteractions } from '../lib/retail-interactions';
import RetailHero from './retail/RetailHero';
import EditorialLede from './retail/EditorialLede';
import HeldForYou from './retail/HeldForYou';
import SetAside from './retail/SetAside';
import AtelierNote from './retail/AtelierNote';
import SmallInvitation from './retail/SmallInvitation';
import Appointment from './retail/Appointment';

interface Props {
  page: RetailPageType;
  deviceRecognized?: boolean;
  editMode?: boolean;
}

/**
 * Derive the editor's-note paragraph from the page payload.
 * In v0 the agent writes its persona summary to `MetaDescription`; we use
 * the first sentence of it. Falls back to a register-appropriate phrase.
 */
function deriveLedeIntro(page: RetailPageType): string {
  const meta = page.MetaDescription?.trim();
  if (meta && meta.length > 40) {
    // Take up to the first two sentences for a substantive lede.
    const sentences = meta.split(/(?<=[.!?])\s+/);
    return sentences.slice(0, 2).join(' ');
  }
  switch (page.register) {
    case 'minimal':
      return 'A small edit for the weeks between the coat and the spring wardrobe — pieces chosen with the wardrobe already in hand.';
    case 'archive':
      return 'Pieces drawn from the archive and the season at hand, with provenance held at Mount Street.';
    case 'discovery':
      return 'The capsules continue, in the colors the season is asking for.';
    case 'atelier':
      return "L'atelier ouvre sur la maison — pieces and objects, in editions held for the months ahead.";
    case 'family':
      return 'Between mountain and shore, the wardrobe that travels with the household.';
  }
}

function deriveLedePullLine(page: RetailPageType): string | null {
  // If the agent's atelier note has a title, use it as the pull-line.
  if (page.atelierNote?.title) return page.atelierNote.title;
  return null;
}

export default function RetailCustomerPage({ page, deviceRecognized = true, editMode }: Props) {
  // Track for analytics — ABM page uses useOdpTracking; mirror that hook here
  // if/when we wire ODP. Skipped in v0 to keep the surface tight.

  useEffect(() => {
    const t = setTimeout(() => {
      initRetailAnimations();
      initRetailInteractions();
    }, 60);
    return () => {
      clearTimeout(t);
      cleanupRetailInteractions();
      cleanupRetailAnimations();
    };
  }, []);

  const degraded = page.deviceDegraded || !deviceRecognized;
  const primaryCity = page.customerSlug?.includes('chen') ? 'New York' :
                      page.customerSlug?.includes('whitfield') ? 'London' :
                      page.customerSlug?.includes('petrov') ? 'Miami Beach' :
                      page.customerSlug?.includes('laurent') ? 'Paris' :
                      page.customerSlug?.includes('brennan') ? 'Aspen' : undefined;

  return (
    <main
      className={`retail-page register-${page.register}`}
      id="main-content"
      data-edit-mode={editMode ? '1' : undefined}
    >
      <a href="#main-content" className="abm-skip-link">Skip to main content</a>

      {/* Scroll progress hairline (left rail) */}
      <div className="retail-progress" aria-hidden="true">
        <div className="retail-progress__fill" />
      </div>

      {/* Top bar — fades in after hero scrolls past */}
      <header className="retail-topbar">
        <span className="retail-wordmark">Maison Aurelle</span>
        <div className="retail-topbar__right">
          <span>{primaryCity || 'Atelier'}</span>
          <span>{page.monthStamp || 'Curated for May'}</span>
        </div>
      </header>

      {page.hero && (
        <RetailHero
          block={page.hero}
          monthStamp={page.monthStamp}
          register={page.register}
        />
      )}

      <EditorialLede
        monthStamp={page.monthStamp}
        register={page.register}
        intro={deriveLedeIntro(page)}
        pullLine={deriveLedePullLine(page)}
      />

      {page.heldForYou && (
        <HeldForYou block={page.heldForYou} register={page.register} />
      )}

      {!degraded && page.setAside && (
        <SetAside block={page.setAside} primaryCity={primaryCity} />
      )}

      {page.atelierNote && (
        <AtelierNote block={page.atelierNote} register={page.register} />
      )}

      {page.smallInvitation && (
        <SmallInvitation block={page.smallInvitation} register={page.register} />
      )}

      {page.appointment && (
        <Appointment block={page.appointment} />
      )}

      {page.footerLine && (
        <footer className="retail-footer">
          <div className="retail-footer__inner">
            <span className="retail-footer__mark">Maison Aurelle</span>
            <p className="retail-footer__line">{page.footerLine}</p>
          </div>
        </footer>
      )}
    </main>
  );
}
