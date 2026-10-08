/** Registers the 'title' screen (TitleProps) on import. */
import { registerScreen } from '../../core/screen-registry';
import { mountTitle, setTitleGate } from './title-screen';

export { mountTitle, setTitleGate };
registerScreen('title', mountTitle, { enter: 'fade' });
