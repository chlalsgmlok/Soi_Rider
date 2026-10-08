/**
 * Public surface of src/ui. Screen modules import from here; the app creates one `new UI(root)`.
 * Reference: docs/DESIGN_SYSTEM.md.
 */
export { UI, type UIOptions } from './core/ui';
export { registerScreen, hasScreen, getScreen } from './core/screen-registry';
export type {
  ScreenContext,
  ScreenView,
  ScreenMount,
  ScreenOptions,
  ScreenHandle,
  ShowOptions,
  UiServices,
  EnterStyle,
} from './core/screen-types';

// DOM + motion toolkit
export { h, s, cx, append, clear, mount, type Attrs, type Child, type ClassValue } from './core/h';
export { pop, popOut, slideIn, slideOut, shake, bump, stamp, stagger, flyArc, springFrames, springSamples, settled, type Side } from './core/animate';
export { countUp, fmtInt, fmtSigned, fmtBaht, type CountUp, type CountUpOpts } from './core/count-up';
export { reducedMotion, setReducedMotion, onMotionChange, EASE, DUR } from './core/motion';
export type { FocusNav, NavDir, NavPress } from './core/focus-nav';

// icons
export { icon, setIcon, iconMarkup, ICON_NAMES, type IconName, type IconOpts } from './icons/icon';

// components
export { button, setBusy, denyButton, type ButtonOpts, type ButtonVariant, type ButtonSize } from './components/button';
export { chip, setChipText, keycap, lockVeil, type ChipOpts, type ChipTone } from './components/chip';
export { card, panel, sectionHead, setCardSelected, type CardOpts } from './components/card';
export { statBar, meter, comfortTone, type StatBar, type Meter, type MeterTone } from './components/bars';
export { swatch, type Swatch, type SwatchOpts } from './components/swatch';
export { tabStrip, type TabStrip, type TabDef } from './components/tab-strip';
export { wallet, type Wallet, type WalletKind } from './components/wallet';
export { coin, flyCoins, type FlyOpts } from './components/coin';
export { soiPlate, curbDivider, crosswalkBand, scallop, type SoiPlateOpts } from './components/street';
export { phoneFrame, gramBar, gramCard, type PhoneFrame, type PhoneOpts } from './components/phone';
export { avatar, avatarSvg, setAvatar } from './components/avatar';
export { comfortFace, type ComfortFace } from './components/face';
export { receipt, gradeStamp, stars, type Receipt, type ReceiptRow } from './components/receipt';
export { openSheet, type SheetHandle, type SheetOptions, type SheetAction } from './components/sheet';
export { toggle, slider, settingRow, type Toggle, type Slider, type SliderOpts } from './components/inputs';
export { speech, MOOD_ICON } from './components/speech';
export { loaderRoad, type LoaderRoad } from './components/loader';

// HUD
export { Hud } from './hud/hud';
export { mapSourceFromCity } from './hud/map-source';
export type { PopupKind, MapRoad, MapSource, HudConfig } from './hud/types';
export type { CalloutSpec } from './hud/callout';
export { PHASE_TEXT, TRAIT, weatherGlyph, CAMERA_LABEL } from './hud/labels';
export { fmtDistance, fmtClock } from './hud/format';
