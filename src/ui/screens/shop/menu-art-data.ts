/**
 * Mini illustrations for catalog items (48×48 grid, toy style: ink outlines, flat paint, one highlight).
 * Static markup only — paint classes are coloured from CSS (menu-shared.css): .p paint · .ps paint shade · .k ink fill ·
 * .ks ink stroke · .l cream · .g glass · .v visor · .sun lamp · .cor coral · .pk pink · .hl highlight · .st white stripe ·
 * .num patch number · .dim muted outline. The paint colour comes from `--art-c` on the wrapper.
 */
const wheel = (cx: number, cy: number, r: number): string =>
  `<circle class="k" cx="${cx}" cy="${cy}" r="${r}"/><circle class="rim" cx="${cx}" cy="${cy}" r="${(r * 0.56).toFixed(2)}"/>` +
  `<circle class="hub" cx="${cx}" cy="${cy}" r="${(r * 0.22).toFixed(2)}"/>`;

const SHELL_OPEN =
  'M8 31C8 18 15.5 9.5 25.5 9.5 35 9.5 41 16.5 41 25.5v2h-7.5c-2.5 0-4 1.8-4 4.3V35h-18C9.5 35 8 33.5 8 31z';
const TEE =
  'M17 7.5 10.5 10l-6 7.5 5.5 5 3.5-3V41h21V19.5l3.5 3 5.5-5-6-7.5L31 7.5c-1 3.3-3.5 5.3-7 5.3s-6-2-7-5.3z';
const LONG =
  'M17 8l-7 3-5.5 20 5.5 1.5 3.5-10.5V41h21V22l3.5 10.5 5.5-1.5-5.5-20-7-3c-1 3.3-3.5 5.3-7 5.3S18 11.3 17 8z';

export const ITEM_ART = {
  bike_cub:
    wheel(12, 36, 6.5) + wheel(37, 36, 6.5) +
    '<path class="ks" stroke-width="2.6" d="M35 17l2 19"/>' +
    '<path class="p" d="M5.5 31c0-7 4.5-10 10.5-10h6c3 0 4 2 4 5v3h4l1-10c0-2.5 1.5-4 4-4h1.5l-1 7c-.5 4.5-1.5 7.5-3.5 9.5H7c-1 0-1.5-.2-1.5-.5z"/>' +
    '<path class="k" d="M9 21c0-2.5 2-3.5 5-3.5h8c1.5 0 2.5 1 2.5 2.5v1z"/>' +
    '<path class="hl" d="M10.5 24c2-1.2 5-1.4 8.5-1.4"/>' +
    '<path class="ks" stroke-width="2.4" d="M30.5 12H37M34.5 12l.5 3"/>' +
    '<path class="l" d="M37 14.5h7l-1 6.5h-5z"/><path class="ks" stroke-width="1.1" d="M39.4 14.7l.1 6.1M41.8 14.7l-.3 6.1M37.4 17.8h6.1"/>' +
    '<circle class="sun" cx="36.6" cy="23.6" r="1.8"/><rect class="cor" x="4.2" y="25.5" width="2.4" height="3" rx=".8"/>',
  bike_scooter:
    wheel(12, 36.5, 6) + wheel(37, 36.5, 6) +
    '<path class="ks" stroke-width="2.6" d="M37 21v15.5"/>' +
    '<path class="p" d="M4.5 29.5c0-8 5-11 12.5-11h7c3 0 4.5 2 4.5 5V28h3l1-11c.3-2.5 2-4 4.5-4h1.5v8c0 5.5-1.7 9.5-4.5 11H7.5c-2 0-3-.8-3-2.5z"/>' +
    '<path class="k" d="M7.5 18.5c0-2.5 2-3.5 5-3.5H24c1.8 0 2.5 1 2.5 2.5v1z"/>' +
    '<path class="hl" d="M9 22c3-1.4 7-1.7 12-1.7M29 30h4"/>' +
    '<path class="ks" stroke-width="2.4" d="M31.5 10.5H40M36.5 10.5V13"/>' +
    '<path class="sun" d="M38.5 16c2 0 3 1 3 2.5s-1 2.5-3 2.5z"/><rect class="cor" x="3.3" y="24" width="2.4" height="3.4" rx=".8"/>',
  bike_sport:
    wheel(11, 35, 7) + wheel(37.5, 35, 7) +
    '<path class="ks" stroke-width="2.6" d="M11 35l10-7"/><path class="ks" stroke-width="2.8" d="M33 17l4.5 18"/>' +
    '<path class="k" d="M19.5 23H30l-2 8h-7z"/><path class="ks" stroke-width="3" d="M20 31.5 9.5 28.5"/>' +
    '<path class="p" d="M4 17l8 1-2 3.5H6.5z"/><path class="k" d="M11 18l8 1v3h-8.5z"/>' +
    '<path class="p" d="M18 20.5c.5-4.5 4.5-6.5 10-6 3.5.3 5.5 2.5 5 5.5L29.5 24H19z"/>' +
    '<path class="hl" d="M21 17.5c2-1.3 5-1.7 8-1.3"/>' +
    '<path class="ks" stroke-width="2.4" d="M29.5 11.5l7 1M33 12l.5 3.5"/>' +
    '<circle class="sun" cx="35.6" cy="17" r="2.7"/><rect class="cor" x="3" y="17.6" width="2.6" height="2.4" rx=".8"/>',

  helmet_open:
    `<path class="p" d="${SHELL_OPEN}"/>` +
    '<path class="k" d="M33 15l11 2.5c.6.1.8.8.4 1.3L43.3 20 34 19.2z"/>' +
    '<path class="l" d="M10 31h19.5v4h-18c-1 0-1.5-1-1.5-2z"/><path class="hl" d="M13 20c2.5-5 7-7.5 12.5-7.5"/>' +
    '<path class="ks" stroke-width="1.8" d="M30 34.5l3.5 7"/>',
  helmet_half:
    '<path class="p" d="M9 28c0-10.5 7-17 16-17s15.5 6 15.5 14.5V28z"/>' +
    '<path class="ks" stroke-width="3" d="M8.5 23.5 40 22"/><rect class="g" x="31" y="17" width="11" height="8" rx="3.5"/>' +
    '<path class="hl" d="M13.5 19c2.5-4 6.5-5.5 11.5-5.5"/><path class="ks" stroke-width="1.8" d="M27 28l3 11"/>',
  helmet_full:
    '<path class="p" d="M8 30C8 17 15.5 9 25.5 9S42 16 42 26v7c0 3.3-2.2 5.5-5.5 5.5H13c-3 0-5-2-5-5z"/>' +
    '<path class="v" d="M27 17.5l15 1V27H29c-2 0-3.5-1.5-3.5-3.5V19c0-.9.7-1.5 1.5-1.5z"/><path class="hl" d="M28.5 20.5l11 .6"/>' +
    '<path class="hl" d="M12.5 19c2.5-5 7-7.2 12.5-7.2"/><path class="ks" stroke-width="1.6" d="M34 31h5M34 34h5"/>',
  helmet_cat:
    '<path class="p" d="M13.5 15 14 4.5l8 6.5z"/><path class="p" d="M27 10l7.5-6 1.5 10z"/>' +
    '<path class="pk" d="M15.5 12l.3-4 3.2 2.8zM29.5 10l3.8-3 .7 5z"/>' +
    `<path class="p" d="${SHELL_OPEN}"/>` +
    '<rect class="g" x="31" y="16" width="11" height="7.5" rx="3.4"/><path class="hl" d="M13 20c2.5-5 7-7.5 12.5-7.5"/>' +
    '<path class="ks" stroke-width="1.6" d="M35.5 28.5l5 1M35.5 31l4.5 2"/>',

  tee:
    `<path class="p" d="${TEE}"/>` +
    '<path class="ps" d="M17 7.5c1 3.3 3.5 5.3 7 5.3s6-2 7-5.3l1.6.6c-1 4.2-4.3 6.7-8.6 6.7s-7.6-2.5-8.6-6.7z"/>' +
    '<path class="hl" d="M16.5 22v14"/>',
  win_vest:
    `<path class="l" d="${TEE}"/>` +
    '<path class="p" d="M17 7.5 13.5 11v30h21V11L31 7.5 26.5 20h-5z"/>' +
    '<rect class="l" x="17" y="25" width="14" height="10" rx="1.5"/><text class="num" x="24" y="33.2" text-anchor="middle">23</text>',
  hoodie:
    `<path class="p" d="${LONG}"/>` +
    '<path class="ps" d="M15.5 9.5c0-5.7 17-5.7 17 0-1.5 3.5-4.5 5.5-8.5 5.5s-7-2-8.5-5.5z"/>' +
    '<path class="ks" stroke-width="1.5" d="M22 15l-.5 6M26 15l.5 6"/><path class="ps" d="M17 31h14l1.5 7h-17z"/>',
  track_jacket:
    `<path class="p" d="${LONG}"/>` +
    '<path class="st" d="M9.2 14.8 6 29.6M11.6 15.6 8.5 30.4M38.8 14.8 42 29.6M36.4 15.6l3.1 14.8"/>' +
    '<path class="l" d="M18 8l6 5 6-5-2-1.5-4 3-4-3z"/><path class="ks" stroke-width="1.6" d="M24 13v28"/>',
  aloha:
    `<path class="p" d="${TEE}"/>` +
    '<g class="fl"><circle cx="17.5" cy="24" r="2.4"/><circle cx="30" cy="20" r="2.2"/><circle cx="29" cy="33" r="2.5"/>' +
    '<circle cx="18.5" cy="35.5" r="2"/><circle cx="9.5" cy="16.5" r="1.8"/><circle cx="38.5" cy="16.5" r="1.8"/></g>' +
    '<g class="fc"><circle cx="17.5" cy="24" r=".9"/><circle cx="30" cy="20" r=".8"/><circle cx="29" cy="33" r=".9"/>' +
    '<circle cx="18.5" cy="35.5" r=".8"/></g>' +
    '<path class="l" d="M17 7.5l4 8.5 3-3.2zM31 7.5 27 16l-3-3.2z"/><path class="ks" stroke-width="1.3" d="M24 13v28"/>',

  gear_none:
    '<circle class="dim" cx="24" cy="24" r="12"/><path class="dim" d="M15.5 32.5l17-17"/>',
  gear_rack:
    '<path class="ks" stroke-width="2.4" d="M8 34h32M12 34l-2 6M36 34l2 6"/><path class="p" d="M10 18h28l-2 16H12z"/>' +
    '<path class="ks" stroke-width="1.3" d="M15.5 18l.5 16M21 18l.2 16M26.5 18l.1 16M32 18l-.2 16M11 23.5h26.2M11.6 29h25"/>' +
    '<path class="ks" stroke-width="2.4" d="M9 18h30"/>',
  gear_topbox:
    '<path class="p" d="M9 21c0-4 2.5-6.5 6.5-6.5h17c4 0 6.5 2.5 6.5 6.5v13c0 2-1.5 3.5-3.5 3.5h-23C10.5 37.5 9 36 9 34z"/>' +
    '<path class="ps" d="M9 24.5h30V21c0-4-2.5-6.5-6.5-6.5h-17C11.5 14.5 9 17 9 21z"/>' +
    '<rect class="cor" x="19" y="29" width="10" height="3.6" rx="1.2"/><rect class="k" x="21.5" y="23" width="5" height="3" rx="1"/>' +
    '<path class="hl" d="M13 18.5c1-1.2 2.5-1.5 4.5-1.5"/>',
  gear_bag:
    '<path class="ks" stroke-width="2.2" d="M16 12c0-5 16-5 16 0"/><rect class="p" x="9" y="12" width="30" height="27" rx="4"/>' +
    '<path class="ps" d="M9 18h30v-2c0-2.2-1.8-4-4-4H13c-2.2 0-4 1.8-4 4z"/><rect class="l" x="15.5" y="22.5" width="17" height="11" rx="3"/>' +
    '<path class="cor" d="M24 31.5s-3.2-2.9-3.2-4.9a3.2 3.2 0 0 1 6.4 0c0 2-3.2 4.9-3.2 4.9z"/>',
  gear_cushion:
    '<path class="ps" d="M8 26.5v3.5c0 4.2 5.6 7.6 16 7.6s16-3.4 16-7.6v-3.5z"/>' +
    '<path class="p" d="M8 26.5c0-4.6 5.6-8 16-8s16 3.4 16 8-5.6 8-16 8-16-3.4-16-8z"/>' +
    '<circle class="sun" cx="17.5" cy="25" r="1.3"/><circle class="sun" cx="30.5" cy="25" r="1.3"/>' +
    '<circle class="sun" cx="24" cy="29" r="1.3"/><circle class="sun" cx="24" cy="21.5" r="1.3"/>' +
    '<circle class="sun" cx="8" cy="31.5" r="1.7"/><circle class="sun" cx="40" cy="31.5" r="1.7"/>' +
    '<path class="hl" d="M13.5 22.5c2-1.4 5-2.1 8-2.3"/>',
  gear_backrest:
    '<path class="ks" stroke-width="2.4" d="M15.5 33V9.5h17V33"/>' +
    '<rect class="p" x="12" y="10.5" width="24" height="14" rx="5.5"/><path class="hl" d="M16 14c2-1.2 4.5-1.5 7-1.5"/>' +
    '<path class="ps" d="M8 31.5v2.8c0 3 5.6 5.4 16 5.4s16-2.4 16-5.4v-2.8z"/>' +
    '<path class="p" d="M8 31.5c0-3 5.6-5.4 16-5.4s16 2.4 16 5.4-5.6 5.4-16 5.4-16-2.4-16-5.4z"/>',
  gear_throne:
    '<path class="sun" d="M13 37V18.5C13 12.5 17.8 9 24 9s11 3.5 11 9.5V37z"/>' +
    '<path class="p" d="M16.5 34V19.2c0-3.9 3.2-6.4 7.5-6.4s7.5 2.5 7.5 6.4V34z"/>' +
    '<path class="sun" d="M16 11.5 19.5 9l4.5-7.5L28.5 9l3.5 2.5-8 2.6z"/><circle class="cor" cx="24" cy="8.8" r="1.7"/>' +
    '<path class="ps" d="M9.5 34.5v2.6c0 2.6 6.4 4.4 14.5 4.4s14.5-1.8 14.5-4.4v-2.6z"/>' +
    '<path class="p" d="M9.5 34.5c0-2.6 6.4-4.6 14.5-4.6s14.5 2 14.5 4.6-6.4 4.6-14.5 4.6-14.5-2-14.5-4.6z"/>' +
    '<path class="sun" d="M7 27.5h6v4.5H7zM35 27.5h6v4.5h-6z"/><circle class="cor" cx="10" cy="29.7" r="1"/>' +
    '<circle class="cor" cx="38" cy="29.7" r="1"/><path class="hl" d="M19.5 17.5c1-1.6 2.6-2.4 4.5-2.6"/>',
} as const;

export type ArtKey = keyof typeof ITEM_ART;

/** one Thai roadside petrol bottle (น้ำมันขวด), 12×36 box at the origin */
export const FUEL_BOTTLE =
  '<rect class="k" x="3.5" y="0" width="5" height="3.4" rx="1"/>' +
  '<path class="g" d="M4 3h4v5l3 4v21c0 1.7-1.3 3-3 3H4c-1.7 0-3-1.3-3-3V12l3-4z"/>' +
  '<path class="cor" d="M2.4 17h7.2v16c0 1-.7 1.6-1.6 1.6H4c-.9 0-1.6-.6-1.6-1.6z"/><path class="hl" d="M3.2 13.5v17"/>';
