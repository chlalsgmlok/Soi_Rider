/** Registers the 'garage' screen (GarageProps) on import — passthrough so the left side reaches the turntable. */
import { registerScreen } from '../../core/screen-registry';
import { mountGarage } from './garage-screen';

export { mountGarage };
registerScreen('garage', mountGarage, { passthrough: true, enter: 'fade' });
