/** Registers the 'shop' screen (ShopProps) on import. */
import { registerScreen } from '../../core/screen-registry';
import { mountShop } from './shop-screen';

export { mountShop };
registerScreen('shop', mountShop);
