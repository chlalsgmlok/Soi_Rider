/** Registers the SETTINGS overlay. Import once for its side effect. */
import { registerScreen } from '../../core/screen-registry';
import { mountSettings } from './settings-screen';

registerScreen('settings', mountSettings, { overlay: true, enter: 'fade' });
