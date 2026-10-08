/** Registers the 'setup' screen (SetupProps) on import. */
import { registerScreen } from '../../core/screen-registry';
import { mountSetup } from './setup-screen';

export { mountSetup };
registerScreen('setup', mountSetup);
