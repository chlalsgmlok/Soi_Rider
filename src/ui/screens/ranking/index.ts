/** Registers the 'ranking' screen (RankingProps) on import. */
import { registerScreen } from '../../core/screen-registry';
import { mountRanking } from './ranking-screen';

export { mountRanking };
registerScreen('ranking', mountRanking);
