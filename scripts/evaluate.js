import { createSeed } from '../client/src/domain/seed.js';
import { analyze, evaluate } from '../client/src/domain/engine.js';
console.log(JSON.stringify({ engine: 'reflow-planner/1.0', dataset: 'synthetic', backtest: evaluate(createSeed()), planning: analyze(createSeed()).metrics, limitations: ['No production performance claim','Time-series dependence invalidates exchangeability assumptions','Illustrative carrier rates','Greedy planner is not globally optimal'] },null,2));
