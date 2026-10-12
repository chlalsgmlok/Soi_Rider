/**
 * Ranking (RankingProps): riders compete on their best score. Glass panel like the shop: "my best" card on the left,
 * the board on the right (medals for the top 3, this rider highlighted). Loads on open and on 새로고침; offline /
 * error / empty states explain themselves. Esc goes back.
 */
import './ranking.css';
import type { RankingView } from '../../../core/types/screens';
import type { SaveData } from '../../../core/types';
import type { ScreenContext, ScreenView } from '../../core/screen-types';
import { h } from '../../core/h';
import { stagger } from '../../core/animate';
import { button } from '../../components/button';
import { menuHeader } from '../shop/menu-header';
import { loadingRows, myCard, rankRow, statusNote } from './ranking-rows';

const failed = (save: SaveData): RankingView => ({
  status: 'error', entries: [], total: 0, message: '순위를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
  mine: { rank: null, nickname: save.loadout.nickname.trim() || 'RIDER', score: save.bestScore, grade: null },
});

export function mountRanking(ctx: ScreenContext<'ranking'>): ScreenView<'ranking'> {
  const list = h('ol.rank-list', { aria: { label: '라이더 순위' } });
  const body = h('div.rank-board');
  let me = myCard(null);
  const refresh = button({ label: '새로고침', icon: 'refresh', variant: 'ghost', size: 'md', onClick: () => void load() });
  const retry = button({ label: '다시 시도', icon: 'refresh', variant: 'secondary', size: 'md' });
  const header = menuHeader({
    plate: { th: 'อันดับ', en: 'Ranking', no: '1' },
    title: '순위',
    sub: '최고 기록으로 겨루는 방콕 라이더 순위',
    onBack: () => ctx.props().onBack(),
    right: refresh,
  });
  const cols = h('div.rank-cols', { aria: { hidden: true } }, h('span', '순위'), h('span', '라이더'), h('span', '등급'), h('span', '점수'));
  body.append(cols, list);
  const content = h('div.rank__body', me, body);
  const panel = h('div.rank__panel', h('div.rank__flag', { aria: { hidden: true } }), h('div.rank__head', header), content);
  ctx.el.append(h('div.menu-stage', h('div.rank', panel)));

  let loading = 0;
  const show = (view: RankingView): void => {
    const next = myCard(view);
    me.replaceWith(next);
    me = next;
    const note = view.status !== 'online' || view.entries.length === 0 ? statusNote(view, () => void load(), retry) : null;
    list.replaceChildren(...view.entries.map(rankRow));
    body.querySelector('.rank-note')?.remove();
    cols.hidden = view.entries.length === 0;
    list.hidden = view.entries.length === 0;
    if (note) body.append(note);
    stagger([...list.children], { step: 28, distance: 10 });
    list.querySelector('.is-me')?.scrollIntoView({ block: 'nearest' });
  };

  async function load(): Promise<void> {
    const ticket = ++loading;
    refresh.disabled = true;
    body.querySelector('.rank-note')?.remove();
    list.hidden = false;
    list.replaceChildren(...loadingRows());
    try {
      const view = await ctx.props().load();
      if (ticket === loading) show(view);
    } catch {
      if (ticket === loading) show(failed(ctx.props().save));
    } finally {
      if (ticket === loading) refresh.disabled = false;
    }
  }

  return {
    enter() {
      stagger([header, me, body], { step: 70 });
      void load();
    },
    back() {
      ctx.props().onBack();
      return true;
    },
  };
}
