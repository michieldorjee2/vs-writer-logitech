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
  /** Paired suggestion — a new piece that accessorizes this anchor. */
  pairedWith?: {
    name: string;
    qualifier: string;
    /** Why this pairing — short editorial line. */
    note: string;
  };
}

export interface Polaroid {
  /** Image URL — typically an atmospheric still that evokes the customer's life. */
  imageUrl: string;
  /** Handwritten-feeling caption shown below the image. */
  caption: string;
  /** Initial rotation in degrees. Polaroids look natural at -10 to +10. */
  rotate: number;
  /** Approximate aspect for the photo (default 1:1). Use 0.75 for tall, 1.33 for wide. */
  aspect?: number;
}

export interface LetterContent {
  /** Greeting line — "Dear Isabella," */
  greeting: string;
  /** Paragraphs. Each rendered with stagger fade-in as the section enters view. */
  paragraphs: string[];
  /** Signature line ("— C.") */
  signoff: string;
}

export interface QA {
  q: string;
  a: string;
}

export interface DemoCustomer {
  displayName: string;
  primaryCity: string;
  stylistName: string | null;
  stylistBoutique: string | null;

  /** Initials shown in the hero's personal monogram — "I.C.", "M.W.", etc. */
  initials: string;
  /** Personal locale shown next to initials — typically a neighborhood, not the city. */
  neighborhood: string;
  /** Personal hero line — replaces the generic line1. References pieces she actually owns. */
  personalHeroLine1: string;
  personalHeroLine2: string;

  editorialIntro: string;
  letter: LetterContent;
  polaroids: Polaroid[];
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
  questions: QA[];
  footerLine: string;

  appointmentSlotPhrase?: string;
  appointmentSlots?: string[];
}

const ISABELLA: DemoCustomer = {
  displayName: 'Isabella Chen',
  primaryCity: 'New York',
  stylistName: 'Opal',
  stylistBoutique: 'Crosby Street',
  initials: 'I.C.',
  neighborhood: 'Tribeca',
  personalHeroLine1: 'After the Anna, before the linen.',
  personalHeroLine2: 'One piece in oat for the weeks the coats rest.',

  editorialIntro:
    "Four orders, two wardrobes — the spring you set down in March and the autumn you keep returning to. The Anna in camel, the Marais in sand, the Liane carried like an extension of the hand. This May, in the weeks between the coats and what comes after, the question is the bridge: a piece in oat linen-wool that holds the wardrobe together while the season turns. Camille has set three things aside, and one quieter object — to be seen if you'd like.",

  letter: {
    greeting: 'Dear Isabella,',
    paragraphs: [
      "Opal here, from the Crosby Street atelier. I've been holding the Plis pair since your last fitting — they came in on Tuesday morning, on the same delivery as the new oat merino. I thought of you when I unwrapped them.",
      "The Anna is in its third winter this fall. There's a way the wool-cashmere goes when it's been worn well — the shoulders settle, the lining loosens just slightly at the seams. We can re-line it without changing the fall. I've kept a swatch from the original run aside in case you'd like.",
      "The Marais has been the quieter friend, I think — it's the trench you take to the early appointments, not the long lunches. The blazer I've set out this week is meant to bridge the two: warm enough for May, soft enough that it doesn't fight with the silk.",
      "Come in when you can. I'll have everything ready.",
    ],
    signoff: '— Opal',
  },

  polaroids: [
    {
      imageUrl: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=900&q=80',
      caption: 'The Anna, on its hook.',
      rotate: -6,
    },
    {
      imageUrl: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=900&q=80',
      caption: 'Cashmere folded the way you like it.',
      rotate: 8,
    },
    {
      imageUrl: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=900&q=80',
      caption: 'The Plis, on linen — unwrapped this Tuesday.',
      rotate: -4,
    },
    {
      imageUrl: 'https://images.unsplash.com/photo-1444723121867-7a241cacace9?auto=format&fit=crop&w=900&q=80',
      caption: 'Crosby Street, morning light.',
      rotate: 9,
    },
    {
      imageUrl: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=900&q=80',
      caption: 'The atelier notebook, kept open at your page.',
      rotate: -10,
    },
    {
      imageUrl: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=900&q=80',
      caption: 'A swatch from the Anna run, set aside.',
      rotate: 5,
    },
  ],

  wornThisYearLabel: 'In your rotation',
  wornAnchors: [
    {
      name: 'Anna Coat',
      qualifier: 'camel wool-cashmere',
      season: 'autumn 2024',
      pairedWith: {
        name: 'Charcoal Woven Stole',
        qualifier: 'herringbone cashmere',
        note: 'A weight that sits between scarf and wrap. Carries the camel into late autumn.',
      },
    },
    {
      name: 'Marais Trench',
      qualifier: 'sand cotton-gabardine',
      season: 'autumn 2025',
      pairedWith: {
        name: 'Côte Knit',
        qualifier: 'oat merino, longer body',
        note: 'Cut to sit cleanly over the trench at the shoulder.',
      },
    },
    {
      name: 'Liane Tote',
      qualifier: 'espresso grained calf',
      season: 'autumn 2024',
      pairedWith: {
        name: 'Liane Zip Wallet',
        qualifier: 'same espresso hide',
        note: 'Carried in the hand, or set quietly inside the tote.',
      },
    },
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

  questions: [
    {
      q: 'Does the Côte come in deep navy?',
      a: 'Not in this run. The oat and the ink are the only two colours we developed for May. A navy is planned for autumn — I can hold a place on the list if you would like.',
    },
    {
      q: 'Where is the merino sourced?',
      a: 'A spinning house outside Biella, in the Italian Alps. The same supplier we have used for the Anna lining since 2019. The yarn is single-origin, traceable to the herd.',
    },
    {
      q: 'How long does relining the Anna take?',
      a: 'About a fortnight, including the time the coat spends with the maker. We collect from your address and return the piece the same way. No charge for outerwear bought through the house.',
    },
    {
      q: 'Can the blazer be tailored shorter?',
      a: 'Yes — the cut allows up to 4cm shorter without disturbing the pocket line. The atelier on Crosby Street will do the alteration in three days.',
    },
    {
      q: 'Is the Plis pair limited?',
      a: 'It is not a numbered piece, but the long-drop variation runs about twelve a season. There are six left.',
    },
    {
      q: 'Could it be sent to Tribeca tomorrow?',
      a: 'Yes. Same-day in Manhattan if you reserve before 3pm; tomorrow morning otherwise. Either way the pieces travel in linen.',
    },
  ],

  footerLine:
    'Pieces are held by appointment. Write to your stylist any time.',

  appointmentSlotPhrase: 'Camille has availability at Crosby Street this month',
  appointmentSlots: ['Thursday, May 21 — afternoon', 'Friday, May 22 — morning'],
};

// Stubs for the other four — fallbacks if their pages get created.
const MARCUS: DemoCustomer = {
  displayName: 'Marcus Whitfield',
  primaryCity: 'London',
  stylistName: 'Opal',
  stylistBoutique: 'Mount Street',
  initials: 'M.W.',
  neighborhood: 'Mayfair',
  personalHeroLine1: 'The second pair, the third cloth.',
  personalHeroLine2: 'The 1972 file is bound; the Oxford is due for its first resole.',
  editorialIntro:
    "Three orders, four objects of consequence — the 1972 dress watch with its original strap retained, the Mahogany Oxford coming up on its first resole, the bespoke shirts in pairs. May is the threshold month for what comes next: a second shoe in conversation with the first, a third cloth to sit alongside poplin and voile. Edward has the provenance file on hand and a quiet pair of objects on the cabinet shelf, ready when you are.",
  letter: {
    greeting: 'Dear Mr. Whitfield,',
    paragraphs: [
      "The provenance file on the 1972 is complete. I had it bound this week alongside the strap — the original kept flat, the new walnut leather drawn for comparison at the same age.",
      "The Mahogany Oxford is approaching the window for its first resole. The maker has the lasts on file; the work takes ten days. If you'd like, I can have them collected next time the box goes out.",
      "I'd suggest the Walnut Wholecut for the second pair — a warmer register without leaving the family. And a third shirt cloth alongside the poplin and voile when you're ready.",
      "Tea at four if it suits.",
    ],
    signoff: '— Opal',
  },
  polaroids: [
    { imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80', caption: 'The 1972, on the desk.', rotate: -7 },
    { imageUrl: 'https://images.unsplash.com/photo-1614252369475-531eba835eb1?auto=format&fit=crop&w=600&q=80', caption: 'The Mahogany Oxford, kept on the rack.', rotate: 6 },
    { imageUrl: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=600&q=80', caption: 'Shirts in pairs, French cuff.', rotate: -3 },
    { imageUrl: 'https://images.unsplash.com/photo-1495707902641-75cac588d2e9?auto=format&fit=crop&w=600&q=80', caption: 'Mount Street, four o\'clock.', rotate: 9 },
    { imageUrl: 'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=600&q=80', caption: 'The provenance file, bound.', rotate: -8 },
    { imageUrl: 'https://images.unsplash.com/photo-1583846783214-7229a91b20ed?auto=format&fit=crop&w=600&q=80', caption: 'Vicuña in ash.', rotate: 4 },
  ],
  wornThisYearLabel: 'In the wardrobe',
  wornAnchors: [
    {
      name: '1972 Dress Watch',
      qualifier: 'vault, original strap retained',
      season: 'June 2025',
      pairedWith: { name: 'Walnut Leather Strap', qualifier: 'aged calf', note: 'Drawn for the same patina at the same age.' },
    },
    {
      name: 'Mahogany Oxford',
      qualifier: 'burnished calf',
      season: 'November 2024',
      pairedWith: { name: 'Walnut Wholecut', qualifier: 'second pair, warmer register', note: 'A complement, not a substitute, once the first goes for resole.' },
    },
    {
      name: 'Vicuña Scarf',
      qualifier: 'ash',
      season: 'December 2025',
      pairedWith: { name: 'Cream Poplin Shirt', qualifier: 'French-cuff block on file', note: 'A third cloth alongside poplin and voile.' },
    },
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
  questions: [
    { q: 'When is the next vault release?', a: 'A second dress watch from 1968 is on the cabinet through June 27. Provenance file is bound.' },
    { q: 'Where is the maker for the Oxford?', a: 'Northampton, the same house we have used since the line opened. Resole takes ten days.' },
    { q: 'Can the cuff be re-monogrammed?', a: 'Yes — three letters, hand-engraved. The work happens here at Mount Street, two weeks.' },
  ],
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
  initials: 'A.P.',
  neighborhood: 'Miami Beach',
  personalHeroLine1: 'The third light of the Lume family.',
  personalHeroLine2: 'Citron, fuchsia — and the one the season chose.',
  editorialIntro:
    'Two capsules in motion — the Lume bag family in citron and fuchsia, the Volute jewelry pair in gold-vermeil. May arrives as the season the third colorway lands and the silhouette of the wrist is added to the conversation. No stylist on file yet; the next time you stop into Miami Design District, the new Lume and the cuff that pairs to your Volute will both be on the cabinet.',
  letter: {
    greeting: 'Dear Aria,',
    paragraphs: [
      "The Miami Design District boutique is open Wednesday through Saturday. We don't expect a visit — but if you'd like to see the new Lume in its third colorway, the box is on the cabinet by the window.",
      "Three pieces from your wishlist have arrived this week. We've kept the Hibou in the ivory-and-gold print and the second Volute, oxidized, on a private hold against this account through the end of May.",
      "The Lume family was made to travel together. The shoulder in warm amber arrived ahead of the others; it sits one shade quieter than the fuchsia and one warmer than the citron. The collection adds up the way a colour study does.",
      "Come by, or send word. The bag will wait.",
    ],
    signoff: '— Opal',
  },
  polaroids: [
    { imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=600&q=80', caption: 'The new Lume — third colour.', rotate: -8 },
    { imageUrl: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=600&q=80', caption: 'The Volute, paired.', rotate: 7 },
    { imageUrl: 'https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=600&q=80', caption: 'The Sera, oxblood, in the evening.', rotate: -5 },
    { imageUrl: 'https://images.unsplash.com/photo-1612722432474-b971cdcea546?auto=format&fit=crop&w=600&q=80', caption: 'The Hibou caftan, ivory and gold.', rotate: 9 },
    { imageUrl: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?auto=format&fit=crop&w=600&q=80', caption: 'Miami Design District, Saturday.', rotate: -9 },
    { imageUrl: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=600&q=80', caption: 'Metallic sandal, the way you wear them.', rotate: 6 },
  ],
  wornThisYearLabel: 'In your collection',
  wornAnchors: [
    {
      name: 'Lume Mini Bag',
      qualifier: 'citron',
      season: 'August 2025',
      pairedWith: { name: 'Lume Shoulder, Warm Amber', qualifier: 'mid-size, burnished calf', note: 'The third light of the family.' },
    },
    {
      name: 'Volute Necklace',
      qualifier: 'gold-vermeil, double-drop',
      season: 'January 2026',
      pairedWith: { name: 'Volute Cuff', qualifier: 'gold-vermeil, brushed', note: 'The wrist added to the conversation.' },
    },
    {
      name: 'Sera Clutch',
      qualifier: 'oxblood python-stamped',
      season: 'February 2025',
      pairedWith: { name: 'Sera Sandal', qualifier: 'low-heel, oxblood', note: 'Closes the pairing the clutch has been waiting for.' },
    },
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
  questions: [
    { q: 'Will the Lume come in deep emerald?', a: 'Not for this season. The amber is the third colour; emerald is on the autumn board, in patent.' },
    { q: 'Can I see the Sera in oxblood at the boutique?', a: 'It is on the cabinet at the Miami Design District atelier from Wednesday. Coffee, no expectation.' },
    { q: 'Is the Volute cuff adjustable?', a: 'Yes — the inner band is tightened by a hidden hinge. Sized at the atelier in five minutes.' },
  ],
  footerLine:
    'Maison Aurelle holds a boutique in the Miami Design District since 2014. By appointment, by request, or by walk-in.',
  appointmentSlotPhrase: 'Private viewings — Miami Design District',
  appointmentSlots: ['Thursday, May 15 — 11h', 'Saturday, May 17 — 14h'],
};

const SEBASTIAN: DemoCustomer = {
  displayName: 'Sebastian Laurent',
  primaryCity: 'Paris',
  stylistName: 'Opal',
  stylistBoutique: 'rue Saint-Honoré',
  initials: 'S.L.',
  neighborhood: '1er arrondissement',
  personalHeroLine1: 'Le pantalon, 07/40.',
  personalHeroLine2: 'Numbered, paired to the jacket already in the closet.',
  editorialIntro:
    "Le pantalon. La capsule jacket 12/40 already in your closet, the ceramic 08/24 on the dining room shelf — la maison s'élargit objet par objet. May brings a numbered companion to the trouser, a basalt tray in the same edition language, and a length of raw linen for those who work with their hands. Margaux is at rue Saint-Honoré through Saturday; the cabinet is open, no reservation required for a first look.",
  letter: {
    greeting: 'Cher Sebastian,',
    paragraphs: [
      "The capsule trouser numbered 07/40 has been kept aside with the jacket already in your closet. The hand-card is inscribed and held with the piece.",
      "The basalt tray came in this week — same edition language as the ceramic vessel that left here in January. It is not a set. It is a conversation between two surfaces.",
      "Raw linen by the metre is now available; the same cloth that lines the capsule, before it becomes anything. For those who work with their hands, or simply want the material itself.",
      "Le cabinet est ouvert mardi et jeudi de 10h à 18h. Une note avant suffit.",
    ],
    signoff: '— Opal',
  },
  polaroids: [
    { imageUrl: 'https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?auto=format&fit=crop&w=600&q=80', caption: '12/40, kept on the rail.', rotate: -7 },
    { imageUrl: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=600&q=80', caption: '08/24, on the shelf.', rotate: 8 },
    { imageUrl: 'https://images.unsplash.com/photo-1599391398131-cd12dfc6c24e?auto=format&fit=crop&w=600&q=80', caption: 'Tissu brut, before the cut.', rotate: -6 },
    { imageUrl: 'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=600&q=80', caption: 'Le carnet, ouvert.', rotate: 4 },
    { imageUrl: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=600&q=80', caption: 'Sterling, flat-forged.', rotate: 9 },
    { imageUrl: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1?auto=format&fit=crop&w=600&q=80', caption: 'Rue Saint-Honoré, mardi.', rotate: -9 },
  ],
  wornThisYearLabel: 'Dans la maison',
  wornAnchors: [
    {
      name: 'Capsule Jacket 12/40',
      qualifier: 'numbered, charcoal',
      season: 'September 2025',
      pairedWith: { name: 'Capsule Trouser 07/40', qualifier: 'hand-numbered', note: 'A numbered companion, paired and inscribed.' },
    },
    {
      name: 'Ceramic Vessel 08/24',
      qualifier: 'atelier signed',
      season: 'January 2026',
      pairedWith: { name: 'Basalt Tray', qualifier: 'same edition language', note: 'It is not a set. A conversation between two surfaces.' },
    },
    {
      name: 'Architectural Ring',
      qualifier: 'sterling, brutalist',
      season: 'January 2025',
      pairedWith: { name: 'Bague Plane No. 4', qualifier: 'sterling, flat-forged', note: 'A quieter companion on the same hand.' },
    },
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
  questions: [
    { q: 'Combien reste-t-il du pantalon 07/40 ?', a: 'Quatre pièces dont la vôtre, déjà inscrite. Les autres partiront avant la fin de mai.' },
    { q: "What's the firing run for the basalt tray?", a: 'Twenty-four trays, each signed. 08/24 to 31/24. The early numbers tend to leave first.' },
    { q: 'Can the capsule trouser be re-fitted?', a: 'Yes — Margaux marks the chalk at rue Saint-Honoré. Final fitting is included with the piece.' },
  ],
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
  initials: 'O.B.',
  neighborhood: 'Aspen & Sag Harbor',
  personalHeroLine1: 'From the mountain to the shore.',
  personalHeroLine2: 'The parka into storage, the throw onto the porch.',
  editorialIntro:
    'Two residences and two wardrobes that meet in the middle. The ski parka is hung for the season; the raffia tote came in last July. May is the threshold week between mountain and shore — pieces that travel well, a throw for cool evenings at the water, the storage of what kept you warm. The household account holds both addresses; anything reserved can go to whichever is current.',
  letter: {
    greeting: 'For the Brennan household,',
    paragraphs: [
      "The technical parka and the cashmere puffer are at the end of their season. Aurelle offers seasonal storage on outerwear bought through the house — cleaned, re-lofted, held in climate-controlled conditions until autumn. A collection can be arranged from either address.",
      "Three pieces are held for the coast: a generous linen-silk throw for cooler evenings on the water, a packable canvas overshirt that travels flat, and a larger raffia tote alongside the one already in the household.",
      "Anything reserved can be sent to Aspen or to Sag Harbor — whichever is current the week it ships.",
      "Crosby Street, Tuesday through Saturday, by appointment.",
    ],
    signoff: '— Opal',
  },
  polaroids: [
    { imageUrl: 'https://images.unsplash.com/photo-1485518882345-15568b007407?auto=format&fit=crop&w=600&q=80', caption: 'The ski parka, hung for the season.', rotate: -8 },
    { imageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=600&q=80', caption: 'The cashmere puffer, ivory.', rotate: 7 },
    { imageUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=600&q=80', caption: 'Raffia tote, kept by the door.', rotate: -5 },
    { imageUrl: 'https://images.unsplash.com/photo-1612722432474-b971cdcea546?auto=format&fit=crop&w=600&q=80', caption: 'The linen-silk caftan, for July.', rotate: 9 },
    { imageUrl: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=600&q=80', caption: 'Table objects, in oat glaze.', rotate: -6 },
    { imageUrl: 'https://images.unsplash.com/photo-1631679706909-1844bbd07221?auto=format&fit=crop&w=600&q=80', caption: 'Cashmere throw, folded.', rotate: 6 },
  ],
  wornThisYearLabel: 'In the household',
  wornAnchors: [
    {
      name: 'Technical Ski Parka',
      qualifier: 'deep navy',
      season: 'December 2025',
      pairedWith: { name: 'Seasonal Storage', qualifier: 'cleaned, re-lofted, held in cold rooms', note: 'Returned to Aspen September 30 — no charge for outerwear bought through the house.' },
    },
    {
      name: 'Linen-Silk Caftan',
      qualifier: 'white',
      season: 'July 2025',
      pairedWith: { name: 'Linen-Silk Throw, Natural', qualifier: 'undyed, 200×280cm', note: 'Weighted enough for cool evenings on the water.' },
    },
    {
      name: 'Beach Tote',
      qualifier: 'raffia + natural leather',
      season: 'July 2025',
      pairedWith: { name: 'Raffia Market Tote', qualifier: 'larger, structured base', note: 'A larger companion to the one already by the door.' },
    },
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
  questions: [
    { q: 'When does the parka come back?', a: 'September 30, to Aspen. Cleaned, re-lofted, ready for the first snow.' },
    { q: 'Can the kids cashmere be replaced if outgrown?', a: 'Yes — we hold the next size in oat against the household account and ship when needed.' },
    { q: 'Could the throw be sent to Sag Harbor next week?', a: 'Yes. Either Friday or Tuesday — we route to whichever address is current.' },
  ],
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
