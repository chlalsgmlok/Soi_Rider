/** Registers the INTRO screen (gram call picker). Import once for its side effect. */
import { registerScreen } from '../../core/screen-registry';
import { mountIntro } from './intro-screen';

registerScreen('intro', mountIntro, { enter: 'fade' });
