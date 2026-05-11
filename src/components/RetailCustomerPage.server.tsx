/**
 * RetailCustomerPage.server — SSR entry mirroring the client component (v3).
 * No useEffect / no GSAP wiring. Hydration takes over on the client.
 */

import type { RetailCustomerPage as RetailPageType, HeldForYouItem, SetAsideItem } from '../lib/graph-types';
import { getDemoContent, resolveDescriptor } from '../lib/retail-demo-content';
import RetailHero from './retail/RetailHero';
import EditorialLede from './retail/EditorialLede';
import WornThisYear from './retail/WornThisYear';
import HeldForYou from './retail/HeldForYou';
import SetAside from './retail/SetAside';
import AtelierNote from './retail/AtelierNote';
import SmallInvitation from './retail/SmallInvitation';
import Appointment from './retail/Appointment';
import StylistsNote from './retail/StylistsNote';
import ClosingReflection from './retail/ClosingReflection';

interface Props {
  page: RetailPageType;
  deviceRecognized?: boolean;
}

const STYLIST_MAILTO = 'mailto:stylist@maisonaurelle.example?subject=Re%3A%20The%20pieces%20held%20for%20me';

export default function RetailCustomerPageServer({ page, deviceRecognized = true }: Props) {
  const degraded = page.deviceDegraded || !deviceRecognized;
  const slug =
    page.customerSlug ||
    (page._metadata?.url?.hierarchical || '').replace(/^\/+|\/+$/g, '').replace(/^en\//, '');
  const demo = getDemoContent(slug, page.register);

  const editorialIntro =
    (page as any).editorialIntro ||
    demo?.editorialIntro ||
    page.MetaDescription ||
    null;

  const heldForYou = page.heldForYou
    ? {
        ...page.heldForYou,
        header: page.heldForYou.header || demo?.heldHeader || null,
        items: (page.heldForYou.items || []).map<HeldForYouItem>((it) => ({
          ...it,
          descriptor: it.descriptor || resolveDescriptor(it.name, it.descriptor, demo, 'held') || '',
        })),
      }
    : null;

  const setAside = page.setAside
    ? {
        ...page.setAside,
        items: (page.setAside.items || []).map<SetAsideItem>((it) => ({
          ...it,
          descriptor: it.descriptor || resolveDescriptor(it.name, it.descriptor, demo, 'setAside') || '',
        })),
      }
    : null;

  const atelierNote = page.atelierNote
    ? {
        ...page.atelierNote,
        title: page.atelierNote.title || demo?.atelierTitle || null,
        body: page.atelierNote.body || demo?.atelierBody || '',
      }
    : (demo?.atelierBody
        ? { title: demo.atelierTitle || '', body: demo.atelierBody, cta: 'Write to your stylist', imageUrl: null, imageDirection: null }
        : null);

  const smallInvitation = page.smallInvitation
    ? {
        ...page.smallInvitation,
        itemName: page.smallInvitation.itemName || demo?.invitationItem || '',
        line: page.smallInvitation.line || demo?.invitationLine || '',
      }
    : null;

  const appointment = page.appointment
    ? {
        ...page.appointment,
        slotPhrase: page.appointment.slotPhrase || demo?.appointmentSlotPhrase || null,
        slots: page.appointment.slots && page.appointment.slots.length > 0
          ? page.appointment.slots
          : demo?.appointmentSlots || null,
        boutique: page.appointment.boutique || demo?.stylistBoutique || null,
      }
    : null;

  const stylistNote = (page as any).stylistNoteBody || demo?.stylistNoteBody;
  const stylistSigned = (page as any).stylistNoteSignedBy || demo?.stylistNoteSignedBy;
  const closingReflection = (page as any).closingReflection || demo?.closingReflection;
  const footerLine = page.footerLine || demo?.footerLine;
  const primaryCity = demo?.primaryCity;

  return (
    <main className={`retail-page register-${page.register}`} id="main-content">
      <a href="#main-content" className="abm-skip-link">Skip to main content</a>

      <div className="retail-progress" aria-hidden="true">
        <div className="retail-progress__fill" />
      </div>

      <header className="retail-topbar">
        <a className="retail-wordmark" href="#main-content">Maison Aurelle</a>
        <div className="retail-topbar__right">
          {primaryCity && <span>{primaryCity}</span>}
          <span>{page.monthStamp || 'Curated for May'}</span>
          <a className="retail-link" href="#appointment">Atelier</a>
        </div>
      </header>

      {page.hero && (
        <RetailHero block={page.hero} monthStamp={page.monthStamp} register={page.register} />
      )}

      <EditorialLede
        monthStamp={page.monthStamp}
        register={page.register}
        intro={editorialIntro || ''}
        pullLine={null}
      />

      {demo && (
        <WornThisYear label={demo.wornThisYearLabel} anchors={demo.wornAnchors} register={page.register} />
      )}

      {heldForYou && <HeldForYou block={heldForYou} register={page.register} />}

      {!degraded && setAside && <SetAside block={setAside} primaryCity={primaryCity} />}

      {atelierNote && <AtelierNote block={atelierNote as any} register={page.register} />}

      {smallInvitation && <SmallInvitation block={smallInvitation} register={page.register} />}

      {stylistNote && stylistSigned && !degraded && (
        <StylistsNote body={stylistNote} signedBy={stylistSigned} contactHref={STYLIST_MAILTO} />
      )}

      {appointment && (
        <section id="appointment">
          <Appointment block={appointment} />
        </section>
      )}

      {closingReflection && <ClosingReflection body={closingReflection} />}

      {footerLine && (
        <footer className="retail-footer">
          <div className="retail-footer__inner">
            <span className="retail-footer__mark">Maison Aurelle</span>
            <p className="retail-footer__line">{footerLine}</p>
          </div>
        </footer>
      )}
    </main>
  );
}
