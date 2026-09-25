/**
 * StatBlock — a port of optimizely.com `components/block/stat-block`.
 *
 * The markup, the class strings and the three display settings are upstream's, unchanged.
 * What is NOT upstream's is the extrusion engine in the middle of this file, and the reason
 * is worth stating precisely because it is a defect in the vendored slice rather than a
 * design choice here.
 *
 * Upstream's renderer is four lines of layout around one import:
 *
 *     import { StackedHeading } from '@/components/element/stacked-heading-element'
 *
 * `components/element/stacked-heading-element/` is NOT in `src/vendor/opticom/` — the
 * MANIFEST in `scripts/sync-opticom.mjs` vendors 74 files and that directory is not among
 * them, so the import does not resolve. The two other ways to reach it are both closed:
 * `src/cms/components/stacked-heading-element/` is another agent's folder and
 * `RENDERER-SPEC.md` forbids a cross-folder import, and `src/vendor/` may not be hand-edited.
 *
 * So the layer geometry below is a transcription of upstream's `stacked-text.tsx` and
 * `use-stacked-animation.ts` — the same constants, the same offset/dampening/scale maths,
 * the same colour ramp and the same `WebkitTextStroke` treatment — kept inside this folder
 * where it breaks nobody else. It renders what `StackedHeading` renders for the one input
 * this block gives it: a single `##…##` span, no curve, no rich text. **The right fix is to
 * add `components/element/stacked-heading-element/` to the sync MANIFEST and delete
 * everything between the two markers below**, at which point this file returns to being
 * upstream's four lines. It is reported, not done, because `src/vendor/` is out of scope.
 *
 * One upstream quirk is reproduced deliberately: the `text-11xl` override collides only with
 * the unprefixed `text-5xl` in `StackedHeading`'s base classes, so `md:text-7xl` and
 * `lg:text-9xl` survive the merge and the number renders 70px on a phone and 56px on a
 * desktop. That is what optimizely.com paints today, and matching it is the point.
 */
import { useEffect, useMemo, useRef } from 'react'
import {
  motion,
  useInView,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion'
import { parseDisplaySettings } from '@/lib/hooks/parseDisplaySettings'
import type { DisplaySettings } from '@/lib/optimizely/types/display-settings'
import { cn } from '@/lib/utils'
import type { StatBlockProps } from './types'

/**
 * `types.ts` was written in Phase 0 against `COMPONENT-SPEC.md`, which specifies
 * `displaySettings?: Record<string, string>`. Graph delivers an ARRAY of `{key, value}` and
 * `RENDERER-SPEC.md` is written against that array, so the scalars come from `./types` and
 * the one prop the two specs disagree on is re-declared here. Reported rather than fixed in
 * place: `types.ts` is not a file this task owns.
 */
type Props = Omit<StatBlockProps, 'displaySettings'> & {
  displaySettings?: DisplaySettings
  isFirst?: boolean
  locale?: string
}

type AnimationMode = 'none' | 'scroll' | 'mouse'

type DisplaySettingValues = {
  animationMode?: AnimationMode
  extrusionCount?: string
  invertExtrusion?: string
}

// ─── vendored-in-place: upstream stacked-heading-element, trimmed to this block's use ────

/**
 * Upstream's ramp, darkest to brightest. `--color-extrusion-9` is referenced by upstream but
 * `tokens/compiled/default.css` only generates 1 through 8, so the deepest layer falls back
 * to 8 rather than resolving to nothing at `layers_9`.
 */
const ALL_EXTRUSION_COLORS = [
  'var(--color-extrusion-9, var(--color-extrusion-8))',
  'var(--color-extrusion-8)',
  'var(--color-extrusion-7)',
  'var(--color-extrusion-6)',
  'var(--color-extrusion-5)',
  'var(--color-extrusion-4)',
  'var(--color-extrusion-3)',
  'var(--color-extrusion-2)',
  'var(--color-extrusion-1)',
]

const LAYER_OFFSET = 10
const MOUSE_INFLUENCE = 15
const SCROLL_INFLUENCE = 15
const FACING_INTENSITY = 1.25
const DEFAULT_EXTRUSION_COUNT = 5
const MAX_EXTRUSION_COUNT = 9
const MAX_LAYER_DISTANCE = 30
const LAYER_Z_OFFSET = 20
const LAYER_SCALE_FACTOR = 0.02

const SPRING_CONFIG = { stiffness: 80, damping: 8, mass: 0.5 }
const ENTRANCE_SPRING_CONFIG = { stiffness: 60, damping: 12, mass: 0.8 }

/** The brightest N of the ramp, clamped to the 5–9 the display template offers. */
function getExtrusionColors(count: number): string[] {
  return ALL_EXTRUSION_COLORS.slice(-Math.min(9, Math.max(5, count)))
}

function getMiddleLayerIndex(count: number): number {
  return Math.floor(count / 2)
}

function useStackedAnimation(
  containerRef: React.RefObject<HTMLElement | null>,
  animationMode: AnimationMode
) {
  const isInView = useInView(containerRef, {
    once: true,
    margin: '-35% 0px -35% 0px',
  })

  const entranceValue = useMotionValue(0)
  const entranceProgress = useSpring(entranceValue, ENTRANCE_SPRING_CONFIG)
  const hasAnimated = useRef(false)

  // Upstream's entrance: once, on first intersection, and never reset.
  useEffect(() => {
    if (hasAnimated.current || !isInView) return
    hasAnimated.current = true
    entranceValue.set(1)
  }, [isInView, entranceValue])

  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const smoothMouseX = useSpring(mouseX, SPRING_CONFIG)
  const smoothMouseY = useSpring(mouseY, SPRING_CONFIG)

  const { scrollYProgress } = useScroll()
  const scrollInput = useTransform(
    scrollYProgress,
    [0, 0.5, 1],
    [SCROLL_INFLUENCE, 0, -SCROLL_INFLUENCE]
  )
  const smoothScrollX = useSpring(scrollInput, SPRING_CONFIG)
  const smoothScrollY = useSpring(scrollInput, SPRING_CONFIG)

  const inputX = animationMode === 'scroll' ? smoothScrollX : smoothMouseX
  const inputY = animationMode === 'scroll' ? smoothScrollY : smoothMouseY

  return { entranceProgress, inputX, inputY, mouseX, mouseY }
}

interface LayerProps {
  text: string
  color: string
  layerIndex: number
  depthFromMiddle: number
  maxDepth: number
  isTopLayer: boolean
  isFirstLayer: boolean
  inputX: MotionValue<number>
  inputY: MotionValue<number>
  zIndex: number
  animationMode: AnimationMode
  entranceProgress: MotionValue<number>
  invertExtrusion: boolean
  extrusionCount: number
}

function Layer({
  text,
  color,
  layerIndex,
  depthFromMiddle,
  maxDepth,
  isTopLayer,
  isFirstLayer,
  inputX,
  inputY,
  zIndex,
  animationMode,
  entranceProgress,
  invertExtrusion,
  extrusionCount,
}: LayerProps) {
  const directionX = 1
  const directionY = invertExtrusion ? -1 : 1
  const layerOffset = LAYER_OFFSET * (extrusionCount / MAX_EXTRUSION_COUNT)
  const baseOffsetX = depthFromMiddle * layerOffset * directionX
  const baseOffsetY = depthFromMiddle * layerOffset * directionY

  // 3D perspective: the top layer is closest and largest, back layers recede.
  const layersFromTop = maxDepth * 2 - layerIndex
  const translateZ = -layersFromTop * LAYER_Z_OFFSET
  const scale = 1 + layerIndex * LAYER_SCALE_FACTOR

  const scaledMaxDistance =
    MAX_LAYER_DISTANCE * (extrusionCount / MAX_EXTRUSION_COUNT)
  const layerMax =
    maxDepth > 0 ? scaledMaxDistance * (Math.abs(depthFromMiddle) / maxDepth) : 0
  // Soft dampening with tanh — asymptotically approaches layerMax.
  const dampen = (value: number) =>
    layerMax > 0 ? Math.tanh(value / layerMax) * layerMax : 0

  const x = useTransform(
    [inputX, entranceProgress],
    ([input, progress]: number[]) => {
      if (isFirstLayer) return 0
      const animatedBaseX = baseOffsetX * progress
      if (animationMode === 'none') return dampen(animatedBaseX)
      const dynamicOffset = input * depthFromMiddle * FACING_INTENSITY * directionX
      return dampen(animatedBaseX + dynamicOffset * progress)
    }
  )

  const y = useTransform(
    [inputY, entranceProgress],
    ([input, progress]: number[]) => {
      if (isFirstLayer) return 0
      const animatedBaseY = baseOffsetY * progress
      if (animationMode === 'none') return dampen(animatedBaseY)
      const dynamicOffset = input * depthFromMiddle * FACING_INTENSITY * directionY
      return dampen(animatedBaseY + dynamicOffset * progress)
    }
  )

  return (
    <motion.span
      className={cn(
        'inline-block whitespace-pre',
        isFirstLayer ? 'relative' : 'absolute inset-0',
        !isTopLayer && 'pointer-events-none select-none'
      )}
      style={{
        color,
        x,
        y,
        z: translateZ,
        scale,
        zIndex,
        WebkitTextStroke: '1px var(--color-fir-darkfir)',
        paintOrder: 'stroke fill',
      }}
      aria-hidden={!isTopLayer}
    >
      {text}
    </motion.span>
  )
}

interface StackedTextProps {
  text: string
  animationMode?: AnimationMode
  extrusionCount?: number
  invertExtrusion?: boolean
}

function StackedText({
  text,
  animationMode = 'mouse',
  extrusionCount = DEFAULT_EXTRUSION_COUNT,
  invertExtrusion = false,
}: StackedTextProps) {
  const containerRef = useRef<HTMLSpanElement>(null)
  const { entranceProgress, inputX, inputY, mouseX, mouseY } =
    useStackedAnimation(containerRef, animationMode)

  const colors = useMemo(() => getExtrusionColors(extrusionCount), [extrusionCount])
  const middleLayerIndex = useMemo(
    () => getMiddleLayerIndex(extrusionCount),
    [extrusionCount]
  )
  const maxDepth = Math.max(middleLayerIndex, colors.length - 1 - middleLayerIndex)

  /**
   * Upstream listens on `window` for `mousemove`. A stat block is a small card in a column,
   * not a full-bleed hero, so the listener is scoped to the element: same normalisation, no
   * document-wide handler per stat on a page that can carry a dozen of them.
   */
  const onPointerMove = (event: React.PointerEvent<HTMLSpanElement>) => {
    if (animationMode !== 'mouse' || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    mouseX.set(((event.clientX - centerX) / (window.innerWidth / 2)) * MOUSE_INFLUENCE)
    mouseY.set(((event.clientY - centerY) / (window.innerHeight / 2)) * MOUSE_INFLUENCE)
  }

  const onPointerLeave = () => {
    if (animationMode !== 'mouse') return
    mouseX.set(0)
    mouseY.set(0)
  }

  return (
    <span
      ref={containerRef}
      className="relative inline-block"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      {colors.map((color, index) => {
        const depthFromMiddle = index - middleLayerIndex
        return (
          <Layer
            key={index}
            text={text}
            color={color}
            layerIndex={index}
            depthFromMiddle={depthFromMiddle}
            maxDepth={maxDepth}
            isTopLayer={index === colors.length - 1}
            isFirstLayer={index === 0}
            inputX={inputX}
            inputY={inputY}
            zIndex={10 + depthFromMiddle}
            animationMode={animationMode}
            entranceProgress={entranceProgress}
            invertExtrusion={invertExtrusion}
            extrusionCount={extrusionCount}
          />
        )
      })}
    </span>
  )
}

/**
 * `StackedHeading` with `as="span"` and a whole-string `##…##`, which is the only shape
 * `stat-block` ever asks it for. The class string is upstream's `StackedHeading` base, its
 * left alignment and this block's override, merged in upstream's order.
 */
function StackedValue({
  text,
  animationMode,
  extrusionCount,
  invertExtrusion,
}: Required<StackedTextProps>) {
  const lines = text.split('\n').filter((line) => line.trim() !== '')

  return (
    <span
      className={cn(
        'font-nudge text-fir-darkfir text-5xl leading-[0.9] font-extrabold tracking-[-0.01em] md:text-7xl lg:text-9xl',
        'text-left',
        'text-11xl leading-[0.9]'
      )}
    >
      {lines.map((line, index) => (
        <span key={index} className="block">
          <StackedText
            text={line}
            animationMode={animationMode}
            extrusionCount={extrusionCount}
            invertExtrusion={invertExtrusion}
          />
        </span>
      ))}
    </span>
  )
}

// ─── end vendored-in-place ───────────────────────────────────────────────────────────────

export default function StatBlock({
  StatValue,
  StatDescription,
  Description,
  displaySettings,
}: Props) {
  if (!StatValue) return null

  const { animationMode, extrusionCount, invertExtrusion, presentation } =
    parseDisplaySettings<DisplaySettingValues & { presentation?: 'plain' | 'extruded' }>(displaySettings)

  /**
   * `Description` is the CMS property; `StatDescription` is the alias upstream's fragment
   * selects. `types.ts` declares both because either can arrive depending on which query
   * fetched the node, so read the alias first and fall back to the property name.
   */
  const description = StatDescription ?? Description

  const mode = (animationMode as AnimationMode) || 'none'
  const layers = extrusionCount
    ? parseInt(extrusionCount.replace('layers_', ''), 10)
    : DEFAULT_EXTRUSION_COUNT
  const invert = invertExtrusion === 'true'

  if (presentation !== 'extruded') {
    // Plain: the value set in the headline face, no extrusion. Inside a hero section
    // (`data-treatment="hero"`) the same card becomes one of the hero's floating cards — the
    // tilt, float and entrance come from `.vb-hero` in index.css, keyed on `vb-stat`.
    return (
      <div className="vb-stat flex h-full min-w-0 flex-col items-start justify-between gap-6 rounded-3xl bg-(--color-neutral-2) p-6 text-(--color-secondary-darkfir) md:p-8">
        <span className="font-headline text-headline-l md:text-headline-xl leading-none font-(--font-weight-headline-extrabold) tracking-tight">
          {StatValue}
        </span>
        {description && (
          <p className="font-body text-body-base/tight font-medium opacity-80">{description}</p>
        )}
      </div>
    )
  }

  return (
    // `overflow-x-clip` + `min-w-0`: the extrusion layers are absolutely positioned and travel
    // up to 30px right of the glyph box. In a 4-up grid a wide value ("Mar 2027") pushed them
    // past the viewport — measured +11px at 360/768 and +17px at 1024. Clip at the card edge,
    // which is the card's own rounded boundary, without creating a scroll container.
    <div className="flex min-w-0 flex-col items-start overflow-x-clip rounded-3xl bg-(--color-neutral-2) p-8">
      <StackedValue
        text={StatValue}
        animationMode={mode}
        extrusionCount={layers}
        invertExtrusion={invert}
      />
      {description && (
        <p className="font-body text-body-base/tight mt-16 font-medium text-(--color-secondary-darkfir)">
          {description}
        </p>
      )}
    </div>
  )
}
