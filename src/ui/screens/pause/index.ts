/** Registers the PAUSE overlay. Import once for its side effect. */
import { registerScreen } from '../../core/screen-registry';
import { mountPause } from './pause-screen';

registerScreen('pause', mountPause, { overlay: true, enter: 'fade' });
