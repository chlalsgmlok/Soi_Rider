/**
 * Terse DOM builder.
 *   h('button.btn.btn--primary', { type: 'button', on: { click } }, icon('play'), '시작')
 *   h('div', { class: ['card', selected && 'is-selected'], style: { '--v': 0.4 }, data: { id: 'x' } }, …children)
 *   s('path', { d: 'M0 0L10 10' })   — same API in the SVG namespace
 * Tag shorthand: "tag#id.class1.class2". Children: Node | string | number | arrays; false/null/undefined are skipped.
 */
export type Child = Node | string | number | boolean | null | undefined | readonly Child[];
export type ClassValue = string | false | null | undefined | readonly ClassValue[];

type Listeners = { [E in keyof HTMLElementEventMap]?: (ev: HTMLElementEventMap[E]) => void };

export interface Attrs {
  class?: ClassValue;
  /** inline style string or map; keys may be camelCase, kebab-case or CSS custom properties (--x) */
  style?: string | Record<string, string | number | null | undefined>;
  data?: Record<string, string | number | boolean | null | undefined>;
  aria?: Record<string, string | number | boolean | null | undefined>;
  on?: Listeners;
  /** textContent shortcut */
  text?: string | number;
  /** receives the element once created */
  ref?: (el: Element) => void;
  [attr: string]: unknown;
}

/** "button.btn#go" → "button"; ".x" → "div" (type-level mirror of parseTag) */
type TagOf<S extends string> = S extends `${infer T}.${string}` ? StripId<T> : StripId<S>;
type StripId<S extends string> = S extends `${infer T}#${string}` ? T : S;
type HtmlOf<S extends string> = TagOf<S> extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[TagOf<S>] : TagOf<S> extends '' ? HTMLDivElement : HTMLElement;
type SvgOf<S extends string> = TagOf<S> extends keyof SVGElementTagNameMap ? SVGElementTagNameMap[TagOf<S>] : SVGElement;

const SVG_NS = 'http://www.w3.org/2000/svg';
const RESERVED = new Set(['class', 'style', 'data', 'aria', 'on', 'text', 'ref']);
/** set as DOM properties rather than attributes */
const PROPS = new Set(['value', 'checked', 'disabled', 'selected', 'tabIndex', 'hidden', 'inert', 'indeterminate']);

const kebab = (k: string): string => (k.startsWith('--') ? k : k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`));

export function cx(...v: ClassValue[]): string {
  const out: string[] = [];
  const walk = (x: ClassValue): void => {
    if (!x) return;
    if (typeof x === 'string') out.push(x);
    else for (const y of x) walk(y);
  };
  v.forEach(walk);
  return out.join(' ');
}

function parseTag(spec: string): { tag: string; id: string; classes: string[] } {
  const m = spec.match(/^([a-zA-Z][\w-]*)?((?:[#.][\w-]+)*)$/);
  if (!m) return { tag: spec, id: '', classes: [] };
  let id = '';
  const classes: string[] = [];
  for (const part of (m[2] ?? '').match(/[#.][\w-]+/g) ?? []) {
    if (part[0] === '#') id = part.slice(1);
    else classes.push(part.slice(1));
  }
  return { tag: m[1] ?? 'div', id, classes };
}

export function append(el: Element, ...children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false || c === true) continue;
    if (Array.isArray(c)) append(el, ...(c as readonly Child[]));
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

function applyAttrs(el: Element, attrs: Attrs, baseClasses: string[]): void {
  const cls = cx(baseClasses, attrs.class);
  if (cls) el.setAttribute('class', cls);
  const style = attrs.style;
  if (typeof style === 'string') el.setAttribute('style', style);
  else if (style) {
    const st = (el as HTMLElement | SVGElement).style;
    for (const [k, v] of Object.entries(style)) if (v !== null && v !== undefined) st.setProperty(kebab(k), String(v));
  }
  for (const [k, v] of Object.entries(attrs.data ?? {})) if (v !== null && v !== undefined && v !== false) el.setAttribute(`data-${kebab(k)}`, String(v));
  for (const [k, v] of Object.entries(attrs.aria ?? {})) if (v !== null && v !== undefined) el.setAttribute(`aria-${k}`, String(v));
  if (attrs.on) for (const [type, fn] of Object.entries(attrs.on)) if (fn) el.addEventListener(type, fn as EventListener);
  if (attrs.text !== undefined) el.textContent = String(attrs.text);
  for (const [k, v] of Object.entries(attrs)) {
    if (RESERVED.has(k) || v === null || v === undefined || v === false) continue;
    if (PROPS.has(k)) Reflect.set(el, k, v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
}

function isAttrs(x: unknown): x is Attrs {
  return typeof x === 'object' && x !== null && !(x instanceof Node) && !Array.isArray(x);
}

export function h<S extends string>(spec: S, attrs?: Attrs | Child | null, ...children: Child[]): HtmlOf<S> {
  const { tag, id, classes } = parseTag(spec);
  const el = document.createElement(tag);
  if (id) el.id = id;
  if (isAttrs(attrs)) applyAttrs(el, attrs, classes);
  else {
    if (classes.length) el.className = classes.join(' ');
    if (attrs !== undefined) children.unshift(attrs);
  }
  append(el, ...children);
  if (isAttrs(attrs) && attrs.ref) attrs.ref(el);
  return el as HtmlOf<S>;
}

export function s<S extends string>(spec: S, attrs?: Attrs | null, ...children: Child[]): SvgOf<S> {
  const { tag, id, classes } = parseTag(spec);
  const el = document.createElementNS(SVG_NS, tag) as SVGElement;
  if (id) el.id = id;
  applyAttrs(el, attrs ?? {}, classes);
  append(el, ...children);
  if (attrs?.ref) attrs.ref(el);
  return el as SvgOf<S>;
}

/** remove every child */
export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** replace all children */
export function mount(el: Element, ...children: Child[]): void {
  clear(el);
  append(el, ...children);
}
