/**
 * Curated luxury-fashion image bank.
 * The agent produces `imageDirection` (a one-sentence design brief) and item
 * names; the renderer maps those to a real photograph. Until the CMS has
 * proper asset references for each piece, this gives every section a real
 * image instead of a slate placeholder.
 *
 * All URLs are Unsplash (CC0). Sized via the Unsplash dynamic params so
 * they hot-link cleanly at any aspect ratio.
 *
 * To pick an image: pass the item name + image direction; the picker scores
 * each entry by keyword overlap and returns the best match (or falls back
 * to the register's default).
 */

import type { RetailRegister } from './graph-types';

interface ImageEntry {
  url: string;
  /** Keywords used for matching against name / direction text. Lowercased. */
  keywords: string[];
  /** Optional register affinity; favored when the page's register matches. */
  registers?: RetailRegister[];
  /** Short alt-text label for accessibility. */
  alt: string;
}

const BANK: ImageEntry[] = [
  // ── Outerwear ──
  { url: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=1400&q=80',
    keywords: ['coat', 'outerwear', 'wool', 'cashmere', 'anna', 'puffer'],
    registers: ['minimal', 'family'],
    alt: 'A wool coat draped over a chair in soft window light' },
  { url: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1400&q=80',
    keywords: ['trench', 'marais', 'gabardine', 'sand'],
    registers: ['minimal'],
    alt: 'A trench coat in soft natural light' },
  { url: 'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?auto=format&fit=crop&w=1400&q=80',
    keywords: ['blazer', 'jacket', 'linen-wool', 'tailored'],
    alt: 'A structured blazer in oat linen-wool' },
  { url: 'https://images.unsplash.com/photo-1485518882345-15568b007407?auto=format&fit=crop&w=1400&q=80',
    keywords: ['ski', 'parka', 'down', 'technical'],
    registers: ['family'],
    alt: 'Technical outerwear in soft mountain light' },

  // ── Knitwear ──
  { url: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=1400&q=80',
    keywords: ['knit', 'crewneck', 'cardigan', 'cashmere', 'merino', 'cote', 'oat'],
    registers: ['minimal', 'archive'],
    alt: 'A fine cashmere knit folded on linen' },
  { url: 'https://images.unsplash.com/photo-1583846783214-7229a91b20ed?auto=format&fit=crop&w=1400&q=80',
    keywords: ['stole', 'scarf', 'wrap', 'cashmere', 'vicuna', 'vicuña', 'charcoal'],
    alt: 'A folded cashmere stole in charcoal' },
  { url: 'https://images.unsplash.com/photo-1591369822096-ffd140ec948f?auto=format&fit=crop&w=1400&q=80',
    keywords: ['half-zip', 'sweater', 'mens'],
    alt: 'A cashmere half-zip sweater' },

  // ── Shirts / tailoring ──
  { url: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=1400&q=80',
    keywords: ['shirt', 'poplin', 'voile', 'bespoke', 'french cuff'],
    registers: ['archive'],
    alt: 'A white poplin shirt on a hanger' },
  { url: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1400&q=80',
    keywords: ['trouser', 'pants', 'flannel', 'wool-crepe', 'slate', 'pantalon'],
    alt: 'Tailored wool trousers' },

  // ── Leather goods ──
  { url: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1400&q=80',
    keywords: ['tote', 'bag', 'liane', 'beach tote', 'raffia'],
    alt: 'A leather tote on a wooden surface' },
  { url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1400&q=80',
    keywords: ['lume', 'shoulder', 'crossbody', 'mini bag'],
    registers: ['discovery'],
    alt: 'A leather shoulder bag in warm light' },
  { url: 'https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=1400&q=80',
    keywords: ['clutch', 'sera', 'python', 'evening bag', 'oxblood'],
    registers: ['discovery'],
    alt: 'An evening clutch in saturated leather' },
  { url: 'https://images.unsplash.com/photo-1590736969955-71cc94901144?auto=format&fit=crop&w=1400&q=80',
    keywords: ['wallet', 'card case', 'cardholder', 'zip wallet', 'ardoise'],
    alt: 'A small leather wallet on a stone surface' },

  // ── Shoes ──
  { url: 'https://images.unsplash.com/photo-1614252369475-531eba835eb1?auto=format&fit=crop&w=1400&q=80',
    keywords: ['oxford', 'derby', 'wholecut', 'shoe', 'mahogany', 'walnut'],
    registers: ['archive'],
    alt: 'A mahogany leather oxford shoe' },
  { url: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=1400&q=80',
    keywords: ['sandal', 'strappy', 'metallic'],
    registers: ['discovery'],
    alt: 'A metallic strappy sandal' },

  // ── Jewelry ──
  { url: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1400&q=80',
    keywords: ['earring', 'plis', 'gold', 'brushed gold', '18k'],
    alt: 'A pair of gold earrings on linen' },
  { url: 'https://images.unsplash.com/photo-1633555715049-0c7a01fce108?auto=format&fit=crop&w=1400&q=80',
    keywords: ['necklace', 'volute', 'pendant', 'double-drop'],
    registers: ['discovery'],
    alt: 'A delicate gold necklace' },
  { url: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=1400&q=80',
    keywords: ['cuff', 'bracelet', 'architectural', 'sterling', 'ring', 'brutalist'],
    registers: ['atelier'],
    alt: 'A sterling cuff bracelet' },

  // ── Dresses ──
  { url: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=1400&q=80',
    keywords: ['dress', 'silk', 'slip', 'bias'],
    alt: 'A silk slip dress on a hanger' },
  { url: 'https://images.unsplash.com/photo-1612722432474-b971cdcea546?auto=format&fit=crop&w=1400&q=80',
    keywords: ['caftan', 'hibou', 'linen-silk', 'silk-linen'],
    alt: 'A flowing linen-silk caftan' },

  // ── Home ──
  { url: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=1400&q=80',
    keywords: ['ceramic', 'vessel', 'bowl', 'inkwell', 'ink-well', 'pottery', 'vase'],
    registers: ['atelier', 'minimal'],
    alt: 'A ceramic vessel on a pale stone surface' },
  { url: 'https://images.unsplash.com/photo-1631679706909-1844bbd07221?auto=format&fit=crop&w=1400&q=80',
    keywords: ['blanket', 'throw', 'linen-silk throw', 'cashmere blanket'],
    alt: 'A folded cashmere throw' },
  { url: 'https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1400&q=80',
    keywords: ['bookend', 'desk', 'walnut', 'sculpture'],
    alt: 'A walnut bookend on a desk' },

  // ── Watches / vault ──
  { url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1400&q=80',
    keywords: ['watch', 'timepiece', 'dress watch', 'vault', '1972'],
    registers: ['archive'],
    alt: 'A vintage dress watch in soft light' },

  // ── Atelier / capsule (numbered) ──
  { url: 'https://images.unsplash.com/photo-1605518215584-eb9f86f0e80c?auto=format&fit=crop&w=1400&q=80',
    keywords: ['capsule', 'numbered', 'atelier jacket', 'sculpted'],
    registers: ['atelier'],
    alt: 'A sculpted atelier piece' },
  { url: 'https://images.unsplash.com/photo-1599391398131-cd12dfc6c24e?auto=format&fit=crop&w=1400&q=80',
    keywords: ['linen', 'raw', 'tissu', 'fabric', 'cloth'],
    alt: 'Lengths of raw linen draped on wood' },
];

const DEFAULT_BY_REGISTER: Record<RetailRegister, string> = {
  minimal:   'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=1400&q=80',
  archive:   'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=1400&q=80',
  discovery: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1400&q=80',
  atelier:   'https://images.unsplash.com/photo-1605518215584-eb9f86f0e80c?auto=format&fit=crop&w=1400&q=80',
  family:    'https://images.unsplash.com/photo-1485518882345-15568b007407?auto=format&fit=crop&w=1400&q=80',
};

/**
 * Pick the best image entry given a name + optional direction text.
 * Scoring: 2 points per keyword match, 1 bonus point for register match.
 */
export function pickImage(
  name: string,
  direction: string | null | undefined,
  register: RetailRegister
): { url: string; alt: string } {
  const haystack = `${name || ''} ${direction || ''}`.toLowerCase();
  if (!haystack.trim()) {
    return { url: DEFAULT_BY_REGISTER[register], alt: 'A Maison Aurelle still' };
  }

  let best: ImageEntry | null = null;
  let bestScore = 0;
  for (const entry of BANK) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (haystack.includes(kw)) score += 2;
    }
    if (entry.registers?.includes(register)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  if (best) return { url: best.url, alt: best.alt };
  return { url: DEFAULT_BY_REGISTER[register], alt: 'A Maison Aurelle still' };
}
