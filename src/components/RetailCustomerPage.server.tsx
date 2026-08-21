/**
 * RetailCustomerPage.server — SSR entry mirroring the client component (v3).
 * No useEffect / no GSAP wiring. Hydration takes over on the client.
 */

import type {
  RetailCustomerPage as RetailPageType,
  HeldForYouItem,
  SetAsideItem,
  RetailLetterBlock,
  RetailPolaroid,
  RetailWornAnchor,
  OpalQuestion,
} from '../lib/graph-types';
import { getDemoContent, resolveDescriptor } from '../lib/retail-demo-content';
import type { WornAnchor as DemoWornAnchor, QA as DemoQA } from '../lib/retail-demo-content';
import { CartProvider } from '../lib/retail-cart';
import CartIcon from './retail/CartIcon';
import RetailHero from './retail/RetailHero';
import LetterAndPolaroids from './retail/LetterAndPolaroids';
import EditorialLede from './retail/EditorialLede';
import WornThisYear from './retail/WornThisYear';
import HeldForYou from './retail/HeldForYou';
import SetAside from './retail/SetAside';
import AtelierNote from './retail/AtelierNote';
import SmallInvitation from './retail/SmallInvitation';
import Appointment from './retail/Appointment';
import StylistsNote from './retail/StylistsNote';
import OpalQuestions from './retail/OpalQuestions';
import ClosingReflection from './retail/ClosingReflection';
import CareTimeline from './retail/CareTimeline';

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

  const stylistNote = page.stylistNoteBody || demo?.stylistNoteBody;
  const stylistSigned = page.stylistNoteSignedBy || demo?.stylistNoteSignedBy;
  const closingReflection = page.closingReflection || demo?.closingReflection;
  const footerLine = page.footerLine || demo?.footerLine;

  // CMS-first with demo fallback for the per-customer fields. Once every
  // customer's content is populated in CMS, the demo layer can be removed.
  const primaryCity = page.primaryCity || demo?.primaryCity;
  const neighborhood = page.neighborhood || demo?.neighborhood;
  const stylistNameOut = page.stylistName || demo?.stylistName;
  const stylistBoutiqueOut = page.stylistBoutique || demo?.stylistBoutique;
  const initialsOut = page.initials || demo?.initials;
  const personalHeroLine1 = page.personalHeroLine1 || demo?.personalHeroLine1;
  const personalHeroLine2 = page.personalHeroLine2 || demo?.personalHeroLine2;

  const letter: RetailLetterBlock | null = page.letter
    ? page.letter
    : (demo?.letter ? { greeting: demo.letter.greeting, paragraphs: demo.letter.paragraphs, signoff: demo.letter.signoff, dateLine: null } : null);

  const polaroids: RetailPolaroid[] = page.polaroids?.length
    ? page.polaroids
    : (demo?.polaroids?.map((p) => ({ imageUrl: p.imageUrl, caption: p.caption, rotate: p.rotate })) || []);

  // Demo content uses nested pairedWith; CMS uses flat pairedName/etc. Normalize to flat.
  const wornAnchorsOut: RetailWornAnchor[] | null = page.wornAnchors?.length
    ? page.wornAnchors
    : (demo?.wornAnchors?.map<RetailWornAnchor>((a: DemoWornAnchor) => ({
        name: a.name,
        qualifier: a.qualifier,
        season: a.season,
        ownedImageUrl: null,
        pairedName: a.pairedWith?.name || null,
        pairedQualifier: a.pairedWith?.qualifier || null,
        pairedImageUrl: null,
        pairedPriceLabel: null,
      })) || null);
  const wornLabel = page.wornLabel || demo?.wornThisYearLabel || null;

  // Demo questions use q/a; CMS uses question/answer. Normalize to CMS shape.
  const questionsOut: OpalQuestion[] | null = page.questions?.length
    ? page.questions
    : (demo?.questions?.map<OpalQuestion>((q: DemoQA) => ({ question: q.q, answer: q.a })) || null);

  const editorialIntroOut = page.editorialIntro || demo?.editorialIntro || editorialIntro;

  return (
    <CartProvider slug={page.customerSlug || slug || 'guest'}>
    <main className={`retail-page register-${page.register}`} id="main-content">
      <a href="#main-content" className="abm-skip-link">Skip to main content</a>

      <div className="retail-progress" aria-hidden="true">
        <div className="retail-progress__fill" />
      </div>

      <header className="retail-topbar">
        <a className="retail-wordmark" href="#main-content">Maison Aurelle</a>
        <div className="retail-topbar__center">
          <span className="retail-topbar__for">For</span>
          <span className="retail-topbar__name">{(page.customerDisplayName || demo?.displayName || 'You').split(' ')[0]}</span>
          {initialsOut && <span className="retail-topbar__initials">· {initialsOut}</span>}
        </div>
        <div className="retail-topbar__right">
          {primaryCity && <span className="retail-topbar__locale">{primaryCity}</span>}
          <span className="retail-topbar__locale">{page.monthStamp || 'Curated for May'}</span>
          <a className="retail-link" href="#appointment">Atelier</a>
          <CartIcon />
        </div>
      </header>

      {page.hero && (
        <RetailHero
          block={page.hero}
          monthStamp={page.monthStamp}
          register={page.register}
          initials={initialsOut}
          neighborhood={neighborhood}
          stylistName={stylistNameOut}
          stylistBoutique={stylistBoutiqueOut}
          personalLine1={personalHeroLine1}
          personalLine2={personalHeroLine2}
        />
      )}

      {letter && polaroids.length ? (
        <LetterAndPolaroids letter={letter} polaroids={polaroids} register={page.register} />
      ) : (
        <EditorialLede
          monthStamp={page.monthStamp}
          register={page.register}
          intro={editorialIntroOut || ''}
          pullLine={null}
        />
      )}

      {page.careTimeline && page.careTimeline.length > 0 && (
        <CareTimeline
          label={page.careLabel || 'On the docket'}
          entries={page.careTimeline}
          makerNote={page.makerNote || null}
        />
      )}

      {wornAnchorsOut && wornAnchorsOut.length > 0 && (
        <WornThisYear label={wornLabel} anchors={wornAnchorsOut} register={page.register} />
      )}

      {heldForYou && <HeldForYou block={heldForYou} register={page.register} />}

      {!degraded && setAside && <SetAside block={setAside} primaryCity={primaryCity} />}

      {atelierNote && <AtelierNote block={atelierNote as any} register={page.register} />}

      {smallInvitation && <SmallInvitation block={smallInvitation} register={page.register} />}

      {stylistNote && stylistSigned && !degraded && (
        <StylistsNote body={stylistNote} signedBy={stylistSigned} />
      )}

      {questionsOut && questionsOut.length > 0 && (
        <OpalQuestions questions={questionsOut} />
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
    </CartProvider>
  );
}
