/** Registers the RESULTS screen (gram receipt). Import once for its side effect. */
import { registerScreen } from '../../core/screen-registry';
import { mountResults } from './results-screen';

registerScreen('results', mountResults, { enter: 'fade' });
