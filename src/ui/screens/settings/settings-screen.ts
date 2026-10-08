/**
 * SETTINGS (overlay) — sound (master / music / sfx), graphics quality, default camera, minimap, reduced motion and
 * touch controls. Every change calls onChange(settings) immediately (live preview); handle.update({ settings })
 * re-syncs the controls without echoing. Esc / 완료 → onBack. 기본값으로 restores DEFAULT_SETTINGS.
 */
import type { CameraMode, QualityPreset, Settings } from '../../../core/types/save';
import type { ScreenContext, ScreenView } from '../../core/screen-types';
import { DEFAULT_SETTINGS } from '../../../logic/save-defaults';
import { h } from '../../core/h';
import { button } from '../../components/button';
import { soiPlate, curbDivider } from '../../components/street';
import { pop, popOut, settled, stagger } from '../../core/animate';
import { section, segmentedRow, toggleRow, volumeRow, type Row } from './settings-controls';
import './settings.css';

type Touch = Settings['touch'];
type Quality = QualityPreset | 'auto';

export function mountSettings(ctx: ScreenContext<'settings'>): ScreenView<'settings'> {
  let cur: Settings = { ...ctx.props().settings };
  const emit = (patch: Partial<Settings>): void => {
    cur = { ...cur, ...patch };
    ctx.props().onChange({ ...cur });
  };

  const master = volumeRow('전체 볼륨', '모든 소리', cur.master, (v) => emit({ master: v }));
  const music = volumeRow('음악', '룩통 · 몰람 BGM', cur.music, (v) => emit({ music: v }));
  const sfx = volumeRow('효과음', '엔진 · 경적 · UI', cur.sfx, (v) => emit({ sfx: v }), () => ctx.ui.sfx('tap'));
  const quality = segmentedRow<Quality>('그래픽 품질', cur.quality, [
    { id: 'auto', label: '자동', hint: '프레임에 맞춰 자동으로 조절해요' },
    { id: 'low', label: '낮음', hint: '배터리 절약 · 효과 최소' },
    { id: 'medium', label: '보통', hint: '권장 · 60 fps 목표' },
    { id: 'high', label: '높음', hint: '틸트시프트 · 블룸 · 젖은 노면 최고 품질' },
  ], (v) => emit({ quality: v }));
  const camera = segmentedRow<CameraMode>('기본 카메라', cur.camera, [
    { id: 'auto', label: '자동', hint: '좁은 틈에서는 카메라가 가까이 붙어요' },
    { id: 'diorama', label: '디오라마', hint: '미니어처 도시를 내려다보는 시점' },
    { id: 'pov', label: '1인칭', hint: '핸들바와 미러가 보이는 시점' },
  ], (v) => emit({ camera: v }));
  const minimap = toggleRow('미니맵', '주행 중 gram 미니폰에 지도 표시', cur.minimap, (v) => emit({ minimap: v }));
  const motion = toggleRow('모션 줄이기', '화면 전환 · 흔들림 · 반짝임 최소화', cur.reducedMotion, (v) => emit({ reducedMotion: v }));
  const touch = segmentedRow<Touch>('터치 컨트롤', cur.touch, [
    { id: 'auto', label: '자동', hint: '터치 화면에서만 버튼을 보여 줘요' },
    { id: 'on', label: '켜기', hint: '항상 화면 버튼 표시' },
    { id: 'off', label: '끄기', hint: '키보드 · 게임패드만 사용' },
  ], (v) => emit({ touch: v }));

  const rows: { [K in keyof Settings]: Row<Settings[K]> } = { master, music, sfx, quality, camera, minimap, reducedMotion: motion, touch };
  const sync = (s: Settings): void => {
    cur = { ...s };
    (Object.keys(rows) as Array<keyof Settings>).forEach((k) => (rows[k] as Row<Settings[typeof k]>).set(s[k]));
  };

  const done = button({ label: '완료', icon: 'check', key: 'Esc', autofocus: false, onClick: () => ctx.props().onBack() });
  const reset = button({
    label: '기본값으로',
    icon: 'refresh',
    variant: 'ghost',
    onClick: () => {
      sync({ ...DEFAULT_SETTINGS });
      ctx.props().onChange({ ...cur });
      ctx.ui.toast('기본 설정으로 되돌렸어요', 'info', 'refresh');
    },
  });
  const close = button({ icon: 'close', variant: 'ghost', size: 'sm', title: '닫기', onClick: () => ctx.props().onBack() });

  const cols = h(
    'div.settings__cols',
    h('div.settings__col', section('SOUND', '사운드', 'sound', master.el, music.el, sfx.el), section('GRAPHICS', '그래픽', 'spark', quality.el)),
    h('div.settings__col', section('RIDE', '플레이', 'bike', camera.el, minimap.el), section('ACCESS', '접근성', 'user', motion.el, touch.el)),
  );
  const panel = h(
    'div.settings__panel',
    { role: 'dialog', aria: { modal: true, label: '설정' } },
    h('div.settings__head', soiPlate({ th: 'ตั้งค่า', en: 'Settings', class: 'settings__plate' }), h('h1.settings__title', '설정'), h('span.u-grow'), close),
    curbDivider('thin'),
    h('div.settings__body.scroll-y', cols),
    h('div.settings__foot', reset, h('span.u-grow'), h('span.settings__saved', '변경 사항은 바로 저장돼요'), done),
  );
  ctx.el.append(h('div.settings', h('div.settings__stage', panel)));

  ctx.onDispose(() => {
    quality.dispose?.();
    camera.dispose?.();
    touch.dispose?.();
  });

  return {
    enter() {
      pop(panel, { from: 0.94 });
      stagger(cols.querySelectorAll('.set-sec'), { delay: 80, step: 70 });
      (master.el.querySelector('input') as HTMLElement | null)?.focus({ preventScroll: true });
    },
    async leave() {
      await Promise.all([settled(popOut(panel, { to: 0.95, duration: 180 })), settled(ctx.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }))]);
    },
    update(next, changed) {
      if (changed.settings) sync(next.settings);
    },
    back() {
      ctx.props().onBack();
      return true;
    },
  };
}
