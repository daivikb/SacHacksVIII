import { useEffect, useRef, type CSSProperties } from "react";
import {
  type RocketPose,
  type RocketDirection,
  mascotStanding,
  mascotStandingYellow,
  rocketPlainPurple,
  rocketPlainYellow,
} from "@/assets/images";
import { layoutFor, useDevice } from "@/features/home/spot-config";

export type SpotArt =
  | { kind: "rocket"; pose: RocketPose; facing: RocketDirection; tilt?: number }
  | { kind: "standing" }
  | { kind: "robot" };

type Stage = "hidden" | "in" | "visible" | "out";

type Spot = {
  index: number;
  /** 13 + 14 share a group and always glitch together. */
  group: number | null;
  el: HTMLDivElement;
  sprite: HTMLElement;
  stage: Stage;
  until: number;
};

// Module-level state (shared across every RocketSpot instance on the page).
// This is what drives the "only one mascot glitches in at a time as you scroll"
// effect — it's a single sequencer watching every mounted spot at once.
const spots = new Set<Spot>();
let raf = 0;
let bound = false;
/** index of the sequential (1–12) spot currently owning the layer */
let holder: Spot | null = null;
/** a spot that wanted the stage while the previous burst was still running */
let pending: Spot | null = null;

const BURST_MS = 420;
/** the box is considered "about to leave" once its top is this close to the top edge */
const OUT_BAND = 6;

// Moves one spot into a new animation stage and (re)starts its CSS burst
// animation by toggling classes on its sprite/container elements.
function setStage(s: Spot, stage: Stage, now: number) {
  s.stage = stage;
  const cl = s.sprite.classList;
  cl.toggle("is-gin", stage === "in");
  cl.toggle("is-gout", stage === "out");
  s.el.classList.toggle("is-live", stage !== "hidden");
  if (stage === "in" || stage === "out") {
    // restart the burst animation cleanly by forcing a reflow
    void s.sprite.offsetWidth;
    s.until = now + BURST_MS;
  }
}

/** still worth showing if it was queued behind a neighbour's burst */
function loose(s: Spot, vh: number) {
  const r = s.el.getBoundingClientRect();
  return r.height > 0 && r.bottom > vh * 0.12 && r.top < vh * 0.88;
}

/** true if this spot's box is fully inside the "wants to be visible" viewport band */
function wants(s: Spot, vh: number) {
  const r = s.el.getBoundingClientRect();
  if (!r.height) return false;
  return r.bottom <= vh - 2 && r.top > -OUT_BAND;
}

// The core scheduler. Runs on every scroll/resize frame (via requestAnimationFrame)
// and decides which spots should be entering, visible, exiting, or hidden.
function paint(now: number) {
  raf = 0;
  const vh = window.innerHeight;

  // group 13/14: desired if either half is in range, and they move as one
  const groups = new Map<number, boolean>();
  spots.forEach((s) => {
    if (s.group === null) return;
    groups.set(s.group, (groups.get(s.group) ?? false) || wants(s, vh));
  });

  // among the sequential spots (1–12) only the one closest to the middle of the
  // viewport may hold the stage, so a lingering neighbour can never swallow a turn
  let best: Spot | null = null;
  let bestD = Infinity;
  spots.forEach((s) => {
    if (s.group !== null || !wants(s, vh)) return;
    const r = s.el.getBoundingClientRect();
    const d = Math.abs(r.top + r.height / 2 - vh / 2);
    if (d < bestD) { bestD = d; best = s; }
  });

  let busy = false;

  spots.forEach((s) => {
    const desired = s.group !== null ? groups.get(s.group)! : wants(s, vh) && best === s;

    if (s.stage === "in" || s.stage === "out") {
      busy = true;
      if (now >= s.until) {
        const next: Stage = s.stage === "in" ? "visible" : "hidden";
        setStage(s, next, now);
        if (next === "hidden" && holder === s) holder = null;
      }
      return;
    }

    if (s.group !== null) {
      // paired spots ignore the sequencer entirely
      if (desired && s.stage === "hidden") {
        setStage(s, "in", now);
        busy = true;
      } else if (!desired && s.stage === "visible") {
        setStage(s, "out", now);
        busy = true;
      }
      return;
    }

    if (s.stage === "visible") {
      if (!desired) {
        setStage(s, "out", now);
        busy = true;
      }
      return;
    }

    // hidden: may only enter once the previous spot has finished glitching out
    if (!holder || holder === s) {
      if (desired || (pending === s && loose(s, vh))) {
        if (pending === s) pending = null;
        holder = s;
        setStage(s, "in", now);
        busy = true;
      }
    } else if (desired) {
      // queued behind the previous burst — take the stage as soon as it frees
      pending = s;
      busy = true;
    }
  });

  if (busy) schedule();
}

function schedule() {
  if (!raf) raf = requestAnimationFrame(paint);
}

// Only one global scroll/resize listener no matter how many spots are mounted.
function bind() {
  if (bound) return;
  bound = true;
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
}

// Tears the shared listener down once the last spot unmounts (e.g. page nav away).
function release() {
  if (spots.size || !bound) return;
  bound = false;
  window.removeEventListener("scroll", schedule);
  window.removeEventListener("resize", schedule);
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  holder = null;
  pending = null;
}

/** default (purple) art */
function artFor(art: SpotArt) {
  return art.kind === "standing" ? mascotStanding : rocketPlainPurple;
}
/** yellow twin shown while the site is in the hover accent theme */
function artAltFor(art: SpotArt) {
  return art.kind === "standing" ? mascotStandingYellow : rocketPlainYellow;
}

export const RocketSpot = ({
  index,
  art,
  at,
  size,
  bubble,
  bubbleSide = "right",
  group = null,
}: {
  index: number;
  art: SpotArt;
  /** fallback position inside the section, in % (spot-config.ts wins if it has an entry) */
  at?: [number, number];
  size?: number;
  bubble?: string;
  bubbleSide?: "left" | "right";
  group?: number | null;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  // Re-renders this component whenever the viewport crosses a device breakpoint,
  // so layoutFor() below picks up the correct desktop/tablet/mobile values.
  const device = useDevice();

  // cfg holds the resolved position/size/tilt/etc for this spot at this device
  // width. Any field spot-config.ts doesn't define falls back to the props
  // passed in JSX (at/size/bubbleSide), then to a hardcoded default.
  const cfg = layoutFor(index, device);
  const pos = cfg.at ?? at ?? [50, 50];
  const width = cfg.size ?? size ?? 200;
  const facing = cfg.facing ?? (art.kind === "rocket" ? art.facing : "right");
  const tilt = cfg.tilt ?? (art.kind === "rocket" ? art.tilt ?? 0 : 0);
  const side = cfg.bubbleSide ?? bubbleSide;
  const bubbleOffset = cfg.bubbleAt ?? [0, 0];

  // Registers this spot with the shared scroll-triggered glitch sequencer above.
  // Skips registration entirely if the visitor has "reduce motion" set, in which
  // case the sprite just renders statically with no burst animation.
  useEffect(() => {
    const el = ref.current;
    const sprite = el?.querySelector<HTMLElement>(".rocket-sprite");
    if (!el || !sprite) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const spot: Spot = { index, group, el, sprite, stage: "hidden", until: 0 };
    spots.add(spot);
    bind();
    schedule();
    return () => {
      spots.delete(spot);
      if (holder === spot) holder = null;
      if (pending === spot) pending = null;
      release();
    };
  }, [index, group]);

  const src = artFor(art);
  const srcAlt = artAltFor(art);

  return (
    <div
      ref={ref}
      data-spot={index}
      className={`rocket-spot bubble-${side}`}
      style={{ left: `${pos[0]}%`, top: `${pos[1]}%`, width: `${width}px` }}
    >
      <span className="rocket-sprite" style={{ transform: tilt ? `rotate(${tilt}deg)` : undefined }}>
        <img className="rocket-base" src={src} alt="" loading="eager" decoding="async" />
        <img className="rocket-alt" src={srcAlt} alt="" aria-hidden="true" decoding="async" />
        <img className="rocket-glitch-slice slice-a" src={src} alt="" aria-hidden="true" />
        <img className="rocket-glitch-slice slice-b" src={src} alt="" aria-hidden="true" />
        <img className="rocket-glitch-slice slice-c" src={src} alt="" aria-hidden="true" />
      </span>
      {bubble && (
        <span
          className="rocket-bubble"
          style={
            {
              "--bx": `${bubbleOffset[0]}px`,
              "--by": `${bubbleOffset[1]}px`,
            } as CSSProperties
          }
        >
          {bubble}
        </span>
      )}
    </div>
  );
};