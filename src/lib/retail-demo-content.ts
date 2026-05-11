/**
 * Demo-time editorial fallback content per customer.
 * Used when the corresponding CMS field is empty. As the agent re-runs and
 * populates CMS, the page progressively reads from CMS instead of these
 * fallbacks. Demo customers only — production retail pages should always
 * read from CMS.
 */

import type { RetailRegister } from './graph-types';

export interface WornAnchor {
  name: string;
  qualifier: string;
  season: string;
}

export interface DemoCustomer {
  displayName: string;
  primaryCity: string;
  stylistName: string | null;
  stylistBoutique: string | null;

  editorialIntro: string;
  wornThisYearLabel: string;
  wornAnchors: WornAnchor[];

  heldHeader: string;
  heldDescriptors: Record<string, string>;

  setAsideDescriptors: Record<string, string>;
  setAsideProvenance: Record<string, string>;

  atelierTitle?: string;
  atelierBody?: string;

  invitationItem?: string;
  invitationLine?: string;

  stylistNoteBody: string;
  stylistNoteSignedBy: string;

  closingReflection: string;
  footerLine: string;

  appointmentSlotPhrase?: string;
  appointmentSlots?: string[];
}

const ISABELLA: DemoCustomer = {
  displayName: 'Isabella Chen',
  primaryCity: 'New York',
  stylistName: 'Camille',
  stylistBoutique: 'Crosby Street',

  editorialIntro:
    "Four orders, two wardrobes — the spring you set down in March and the autumn you keep returning to. The Anna in camel, the Marais in sand, the Liane carried like an extension of the hand. This May, in the weeks between the coats and what comes after, the question is the bridge: a piece in oat linen-wool that holds the wardrobe together while the season turns. Camille has set three things aside, and one quieter object — to be seen if you'd like.",

  wornThisYearLabel: 'In your rotation',
  wornAnchors: [
    { name: 'Anna Coat',     qualifier: 'camel wool-cashmere',      season: 'autumn 2024' },
    { name: 'Marais Trench', qualifier: 'sand cotton-gabardine',    season: 'autumn 2025' },
    { name: 'Liane Tote',    qualifier: 'espresso grained calf',    season: 'autumn 2024' },
    { name: 'Plis Earrings', qualifier: '18k brushed gold',         season: 'autumn 2025' },
  ],

  heldHeader: 'Selected by Camille for you, this week',
  heldDescriptors: {
    'Côte Knit':
      'Fine-gauge merino in oat, cut slightly longer through the body so it sits cleanly over the Marais without disturbing the line at the shoulder. A piece that holds the wardrobe together when the coats start to come off.',
    'Liane Zip Wallet':
      'A smaller companion to the Liane Tote, drawn from the same espresso hide. Carried in the hand, or set quietly inside the tote — the day works either way.',
    'Slate Wool Trousers':
      'Wide, flat-front, ankle-grazing. Reads against the Anna in winter and against the linen in May. The kind of trouser you stop noticing because it never asks for attention.',
    // common alternates the agent may produce
    'Aurelle Blazer, Oat Linen-Wool':
      'Single-button, structured shoulder, half-lined in silk habotai. The bridge between the Anna and the Marais — a layer for the weeks the coats spend in the closet.',
    'Côte Trousers, Slate Wool-Crepe':
      'Wide-leg, flat-front, slightly cropped. Pairs with the blazer or the Anna; carries the same restrained line the rest of your wardrobe already keeps.',
  },

  setAsideDescriptors: {
    'Plis Earrings II':
      'The long-drop version of the pair you wear most. 18k brushed gold, hand-formed at the same fold, the proportion just a touch more present.',
    'Plis Earrings, Long Drop (18k brushed gold)':
      'The long-drop version of the pair you wear most. 18k brushed gold, hand-formed at the same fold, the proportion just a touch more present.',
  },
  setAsideProvenance: {
    default:
      'Noted at your last fitting with Camille — held against this account, pending your word.',
  },

  atelierTitle: 'On the Anna Coat',
  atelierBody:
    "The wool-cashmere at this weight benefits from a fresh lining every few seasons. The atelier offers this quietly, by appointment, with the coat returned within a fortnight — the shell unchanged, the interior renewed. If the Anna is approaching that point, a note to Camille is all it takes.",

  invitationItem: 'Charcoal Woven Stole',
  invitationLine:
    "Herringbone cashmere, woven in charcoal. The weight sits between a scarf and a wrap, and it travels well — reading differently each time depending on what it's set against.",

  stylistNoteBody:
    "The Plis pair came in last week. I've set the long-drop aside whenever you're next on Crosby Street, alongside the new merino. Either before lunch or just after works for me — write whenever it suits.",
  stylistNoteSignedBy: 'Camille',

  closingReflection:
    "The wardrobe you're building doesn't ask for new colors. It asks for the right weight, the right fall, and the rare object that earns its place. May is the quiet month — most things stay. One or two come in.",

  footerLine:
    'Pieces are held by appointment. Write to your stylist any time.',

  appointmentSlotPhrase: 'Camille has availability at Crosby Street this month',
  appointmentSlots: ['Thursday, May 21 — afternoon', 'Friday, May 22 — morning'],
};

// Stubs for the other four — fallbacks if their pages get created.
const MARCUS: DemoCustomer = {
  displayName: 'Marcus Whitfield',
  primaryCity: 'London',
  stylistName: 'Edward',
  stylistBoutique: 'Mount Street',
  editorialIntro:
    "Three orders, four objects of consequence — the 1972 dress watch with its original strap retained, the Mahogany Oxford coming up on its first resole, the bespoke shirts in pairs. May is the threshold month for what comes next: a second shoe in conversation with the first, a third cloth to sit alongside poplin and voile. Edward has the provenance file on hand and a quiet pair of objects on the cabinet shelf, ready when you are.",
  wornThisYearLabel: 'In the wardrobe',
  wornAnchors: [
    { name: '1972 Dress Watch',     qualifier: 'vault, original strap retained', season: 'June 2025' },
    { name: 'Mahogany Oxford',      qualifier: 'burnished calf',                  season: 'November 2024' },
    { name: 'Vicuña Scarf',         qualifier: 'ash',                             season: 'December 2025' },
    { name: 'Bespoke Shirts',       qualifier: 'poplin + voile, French cuff',     season: 'November 2024' },
  ],
  heldHeader: 'Pieces drawn for you this month',
  heldDescriptors: {
    'Walnut Wholecut':
      'Single-piece construction in burnished calf, the walnut tone sitting one register warmer than the Mahogany Oxford. The natural complement once the first pair has earned its first resole.',
    'Ash Suede Derby':
      'Quieter silhouette, unlined at the quarter for warm-weather wear, in the ash that already runs through the vicuña scarf. A second register of the same wardrobe.',
    'Cream Poplin Shirt, Spread Collar':
      'A third cloth alongside the existing poplin and voile, cut to the same French-cuff block already on file. No fitting required.',
  },
  setAsideDescriptors: {
    default: 'Held with the provenance file at Mount Street.',
  },
  setAsideProvenance: {
    default: 'The provenance file on order #1198 has been updated. The original strap remains the reference point; a second strap in aged walnut leather is set aside should you wish to view it alongside the piece.',
  },
  atelierTitle: 'On the question of the strap',
  atelierBody:
    "When a timepiece enters the vault programme, the provenance file travels with it — not as documentation alone, but as a record of intention. The original strap retained from your 1972 piece has been cleaned and stored flat; the aged walnut leather now set aside was selected for its proximity to the original's patina at approximately the same age. Both can be viewed together at Mount Street, or the file can be sent to you in full.",
  invitationItem: 'Ash Ceramic Inkwell',
  invitationLine:
    'A writing-desk piece this season — ash glaze, wheel-thrown, in the same raw finish as the ceramic work the atelier has produced since 1971. Adjacent to the palette without departing from it.',
  stylistNoteBody:
    "The walnut strap is on the shelf with the file. Tea at four if it suits — Tuesday and Thursday next week are open, or the cabinet can be sent down to the office.",
  stylistNoteSignedBy: 'Edward',
  closingReflection:
    "The collection is finished — what's left is care, and the occasional object that earns its place. May is for the second pair, the third cloth, the small refinement.",
  footerLine:
    'Vault pieces are released to viewing by appointment. Provenance files travel ahead of the pieces.',
  appointmentSlotPhrase: 'Edward holds the file and both straps on site',
  appointmentSlots: ['Tuesday, May 19 — 11:00', 'Thursday, May 21 — 14:30'],
};

const ARIA: DemoCustomer = {
  displayName: 'Aria Petrov',
  primaryCity: 'Miami Beach',
  stylistName: null,
  stylistBoutique: null,
  editorialIntro:
    'Two capsules in motion — the Lume bag family in citron and fuchsia, the Volute jewelry pair in gold-vermeil. May arrives as the season the third colorway lands and the silhouette of the wrist is added to the conversation. No stylist on file yet; the next time you stop into Miami Design District, the new Lume and the cuff that pairs to your Volute will both be on the cabinet.',
  wornThisYearLabel: 'In your collection',
  wornAnchors: [
    { name: 'Lume Mini Bag',      qualifier: 'citron',                  season: 'August 2025' },
    { name: 'Lume Crossbody',     qualifier: 'fuchsia patent',          season: 'January 2026' },
    { name: 'Volute Necklace',    qualifier: 'gold-vermeil, double-drop', season: 'January 2026' },
    { name: 'Sera Clutch',        qualifier: 'oxblood python-stamped',   season: 'February 2025' },
  ],
  heldHeader: 'Three pieces, two families',
  heldDescriptors: {
    'Lume Shoulder, Warm Amber':
      'The mid-size Lume in burnished amber calf — structured base, adjustable strap. The colorway the season is reaching for, in the silhouette you already know.',
    'Volute Cuff, Gold-Vermeil':
      'Wide and architectural, brushed finish — sits on the wrist the way the earrings sit at the ear. The first wear of the form in this collection.',
    'Sera Sandal, Oxblood':
      'A low-heeled leather sandal in the same oxblood as the Sera Clutch. Closes the pairing the clutch has been waiting for.',
  },
  setAsideDescriptors: {
    default: 'Held against your account, pending your word.',
  },
  setAsideProvenance: {
    default: 'Surfaced from your wishlist activity, set aside through the end of May.',
  },
  atelierTitle: 'On the Lume family',
  atelierBody:
    "The Lume was conceived as a single form that could hold a season's worth of color without revision. Same hand-stitched gusset, same brass hardware — cast once and not adjusted. What changes is only the leather and the light it catches. A collection built around one form tends to travel well together.",
  invitationItem: 'Sand Silk-Linen Scarf',
  invitationLine:
    'The one neutral that holds its own beside a saturated bag. Silk-linen, undyed, woven in a single warm tone.',
  stylistNoteBody:
    'The Miami Design District boutique is open Wednesday through Saturday. The first visit is a conversation — the Lume, the new cuff, the May arrivals. Coffee, no expectation.',
  stylistNoteSignedBy: 'The Miami atelier',
  closingReflection:
    'The capsules continue when you do. There is no urgency — these pieces are made to wait the season out, in the colorways the season chose.',
  footerLine:
    'Maison Aurelle holds a boutique in the Miami Design District since 2014. By appointment, by request, or by walk-in.',
  appointmentSlotPhrase: 'Private viewings — Miami Design District',
  appointmentSlots: ['Thursday, May 15 — 11h', 'Saturday, May 17 — 14h'],
};

const SEBASTIAN: DemoCustomer = {
  displayName: 'Sebastian Laurent',
  primaryCity: 'Paris',
  stylistName: 'Margaux',
  stylistBoutique: 'rue Saint-Honoré',
  editorialIntro:
    "Le pantalon. La capsule jacket 12/40 already in your closet, the ceramic 08/24 on the dining room shelf — la maison s'élargit objet par objet. May brings a numbered companion to the trouser, a basalt tray in the same edition language, and a length of raw linen for those who work with their hands. Margaux is at rue Saint-Honoré through Saturday; the cabinet is open, no reservation required for a first look.",
  wornThisYearLabel: 'Dans la maison',
  wornAnchors: [
    { name: 'Capsule Jacket 12/40', qualifier: 'numbered, charcoal',         season: 'September 2025' },
    { name: 'Ceramic Vessel 08/24', qualifier: 'atelier signed',             season: 'January 2026' },
    { name: 'Sculpted Wool Coat',   qualifier: 'ash',                         season: 'January 2025' },
    { name: 'Architectural Ring',   qualifier: 'sterling, brutalist',         season: 'January 2025' },
  ],
  heldHeader: 'La suite',
  heldDescriptors: {
    'Pantalon Architecte':
      "Double-faced charcoal wool, single pleat, blind hem, unlined below the knee. La continuité du langage déjà dans le placard.",
    'Gilet Brut':
      "Raw-finish ash wool, dropped shoulder, no lining, interior seams exposed as detail.",
    'Bague Plane No. 4':
      "Sterling, flat-forged, 4mm band with a single interrupted surface — a quieter companion to the architectural ring.",
  },
  setAsideDescriptors: {
    'Capsule Trouser 07/40':
      'A numbered companion to the jacket 12/40, hand-inscribed and held with the piece.',
  },
  setAsideProvenance: {
    default: 'From the capsule release noted on order #1267.',
  },
  atelierTitle: 'Sur la question du foyer',
  atelierBody:
    'The home category has been open on this account since January. The ceramic vessel — 08/24 — was among the first signed objects to leave the atelier this year. A second object, a low basalt tray in the same edition language, is now available. It is not a set. It is a conversation between two surfaces.',
  invitationItem: 'Tissu Brut, au mètre',
  invitationLine:
    'Lengths of the raw linen used in the capsule linings — the same cloth, before it becomes anything. Adjacent to the objects already in the collection.',
  stylistNoteBody:
    "Le cabinet est ouvert mardi et jeudi de 10h à 18h. Le pantalon numéroté et le plateau en basalte vous attendent. Une note avant suffit.",
  stylistNoteSignedBy: 'Margaux',
  closingReflection:
    "Numbered pieces do not return. The maison s'élargit slowly — un objet, une coupe à la fois.",
  footerLine:
    'Les pièces numérotées ne reviennent pas en stock.',
  appointmentSlotPhrase: 'Margaux is in Tuesday and Thursday',
  appointmentSlots: ['Tuesday, May 13 — 10h–18h', 'Thursday, May 15 — 10h–18h'],
};

const OLIVIA: DemoCustomer = {
  displayName: 'Olivia Brennan',
  primaryCity: 'Aspen',
  stylistName: null,
  stylistBoutique: null,
  editorialIntro:
    'Two residences and two wardrobes that meet in the middle. The ski parka is hung for the season; the raffia tote came in last July. May is the threshold week between mountain and shore — pieces that travel well, a throw for cool evenings at the water, the storage of what kept you warm. The household account holds both addresses; anything reserved can go to whichever is current.',
  wornThisYearLabel: 'In the household',
  wornAnchors: [
    { name: 'Cashmere Down Puffer',   qualifier: 'ivory',                   season: 'December 2024' },
    { name: 'Technical Ski Parka',    qualifier: 'deep navy',               season: 'December 2025' },
    { name: 'Linen-Silk Caftan',      qualifier: 'white',                   season: 'July 2025' },
    { name: 'Beach Tote',             qualifier: 'raffia + natural leather', season: 'July 2025' },
  ],
  heldHeader: 'Held for the move to the coast',
  heldDescriptors: {
    'Linen-Silk Throw, Natural':
      'Generous 200 × 280 cm in undyed linen-silk, weighted enough for cool evenings on the water.',
    'Packable Canvas Overshirt, Oat':
      'Unlined, washed cotton-canvas, collarless — travels flat between addresses.',
    'Raffia Market Tote, Natural Leather Base':
      'A larger companion to the beach tote already in the household. Structured base, open top.',
  },
  setAsideDescriptors: {
    default: 'Held against the household account.',
  },
  setAsideProvenance: {
    default: 'Surfaced from the rotation between Aspen and Sag Harbor.',
  },
  atelierTitle: 'On seasonal storage — for the pieces that earned their winter',
  atelierBody:
    'The Technical Ski Parka and the Cashmere Down Puffer are now five months into their season. Maison Aurelle offers complimentary seasonal storage and conditioning for outerwear purchased through the house — cleaned, re-lofted, and held in climate-controlled conditions until the autumn window. A collection arrangement can be made from either address.',
  invitationItem: 'Ceramic Table Bowl',
  invitationLine:
    "The house's table objects — thrown in small runs, finished in oat and sand glazes — have found their way into a number of households that began, as yours did, with outerwear.",
  stylistNoteBody:
    "We work by appointment in Manhattan and out to the Hamptons. The first session is a conversation, not a sale — and either address can receive the pieces ahead of the summer.",
  stylistNoteSignedBy: 'The Crosby Street atelier',
  closingReflection:
    'The household has two seasons, and the wardrobe meets them in the middle. May holds, June ships, the parka returns in autumn.',
  footerLine:
    'The household account holds both addresses; anything reserved can be directed to whichever is current.',
  appointmentSlotPhrase: 'Crosby Street, New York — by appointment',
  appointmentSlots: ['Tuesday through Saturday', 'Morning slots open this week'],
};

const DEMO_CONTENT: Record<string, DemoCustomer> = {
  'isabella-chen':     ISABELLA,
  'marcus-whitfield':  MARCUS,
  'aria-petrov':       ARIA,
  'sebastian-laurent': SEBASTIAN,
  'olivia-brennan':    OLIVIA,
};

export function getDemoContent(slug: string | null | undefined, _register: RetailRegister): DemoCustomer | null {
  if (!slug) return null;
  return DEMO_CONTENT[slug] || null;
}

/** Resolve a held-for-you item's descriptor, falling back to the demo bank by item name. */
export function resolveDescriptor(
  itemName: string,
  cmsDescriptor: string | null | undefined,
  demo: DemoCustomer | null,
  category: 'held' | 'setAside' = 'held'
): string | null {
  if (cmsDescriptor && cmsDescriptor.trim()) return cmsDescriptor;
  if (!demo) return null;
  const bank = category === 'held' ? demo.heldDescriptors : demo.setAsideDescriptors;
  return bank[itemName] || bank.default || null;
}
