# SOI RIDER — Design System & UI Reference

> Living style guide: `sandbox/ui.html?view=components` · HUD: `sandbox/ui.html` (`?bg=02` for the rainy POV) ·
> router/transition demo: `sandbox/ui.html?view=transition`. Code: `src/ui/**`, public surface `src/ui/index.ts`.

Source mood: mockup 03 — warm golden-hour Bangkok diorama, toy-like cartoon 3D, saturated taxi pinks / tuk-tuk blues /
banana greens, a single **gram cyan** route line and a **coral pin** as the only "UI colours" living inside the world.
The interface is a premium mobile-game HUD laid on a miniature city: minimal chrome, bold white numerals, small dark-glass
chips, playful but never childish.

---

## 0. Quick start for screen authors

```ts
// src/ui/screens/title/title.ts  (one folder per screen; register them all from src/ui/screens/index.ts)
import { registerScreen, h, button, soiPlate, curbDivider, stagger } from '../../index';

registerScreen('title', (ctx) => {
  const p = ctx.props();                                   // TitleProps (src/core/types/screens.ts)
  const start = button({ label: '출근하기', icon: 'play', size: 'xl', key: 'Enter', autofocus: true, onClick: p.onStart });
  const menu = h('div.title__menu', start, button({ label: '차고', icon: 'helmet', variant: 'secondary', onClick: p.onGarage }));
  ctx.el.append(h('div.title', h('div.t-logo', 'SOI ', h('b', 'RIDER')), soiPlate({ th: 'ซอย สุขุมวิท 23', en: 'Sukhumvit Soi 23' }), curbDivider(), menu));
  return {
    enter: () => void stagger(menu.children),             // runs when the wipe reveals the screen
    update: (next) => { /* handle.update(partial) lands here */ },
    back: () => false,                                     // Esc / Backspace / gamepad B
  };
});

// src/app: const ui = new UI(document.getElementById('ui')!);
const title = ui.show('title', titleProps, 'wipe', { onCovered: () => engine.setScene(titleScene) });
```

Rules of thumb: build DOM with `h()`, style with the classes below + tokens, never hard-code colours/durations, put every
interactive element in the focus order (native `button`, or `data-nav` on custom elements), and give the screen at least
one Bangkok street motif (§6.4).

---

## 1. Principles
1. **The world is the UI** — navigation lives on the road (cyan route, coral pin, ring under the bike). Screen HUD stays in the corners.
2. **Glanceable at speed** — one big number per corner, Kanit bold, white with a crisp 2 px drop shadow. No paragraphs while riding.
3. **Bangkok street vocabulary** — crosswalk stripes, red-white curb stripes, blue soi-sign plates, tuk-tuk canopy scallops, receipt paper,
   the gram phone. Every screen uses at least one of these motifs; never generic sci-fi or flat corporate.
4. **Toy physics in motion** — springy overshoot pops, quick wipes, coins that fly. Respect reduced motion (OS or Settings).
5. **Korean first, Thai flavour** — UI copy in Korean; Thai script appears as signage/labels (Kanit renders Thai).

---

## 2. Tokens (`src/ui/styles/tokens.css`; hex values mirror `src/core/config/palette.ts`)

Never hard-code a colour, radius, duration or z-index in a component — use or add a token.

### 2.1 Colour
| token | value | use |
|---|---|---|
| `--c-cyan` / `-hi` / `-deep` / `-ink` | #3EE6D4 / #7FF3E6 / #12B5A6 / #0A6E65 | route, primary accent, progress, speed arc, focus ring · pressed / text-on-light |
| `--c-coral` / `-hi` / `-deep` | #FF4D5E / #FF8390 / #C92F45 | pin, danger, < 10 cm, fail, late |
| `--c-amber` / `-hi` / `-deep` | #FFB23E / #FFD07F / #C27C16 | warnings, 10–30 cm, combo, tuck |
| `--c-sun` | #FFC46B | highlights, coins (฿) |
| `--c-pink` / `-hi` / `-deep` | #F2559A / #FF8CBF / #B8306E | taxi pink, playful accents, S grade, PERFECT GAP |
| `--c-mango` | #F7C928 | fuel, stars |
| `--c-leaf` / `-hi` / `-deep` | #34B04A / #6FD77F / #22803A | success, good tone, care bonus |
| `--c-tuk` / `-hi` / `-deep` | #2C56B8 / #4B78DC / #1B3A86 | secondary buttons, rain prompts |
| `--c-sign` | #2457A6 | soi-sign plates |
| `--c-ink` / `-2` / `-3` | #151821 / #232838 / #343B52 | text on light, glass base, raised glass |
| `--c-cream` / `-2` / `-3`, `--c-paper-line` | #FFF6E8 / #F6E9D3 / #EAD8B8 / #DCC7A3 | receipt paper, light cards, gram app |
| `--c-asphalt` / `-dark`, `--c-curb-red` / `--c-curb-white` | #6E6762 / #3E3A37, #D9473E / #F3EEE3 | street motifs (wipe, curb divider) |
| `--t-on-dark` / `-2` / `-3` | #fff / 74 % / 50 % | text on glass & dark panels |
| `--t-on-light` / `-2` / `-3` | #151821 / #575D6E / #8D8F99 | text on cream & paper |
| `--tone-info/good/warn/bad` | cyan / leaf / amber / coral | maps `Tone` from `src/core/events.ts` |
| `--grade-s…f` | pink · cyan-deep · leaf · amber-deep · #6F7486 · coral-deep | grade stamps |

### 2.2 Surfaces, shadows, shape, space
| token | value | use |
|---|---|---|
| `--glass-bg` / `-strong` / `-soft` | ink @ .55 / .78 / .34 | HUD chips, panels (always with `--glass-blur`) |
| `--glass-blur` | `blur(14px) saturate(1.3)` | `backdrop-filter` for every glass surface |
| `--glass-border` | white @ .14 | 1 px glass rim |
| `--scrim` | ink @ .55 | modal / overlay backdrop |
| `--shadow-text` / `-strong` | 2 px drop + soft halo | white HUD text on bright scenes |
| `--shadow-icon` | `drop-shadow` pair | icons over the 3D world |
| `--shadow-toy` | `0 4px 0 rgba(0,0,0,.28)` | chunky buttons (pressed: translateY(3px), 1 px) |
| `--shadow-chip` / `-card` / `-float` | 3 elevation steps | chips · cards · panels/sheets |
| `--r-key` 8 · `--r-chip` 10 · `--r-card` 16 · `--r-sheet` 24 · `--r-pill` 999 | | radii |
| `--s-1…--s-12` | 4 · 8 · 12 · 16 · 20 · 24 · 32 · 48 | 4-pt spacing |

### 2.3 Layers (`--z-*`) and layout
| token | value | layer |
|---|---|---|
| `--z-world` | 0 | `#gl` canvas |
| `--z-hud` / `--z-hud-float` | 10 / 12 | `.ui-layer--hud` (corners, brackets, popups) |
| `--z-screen` | 20 | `.ui-layer--screens` (base screen) |
| `--z-overlay` | 30 | overlay screens (pause, settings) |
| `--z-sheet` | 40 | modal sheets |
| `--z-toast` | 50 | toast stack |
| `--z-wipe` | 60 | crosswalk wipe / fade veil |
| `--z-debug` | 90 | dev overlays |

`--safe` = 16 px (24 px at ≥ 1280 w), `--safe-t/r/b/l` add the device safe-area insets. `--hud-zoom` / `--ui-zoom` are set from JS
(`core/viewport-scale.ts`): `min(w/1280, h/720)` clamped to 0.68–1.7 (HUD) and 0.8–1.5 (screens). HUD clusters use `zoom: var(--hud-zoom)`,
so author everything at the 1280×720 design size. `--hud-tc-h` (set by the HUD) is the live height of its top-centre cluster.

---

## 3. Type
- **Display & numerals** `--font-display`: Kanit 400/500/600/700/800 + 800 italic (Latin + Thai). Tabular figures for counters.
- **Korean UI & body** `--font-ui`: Pretendard Variable 500–800.
- Logo "SOI RIDER": Kanit 800 italic, tracking −0.02em (`.t-logo`), "RIDER" in cyan.
- HUD trip tag: `03` cyan Kanit 800 + ` / BANGKOK` white Kanit 600, thin underline whose first 34 px are cyan.

| class | size @1280×720 | weight | use |
|---|---|---|---|
| `.t-caption` | 12 | 400–600 | meta, hints |
| `.t-body` | 14 | 500 | body copy |
| `.t-label` | 16 | 700 | labels, list rows |
| `.t-title-s` | 20 | 800 | card / sheet titles |
| `.t-title` | clamp(24, 2.19vw, 40) | 800 | screen titles |
| `.t-hud` | 44 | Kanit 800 | HUD big numbers (+ `--shadow-text`) |
| `.t-hero` | clamp(56, 5.63vw, 104) | Kanit 800 italic | hero / grade |
| `.t-kicker` | 12 caps, tracking .08em | Kanit 600 | section kickers |
| `.t-num` | — | Kanit, `tnum` | any changing number |
| `.t-thai` | — | Kanit | Thai strings (`lang="th"`) |
| `.t-shadow` `.t-dim` `.t-mute` | | | modifiers |

Utility classes: `.u-row`, `.u-col`, `.u-grow`, `.u-ellipsis`, `.u-visually-hidden`, `.scroll-y`, `.interactive` (re-enables pointer events).

---

## 4. Motion

**Easing** (`EASE` in `core/motion.ts`, CSS `--ease-*`): `out` cubic-bezier(.2,.8,.2,1) · `pop` (.34,1.56,.64,1) · `in` (.5,0,.75,0) · `inout` (.65,0,.35,1).
**Durations** (`DUR`, CSS `--d-*`): tap 120 · chip 220 · card 360 · screen 600 · hero 900 · wipe 450 ms.

**Crosswalk Wipe** (`'wipe'`): 6 zebra bars slanted 12° stream in from the left (leading bar on top), hold one beat, then exit
to the right, left-most first, so the next screen is revealed left → right; a cyan-ringed rider puck zips across with a dashed route
streak. 130 ms in + 5×16 ms stagger + 30 ms hold + 130 ms out + 5×16 ms = **450 ms**. `onCovered` runs exactly once while fully covered
(swap the 3D scene / camera there). **Fade** (`'fade'`): ink veil 200 ms in / 260 ms out. **None**: instant. Under reduced motion the wipe
becomes a 140 ms fade. Overlays never wipe — `show(overlay, …, 'wipe')` is treated as `'none'` + the overlay's entrance.

**Helpers** (`core/animate.ts`, all WAAPI, compositor-friendly, all reduced-motion aware, all return the `Animation`):
| helper | effect | typical use |
|---|---|---|
| `pop(el, { from = .85, delay, spring })` | spring scale-in with overshoot | chips, cards appearing, value changes |
| `popOut(el, { to, duration })` | shrink + fade | removals (await `settled()` before `remove()`) |
| `slideIn(el, side, { distance, delay, spring })` / `slideOut(el, side, d)` | spring slide | sheets, banners, panels |
| `shake(el, strength)` | horizontal deny shake | can't afford, invalid |
| `bump(el, amount)` | squash bounce | wallet/combo increments |
| `stamp(el, { delay, rotate })` | rubber-stamp slam (2.6× → 1) | grade stamp, "PAID" |
| `stagger(children, { step = 45, delay = 60, distance })` | rise-in cascade | menus, lists on `enter()` |
| `flyArc(el, from, to, { duration, delay, lift })` | quadratic arc flight | used by `flyCoins` |
| `springFrames(map, spring)` / `springSamples(spring)` | bake a damped spring into keyframes | custom springs |
| `settled(anim)` | awaitable, never rejects | sequencing |
| `countUp(el, from, to, { duration, delay, format, onStep })` → `{ done, cancel }` | ease-out number roll | receipts, wallet, score |
| `flyCoins(from, toEl, count, { step, onLand, layer })` | coins arc to the wallet | payout |

Formats: `fmtInt` (7,430) · `fmtSigned` (+1,200 / −30 with a real minus) · `fmtBaht` (฿142); HUD: `fmtDistance`, `fmtClock`.
Screen entrance on reveal (`ScreenOptions.enter`): `'rise'` (base default) · `'pop'` (overlay default) · `'fade'` · `'none'`.

**Reduced motion**: `reducedMotion()` = Settings override ?? OS `prefers-reduced-motion`. The app calls
`ui.setReducedMotion(settings.reducedMotion ? true : null)` (null = follow the OS). It mirrors to `<html data-motion>`;
CSS kills decorative loops; helpers fall back to short fades or instant state; count-ups jump to the final value.

---

## 5. UI architecture (`src/ui/core/**`)

```
#ui.ui-root  (pointer-events: none — the canvas gets input unless a screen/widget opts in)
 ├─ .ui-layer--hud       Hud (corners + float layer)            z 10
 ├─ .ui-layer--screens   section.screen.screen--<id> …          z 20 / overlays 30 / sheets 40
 ├─ .ui-layer--toasts    .toast-stack                           z 50
 └─ .ui-layer--wipe      .wipe + .fade-veil                     z 60
```

### 5.1 `UI` facade (`new UI(root, { bus? })`)
| member | description |
|---|---|
| `show(id, props, transition = 'wipe', { overlay?, onCovered? })` → `ScreenHandle` | mounts immediately (hidden), swaps in during the transition. Base screens replace the base + close overlays; overlays stack. All swaps are queued — never overlap. |
| `ScreenHandle` | `id`, `el`, `closed`, `props()`, `update(partial)` (merged + forwarded to the view), `close(transition?)` |
| `transition(kind, onCovered?)` | run a wipe/fade without changing screens (e.g. swap the 3D backdrop) |
| `hud` | the `Hud` (§8) |
| `toast(text, tone = 'info', icon?)` | max 3 stacked, bursts of the same text de-duplicated (700 ms), auto-dismiss 2–4.8 s by length |
| `sheet(opts)` | modal bottom (or centred) sheet in the top-most screen, `await handle.result` |
| `sfx(name)` | emits `ui:sfx` on the bus (src/audio plays it) |
| `nav.press('up'│'down'│'left'│'right'│'ok'│'back')` | gamepad → focus navigation |
| `setReducedMotion(v)`, `stack()`, `top()`, `closeAll()`, `dispose()` | |

The `'hud'` screen is pre-registered: showing it reveals the HUD (`hud.show()`), closing it hides it. It is `inert` and passes clicks through.

### 5.2 Registering screens (`registerScreen(id, mount, opts)`)
`mount(ctx)` builds DOM into `ctx.el` and may return a `ScreenView`:
| hook | when |
|---|---|
| `update(props, changed)` | after `handle.update(partial)` |
| `enter()` | the transition has revealed the screen — run entrance choreography (`stagger`, `pop`, count-ups) |
| `leave()` → Promise | overlays / `'none'` closes: exit animation awaited before removal |
| `back()` → boolean | Esc / Backspace / gamepad B; return `true` if handled (close a sub-panel, call `onBack`) |
| `key(e)` → boolean | raw keydown before focus navigation (tab hotkeys Q/E, shortcuts); return `true` to consume |
| `destroy()` | cleanup (also `ctx.onDispose(fn)`) |

`ctx`: `id`, `el`, `ui` (services: `hud`, `toast`, `sfx`, `transition`, `sheet`), `props()`, `close(t?)`, `onDispose(fn)`, `focusFirst()`.
`ScreenOptions`: `overlay` (default for `pause`, `settings`), `enter`, `passthrough` (clicks fall through to the canvas except on
interactive children — use for **garage** so the turntable can be dragged; the garage panel docks right, max 460 px).

### 5.3 Focus & keyboard
- On reveal the router focuses `[data-autofocus]` → `.is-selected/.is-active` → first focusable. Closing an overlay restores the
  previously focused element.
- Arrows move focus **spatially** between `button, a, input, select, [tabindex], [data-nav]` (skip one with `data-nav="skip"`).
  ←/→ are left to text fields and range sliders. Enter activates `[data-nav]` elements (native buttons handle Enter/Space).
- Esc/Backspace: closes the top sheet, else calls the screen's `back()`. An open sheet captures navigation (focus trap).
- Focus ring: `:focus-visible` → 3 px cyan outline, 3 px offset (do not remove it; restyle with `outline-offset` only).
- Interactive cards (`card({ interactive: true })`) are already `role=button`, `tabindex=0`, `data-nav`.

### 5.4 UI sounds
Pressing any `.btn, .tab, .swatch, .card--interactive, .toggle, [data-sfx]` inside a screen emits `ui:sfx 'tap'`; mouse hover emits
`'hover'`. Override per element with `data-sfx="buy|equip|deny|coin|stamp|…"`, silence with `data-sfx="none"`
(`button({ sfx: 'buy' })` does this). Never call audio directly from UI code.

---

## 6. Components (`src/ui/components/**`, CSS `src/ui/styles/components/*.css`)

All helpers return plain elements (or `{ el, …setters }`) — append them anywhere. Setters diff internally, so they are safe per frame.

### 6.1 Buttons — `button(opts)` → `HTMLButtonElement` (`.btn`)
`{ label, sub, icon, iconRight, variant, size, block, pill, key, price, locked, affordable, disabled, autofocus, sfx, title, class, onClick }`
| variant | look | use |
|---|---|---|
| `primary` (default) | gram cyan, ink text | the one main action per view |
| `secondary` | tuk-tuk blue | secondary navigation (차고, 상점) |
| `ghost` | dark glass | tertiary, icon buttons, on-scene controls |
| `danger` | coral | quit, discard |
| `sun` | mango/sun | fuel, money actions |
| `paper` | cream | actions on cream/paper surfaces |
Sizes `sm · md · lg · xl` (xl = hero CTA with `sub` line). `block` = full width, `pill`, icon-only (no label → square, pass `title`).
States: pressed (side collapses, `translateY(3px)`), `disabled`, `is-locked` (+ `price` coin pill, `affordable` highlights it), `is-busy`
via `setBusy(btn, true)`, deny feedback `denyButton(btn)` (+ `ui.sfx('deny')`). Keycap hint: `key: 'E' | 'Enter' | 'Esc'`.

### 6.2 Chips, keycaps, badges, coin, wallet
- `chip({ text, tone, icon, size, solid, paper, live, num, class })` → `.chip` · tones `neutral info good warn bad pink tuk` · sizes `sm md lg`
  · `solid` fills with the tone · `paper` for cream surfaces · `live` = pulsing dot · `num` = tabular Kanit. `setChipText(el, text)` updates in place.
- `keycap(key, size = 'md', dark?)` → `.keycap` (`sm md lg`, auto `--wide` for ≥ 3 chars; Enter renders ↵, Space → SPACE).
- `.badge` (count bubble) / `.badge--new` / `.badge--good`.
- `coin(size?)` → `.coin` (฿ token, `--lg`), `flyCoins(...)` (§4).
- `wallet('baht' | 'fuel', value)` → `{ el, target, value(), set(v, { animate, duration, onStep }), bump() }` (`.wallet`; `is-empty` at 0).

### 6.3 Surfaces
- `.glass` (+ `--strong --soft --pill`) — dark frosted glass for anything over the 3D world.
- `card(opts, …children)` → `.card` cream paper card · `dark` → `.card--dark` · `interactive` (hover lift, focusable) · `selected`
  (cyan ring + check badge, `setCardSelected(el, on)`) · `locked` (desaturated + `.lock-veil` with a lock badge top-right).
- `panel({ head, foot, scroll, class }, …body)` → `.panel` docked dark surface (garage/shop/settings) with `.panel__head/__body/__foot`.
- `sectionHead(kicker, title, …right)` → `.section-head` (`__kicker` Kanit caps cyan + `__title`).
- `lockVeil()` for custom locked tiles (parent `position: relative`).

### 6.4 Bangkok street motifs (use at least one per screen)
- `soiPlate({ en, th?, no?, size: 'mini'|'md'|'lg', green?, class })` → `.soi-plate` blue street sign (white rim, Thai over English,
  optional number tab; `green` = highway sign). Screen headers, district names, the HUD road row.
- `curbDivider('default'|'thin'|'vertical'|'amber')` → `.curb-divider` red-white curb stripe: section separators, sheet tops.
- `crosswalkBand({ moving?, ink? })` → `.crosswalk.crosswalk--band`; `.crosswalk` (+ `--ink --subtle --moving`) is a 12° zebra fill for
  any block (callout bands, hero backgrounds) via `--cw-stripe / --cw-color / --cw-gap`.
- `scallop('tuk'|'cyan'|'pink')` → `.scallop` tuk-tuk canopy edge for panel/card tops.

### 6.5 Values & selection
- `statBar({ label, value, display?, delta?, paper?, segments = 10 })` → `{ el, set(value, display?, delta?) }` — segmented garage stat;
  `delta` previews an upgrade (green stripes) or downgrade (red).
- `meter({ value, tone, size: 'md'|'lg', paper?, label? })` → `{ el, set(value, tone?) }` — comfort/fuel bar; `comfortTone(0..100)`
  → `good ≥ 60 · warn 30–60 · bad < 30`.
- `swatch({ hex, name, selected, locked, price, showName, size, onPick })` → `{ el, button, setSelected, setLocked }`; wrap in `.swatch-grid`.
- `tabStrip({ tabs: [{ id, label, icon?, badge? }], active, onChange, block?, segmented?, label? })` → `{ el, active(), set(id, emit?),
  handleKey(e), dispose() }` — pill tabs with a sliding cyan ink; forward `key(e)` → `handleKey(e)` for Q/E and [/] hotkeys.
- `toggle({ checked, label, onChange, disabled? })` → `{ el, value(), set(on, emit?) }` (`.toggle`, role=switch).
- `slider({ value, label, min = 0, max = 1, step, format?, readout?, onInput?, onCommit? })` → `{ el, value(), set(v) }` (`.slider`, keeps `--v`).
- `settingRow(label, hint | null, control)` → `.setting-row` (label + hint left, control right). Settings screens are lists of these.

### 6.6 gram phone, passengers, speech
- `phoneFrame({ mini?, width?, free?, time?, class }, …content)` → `{ el, screen, setTime }` — handset with island, status bar, glass
  sheen; 9:19.5 unless `free`; `mini` = HUD variant. Inside: `gramBar(…right)` (cyan header + wordmark), `gramCard({ selected }, …)`.
- `avatar(look, 'sm'|'md'|'lg')` / `avatarSvg(look)` / `setAvatar(el, look)` — portrait from `PassengerLook` (skin, shirt, hair style
  `hair_long|hair_bun|hat_cap|…` + colour) so the 2D face matches the 3D passenger.
- `comfortFace(value, size)` → `{ el, update(v) → bandChanged }` — face colour/expression bands 80/60/45/30 (aligned with `comfortTone`).
- `speech(text, mood)` → `.speech.speech--<mood>` bubble (`happy neutral scared angry wet cough`, glyph from `MOOD_ICON`).

### 6.7 Results
- `receipt({ meta?, head?, rows: [{ label, detail?, value, format? }], totalLabel?, total?, barcode? })` → `{ el, paper, rows, total,
  reveal({ rowMs, onTick, onRow }) }` — gram paper slip with zig-zag edges; `reveal()` slides rows in and counts each up, then the total.
- `gradeStamp(grade, { size: 'sm'|'md'|'lg', onDark?, label? })` → rubber stamp (`--grade-*` colours); slam it with `stamp(el)`.
- `stars(value 0..5 step .5, { max, size, onDark })`.

### 6.8 Feedback
- Toasts: `ui.toast(text, tone, icon?)` — `.toast--info|good|warn|bad`; any `IconName` as icon, tone glyph otherwise. During a ride
  they stack under the HUD's top-centre cluster automatically.
- Sheets: `ui.sheet({ title, body?, icon?, actions?: [{ id, label, variant, icon, sfx, autofocus, disabled }], dismissible = true,
  center? })` → `{ el, result: Promise<id | null>, close(id?) }`. Focus moves to the autofocus (else last) action and is restored on close.
- `loaderRoad(progress, label?)` → `{ el, set(p) }` — boot progress: cyan route fills and the rider puck drives along it.

---

## 7. Icons (`src/ui/icons/**`)
`icon(name, size = 24, { class, label, color, stroke })` → `<svg class="icon icon--name">` in `currentColor`; `setIcon(svgEl, name)`
swaps a glyph in place; `iconMarkup(name, size)` returns a string. Without `label` icons are `aria-hidden` (decorative).
Style: 24 px grid, 2 px round strokes, accents as filled shapes at `fill-opacity .2` (recolour with `color`); `--icon-hole` colours
cut-outs (pin centre, wrong-way bar). Add new glyphs to `icon-paths.ts` only — keep the grid and stroke rules.

| group | names |
|---|---|
| navigation & status | pin flag nav route map clock warning wrongway walk tuck spark bolt |
| weather & time | sun moon cloud rain haze heat drop |
| rider & gear | helmet bike shirt box palette raincoat mask horn phone user |
| economy & meta | coin fuel star trophy cart lock unlock dice |
| controls | play pause gear settings sound music gamepad camera refresh exit home info plus minus check close back chevron-right chevron-down arrow-left arrow-right arrow-up arrow-down |
| moods | smile meh frown alert |

---

## 8. HUD (`src/ui/hud/**`)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ 03 / BANGKOK              [▣ 소나기!  잠깐 멈추고 우비 건네기   (E)]   목적지까지 │
│ ▔▔▔▔▔▔▔▔▔▔                 [▌역주행 중 −15/s]                     📍 260 m │
│ [SUKHUMVIT] Soi 23         (toasts stack here, below the banner)     ⏱ 02:44 │
│ (☂ 폭우)                                                                     │
│                         ALMOST THERE  (phase callout)                         │
│                      NEAR MISS ×3  +120   ← rises from the bike                 │
│ ( 앗, 비 온다! )        ( 22 cm )  🛵  ( 9 cm )                      COMBO ×4 │
│ ┌gram──────●─┐                                                 [⇆ 움츠리기] │
│ │😀 말리 ★4.8 │                                                   ╭──────╮   │
│ │😐 ▬▬▬▬▬ 57 │                                                   │  ➤   │   │
│ │  mini-map   │                                                   │ 18   │   │
│ └─────────────┘                                                   ╰km/h──╯   │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 8.1 Widgets
| widget | data (HudState) | behaviour |
|---|---|---|
| Trip tag (TL) | `tripNumber`, `city`, `district`, `roadName`, `weather`, `rain` | `03` cyan + `/ BANGKOK`, underline, soi plate + road name (pops on change), weather chip (`weatherGlyph`: 소나기/폭우/매연 주의/흐림/폭염/노을/맑은 밤) |
| Target (TR) | `phase`, `targetMeters`, `etaLeftSec` | label (픽업까지/목적지까지…), coral pin + distance (`fmtDistance`: 7 m · 340 m · 1.3 km), ETA chip: ≥ 30 s normal, < 30 s amber, < 0 coral pulsing `+00:41 지연`; dims to 55 % when no target |
| Speed gauge (BR) | `speedKmh`, `targetBearing`, `tucking` | 250° arc, ticks every 10 km/h, full scale = bike top speed (`configure`); cyan sweep; glass dial with white nav arrow (amber when target is behind > 100°); number with ±0.6 hysteresis; tucking → amber sweep + cap tick at 15 km/h |
| Rider status (above gauge) | `combo`, `tucking`, `cameraMode` | `COMBO ×n` (≥ 2, bumps on increase), tuck chip, camera-mode chip for 2.2 s after a change |
| gram mini-phone (BL) | `phase`, `passenger`, `comfort`, `minimap`, `speedKmh` | phase bar (dot turns coral when carrying), avatar + name + ★rating · origin + trait chip (급해요/겁 많음/첫 방콕/짐 많음/단골), comfort face + bar coloured by value + number; "콜 연결 중…" when no passenger; heading-up mini-map |
| Mini-map | `minimap.playerPos/Heading/route/target` + `setMapSource(fn)` | roads from the MapSource (re-queried every 120 m within 320 m), cyan route with dark casing, coral pin (clamped to the edge), cyan player arrow; zooms out with speed; ≤ 15 Hz redraw, only when something moved; day/night themes |
| Clearance brackets | `clearance.{left,right}Cm` + `{left,right}Screen` | `( 6 cm )` centred on each anchor; ≥ 30 cyan · 10–30 amber · < 10 coral; pulse speeds up as the gap closes (1.4 s → .42 s); ink casing keeps them readable on pink taxis |
| Combo popups | events + `bikeScreen` anchor | `NEAR MISS ×3 +120` (amber), `PERFECT GAP +300` (pink, tilted), `FILTER +15` (cyan), `RAINCOAT +400` (green care), `penalty` (coral), `info` (white); pooled ×8, bursts stack upwards |
| Prompt banner (TC) | `prompt` (+ `story:prompt/resolve`) | accent icon tile (rain = tuk blue, mask = amber, board/pickup = cyan, dropoff = coral) · title + text · keycap in a draining ring (coral + key nudge < 30 %); resolve → check pop or shake, then slides out |
| Warnings (TC) | `counterflow`, `onSidewalk` | `역주행 중 −15/s` coral / `인도 주행 −20/s` amber chips with curb-stripe edge and glow pulse |
| Phase callout (centre) | `mission:phase` | `LET'S GO!` · `PICK UP!` · `NEXT STOP` · `ALMOST THERE` · `ARRIVED!` · `TRIP FAILED` over a sliding crosswalk band (1.65 s) |
| Speech bubble | `passenger:say` | above the phone, mood glyph + tint, auto-hide 2.4–6 s by length |
| Edge flash | collisions, perfect gap | inset vignette: coral hits, amber mirror clips, cyan perfect gap |

### 8.2 API (`ui.hud`)
```ts
ui.hud.configure({ topSpeedKmh: bike.topKmh, timeOfDay, minimap: settings.minimap });
ui.hud.setMapSource(mapSourceFromCity(city.data));   // or any (center, radius) => MapRoad[]
const unbind = ui.hud.bind(bus);                     // event reactions, see 8.3
ui.show('hud', {}, 'wipe', { onCovered: () => startRide() });
// every frame (PLAY step 9):
ui.hud.update(state);                                // HudState from src/core/types/hud.ts
// direct calls (also driven by bind):
ui.hud.popup('nearMiss', 'NEAR MISS ×2 +100', at?);  ui.hud.say('천천히요!', 'scared');
ui.hud.prompt(promptState); ui.hud.resolvePrompt('raincoat', true); ui.hud.phase('arriving');
ui.hud.announce({ title: 'RAIN', accent: 'INCOMING', sub: '우비를 준비하세요', tone: 'info' });
ui.hud.flash('bad', 1); ui.hud.toast('연료 −1', 'warn', 'fuel');
// between runs: ui.hud.reset(); unbind();
```
`show()`/`hide()` slide the four corners in/out (staggered). `update()` is cheap: every widget diffs against its own cache and only writes
`textContent`, transforms, classes or one SVG attribute when something visibly changed; the mini-map throttles itself.
Measured in `sandbox/ui.html` (`window.__bench(600)`, worst case — every widget changing every frame): **0.07 ms** JS per update +
**0.31–0.35 ms** style/layout flush (each corner cluster is `contain: layout style`).

### 8.3 Bus bindings (`hud.bind(bus)`)
| event | reaction |
|---|---|
| `nearMiss` | popup `NEAR MISS ×combo +points` |
| `perfectGap` | popup `PERFECT GAP ×combo +points` + cyan edge flash |
| `filterPass` | popup `FILTER +SCORE.filterPass` |
| `toast` | `ui.toast(text, tone, icon)` |
| `passenger:say` | speech bubble |
| `story:prompt` / `story:resolve` | open banner (+ `ui:sfx 'ping'`) / success-fail beat; raincoat/mask success → care popup |
| `mission:phase` | phase callout (+ `ui:sfx 'swoosh'`) |
| `collision` | mirror → amber flash; body/pedestrian/heavy → coral flash |
| `player:fall` | strong coral flash |
Gameplay sounds are NOT emitted by the HUD (src/audio binds the same events).

### 8.4 Legibility rules
- White numerals always carry `--shadow-text` (bright scenes) — never put white text on the scene without it.
- Coloured strokes over the world get an ink casing (gauge track, brackets, mini-map route) so cyan/amber/coral survive pink taxis,
  white vans and wet asphalt.
- Glass (`--glass-*` + blur) only behind clusters that hold paragraphs or several values (banner, dial, chips); corners stay chrome-free.
- Never cover the centre third with persistent UI — only transient popups/callouts live there.

---

## 9. Do / Don't
| do | don't |
|---|---|
| one primary (cyan) action per view; secondary in tuk blue, the rest ghost | two cyan CTAs side by side |
| Kanit for numbers, Pretendard for Korean sentences | Kanit for long Korean copy, system fonts anywhere |
| tokens for every colour, radius, duration, z-index | hex literals / magic ms in component CSS or TS |
| `h()` + component helpers; update via setters/`textContent` | `innerHTML` with dynamic strings, rebuilding DOM per frame |
| a street motif per screen (soi plate, curb, crosswalk, scallop, receipt, gram phone) | generic gradients, neon sci-fi, flat corporate cards |
| spring pops / stamps for rewards, stagger lists on `enter()` | long blocking animations, motion that ignores `reducedMotion()` |
| `data-sfx` / `ui.sfx()` for UI sounds | calling the audio engine from UI code |
| Korean copy, Thai only as signage flavour (`lang="th"`, `.t-thai`) | Thai sentences the player has to read |
| keep focus visible and reachable with arrows + Enter + Esc | `outline: none` on focusables, mouse-only controls |
| HUD numerals at the corners, ≤ 1 big number per corner | paragraphs, stacked panels or modals during a ride (use the prompt banner) |

---

## 10. Dev harness & tests
- `sandbox/ui.html` — `?view=hud` (default) `&bg=03|02|none` `&phase=intro|toPickup|boarding|toDropoff|arriving` `&tod=morning|noon|sunset|night`
  `&freeze=<sec>` `&minimap=0` `&raw=1` (keep the mockup's painted-in HUD; by default it is blurred out) `&reduced=1`.
  `?view=components` living style guide · `?view=transition` router demo (`window.__wipe()`, `window.__pause()`).
  `window.__ready`, `window.__stats` (frame timing), `window.__bench(n)` (per-update cost).
- Screenshot: `node tools/shot.mjs --page "sandbox/ui.html?bg=02" --dir shots/ui-foundation --steps "until:20000:window.__ready|wait:3700|shot:hud02"`.
- Unit tests: `npx vitest run src/ui` (HUD formats & thresholds, map source, spring/zoom math, number formats).

## 11. File map
```
src/ui/index.ts                 public surface (import everything from here)
src/ui/core/                    ui (facade) · router · screen-registry · screen-types · transition · focus-nav · toaster
                                h (DOM builder) · animate (springs) · count-up · motion (reduced motion, EASE, DUR)
                                viewport-scale · sfx-delegate
src/ui/components/              button chip card bars swatch tab-strip inputs wallet coin street phone avatar face speech
                                receipt sheet loader · gallery* (style guide only)
src/ui/icons/                   icon.ts (API) · icon-paths.ts (glyph table)
src/ui/hud/                     hud (facade) · hud-bus · widgets (trip-tag target-readout speed-gauge rider-status mini-phone
                                minimap minimap-glyphs clearance popups prompt-banner warnings callout speech flash)
                                · labels (Korean copy) · format · map-source · types · demo-feed (sandbox data)
src/ui/styles/                  tokens · base · components/* · hud/* · transitions · load-styles.ts (fonts + cascade order)
src/ui/screens/<id>/            screen modules (screen agents) + screens/index.ts registering them
```
