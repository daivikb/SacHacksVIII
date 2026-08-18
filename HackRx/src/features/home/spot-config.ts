/**
 * Mascot spot layout — single source of truth for every RocketSpot position.
 *
 * Coordinates are percentages of the parent section; they address the CENTRE of
 * the sprite (the spot is translated by -50%/-50%).
 *
 * There is one layout per device class. The desktop entry in SPOT_LAYOUT is the
 * full, required layout for every spot index. Tablet and mobile entries only need
 * to list the values that differ from desktop — anything missing falls back to
 * the desktop entry via layoutFor() below.
 *
 * These values are static now. The old drag-and-drop calibration tool has been
 * removed from the app, so to reposition a spot you edit the numbers directly.
 */
import { useSyncExternalStore } from "react";

// Shape of a single spot. Every field except `at` is optional because most spots
// only need a position — size/tilt/facing/bubble placement fall back to sane
// defaults supplied by the component that renders them (RocketSpot.tsx).
export type SpotLayout = {
  at: [number, number]; // [x%, y%] of the spot's centre within its parent section
  size?: number; // sprite width in px
  /** which way the rocket nose points (overrides the value passed in JSX) */
  facing?: "left" | "right";
  /** sprite rotation in degrees */
  tilt?: number;
  /** which side of the sprite the hover bubble hangs off */
  bubbleSide?: "left" | "right";
  /** extra hover-bubble offset in px, [dx, dy] */
  bubbleAt?: [number, number];
};

export type Device = "desktop" | "tablet" | "mobile";

/** breakpoints must match the CSS ones used for the register section */
export function deviceFor(width: number): Device {
  if (width <= 640) return "mobile";
  if (width <= 1024) return "tablet";
  return "desktop";
}

// Full desktop layout, required entry for every spot index the app uses.
// Spot 13 = the standing mascot next to the register button, spot 14 = the rocket.
export const SPOT_LAYOUT: Record<number, SpotLayout> = {
  13: { at: [14, 66.5], size: 115, bubbleAt: [33, 55] },
  14: { at: [87.5, 45], size: 135 },
};

// Tablet overrides. Only fields that differ from SPOT_LAYOUT are listed here;
// everything else is inherited from the desktop entry above.
export const SPOT_LAYOUT_TABLET: Record<number, Partial<SpotLayout>> = {
  13: { at: [18, 71], size: 100, bubbleAt: [30, 62] },
  14: { at: [87, 50.5], size: 250, tilt: -35 },
};

// Mobile overrides, same idea as tablet but for narrow viewports.
export const SPOT_LAYOUT_MOBILE: Record<number, Partial<SpotLayout>> = {
  13: { at: [11, 71.5], size: 75, bubbleAt: [-14, 11] },
  14: { at: [85, 59.5], size: 150, tilt: -35 },
};

// Groups all three layouts by device so layoutFor() can key into this instead
// of writing a chain of if/else statements every time it's called.
export const DEVICE_LAYOUTS: Record<Device, Record<number, Partial<SpotLayout>>> = {
  desktop: SPOT_LAYOUT,
  tablet: SPOT_LAYOUT_TABLET,
  mobile: SPOT_LAYOUT_MOBILE,
};

// Human-readable labels. Not used for rendering, just handy if you ever want to
// log or debug which spot index corresponds to which real element.
export const SPOT_LABELS: Record<number, string> = {
  13: "Register — standing mascot",
  14: "Register — rocket",
};

/**
 * Resolves the final layout for a spot at the current viewport width.
 * Desktop values are the base; tablet/mobile only overwrite the fields they
 * define (that's what the object spread below is doing), everything else falls
 * back to the desktop base.
 *
 * `device` defaults to reading the live window width, so most callers can just
 * write layoutFor(index) and get the right answer. It's an explicit optional
 * param mainly so this still works safely if it's ever called during
 * server-side rendering, where `window` doesn't exist.
 */
export function layoutFor(
  index: number,
  device: Device = typeof window !== "undefined" ? deviceFor(window.innerWidth) : "desktop"
): SpotLayout {
  const base = SPOT_LAYOUT[index] ?? { at: [50, 50] }; // safe fallback if an index is ever missing
  if (device === "desktop") return base;
  const override = DEVICE_LAYOUTS[device][index];
  return override ? { ...base, ...override } : base;
}

// --- resize subscription -----------------------------------------------------
// RocketSpot needs to re-render when the viewport crosses a device breakpoint
// (say, resizing the window from desktop width down to tablet width) so
// layoutFor() picks up the new values. useSyncExternalStore is React's
// recommended way to subscribe a component to something that lives outside
// React's own state, here, window.innerWidth.

function subscribeToResize(onChange: () => void) {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

/** Returns the current device class and re-renders the calling component on resize. */
export function useDevice(): Device {
  return useSyncExternalStore(
    subscribeToResize,
    () => deviceFor(window.innerWidth), // client snapshot: live width
    () => "desktop" // server snapshot: safe default, avoids an SSR crash
  );
}