// AI Strategy Loader - Makes AI classes available globally
import { AIStrategyEngine } from './AIStrategyEngine';
import { DurakProbabilityEngine } from './AIProbability';

if (typeof window !== 'undefined') {
  window.AIStrategyEngine = AIStrategyEngine;
  window.DurakProbabilityEngine = DurakProbabilityEngine;
}

export { AIStrategyEngine, DurakProbabilityEngine };