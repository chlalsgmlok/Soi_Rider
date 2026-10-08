import type { AppCtx } from '../app-context';

/** SETTINGS overlay (title or pause): every change is persisted and applied live (volumes, quality, camera, …) */
export function openSettings(ctx: AppCtx, onClose?: () => void): void {
  const handle = ctx.ui.show('settings', {
    settings: ctx.saves.save.settings,
    onChange: (s) => ctx.applySettings(s),
    onBack: () => {
      void handle.close();
      onClose?.();
    },
  }, 'none');
}
