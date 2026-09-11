/**
 * TRACE-KT: Numerical Verification Test Suite
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Verifies every pure function of the TRACE-KT algorithm with worked examples.
 * These are the exact numerical examples that go into the research paper.
 *
 * Run: node src/tests/tracekt.test.js
 */

const {
  // Elo
  eloExpected,
  updateLearnerRating,
  updateQuestionElo,
  // CES (Contribution C1)
  responseTimeFactor,
  hintFactor,
  confidenceFactor,
  attemptDecayFactor,
  computeCES,
  // Dynamic G/S
  computeDynamicGS,
  // TRACE-KT posterior
  traceKTPosterior,
  // Uncertainty (Contribution C3)
  updateBetaTracker,
  computeUncertainty,
  // Constants
  BASE_GUESS,
  BASE_SLIP,
  K_LEARNER,
  K_QUESTION,
} = require('../services/tracekt.service');

const {
  // Trust (Contribution C2)
  computeQuestionTrustScore,
  computeConceptConsistency,
  computeRelevance,
  computeDifficultyCalibration,
  computeFormatQuality,
  keywordOverlap,
  tokenize,
} = require('../services/trust.service');

// ── Test infrastructure ──────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const TOLERANCE = 0.001;

function assertClose(actual, expected, label, tolerance = TOLERANCE) {
  if (Math.abs(actual - expected) <= tolerance) {
    passed++;
    console.log(`  ✅ ${label}: ${actual.toFixed(4)} ≈ ${expected.toFixed(4)}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}: got ${actual.toFixed(6)}, expected ${expected.toFixed(6)} (diff=${Math.abs(actual - expected).toFixed(6)})`);
  }
}

function assertTrue(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}: condition was false`);
  }
}

function section(name) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${name}`);
  console.log(`${'═'.repeat(60)}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Test 1: Elo Expected Correctness
// ═══════════════════════════════════════════════════════════════════════════════

section('1. Elo Expected Correctness');

// Equal ratings → 50%
assertClose(eloExpected(1200, 1200), 0.5, 'Equal ratings → E=0.5');

// Learner 400 above question → ~90.9%
assertClose(eloExpected(1600, 1200), 0.909, 'R_L=1600, R_Q=1200 → E≈0.909', 0.001);

// Learner 400 below question → ~9.1%
assertClose(eloExpected(800, 1200), 0.091, 'R_L=800, R_Q=1200 → E≈0.091', 0.001);

// Learner 200 above → ~76%
assertClose(eloExpected(1400, 1200), 0.760, 'R_L=1400, R_Q=1200 → E≈0.760', 0.001);

// ═══════════════════════════════════════════════════════════════════════════════
// Test 2: Elo Rating Updates
// ═══════════════════════════════════════════════════════════════════════════════

section('2. Elo Rating Updates');

// Hard question correct (upset): big gain
const e1 = eloExpected(1200, 1400);
const newR1 = updateLearnerRating(1200, e1, true);
assertTrue(newR1 > 1215, `Hard correct: 1200→${newR1.toFixed(1)} (>1215)`);

// Hard question incorrect (expected): small loss
const newR2 = updateLearnerRating(1200, e1, false);
assertTrue(newR2 > 1194 && newR2 < 1200, `Hard incorrect: 1200→${newR2.toFixed(1)} (small loss)`);

// Easy question incorrect (upset): big loss
const e2 = eloExpected(1200, 800);
const newR3 = updateLearnerRating(1200, e2, false);
assertTrue(newR3 < 1180, `Easy incorrect: 1200→${newR3.toFixed(1)} (<1180)`);

// Question Elo: wrong answer → question gets harder
const newQE = updateQuestionElo(1200, 0.5, false);
assertTrue(newQE > 1200, `Wrong answer → question Elo increases: ${newQE.toFixed(1)}`);

// ═══════════════════════════════════════════════════════════════════════════════
// Test 3: CES Factor Functions (Contribution C1)
// ═══════════════════════════════════════════════════════════════════════════════

section('3. CES Factor Functions (C1)');

// Response time factor
const rtFast = responseTimeFactor(5, 1200, 1200);   // 5 sec for medium → very fast
const rtSlow = responseTimeFactor(120, 1200, 1200);  // 2 min for medium → very slow
assertTrue(rtFast > rtSlow, `Fast(5s)=${rtFast.toFixed(3)} > Slow(120s)=${rtSlow.toFixed(3)}`);
assertTrue(rtFast > 0.7, `Very fast → high evidence: ${rtFast.toFixed(3)}`);
assertTrue(rtSlow < 0.4, `Very slow → low evidence: ${rtSlow.toFixed(3)}`);

// Hard question should expect longer time
const rtHardMed = responseTimeFactor(30, 1200, 1600);  // 30s for hard question
const rtEasyMed = responseTimeFactor(30, 1200, 800);   // 30s for easy question
assertTrue(rtHardMed > rtEasyMed, `30s on hard(${rtHardMed.toFixed(3)}) > 30s on easy(${rtEasyMed.toFixed(3)})`);

// Hint factor
assertClose(hintFactor(0), 1.0, 'No hints → f_h=1.0');
assertClose(hintFactor(1), 0.5, 'One hint → f_h=0.5');
assertClose(hintFactor(2), 1/3, 'Two hints → f_h=0.333');

// Confidence factor
assertClose(confidenceFactor(1.0, true), 1.0, 'High conf + correct → f_κ=1.0');
assertClose(confidenceFactor(0.0, false), 1.0, 'Low conf + incorrect → f_κ=1.0');
assertClose(confidenceFactor(1.0, false), 0.5, 'High conf + incorrect → f_κ=0.5');
assertClose(confidenceFactor(0.0, true), 0.5, 'Low conf + correct → f_κ=0.5');
assertClose(confidenceFactor(0.5, true), 0.75, 'Moderate conf + correct → f_κ=0.75');

// Attempt decay factor
assertClose(attemptDecayFactor(1), 1.0, 'First attempt → f_n=1.0');
assertClose(attemptDecayFactor(2), 1 / 1.3, 'Second attempt → f_n≈0.769', 0.001);
assertClose(attemptDecayFactor(5), 1 / 2.2, 'Fifth attempt → f_n≈0.455', 0.001);

// ═══════════════════════════════════════════════════════════════════════════════
// Test 4: Composite CES
// ═══════════════════════════════════════════════════════════════════════════════

section('4. Composite CES');

// Strong evidence: fast, no hints, high confidence, first attempt, correct
const cesStrong = computeCES({
  responseTimeSec: 8, hintCount: 0, confidence: 1.0, correct: true,
  attemptNumber: 1, learnerRating: 1200, questionElo: 1200,
});
assertTrue(cesStrong.ces > 0.7, `Strong evidence CES=${cesStrong.ces.toFixed(3)} (>0.7)`);

// Weak evidence: slow, 2 hints, low confidence, 4th attempt, correct
const cesWeak = computeCES({
  responseTimeSec: 120, hintCount: 2, confidence: 0.25, correct: true,
  attemptNumber: 4, learnerRating: 1200, questionElo: 1200,
});
assertTrue(cesWeak.ces < 0.1, `Weak evidence CES=${cesWeak.ces.toFixed(3)} (<0.1)`);

// Moderate evidence
const cesMod = computeCES({
  responseTimeSec: 25, hintCount: 0, confidence: 0.75, correct: true,
  attemptNumber: 1, learnerRating: 1200, questionElo: 1200,
});
assertTrue(cesMod.ces > 0.3 && cesMod.ces < 0.8, `Moderate evidence CES=${cesMod.ces.toFixed(3)}`);

// CES strong > moderate > weak
assertTrue(cesStrong.ces > cesMod.ces && cesMod.ces > cesWeak.ces,
  `CES ordering: ${cesStrong.ces.toFixed(3)} > ${cesMod.ces.toFixed(3)} > ${cesWeak.ces.toFixed(3)}`);

// ═══════════════════════════════════════════════════════════════════════════════
// Test 5: Dynamic G/S (TRACE-KT Core)
// ═══════════════════════════════════════════════════════════════════════════════

section('5. Dynamic G/S Parameters');

// High weight, hard question: G should be very low (correct is strong mastery evidence)
const gs1 = computeDynamicGS(0.1, 0.9);  // E=0.1 (hard), w=0.9 (strong evidence)
// G = 0.25 * (1 - 0.9*0.9) = 0.25 * 0.19 = 0.0475
assertTrue(gs1.dynamicGuess < 0.06, `Hard+strong: G=${gs1.dynamicGuess.toFixed(4)} (<0.06)`);
// S = 0.10 * (1 - 0.9*0.1) = 0.10 * 0.91 = 0.091 (slip is forgivable on hard)
assertTrue(gs1.dynamicSlip > 0.08, `Hard+strong: S=${gs1.dynamicSlip.toFixed(4)} (>0.08)`);

// High weight, easy question: G should be near base (could still be guess), S very low
const gs2 = computeDynamicGS(0.9, 0.9);  // E=0.9 (easy), w=0.9
// G = 0.25 * (1 - 0.9*0.1) = 0.25 * 0.91 = 0.2275
assertTrue(gs2.dynamicGuess > 0.20, `Easy+strong: G=${gs2.dynamicGuess.toFixed(4)} (>0.20)`);
// S = 0.10 * (1 - 0.9*0.9) = 0.10 * 0.19 = 0.019 (incorrect on easy = devastating)
assertTrue(gs2.dynamicSlip < 0.03, `Easy+strong: S=${gs2.dynamicSlip.toFixed(4)} (<0.03)`);

// Low weight (fallback to baseline — no behavioral/trust modulation)
const gs3 = computeDynamicGS(0.5, 0.0);  // E=0.5, w=0 (no behavioral evidence)
// G = 0.25 * (1 - 0) = 0.25, S = 0.10 * (1 - 0) = 0.10
assertClose(gs3.dynamicGuess, BASE_GUESS, 'No evidence → G=G_base', 0.001);
assertClose(gs3.dynamicSlip, BASE_SLIP, 'No evidence → S=S_base', 0.001);

// ═══════════════════════════════════════════════════════════════════════════════
// Test 6: TRACE-KT Posterior Update
// ═══════════════════════════════════════════════════════════════════════════════

section('6. TRACE-KT Posterior Update');

const PRIOR = 0.30;

// Scenario A: Hard question, correct, strong CES+trust → big mastery boost
const scA = traceKTPosterior(PRIOR, true, 0.1, 0.85);
assertTrue(scA.newMastery > 0.70, `Hard correct, strong evidence → M=${scA.newMastery.toFixed(3)} (>0.70)`);

// Scenario B: Easy question, correct, moderate CES+trust → moderate boost
const scB = traceKTPosterior(PRIOR, true, 0.9, 0.5);
assertTrue(scB.newMastery > 0.3 && scB.newMastery < 0.8, `Easy correct, moderate evidence → M=${scB.newMastery.toFixed(3)}`);

// Scenario C: Easy question, incorrect, strong CES+trust → severe penalty
const scC = traceKTPosterior(0.5, false, 0.9, 0.85);
assertTrue(scC.newMastery < 0.25, `Easy incorrect, strong evidence → M=${scC.newMastery.toFixed(3)} (<0.25)`);

// Scenario D: Hard question, incorrect, weak CES → forgivable (S stays high)
const scD = traceKTPosterior(0.5, false, 0.1, 0.2);
assertTrue(scD.newMastery > 0.15, `Hard incorrect, weak evidence → M=${scD.newMastery.toFixed(3)} (>0.15, more forgivable than easy)`);

// Key property: Hard correct provides stronger boost than easy correct
// (because G is lower for hard questions with strong evidence)
assertTrue(scA.newMastery > scB.newMastery, `Hard correct > Easy correct: ${scA.newMastery.toFixed(3)} > ${scB.newMastery.toFixed(3)}`);

// ═══════════════════════════════════════════════════════════════════════════════
// Test 7: Comparison — TRACE-KT vs Elo-BKT (Current System)
// ═══════════════════════════════════════════════════════════════════════════════

section('7. TRACE-KT vs Elo-BKT Comparison');

// With corrected G/S: w=0 → G=G_base, S=S_base (flat baseline, no difficulty modulation)
// Higher w → G shrinks for hard questions → correct answer is MORE informative
const baseline_hardCorrect = traceKTPosterior(PRIOR, true, 0.1, 0.0);      // w=0 → baseline
const traceKT_hardCorrect_strong = traceKTPosterior(PRIOR, true, 0.1, 0.85);  // w=0.85 → strong
const traceKT_hardCorrect_weak = traceKTPosterior(PRIOR, true, 0.1, 0.15);    // w=0.15 → weak

console.log(`  📊 Hard correct (prior=0.30):`);
console.log(`     Baseline (w=0.0): M=${baseline_hardCorrect.newMastery.toFixed(3)} (G=${baseline_hardCorrect.dynamicGuess.toFixed(4)})`);
console.log(`     TRACE-KT strong:  M=${traceKT_hardCorrect_strong.newMastery.toFixed(3)} (G=${traceKT_hardCorrect_strong.dynamicGuess.toFixed(4)})`);
console.log(`     TRACE-KT weak:    M=${traceKT_hardCorrect_weak.newMastery.toFixed(3)} (G=${traceKT_hardCorrect_weak.dynamicGuess.toFixed(4)})`);

// Strong evidence on hard question → G is lower → correct is more informative → higher mastery
assertTrue(traceKT_hardCorrect_strong.newMastery > baseline_hardCorrect.newMastery,
  `Strong CES on hard question boosts mastery beyond baseline`);

// Stronger evidence → lower G → higher mastery boost
assertTrue(traceKT_hardCorrect_strong.newMastery > traceKT_hardCorrect_weak.newMastery,
  `Strong CES produces larger update than weak CES`);

// ═══════════════════════════════════════════════════════════════════════════════
// Test 8: Uncertainty Quantification (Contribution C3)
// ═══════════════════════════════════════════════════════════════════════════════

section('8. Uncertainty Quantification (C3)');

// Uninformative prior: high uncertainty
const u0 = computeUncertainty(1, 1);
assertTrue(u0 > 0.4, `Uninformative prior: U=${u0.toFixed(3)} (>0.4, high uncertainty)`);

// After 5 correct (high weight): uncertainty decreases
let alpha = 1, beta = 1;
for (let i = 0; i < 5; i++) {
  const result = updateBetaTracker(alpha, beta, true, 0.8);
  alpha = result.alpha;
  beta = result.beta;
}
const u5 = computeUncertainty(alpha, beta);
assertTrue(u5 < u0, `After 5 correct: U=${u5.toFixed(3)} < initial ${u0.toFixed(3)}`);
assertTrue(u5 < 0.35, `After 5 correct: U=${u5.toFixed(3)} (<0.35, decreased)`);

// After 10 mixed (5 correct, 5 incorrect): uncertainty should still decrease from prior
// (more data = less uncertainty even if mixed)
let alpha2 = 1, beta2 = 1;
for (let i = 0; i < 5; i++) {
  const r1 = updateBetaTracker(alpha2, beta2, true, 0.7);
  alpha2 = r1.alpha; beta2 = r1.beta;
  const r2 = updateBetaTracker(alpha2, beta2, false, 0.7);
  alpha2 = r2.alpha; beta2 = r2.beta;
}
const uMixed = computeUncertainty(alpha2, beta2);
assertTrue(uMixed < u0, `Mixed results: U=${uMixed.toFixed(3)} < initial ${u0.toFixed(3)} (more data)`);

// Low-weight evidence should reduce uncertainty slowly
let alpha3 = 1, beta3 = 1;
for (let i = 0; i < 5; i++) {
  const result = updateBetaTracker(alpha3, beta3, true, 0.1); // very low weight
  alpha3 = result.alpha;
  beta3 = result.beta;
}
const uLowWeight = computeUncertainty(alpha3, beta3);
assertTrue(uLowWeight > u5, `Low-weight evidence: U=${uLowWeight.toFixed(3)} > high-weight ${u5.toFixed(3)}`);

// ═══════════════════════════════════════════════════════════════════════════════
// Test 9: Trust Score Components (Contribution C2)
// ═══════════════════════════════════════════════════════════════════════════════

section('9. Trust Score Components (C2)');

// Concept consistency: good match
const cc1 = computeConceptConsistency(
  'TCP/IP Protocol',
  'Which layer of the TCP/IP protocol stack handles routing?',
  ['Network', 'Transport', 'Application', 'Data Link']
);
assertTrue(cc1 > 0.3, `Good concept match: ${cc1.toFixed(3)} (>0.3)`);

// Concept consistency: poor match
const cc2 = computeConceptConsistency(
  'Machine Learning',
  'What is the capital of France?',
  ['Paris', 'London', 'Berlin', 'Madrid']
);
assertTrue(cc2 < 0.2, `Poor concept match: ${cc2.toFixed(3)} (<0.2)`);

// Relevance: good match to objectives
const rel1 = computeRelevance(
  'Explain the difference between TCP and UDP protocols',
  ['Understand TCP/IP protocol stack', 'Compare TCP and UDP', 'Explain network routing']
);
assertTrue(rel1 > 0.2, `Good relevance: ${rel1.toFixed(3)} (>0.2)`);

// Difficulty calibration: well-calibrated question
const dc1 = computeDifficultyCalibration(0.65, 0.60, 20);
assertTrue(dc1 > 0.9, `Well-calibrated: ${dc1.toFixed(3)} (>0.9)`);

// Difficulty calibration: poorly calibrated
const dc2 = computeDifficultyCalibration(0.90, 0.30, 20);
assertTrue(dc2 < 0.5, `Poorly calibrated: ${dc2.toFixed(3)} (<0.5)`);

// Difficulty calibration: insufficient data → default 0.5
const dc3 = computeDifficultyCalibration(0.5, 0.5, 3);
assertClose(dc3, 0.5, 'Insufficient data → T_d=0.5');

// Format quality: good question
const fq1 = computeFormatQuality(
  'Which of the following best describes the purpose of the OSI model?',
  ['Standardized networking framework', 'Programming language', 'Database management system', 'Operating system'],
  'The OSI model provides a standard framework for networking protocols.'
);
assertTrue(fq1 > 0.8, `Good format quality: ${fq1.toFixed(3)} (>0.8)`);

// Format quality: duplicate options → penalty
const fq2 = computeFormatQuality(
  'What is X?',
  ['Answer A', 'Answer A', 'Answer B', 'Answer C'],
  'X is A.'
);
assertTrue(fq2 < fq1, `Duplicate options penalized: ${fq2.toFixed(3)} < ${fq1.toFixed(3)}`);

// ═══════════════════════════════════════════════════════════════════════════════
// Test 10: Full TRACE-KT Scenario (Paper Worked Example)
// ═══════════════════════════════════════════════════════════════════════════════

section('10. Full TRACE-KT Scenario (Paper Worked Example)');

console.log('\n  📝 Scenario: Learner (R=1200) answers a hard question (Q=1400) correctly');
console.log('     Response time: 12s, No hints, Confidence: 0.75, First attempt');
console.log('     Question trust: 0.82\n');

// Step 1: Elo expected
const E = eloExpected(1200, 1400);
console.log(`  Step 1 — Elo Expected: E = ${E.toFixed(4)}`);

// Step 2: CES
const { ces, factors } = computeCES({
  responseTimeSec: 12, hintCount: 0, confidence: 0.75, correct: true,
  attemptNumber: 1, learnerRating: 1200, questionElo: 1400,
});
console.log(`  Step 2 — CES Factors:`);
console.log(`    f_τ (time)       = ${factors.fTau.toFixed(4)}`);
console.log(`    f_h (hints)      = ${factors.fHint.toFixed(4)}`);
console.log(`    f_κ (confidence) = ${factors.fConf.toFixed(4)}`);
console.log(`    f_n (attempt)    = ${factors.fAttempt.toFixed(4)}`);
console.log(`    CES              = ${ces.toFixed(4)}`);

// Step 3: Trust-gated weight
const trust = 0.82;
const w = ces * trust;
console.log(`  Step 3 — Trust-gated weight: w = CES × T = ${ces.toFixed(4)} × ${trust} = ${w.toFixed(4)}`);

// Step 4: Dynamic G/S
const { dynamicGuess, dynamicSlip } = computeDynamicGS(E, w);
console.log(`  Step 4 — Dynamic G/S:`);
console.log(`    G = ${dynamicGuess.toFixed(4)} (base=${BASE_GUESS})`);
console.log(`    S = ${dynamicSlip.toFixed(4)} (base=${BASE_SLIP})`);

// Step 5: Posterior
const { posterior, newMastery } = traceKTPosterior(0.30, true, E, w);
console.log(`  Step 5 — Bayesian Update:`);
console.log(`    Prior     = 0.3000`);
console.log(`    Posterior = ${posterior.toFixed(4)}`);
console.log(`    + Transit = ${newMastery.toFixed(4)}`);

// Step 6: Uncertainty
const betaResult = updateBetaTracker(1.0, 1.0, true, w);
const uncertainty = computeUncertainty(betaResult.alpha, betaResult.beta);
console.log(`  Step 6 — Uncertainty:`);
console.log(`    Beta(${betaResult.alpha.toFixed(2)}, ${betaResult.beta.toFixed(2)})`);
console.log(`    U = ${uncertainty.toFixed(4)}`);

console.log(`\n  ✨ Output: Mastery = ${newMastery.toFixed(3)}, Uncertainty = ${uncertainty.toFixed(3)}`);

// Verify sensible results
assertTrue(newMastery > 0.7, `Hard correct with strong evidence → M > 0.7`);
assertTrue(uncertainty < u0, `Single interaction → uncertainty decreased from prior`);

// ═══════════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`\n${'═'.repeat(60)}`);
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log(`${'═'.repeat(60)}\n`);

process.exit(failed > 0 ? 1 : 0);
