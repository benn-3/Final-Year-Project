/**
 * TRACE-KT Evaluation Metrics
 * ═══════════════════════════════════════════════════════════════════════════════
 * Standard educational data mining & knowledge tracing evaluation metrics:
 * - Discrimination: AUC-ROC, Accuracy, F1-Score
 * - Regression / Error: RMSE, MAE
 * - Calibration: Brier Score, Expected Calibration Error (ECE)
 * - Epistemic Uncertainty: PICP, MPIW
 * - Statistical Significance: Paired t-test, Cohen's d
 */

/**
 * Compute Area Under the ROC Curve (AUC-ROC) via Mann-Whitney U statistic.
 * Handles ties properly by fractional rank assignment.
 * @param {number[]} yTrue - Binary labels (0 or 1)
 * @param {number[]} yPred - Predicted probabilities in [0, 1]
 * @returns {number} AUC ∈ [0, 1]
 */
function computeAUC(yTrue, yPred) {
  if (yTrue.length !== yPred.length || yTrue.length === 0) return 0.5;

  const nPos = yTrue.reduce((sum, y) => sum + (y === 1 ? 1 : 0), 0);
  const nNeg = yTrue.length - nPos;
  if (nPos === 0 || nNeg === 0) return 0.5;

  // Pair and sort ascending by predicted probability
  const paired = yTrue.map((yt, i) => ({ y: yt, p: yPred[i] }));
  paired.sort((a, b) => a.p - b.p);

  // Assign ranks with tie handling
  let rankSum = 0;
  let i = 0;
  while (i < paired.length) {
    let j = i;
    while (j < paired.length && paired[j].p === paired[i].p) {
      j++;
    }
    // Items from i to j-1 have same score, their average rank is (i + 1 + j) / 2
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      if (paired[k].y === 1) {
        rankSum += avgRank;
      }
    }
    i = j;
  }

  const u = rankSum - (nPos * (nPos + 1)) / 2;
  return u / (nPos * nNeg);
}

/**
 * Compute classification accuracy at specified threshold.
 */
function computeAccuracy(yTrue, yPred, threshold = 0.5) {
  let correct = 0;
  for (let i = 0; i < yTrue.length; i++) {
    const predLabel = yPred[i] >= threshold ? 1 : 0;
    if (predLabel === yTrue[i]) correct++;
  }
  return correct / yTrue.length;
}

/**
 * Compute F1-Score at specified threshold.
 */
function computeF1(yTrue, yPred, threshold = 0.5) {
  let tp = 0, fp = 0, fn = 0;
  for (let i = 0; i < yTrue.length; i++) {
    const predLabel = yPred[i] >= threshold ? 1 : 0;
    if (predLabel === 1 && yTrue[i] === 1) tp++;
    else if (predLabel === 1 && yTrue[i] === 0) fp++;
    else if (predLabel === 0 && yTrue[i] === 1) fn++;
  }
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  return precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
}

/**
 * Compute Root Mean Squared Error.
 */
function computeRMSE(yTrue, yPred) {
  let sumSq = 0;
  for (let i = 0; i < yTrue.length; i++) {
    const diff = yTrue[i] - yPred[i];
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq / yTrue.length);
}

/**
 * Compute Mean Absolute Error.
 */
function computeMAE(yTrue, yPred) {
  let sumAbs = 0;
  for (let i = 0; i < yTrue.length; i++) {
    sumAbs += Math.abs(yTrue[i] - yPred[i]);
  }
  return sumAbs / yTrue.length;
}

/**
 * Compute Brier Score (lower is better calibrated).
 */
function computeBrierScore(yTrue, yPred) {
  let sumSq = 0;
  for (let i = 0; i < yTrue.length; i++) {
    const diff = yTrue[i] - yPred[i];
    sumSq += diff * diff;
  }
  return sumSq / yTrue.length;
}

/**
 * Compute Expected Calibration Error (ECE).
 * Partitions predictions into M equal-width bins and computes weighted avg |acc - conf|.
 * @param {number[]} yTrue
 * @param {number[]} yPred
 * @param {number} nBins - Number of bins (default 10)
 * @returns {number} ECE ∈ [0, 1]
 */
function computeECE(yTrue, yPred, nBins = 10) {
  const bins = Array.from({ length: nBins }, () => ({ count: 0, sumPred: 0, sumTrue: 0 }));

  for (let i = 0; i < yTrue.length; i++) {
    let binIdx = Math.floor(yPred[i] * nBins);
    if (binIdx >= nBins) binIdx = nBins - 1;
    bins[binIdx].count++;
    bins[binIdx].sumPred += yPred[i];
    bins[binIdx].sumTrue += yTrue[i];
  }

  let ece = 0;
  const n = yTrue.length;
  for (const bin of bins) {
    if (bin.count > 0) {
      const avgConfidence = bin.sumPred / bin.count;
      const accuracy = bin.sumTrue / bin.count;
      ece += (bin.count / n) * Math.abs(accuracy - avgConfidence);
    }
  }
  return ece;
}

/**
 * Compute Prediction Interval Coverage Probability (PICP) and Mean Prediction Interval Width (MPIW).
 * @param {number[]} yTrue
 * @param {number[]} yLower
 * @param {number[]} yUpper
 */
function computePICP_MPIW(yTrue, yLower, yUpper) {
  let covered = 0;
  let totalWidth = 0;
  for (let i = 0; i < yTrue.length; i++) {
    if (yTrue[i] >= yLower[i] && yTrue[i] <= yUpper[i]) {
      covered++;
    }
    totalWidth += (yUpper[i] - yLower[i]);
  }
  return {
    picp: covered / yTrue.length,
    mpiw: totalWidth / yTrue.length,
  };
}

/**
 * Paired t-test between two equal-sized metric arrays (e.g. cross-validation folds).
 */
function computePairedTTest(sample1, sample2) {
  const n = sample1.length;
  if (n !== sample2.length || n < 2) return { t: 0, pValue: 1, df: 0 };

  const diffs = sample1.map((v, i) => v - sample2[i]);
  const meanDiff = diffs.reduce((a, b) => a + b, 0) / n;
  const varDiff = diffs.reduce((sum, d) => sum + Math.pow(d - meanDiff, 2), 0) / (n - 1);
  const stdDiff = Math.sqrt(varDiff);

  if (stdDiff === 0) return { t: 0, pValue: 1, df: n - 1, meanDiff: 0 };

  const t = meanDiff / (stdDiff / Math.sqrt(n));

  // Approximate 2-tailed p-value using standard normal / t-distribution tail
  const df = n - 1;
  const x = Math.abs(t);
  // Standard approximation for p-value
  const z = x;
  const pApprox = 2 * (1 - normalCDF(z));

  return {
    t: Math.round(t * 1000) / 1000,
    df,
    meanDiff: Math.round(meanDiff * 10000) / 10000,
    pValue: Math.max(0.0001, Math.round(pApprox * 10000) / 10000),
    significant: pApprox < 0.05,
  };
}

function normalCDF(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - prob : prob;
}

/**
 * Compute Cohen's d effect size for paired samples.
 */
function computeCohensD(sample1, sample2) {
  const n = sample1.length;
  const diffs = sample1.map((v, i) => v - sample2[i]);
  const meanDiff = diffs.reduce((a, b) => a + b, 0) / n;
  const varDiff = diffs.reduce((sum, d) => sum + Math.pow(d - meanDiff, 2), 0) / (n - 1);
  const stdDiff = Math.sqrt(varDiff);
  return stdDiff > 0 ? meanDiff / stdDiff : 0;
}

module.exports = {
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
};
