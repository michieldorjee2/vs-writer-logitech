/**
 * RetailCustomerPage.server — SSR entry.
 *
 * Renders the same React tree as RetailCustomerPage.tsx but without the
 * useEffect-driven GSAP + cursor wiring (those are window-dependent).
 * The client component hydrates and takes over animations.
 */

import type { RetailCustomerPage as RetailPageType } from '../lib/graph-types';
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
}

function deriveLedeIntro(page: RetailPageType): string {
  const meta = page.MetaDescription?.trim();
  if (meta && meta.length > 40) {
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
  if (page.atelierNote?.title) return page.atelierNote.title;
  return null;
}

export default function RetailCustomerPageServer({ page, deviceRecognized = true }: Props) {
  const degraded = page.deviceDegraded || !deviceRecognized;
  const primaryCity = page.customerSlug?.includes('chen') ? 'New York' :
                      page.customerSlug?.includes('whitfield') ? 'London' :
                      page.customerSlug?.includes('petrov') ? 'Miami Beach' :
                      page.customerSlug?.includes('laurent') ? 'Paris' :
                      page.customerSlug?.includes('brennan') ? 'Aspen' : undefined;

  return (
    <main className={`retail-page register-${page.register}`} id="main-content">
      <a href="#main-content" className="abm-skip-link">Skip to main content</a>

      <div className="retail-progress" aria-hidden="true">
        <div className="retail-progress__fill" />
      </div>

      <header className="retail-topbar">
        <span className="retail-wordmark">Maison Aurelle</span>
        <div className="retail-topbar__right">
          <span>{primaryCity || 'Atelier'}</span>
          <span>{page.monthStamp || 'Curated for May'}</span>
        </div>
      </header>

      {page.hero && (
        <RetailHero block={page.hero} monthStamp={page.monthStamp} register={page.register} />
      )}

      <EditorialLede
        monthStamp={page.monthStamp}
        register={page.register}
        intro={deriveLedeIntro(page)}
        pullLine={deriveLedePullLine(page)}
      />

      {page.heldForYou && <HeldForYou block={page.heldForYou} register={page.register} />}

      {!degraded && page.setAside && <SetAside block={page.setAside} primaryCity={primaryCity} />}

      {page.atelierNote && <AtelierNote block={page.atelierNote} register={page.register} />}

      {page.smallInvitation && <SmallInvitation block={page.smallInvitation} register={page.register} />}

      {page.appointment && <Appointment block={page.appointment} />}

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
