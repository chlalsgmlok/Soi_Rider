/**
 * Side-effect module: fonts + every design-system stylesheet, in cascade order.
 * Imported once by src/ui/core/ui.ts; sandboxes may import it directly.
 */
import '@fontsource/kanit/400.css';
import '@fontsource/kanit/500.css';
import '@fontsource/kanit/600.css';
import '@fontsource/kanit/700.css';
import '@fontsource/kanit/800.css';
import '@fontsource/kanit/800-italic.css';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './tokens.css';
import './base.css';
import './components.css';
import './transitions.css';
import './hud.css';
