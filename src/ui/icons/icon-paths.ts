/**
 * Icon data table (DESIGN_SYSTEM §7): 24 px grid, 2 px round strokes in currentColor, filled accents.
 * Inner SVG markup only; src/ui/icons/icon.ts wraps it. Accent tints use fill-opacity so icons recolour with `color`.
 * `--icon-hole` (default white) colours the cut-outs in filled glyphs (pin centre, toggles).
 */
const T = 'fill="currentColor" fill-opacity=".2" stroke="none"';
const F = 'fill="currentColor" stroke="none"';

export const ICONS = {
  // ── navigation & status ──
  pin: `<path ${F} d="M12 22s-7-6.4-7-12a7 7 0 0 1 14 0c0 5.6-7 12-7 12z"/><circle cx="12" cy="10" r="2.7" fill="var(--icon-hole,#fff)" stroke="none"/>`,
  flag: `<path ${T} d="M5.5 4.5h11l-2 4 2 4h-11z"/><path d="M5.5 21V4M5.5 4.5h11l-2 4 2 4h-11"/>`,
  nav: `<path ${F} stroke="currentColor" stroke-width="1.6" d="M12 2.8l7.2 17.6L12 16.3l-7.2 4.1z"/>`,
  route: `<path stroke-dasharray="2.6 3.2" d="M6.5 19c0-4.5 11-3 11-7.8S10 7.5 10 4.8"/><circle ${F} cx="6.5" cy="19.5" r="2"/><path ${F} d="M10 1.8a2.6 2.6 0 0 1 2.6 2.6c0 1.9-2.6 4.1-2.6 4.1S7.4 6.3 7.4 4.4A2.6 2.6 0 0 1 10 1.8z"/>`,
  map: `<path ${T} d="M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5z"/><path d="M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5zM9 4.5v13M15 6.5v13"/>`,
  clock: `<circle cx="12" cy="12" r="8.6"/><path d="M12 7.2V12l3.2 2.1"/>`,
  warning: `<path ${T} d="M10.3 4.2 2.8 17.5a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M10.3 4.2 2.8 17.5a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0zM12 9.5v4.2M12 17v.2"/>`,
  wrongway: `<circle ${F} cx="12" cy="12" r="9.2"/><path stroke="var(--icon-hole,#fff)" stroke-width="3.2" d="M7.2 12h9.6"/>`,
  walk: `<circle cx="13.2" cy="4.4" r="1.9"/><path d="M10 21l2.2-5.6-2.6-2.6 1.1-5.1 3 3 3 1.1M9.6 8 7 9.6 6.1 13M12.2 15.4 14.7 21"/>`,
  tuck: `<path d="M3.5 12h6M6.8 8.7 10 12l-3.2 3.3M20.5 12h-6M17.2 8.7 14 12l3.2 3.3"/><path d="M12 4v16" stroke-dasharray="1.5 3"/>`,
  spark: `<path ${F} d="M12 2.2l2.2 7.1 7.1 2.7-7.1 2.7L12 21.8l-2.2-7.1L2.7 12l7.1-2.7z"/>`,
  bolt: `<path ${F} stroke="currentColor" stroke-width="1.2" d="M13.5 2.5 5 13.6h6.2l-1.2 7.9 8.5-11.2h-6.3z"/>`,

  // ── weather & time ──
  sun: `<circle ${F} cx="12" cy="12" r="4.3"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4 7 7M17 17l1.6 1.6M5.4 18.6 7 17M17 7l1.6-1.6"/>`,
  moon: `<path ${F} d="M19.8 14.6A8.2 8.2 0 0 1 9.4 4.2a8.2 8.2 0 1 0 10.4 10.4z"/><path d="M17 3.5v3M15.5 5h3"/>`,
  cloud: `<path ${T} d="M7 18.5a4.6 4.6 0 0 1-.7-9.1 6.1 6.1 0 0 1 11.4-.8 4.5 4.5 0 0 1-.2 9.9z"/><path d="M7 18.5a4.6 4.6 0 0 1-.7-9.1 6.1 6.1 0 0 1 11.4-.8 4.5 4.5 0 0 1-.2 9.9z"/>`,
  rain: `<path ${T} d="M7 15a4.2 4.2 0 0 1-.6-8.3 5.6 5.6 0 0 1 10.6-.7A4 4 0 0 1 17 15z"/><path d="M7 15a4.2 4.2 0 0 1-.6-8.3 5.6 5.6 0 0 1 10.6-.7A4 4 0 0 1 17 15zM8.2 18l-1 2.5M12.2 18l-1 2.5M16.2 18l-1 2.5"/>`,
  haze: `<path d="M3 7.5c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0M3 12c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0M3 16.5c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0"/>`,
  heat: `<path ${T} d="M10 14.4V5a2 2 0 0 1 4 0v9.4a4 4 0 1 1-4 0z"/><path d="M10 14.4V5a2 2 0 0 1 4 0v9.4a4 4 0 1 1-4 0zM12 9v7.5"/><path d="M17.5 6.5h2M17.5 10h2"/>`,
  drop: `<path ${T} d="M12 3s-6 6.6-6 11a6 6 0 0 0 12 0c0-4.4-6-11-6-11z"/><path d="M12 3s-6 6.6-6 11a6 6 0 0 0 12 0c0-4.4-6-11-6-11zM9 14.5a3 3 0 0 0 3 3"/>`,

  // ── rider & gear ──
  helmet: `<path ${T} d="M4 16.5V15a8 8 0 0 1 16 0v1.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5z"/><path d="M4 16.5V15a8 8 0 0 1 16 0v1.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5zM12.4 7.1c-.4 2.2.3 4.6 2.7 5H20"/>`,
  bike: `<circle cx="5.5" cy="16.5" r="3"/><circle cx="18.5" cy="16.5" r="3"/><path d="M8.5 16.5h5.6l2.6-8.2h2.6M15 5.2h2.4l1.1 3.1M4.5 11.6h6.2l2.1 4.9"/><path ${T} d="M4.5 11.6h6.2l2.1 4.9H8.5a3 3 0 0 0-4-4.9z"/>`,
  shirt: `<path ${T} d="M8.5 3.5 4 6l1.6 4.4 2.4-1v11h8v-11l2.4 1L20 6l-4.5-2.5a3.5 3.5 0 0 1-7 0z"/><path d="M8.5 3.5 4 6l1.6 4.4 2.4-1v11h8v-11l2.4 1L20 6l-4.5-2.5a3.5 3.5 0 0 1-7 0z"/>`,
  box: `<path ${T} d="M4 11h16v6.5A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z"/><path d="M5.5 7h13A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9A1.5 1.5 0 0 1 5.5 7zM4 11h16M10 11v2.6h4V11M8 7l1-2.5h6L16 7"/>`,
  palette: `<path ${T} d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.1-.9-1.4-.9-2.4 0-.9.7-1.4 1.7-1.4h2a3.8 3.8 0 0 0 3.9-3.9c0-4.2-3.8-7.6-8.5-7.6z"/><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.1-.9-1.4-.9-2.4 0-.9.7-1.4 1.7-1.4h2a3.8 3.8 0 0 0 3.9-3.9c0-4.2-3.8-7.6-8.5-7.6z"/><circle ${F} cx="7.6" cy="11.2" r="1.3"/><circle ${F} cx="10.4" cy="7.4" r="1.3"/><circle ${F} cx="15" cy="7.9" r="1.3"/>`,
  raincoat: `<path ${T} d="M8.5 8V6.8a3.5 3.5 0 0 1 7 0V8l3.9 2.5-1.3 3.7-1.6-.7.9 7H6.6l.9-7-1.6.7-1.3-3.7z"/><path d="M8.5 8V6.8a3.5 3.5 0 0 1 7 0V8l3.9 2.5-1.3 3.7-1.6-.7.9 7H6.6l.9-7-1.6.7-1.3-3.7zM10.2 7.6a1.8 1.8 0 0 1 3.6 0M12 9.6v10.9M8.8 15.6h1.6M13.6 15.6h1.6"/>`,
  mask: `<path ${T} d="M5 8.6C7.5 7.5 9.5 7 12 7s4.5.5 7 1.6V14c0 2.5-3.5 4.5-7 4.5S5 16.5 5 14z"/><path d="M5 8.6C7.5 7.5 9.5 7 12 7s4.5.5 7 1.6V14c0 2.5-3.5 4.5-7 4.5S5 16.5 5 14zM5 9.6H3.6a1.5 1.5 0 0 0 0 3H5M19 9.6h1.4a1.5 1.5 0 0 1 0 3H19M8.6 11h6.8M8.6 14h6.8"/>`,
  horn: `<path ${T} d="M3.5 10.2v3.6H6l8.5 4.7V5.5L6 10.2z"/><path d="M3.5 10.2v3.6H6l8.5 4.7V5.5L6 10.2zM6 13.8l1.1 4.4h2.6M17.6 9.2a3.8 3.8 0 0 1 0 5.6M19.8 6.8a7.2 7.2 0 0 1 0 10.4"/>`,
  phone: `<rect ${T} x="6.5" y="2.5" width="11" height="19" rx="2.6"/><rect x="6.5" y="2.5" width="11" height="19" rx="2.6"/><path d="M10.5 18.6h3"/>`,
  user: `<circle ${T} cx="12" cy="8" r="4"/><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>`,

  // ── economy & meta ──
  coin: `<circle ${T} cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="8.6"/><path d="M10 7.6v8.8M10 7.8h3a2 2 0 0 1 0 4h-3 3.4a2.1 2.1 0 0 1 0 4.2H10M11.6 6v1.8M11.6 16.2V18"/>`,
  fuel: `<path ${T} d="M5 20V5.5A1.5 1.5 0 0 1 6.5 4h6A1.5 1.5 0 0 1 14 5.5V20z"/><path d="M5 20V5.5A1.5 1.5 0 0 1 6.5 4h6A1.5 1.5 0 0 1 14 5.5V20M3.5 20h12M14 9h1.8a1.5 1.5 0 0 1 1.5 1.5v5.2a1.6 1.6 0 0 0 3.2 0V8.4L18.2 6"/><rect ${F} x="7" y="6.5" width="5" height="4" rx=".8"/>`,
  star: `<path ${F} stroke="currentColor" stroke-width="1.2" d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.2 6L12 16.9l-5.5 2.9 1.2-6-4.5-4.2 6.1-.8z"/>`,
  trophy: `<path ${T} d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3.2 3.2 0 0 0 3.2 4.6M16 6h3a3.2 3.2 0 0 1-3.2 4.6M12 13v4M8.5 20.5h7M9.6 17h4.8"/>`,
  cart: `<path ${T} d="M6.4 8h14.1l-1.9 6.6a1.5 1.5 0 0 1-1.5 1.1H9.2a1.5 1.5 0 0 1-1.5-1.2z"/><path d="M3 4h2.5l2.2 10.5a1.5 1.5 0 0 0 1.5 1.2h8.3a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.4"/><circle ${F} cx="9.6" cy="19.6" r="1.5"/><circle ${F} cx="17" cy="19.6" r="1.5"/>`,
  lock: `<rect ${T} x="5" y="10.5" width="14" height="10" rx="2.2"/><rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9M12 14.4v2.4"/>`,
  unlock: `<rect ${T} x="5" y="10.5" width="14" height="10" rx="2.2"/><rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8 10.5V7.6a4 4 0 0 1 7.7-1.5M12 14.4v2.4"/>`,
  dice: `<rect ${T} x="4" y="4" width="16" height="16" rx="3.6"/><rect x="4" y="4" width="16" height="16" rx="3.6"/><circle ${F} cx="8.6" cy="8.6" r="1.4"/><circle ${F} cx="12" cy="12" r="1.4"/><circle ${F} cx="15.4" cy="15.4" r="1.4"/>`,

  // ── controls ──
  play: `<path ${F} stroke="currentColor" stroke-width="1.6" d="M8 5.2v13.6L18.6 12z"/>`,
  pause: `<rect ${F} x="6.4" y="5" width="4.2" height="14" rx="1.3"/><rect ${F} x="13.4" y="5" width="4.2" height="14" rx="1.3"/>`,
  gear: `<path ${T} d="M12 8.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z"/><path d="M10.3 3.5h3.4l.5 2.4 1.6.9 2.3-.8 1.7 2.9-1.8 1.7v1.8l1.8 1.7-1.7 2.9-2.3-.8-1.6.9-.5 2.4h-3.4l-.5-2.4-1.6-.9-2.3.8-1.7-2.9 1.8-1.7v-1.8L4.2 8.9l1.7-2.9 2.3.8 1.6-.9z"/><circle cx="12" cy="12" r="3.2"/>`,
  settings: `<path d="M4 7h8.5M17.5 7H20M4 17h2.5M11.5 17H20"/><circle ${T} cx="15" cy="7" r="2.5"/><circle cx="15" cy="7" r="2.5"/><circle ${T} cx="9" cy="17" r="2.5"/><circle cx="9" cy="17" r="2.5"/>`,
  sound: `<path ${T} d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM15.6 9.2a4 4 0 0 1 0 5.6M18 6.8a7.4 7.4 0 0 1 0 10.4"/>`,
  music: `<path d="M9 17.8V6.2l10-2v11.6"/><circle ${F} cx="6.6" cy="17.8" r="2.5"/><circle ${F} cx="16.6" cy="15.8" r="2.5"/>`,
  gamepad: `<rect ${T} x="2.5" y="7" width="19" height="10.5" rx="5.25"/><rect x="2.5" y="7" width="19" height="10.5" rx="5.25"/><path d="M7.5 10.3v4.2M5.4 12.4h4.2"/><circle ${F} cx="15.4" cy="11.2" r="1.1"/><circle ${F} cx="17.6" cy="13.6" r="1.1"/>`,
  camera: `<path ${T} d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.5-2h5L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.5-2h5L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.8" r="3.3"/>`,
  refresh: `<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.6 4.4v4.7h-4.7"/>`,
  exit: `<path d="M14 4.5h4a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-4M10 16.5 5.5 12 10 7.5M5.5 12h10"/>`,
  home: `<path ${T} d="M5 10.5 12 4.5l7 6V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19z"/><path d="M3.5 11.8 12 4.5l8.5 7.3M5 10.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-8.5M10 20.5v-5.5h4v5.5"/>`,
  info: `<circle ${T} cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.5M12 7.6v.2"/>`,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  minus: `<path d="M5 12h14"/>`,
  check: `<path stroke-width="2.6" d="M5 12.5 9.5 17 19 7.5"/>`,
  close: `<path stroke-width="2.4" d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>`,
  back: `<path stroke-width="2.4" d="M14.5 5.5 8 12l6.5 6.5"/>`,
  'chevron-right': `<path stroke-width="2.4" d="M9.5 5.5 16 12l-6.5 6.5"/>`,
  'chevron-down': `<path stroke-width="2.4" d="M5.5 9.5 12 16l6.5-6.5"/>`,
  'arrow-left': `<path d="M19 12H5.5M11 6l-6 6 6 6"/>`,
  'arrow-right': `<path d="M5 12h13.5M13 6l6 6-6 6"/>`,
  'arrow-up': `<path d="M12 19V5.5M6 11l6-6 6 6"/>`,
  'arrow-down': `<path d="M12 5v13.5M6 13l6 6 6-6"/>`,

  // ── moods (speech bubbles) ──
  smile: `<circle ${T} cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="8.6"/><path d="M8.3 13.6a4.4 4.4 0 0 0 7.4 0"/><circle ${F} cx="9" cy="9.8" r="1.2"/><circle ${F} cx="15" cy="9.8" r="1.2"/>`,
  meh: `<circle ${T} cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="8.6"/><path d="M8.6 14.8h6.8"/><circle ${F} cx="9" cy="9.8" r="1.2"/><circle ${F} cx="15" cy="9.8" r="1.2"/>`,
  frown: `<circle ${T} cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="8.6"/><path d="M8.4 16a4.4 4.4 0 0 1 7.2 0M8 8.6l2.4 1.2M16 8.6l-2.4 1.2"/>`,
  alert: `<circle ${T} cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="8.6"/><path stroke-width="2.6" d="M12 7v6M12 16.6v.2"/>`,
} as const;

export type IconName = keyof typeof ICONS;
