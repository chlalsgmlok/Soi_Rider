/** Registers the BOOT screen (docs/DESIGN_SYSTEM.md §5.2). Import once for its side effect. */
import { registerScreen } from '../../core/screen-registry';
import { mountBoot } from './boot-screen';

registerScreen('boot', mountBoot, { enter: 'fade' });
