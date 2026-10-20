/**
 * The search page's scene: one of three photographs, picked per page load.
 *
 * Each comes as an AVIF ladder (WebP for browsers without AVIF) in two cuts:
 * the whole frame, and a 3:4 slice from its middle for portrait screens, so a
 * phone never downloads the two-thirds of a landscape photo it would crop
 * away. The files are made by a one-off sharp script (quality 36 AVIF / 62
 * WebP: the scene sits under a dark shade, which hides the compression).
 *
 * Pure: the server renders the same <picture> the browser hydrates.
 */

export type Scene = {
  id: 'river' | 'red-rock' | 'mountain';
  /** Width over height of the whole frame. */
  aspect: number;
  /** A 24px-wide WebP, shown blurred until the photograph arrives. */
  lqip: string;
};

export const SCENES: readonly Scene[] = [
  {
    id: 'river',
    aspect: 1.6528,
    lqip: 'data:image/webp;base64,UklGRrAAAABXRUJQVlA4IKQAAADwBACdASoYAA8APu1iqU2ppaOiMAgBMB2JaACdMoR8jf/qUALO+UjUxlLxshbRTwAA/gTvfZKkp8A960aU95Ye5aXDeGGOekuHJVaUYZ4HhtUBIDhZMK/NUiyyXDGWuZ7JNnjB4vzUI/Hs1mEasqCCIjsfK61uYCp+zFTWDLmgaHWVLrHmrvH+anr5yh4Nnc/bq3OLB19NAHw9H7KrCXWfFTgAAA==',
  },
  {
    id: 'red-rock',
    aspect: 1.5,
    lqip: 'data:image/webp;base64,UklGRpQAAABXRUJQVlA4IIgAAAAwBACdASoYABAAPu1iqU2ppaOiMAgBMB2JZgCdMoAC+4XRCE92PP9/lOAA3XGcCPBU8ytoD6zHKmCY0r4I8DWbPHvJ2QwOkBLOTqhKaVgi5OZB12Q/4apVKByJqRl35703lneDLQ75e2E3/TCSPpOx82e+U4v6tEPUlvGtXulXUiib1/H5L8AA',
  },
  {
    id: 'mountain',
    aspect: 1.4993,
    lqip: 'data:image/webp;base64,UklGRrgAAABXRUJQVlA4IKwAAABQBACdASoYABAAPu1iqU2ppaOiMAgBMB2JZACdEf/gPgC2iVoqhzY1ZwAAAP7X0qlRoJeEmfdTyllOGqYt86u/oWef+W0oMIvVntht3jrBc3/yJatXQJn1uFhZ3QOmkt2voH958qoiD8p3NCioeUyL86srAFB6nZ4xvxZv9NcCAYqLI/DZ24vs5aaRuQQBR9S65tmZSG4ovVECIjfxdtpkr18jGimrNldhyAAA',
  },
];

export const SCENE_DIR = '/home/scenes/v1';

const LADDER = {
  wide: { avif: [640, 960, 1280, 1600, 1920, 2400, 2880], webp: [960, 1600, 2400] },
  tall: { avif: [480, 720, 1080, 1440, 1800], webp: [720, 1440] },
} as const;

export type Cut = keyof typeof LADDER;
type Format = 'avif' | 'webp';

/** Screens at least this tall for their width get the portrait slice. */
export const TALL_MEDIA = '(max-aspect-ratio: 3/4)';
const TALL_ASPECT = 3 / 4;

/* The scene is the window less a 12–18px frame each side; 24px is the phone frame. */
const FRAME = '24px';

export function sceneSrc(id: Scene['id'], cut: Cut, width: number, format: Format): string {
  return `${SCENE_DIR}/${id}-${cut}-${width}.${format}`;
}

export function sceneSrcSet(id: Scene['id'], cut: Cut, format: Format): string {
  return LADDER[cut][format].map((w) => `${sceneSrc(id, cut, w, format)} ${w}w`).join(', ');
}

/**
 * How wide the photograph is drawn. It covers the scene, so on a screen
 * narrower than the photo's shape it is as tall as the scene and wider than it.
 */
export function sceneSizes(scene: Scene, cut: Cut): string {
  if (cut === 'tall') return `calc((100vh - ${FRAME}) * ${TALL_ASPECT})`;
  const a = scene.aspect;
  return `(max-aspect-ratio: ${Math.round(a * 1000)}/1000) calc((100vh - ${FRAME}) * ${a}), calc(100vw - ${FRAME})`;
}

export function sceneById(id: string | null | undefined): Scene | undefined {
  return SCENES.find((s) => s.id === id);
}

export function randomScene(): Scene {
  return SCENES[Math.floor(Math.random() * SCENES.length)];
}
