/**
 * Nickname tab: big licence plate preview, text field (≤ 10 characters, live counter), random Thai nickname dice.
 * Enter in the field equips (hooks.submit). An empty field falls back to the saved nickname on equip (logic.equip).
 */
import { h } from '../../core/h';
import { button } from '../../components/button';
import { sectionHead } from '../../components/card';
import { bump } from '../../core/animate';
import { licensePlate } from './garage-plate';
import { NICKNAME_LIMIT, type GarageModel } from './garage-model';

/** Thai nicknames (ชื่อเล่น) — short, romanised, plate-friendly */
const NICKNAMES = ['NONG', 'BEAM', 'TON', 'PLOY', 'MILK', 'BANK', 'GOLF', 'FERN', 'KAO', 'NAM', 'MAX', 'PING', 'BOSS', 'MOD', 'TAE', 'JUB'];

const clip = (raw: string): string => Array.from(raw.replace(/[\u0000-\u001f\u007f]/g, '')).slice(0, NICKNAME_LIMIT).join('');

export interface NicknameEditor {
  el: HTMLElement;
  input: HTMLInputElement;
  refresh(model: GarageModel): void;
}

export function nicknameEditor(model: GarageModel, hooks: { submit(): void }): NicknameEditor {
  const plate = licensePlate(model.preview.nickname, 'lg');
  const count = h('span.g-nick__count.t-num');
  const input = h('input.g-nick__input', {
    type: 'text',
    value: model.preview.nickname,
    maxlength: NICKNAME_LIMIT * 2,
    autocomplete: 'off',
    spellcheck: 'false',
    enterkeyhint: 'done',
    aria: { label: `닉네임 (최대 ${NICKNAME_LIMIT}자)` },
  });
  // never rewrite the field mid-composition (Korean / Thai IME); clip once the syllable is committed
  const sync = (fix: boolean): void => {
    const v = clip(input.value);
    if (fix && v !== input.value) input.value = v;
    model.setNickname(v);
  };
  input.addEventListener('input', (e) => sync(!(e as InputEvent).isComposing));
  input.addEventListener('compositionend', () => sync(true));
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    input.blur();
    hooks.submit();
  });
  const dice = button({
    label: '랜덤',
    icon: 'dice',
    variant: 'ghost',
    size: 'sm',
    title: '태국식 닉네임 뽑기',
    onClick: () => {
      const pool = NICKNAMES.filter((n) => n !== model.preview.nickname);
      const next = pool[Math.floor(Math.random() * pool.length)] ?? 'NONG';
      input.value = next;
      model.setNickname(next);
      bump(plate.el, 0.06);
    },
  });
  const hint = h('p.g-nick__hint');
  const el = h(
    'section.g-nick',
    { aria: { label: '닉네임' } },
    h('div.g-nick__stage', plate.el),
    sectionHead('Nickname', '라이더 닉네임', count),
    h('div.g-nick__row', input, dice),
    hint,
    h('p.g-nick__note', 'gram 앱 손님 화면과 번호판에 표시돼요. Enter 로 바로 장착.'),
  );

  const refresh = (m: GarageModel): void => {
    const v = m.preview.nickname;
    if (document.activeElement !== input && input.value !== v) input.value = v;
    plate.set(v || m.save.loadout.nickname);
    const n = Array.from(v).length;
    count.textContent = `${n}/${NICKNAME_LIMIT}`;
    const empty = v.trim().length === 0;
    el.classList.toggle('is-empty', empty);
    hint.textContent = empty ? `비워 두면 원래 닉네임 ${m.save.loadout.nickname}(으)로 돌아가요` : '';
    hint.hidden = !empty;
  };
  refresh(model);
  return { el, input, refresh };
}
