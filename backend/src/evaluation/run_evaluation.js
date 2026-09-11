/**
 * TRACE-KT Comprehensive Evaluation Harness
 * ═══════════════════════════════════════════════════════════════════════════════
 * Executes offline benchmark evaluation comparing:
 * 1. Standard BKT (Corbett & Anderson)
 * 2. Elo-Only (Pelánek)
 * 3. Elo-BKT (Legacy hybrid)
 * 4. TRACE-KT Ablations (A1: No CES, A2: No Trust, A4: No RT, A5: No Hints, A6: No Conf)
 * 5. TRACE-KT (Full proposed algorithm)
 *
 * Computes:
 * - Discrimination: AUC-ROC, Accuracy, F1
 * - Calibration: Brier Score, ECE
 * - Prediction Error: RMSE, MAE
 * - Epistemic Uncertainty: PICP, MPIW
 * - Statistical Rigor: Paired t-tests against baselines, p-values, Cohen's d effect sizes
 */

const fs = require('fs');
const path = require('path');
const { generateBenchmarkDataset } = require('./benchmark_dataset');
const {
  StandardBKTModel,
  EloOnlyModel,
  EloBKTModel,
  TraceKTModel,
} = require('./baseline_models');
const {
  computeAUC,
  computeAccuracy,
  computeF1,
  computeRMSE,
  computeMAE,
  computeBrierScore,
  computeECE,
  computePICP_MPIW,
  computePairedTTest,
  computeCohensD,
} = require('./metrics');

async function runEvaluation() {
  console.log('══════════════════════════════════════════════════════════════════════════════');
  console.log('  TRACE-KT: Empirical Benchmark Evaluation & Comparative Analysis');
  console.log('══════════════════════════════════════════════════════════════════════════════\n');

  // 1. Generate multi-learner evaluation dataset
  const datasetConfig = {
    numLearners: 80,
    numConcepts: 12,
    itemsPerConcept: 8,
    seed: 2026,
  };
  console.log(`Generating benchmark sequence: ${datasetConfig.numLearners} learners, ${datasetConfig.numConcepts} concepts...`);
  const dataset = generateBenchmarkDataset(datasetConfig);
  console.log(`Total interactions generated: ${dataset.totalInteractions}\n`);

  // 2. Define models to evaluate
  const modelFactories = [
    { id: 'bkt', name: 'Standard BKT', create: () => new StandardBKTModel() },
    { id: 'elo', name: 'Elo-Only', create: () => new EloOnlyModel() },
    { id: 'elo_bkt', name: 'Elo-BKT (Legacy)', create: () => new EloBKTModel() },
    {
      id: 'tracekt_no_ces',
      name: 'A1: TRACE-KT (w/o CES)',
      create: () => new TraceKTModel({ name: 'A1: TRACE-KT (w/o CES)', ablation: 'no_ces' }),
    },
    {
      id: 'tracekt_no_trust',
      name: 'A2: TRACE-KT (w/o Trust)',
      create: () => new TraceKTModel({ name: 'A2: TRACE-KT (w/o Trust)', ablation: 'no_trust' }),
    },
    {
      id: 'tracekt_no_rt',
      name: 'A4: TRACE-KT (w/o RT)',
      create: () => new TraceKTModel({ name: 'A4: TRACE-KT (w/o RT)', ablation: 'no_rt' }),
    },
    {
      id: 'tracekt_no_hints',
      name: 'A5: TRACE-KT (w/o Hints)',
      create: () => new TraceKTModel({ name: 'A5: TRACE-KT (w/o Hints)', ablation: 'no_hints' }),
    },
    {
      id: 'tracekt_no_conf',
      name: 'A6: TRACE-KT (w/o Conf)',
      create: () => new TraceKTModel({ name: 'A6: TRACE-KT (w/o Conf)', ablation: 'no_conf' }),
    },
    {
      id: 'tracekt_full',
      name: 'TRACE-KT (Proposed Full)',
      create: () => new TraceKTModel({ name: 'TRACE-KT (Proposed Full)' }),
    },
  ];

  // Group interactions by learner for 5-fold cross-validation
  const learners = Array.from(new Set(dataset.interactions.map((ix) => ix.learnerId)));
  const kFolds = 5;
  const foldSize = Math.ceil(learners.length / kFolds);

  const resultsByModel = new Map();

  for (const mf of modelFactories) {
    resultsByModel.set(mf.id, {
      id: mf.id,
      name: mf.name,
      foldAUCs: [],
      foldAccs: [],
      foldF1s: [],
      foldRMSEs: [],
      foldBriers: [],
      foldECEs: [],
      allPredictions: [],
      allTrue: [],
      allLower: [],
      allUpper: [],
    });
  }

  console.log(`Running ${kFolds}-fold cross-validation across ${learners.length} learners...`);

  for (let f = 0; f < kFolds; f++) {
    const testLearners = new Set(learners.slice(f * foldSize, (f + 1) * foldSize));

    for (const mf of modelFactories) {
      const model = mf.create();
      const modelEntry = resultsByModel.get(mf.id);

      const foldTrue = [];
      const foldPred = [];

      // Process interactions in temporal sequence
      for (const ix of dataset.interactions) {
        if (!testLearners.has(ix.learnerId)) {
          // Warm up / train on other learners
          model.predict(ix);
          model.update(ix);
        } else {
          // Test learner
          const pPred = model.predict(ix);
          foldTrue.push(ix.correct);
          foldPred.push(pPred);

          modelEntry.allTrue.push(ix.correct);
          modelEntry.allPredictions.push(pPred);

          if (typeof model.getPredictionInterval === 'function') {
            const pi = model.getPredictionInterval(ix);
            modelEntry.allLower.push(pi.lower);
            modelEntry.allUpper.push(pi.upper);
            if (!modelEntry.allTrueLatent) modelEntry.allTrueLatent = [];
            modelEntry.allTrueLatent.push(ix.pTrue);
          }

          // Sequential online update
          model.update(ix);
        }
      }

      // Compute fold metrics
      modelEntry.foldAUCs.push(computeAUC(foldTrue, foldPred));
      modelEntry.foldAccs.push(computeAccuracy(foldTrue, foldPred));
      modelEntry.foldF1s.push(computeF1(foldTrue, foldPred));
      modelEntry.foldRMSEs.push(computeRMSE(foldTrue, foldPred));
      modelEntry.foldBriers.push(computeBrierScore(foldTrue, foldPred));
      modelEntry.foldECEs.push(computeECE(foldTrue, foldPred));
    }
  }

  // 3. Aggregate metrics
  const summaryTable = [];
  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = (arr) => {
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / (arr.length - 1));
  };

  for (const mf of modelFactories) {
    const entry = resultsByModel.get(mf.id);
    const mRow = {
      id: mf.id,
      name: mf.name,
      auc: mean(entry.foldAUCs),
      aucStd: std(entry.foldAUCs),
      accuracy: mean(entry.foldAccs),
      f1: mean(entry.foldF1s),
      rmse: mean(entry.foldRMSEs),
      brier: mean(entry.foldBriers),
      ece: mean(entry.foldECEs),
    };

    if (entry.allLower.length > 0) {
      const targets = entry.allTrueLatent && entry.allTrueLatent.length > 0 ? entry.allTrueLatent : entry.allTrue;
      const uq = computePICP_MPIW(targets, entry.allLower, entry.allUpper);
      mRow.picp = uq.picp;
      mRow.mpiw = uq.mpiw;
    }

    summaryTable.push(mRow);
  }

  // 4. Statistical significance tests comparing TRACE-KT against all others
  const traceFull = resultsByModel.get('tracekt_full');
  const significanceTests = [];

  for (const mf of modelFactories) {
    if (mf.id === 'tracekt_full') continue;
    const comp = resultsByModel.get(mf.id);
    const tTest = computePairedTTest(traceFull.foldAUCs, comp.foldAUCs);
    const cohen = computeCohensD(traceFull.foldAUCs, comp.foldAUCs);

    significanceTests.push({
      baseline: mf.name,
      meanDiffAUC: tTest.meanDiff,
      tStat: tTest.t,
      pValue: tTest.pValue,
      cohensD: Math.round(cohen * 100) / 100,
      significant: tTest.significant,
    });
  }

  // 5. Display Formatted Results Table
  console.log('\n┌────────────────────────────────────────────────────────────────────────────────────────────────┐');
  console.log('│                                📊 KNOWLEDGE TRACING BENCHMARK RESULTS                          │');
  console.log('├──────────────────────────┬──────────────┬──────────┬──────────┬──────────┬──────────┬──────────┤');
  console.log('│ Model                    │ AUC-ROC (SD) │ Accuracy │ F1-Score │   RMSE   │  Brier   │   ECE    │');
  console.log('├──────────────────────────┼──────────────┼──────────┼──────────┼──────────┼──────────┼──────────┤');

  for (const r of summaryTable) {
    const nameStr = r.name.padEnd(24);
    const aucStr = `${r.auc.toFixed(4)} (±${r.aucStd.toFixed(3)})`.padEnd(12);
    const accStr = `${(r.accuracy * 100).toFixed(2)}%`.padEnd(8);
    const f1Str = `${r.f1.toFixed(4)}`.padEnd(8);
    const rmseStr = `${r.rmse.toFixed(4)}`.padEnd(8);
    const brierStr = `${r.brier.toFixed(4)}`.padEnd(8);
    const eceStr = `${r.ece.toFixed(4)}`.padEnd(8);

    console.log(`│ ${nameStr} │ ${aucStr} │ ${accStr} │ ${f1Str} │ ${rmseStr} │ ${brierStr} │ ${eceStr} │`);
  }
  console.log('└──────────────────────────┴──────────────┴──────────┴──────────┴──────────┴──────────┴──────────┘');

  // Display Statistical Significance Table
  console.log('\n┌────────────────────────────────────────────────────────────────────────────────────────┐');
  console.log('│                   📈 STATISTICAL SIGNIFICANCE (TRACE-KT Full vs. Baselines)            │');
  console.log('├──────────────────────────┬──────────────┬──────────┬──────────┬────────────┬───────────┤');
  console.log('│ Comparison               │ Δ AUC-ROC    │ t-stat   │ p-value  │ Cohen\'s d  │ Sig (p<.05)│');
  console.log('├──────────────────────────┼──────────────┼──────────┼──────────┼────────────┼───────────┤');

  for (const s of significanceTests) {
    const compStr = s.baseline.padEnd(24);
    const diffStr = `+${s.meanDiffAUC.toFixed(4)}`.padEnd(12);
    const tStr = `${s.tStat.toFixed(3)}`.padEnd(8);
    const pStr = `${s.pValue < 0.001 ? '<0.001' : s.pValue.toFixed(4)}`.padEnd(8);
    const dStr = `${s.cohensD.toFixed(2)}`.padEnd(10);
    const sigStr = s.significant ? '✅ YES' : '❌ NO';

    console.log(`│ ${compStr} │ ${diffStr} │ ${tStr} │ ${pStr} │ ${dStr} │ ${sigStr.padEnd(9)} │`);
  }
  console.log('└──────────────────────────┴──────────────┴──────────┴──────────┴────────────┴───────────┘\n');

  // Display Uncertainty Calibration
  const fullRow = summaryTable.find((r) => r.id === 'tracekt_full');
  console.log(`✨ Closed-Form Epistemic Uncertainty Quality (Beta Distribution):`);
  console.log(`   • PICP (Prediction Interval Coverage Probability): ${(fullRow.picp * 100).toFixed(2)}% (Target: ~90%)`);
  console.log(`   • MPIW (Mean Prediction Interval Width):          ${fullRow.mpiw.toFixed(4)}`);
  console.log(`   • ECE (Expected Calibration Error):               ${fullRow.ece.toFixed(4)} (vs Elo-BKT: ${summaryTable.find((r) => r.id === 'elo_bkt').ece.toFixed(4)})\n`);

  // 6. Save results to JSON and Markdown
  const resultsDir = path.join(__dirname);
  const jsonPath = path.join(resultsDir, 'evaluation_results.json');
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        config: datasetConfig,
        summary: summaryTable,
        significance: significanceTests,
      },
      null,
      2
    )
  );

  console.log(`Results successfully saved to: ${jsonPath}`);
  return { summaryTable, significanceTests };
}

if (require.main === module) {
  runEvaluation()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Evaluation failed:', err);
      process.exit(1);
    });
}

module.exports = { runEvaluation };
