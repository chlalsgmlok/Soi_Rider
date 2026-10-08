/** Touch controls styling — design tokens from docs/DESIGN_SYSTEM.md (CSS vars with literal fallbacks). */
export const TOUCH_CSS = /* css */ `
.soi-touch{position:fixed;inset:0;z-index:40;pointer-events:none;user-select:none;-webkit-user-select:none;
  -webkit-touch-callout:none;touch-action:none;font-family:Kanit,Pretendard,system-ui,sans-serif;
  --tc-cyan:var(--c-cyan,#3EE6D4);--tc-cyan-deep:var(--c-cyan-deep,#12B5A6);--tc-coral:var(--c-coral,#FF4D5E);
  --tc-ink:var(--c-ink,#151821);--tc-glass:rgba(21,24,33,.55);--tc-pad:max(16px,env(safe-area-inset-left));}
.soi-touch[hidden]{display:none}
.soi-touch .zone{position:absolute;left:0;bottom:0;width:46%;height:62%;pointer-events:auto}
.soi-touch .pad{position:absolute;width:200px;height:64px;margin:-32px 0 0 -100px;border-radius:999px;
  background:var(--tc-glass);backdrop-filter:blur(14px) saturate(1.3);-webkit-backdrop-filter:blur(14px) saturate(1.3);
  box-shadow:inset 0 0 0 2px rgba(255,255,255,.14),0 4px 0 rgba(0,0,0,.28);transition:opacity .22s cubic-bezier(.2,.8,.2,1);opacity:.78}
.soi-touch .pad::before,.soi-touch .pad::after{content:"";position:absolute;top:50%;width:0;height:0;margin-top:-7px;
  border:7px solid transparent;opacity:.55}
.soi-touch .pad::before{left:14px;border-right:9px solid #fff;border-left:0}
.soi-touch .pad::after{right:14px;border-left:9px solid #fff;border-right:0}
.soi-touch .pad.on{opacity:1}
.soi-touch .knob{position:absolute;left:50%;top:50%;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;
  background:radial-gradient(circle at 50% 38%,#fff 0 34%,rgba(255,255,255,.9) 35% 40%,transparent 41%),var(--tc-cyan);
  box-shadow:0 4px 0 var(--tc-cyan-deep),0 0 18px rgba(62,230,212,.45)}
.soi-touch .btn{position:absolute;pointer-events:auto;display:grid;place-items:center;border-radius:50%;color:#fff;
  background:var(--tc-glass);backdrop-filter:blur(14px) saturate(1.3);-webkit-backdrop-filter:blur(14px) saturate(1.3);
  box-shadow:inset 0 0 0 2px rgba(255,255,255,.16),0 4px 0 rgba(0,0,0,.28);
  transition:transform .12s cubic-bezier(.2,.8,.2,1),box-shadow .12s cubic-bezier(.2,.8,.2,1),background .12s}
.soi-touch .btn svg{width:46%;height:46%;stroke:currentColor;stroke-width:2.4;fill:none;stroke-linecap:round;stroke-linejoin:round}
.soi-touch .btn span{position:absolute;bottom:-18px;font-size:11px;font-weight:600;letter-spacing:.04em;
  text-shadow:0 2px 0 rgba(0,0,0,.35);opacity:.85;white-space:nowrap}
.soi-touch .btn.down{transform:translateY(3px);box-shadow:inset 0 0 0 2px rgba(255,255,255,.28),0 1px 0 rgba(0,0,0,.28)}
.soi-touch .gas{right:var(--tc-pad);bottom:max(28px,env(safe-area-inset-bottom));width:104px;height:104px;
  background:var(--tc-cyan);color:var(--tc-ink);box-shadow:0 5px 0 var(--tc-cyan-deep),0 0 22px rgba(62,230,212,.35)}
.soi-touch .gas.down{box-shadow:0 1px 0 var(--tc-cyan-deep),0 0 28px rgba(62,230,212,.6)}
.soi-touch .brake{right:calc(var(--tc-pad) + 116px);bottom:max(22px,env(safe-area-inset-bottom));width:76px;height:76px;
  background:var(--tc-coral);box-shadow:0 4px 0 #b8303d}
.soi-touch .brake.down{box-shadow:0 1px 0 #b8303d}
.soi-touch .tuck{right:calc(var(--tc-pad) + 24px);bottom:156px;width:58px;height:58px}
.soi-touch .horn{right:calc(var(--tc-pad) + 100px);bottom:122px;width:58px;height:58px}
.soi-touch .act{right:calc(var(--tc-pad) + 176px);bottom:116px;width:52px;height:52px}
.soi-touch .cam{right:calc(var(--tc-pad) + 30px);bottom:236px;width:46px;height:46px}
.soi-touch .pause{left:50%;top:max(12px,env(safe-area-inset-top));width:44px;height:44px;margin-left:-22px}
@media (prefers-reduced-motion:reduce){.soi-touch .btn,.soi-touch .pad{transition:none}}
`;

/** 24px-grid line icons (2px rounded strokes, per the design system) */
export const TOUCH_ICONS = {
  gas: '<svg viewBox="0 0 24 24"><path d="M6 14l6-6 6 6"/><path d="M6 19l6-6 6 6"/></svg>',
  brake: '<svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="3"/></svg>',
  tuck: '<svg viewBox="0 0 24 24"><path d="M4 9l4 3-4 3"/><path d="M20 9l-4 3 4 3"/><path d="M12 5v14"/></svg>',
  horn: '<svg viewBox="0 0 24 24"><path d="M4 10v4h3l6 4V6L7 10z"/><path d="M17 9a4 4 0 0 1 0 6"/><path d="M19.5 6.5a8 8 0 0 1 0 11"/></svg>',
  act: '<svg viewBox="0 0 24 24"><path d="M8 13V6a1.5 1.5 0 0 1 3 0v5"/><path d="M11 10.5V5a1.5 1.5 0 0 1 3 0v5.5"/><path d="M14 10.5V7a1.5 1.5 0 0 1 3 0v6c0 4-2.5 7-6 7-2.5 0-4-1.5-5.5-4L4 13a1.5 1.5 0 0 1 2.5-1.5L8 13"/></svg>',
  cam: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M9 6v12"/><path d="M15 6v12"/></svg>',
} as const;
