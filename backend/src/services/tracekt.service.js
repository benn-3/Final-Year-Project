/**
 * TRACE-KT: Trust and Response-Aware Cognitive Evidence Knowledge Tracing
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * A unified algorithm that dynamically estimates concept mastery using:
 *   - Learner ability (Elo rating)
 *   - Item/question difficulty (Elo rating)
 *   - Correctness
 *   - Response time
 *   - Hint usage
 *   - Self-reported confidence (5-point Likert)
 *   - Question trust/reliability score
 *   - Prediction uncertainty (Beta distribution)
 *
 * Architecture:
 *   TRACE-KT Engine
 *   ├── Phase 1: Elo Updates (per question)          — learner ability + question difficulty
 *   ├── Phase 2: CES Computation (per question)      — Cognitive Evidence Strength
 *   ├── Phase 3: Trust-Gated Evidence Weight          — w = CES × trust
 *   ├── Phase 4: Bayesian Posterior Update (per concept) — dynamic G/S with CES+trust
 *   ├── Phase 5: Uncertainty Update (per concept)     — Beta distribution tracker
 *   └── Weak Concept Detection                        — mastery < WEAK_THRESHOLD
 *
 * Three Core Contributions:
 *   C1: Cognitive Evidence Strength (CES) — multi-signal behavioral evidence compression
 *   C2: Trust-Attenuated Mastery Updates  — AI-generated question trust gating
 *   C3: Closed-Form Uncertainty           — Beta-distribution mastery uncertainty
 *
 * Computational Complexity: O(n + k) per attempt
 *   n = questions per assessment, k = distinct concepts (k ≤ n)
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ═══════════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════════

// ── Elo Parameters ──
const K_LEARNER  = 24;   // Learner K-factor (responsive)
const K_QUESTION = 8;    // Question K-factor (stable across many learners)

// ── BKT Base Parameters ──
const BASE_GUESS   = 0.25;  // 1-in-4 MCQ random chance
const BASE_SLIP    = 0.10;  // Literature standard
const P_TRANSIT    = 0.10;  // Learning transition probability

// ── CES Parameters (Contribution C1) ──
const TAU_BASE     = 30;    // Expected median response time in seconds
const BETA_TAU     = 0.5;   // Difficulty scaling for response time model
const GAMMA_TAU    = 1.0;   // Logistic sensitivity for response time factor
const ALPHA_HINT   = 1.0;   // Hint decay rate (each hint halves evidence)
const LAMBDA_CONF  = 0.5;   // Confidence miscalibration penalty weight
const ALPHA_ATTEMPT = 0.3;  // Attempt repetition decay rate
const EPS          = 0.1;   // Numerical stability for log(0)

// ── Mastery Thresholds ──
const WEAK_THRESHOLD    = 0.60;  // p_mastery below this → weak concept
const MASTERY_THRESHOLD = 0.85;  // p_mastery above this → mastered concept

// ── Defaults ──
const DEFAULT_RATING    = 1200;  // Starting Elo rating
const DEFAULT_MASTERY   = 0.30;  // Starting BKT prior
const DEFAULT_UNCERTAINTY = 0.50; // Starting uncertainty
const DEFAULT_BETA_ALPHA = 1.0;  // Uninformative Beta prior
const DEFAULT_BETA_BETA  = 1.0;

// ── G/S Clamping (ensures valid probabilities) ──
const G_MIN = 0.01;
const G_MAX = 0.49;
const S_MIN = 0.01;
const S_MAX = 0.49;

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 1: Elo Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Elo expected correctness: σ((A - D) / 400)
 * @param {number} learnerRating  — current learner ability estimate
 * @param {number} questionElo   — current question difficulty estimate
 * @returns {number} expected ∈ (0, 1)
 */
function eloExpected(learnerRating, questionElo) {
  return 1 / (1 + Math.pow(10, (questionElo - learnerRating) / 400));
}

/**
 * Update learner rating after one question.
 * @param {number} rating   — current learner rating
 * @param {number} expected — Elo expected correctness
 * @param {boolean} correct — actual outcome
 * @returns {number} updated rating
 */
function updateLearnerRating(rating, expected, correct) {
  return rating + K_LEARNER * ((correct ? 1 : 0) - expected);
}

/**
 * Update question Elo after one attempt.
 * Question gains rating when learner gets it wrong (harder than expected).
 * @param {number} questionElo
 * @param {number} expected
 * @param {boolean} correct
 * @returns {number} updated question Elo
 */
function updateQuestionElo(questionElo, expected, correct) {
  return questionElo + K_QUESTION * (expected - (correct ? 1 : 0));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 2: Cognitive Evidence Strength (CES) — Contribution C1
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Logistic sigmoid function.
 * @param {number} x
 * @returns {number} σ(x) ∈ (0, 1)
 */
function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Response time factor f_τ.
 *
 * Uses a log-normal reference model: expected log-response-time scales with difficulty.
 * Fast correct answers → high f_τ → strong evidence.
 * Slow correct answers → low f_τ → weaker evidence (possible deliberation/guessing).
 *
 * f_τ = σ((μ_τ - log(τ + ε)) / γ_τ)
 * where μ_τ = log(τ_base) + β_τ · (D - A) / 400
 *
 * @param {number} responseTimeSec — response time in seconds
 * @param {number} learnerRating   — learner ability
 * @param {number} questionElo     — question difficulty
 * @returns {number} f_τ ∈ (0, 1)
 */
function responseTimeFactor(responseTimeSec, learnerRating, questionElo) {
  const muTau = Math.log(TAU_BASE) + BETA_TAU * (questionElo - learnerRating) / 400;
  const logResponseTime = Math.log(responseTimeSec + EPS);
  return sigmoid((muTau - logResponseTime) / GAMMA_TAU);
}

/**
 * Hint factor f_h.
 *
 * f_h = 1 / (1 + α_h · h)
 * Zero hints → f_h = 1; each hint geometrically reduces evidence strength.
 *
 * @param {number} hintCount — number of hints used (distractors eliminated)
 * @returns {number} f_h ∈ (0, 1]
 */
function hintFactor(hintCount) {
  return 1 / (1 + ALPHA_HINT * hintCount);
}

/**
 * Confidence calibration factor f_κ.
 *
 * f_κ = 1 - λ_κ · |κ - c|
 * Aligned confidence (high + correct, low + incorrect) → high f_κ.
 * Miscalibrated confidence → reduced evidence strength.
 *
 * @param {number} confidence — self-reported confidence ∈ [0, 1] (from 5-point Likert)
 * @param {boolean} correct   — actual outcome
 * @returns {number} f_κ ∈ [1 - λ_κ, 1]
 */
function confidenceFactor(confidence, correct) {
  return 1 - LAMBDA_CONF * Math.abs(confidence - (correct ? 1 : 0));
}

/**
 * Attempt decay factor f_n.
 *
 * f_n = 1 / (1 + α_n · max(0, n - 1))
 * First attempt has full weight; repeated attempts have diminishing returns.
 * Prevents gaming via repetition.
 *
 * @param {number} attemptNumber — which attempt this is for this concept (1-indexed)
 * @returns {number} f_n ∈ (0, 1]
 */
function attemptDecayFactor(attemptNumber) {
  return 1 / (1 + ALPHA_ATTEMPT * Math.max(0, attemptNumber - 1));
}

/**
 * Compute Cognitive Evidence Strength (CES).
 *
 * CES = f_τ · f_h · f_κ · f_n
 *
 * Multiplicative form ensures any single weak signal (e.g., heavy hint usage)
 * substantially reduces evidence strength regardless of other signals.
 *
 * @param {object} params
 * @param {number} params.responseTimeSec — response time in seconds
 * @param {number} params.hintCount       — hints used
 * @param {number} params.confidence      — self-reported confidence ∈ [0, 1]
 * @param {boolean} params.correct        — actual outcome
 * @param {number} params.attemptNumber   — attempt count for this concept
 * @param {number} params.learnerRating   — learner Elo
 * @param {number} params.questionElo     — question Elo
 * @returns {{ ces: number, factors: { fTau: number, fHint: number, fConf: number, fAttempt: number }}}
 */
function computeCES({
  responseTimeSec,
  hintCount,
  confidence,
  correct,
  attemptNumber,
  learnerRating,
  questionElo,
}) {
  const fTau     = responseTimeFactor(responseTimeSec, learnerRating, questionElo);
  const fHint    = hintFactor(hintCount);
  const fConf    = confidenceFactor(confidence, correct);
  const fAttempt = attemptDecayFactor(attemptNumber);

  const ces = fTau * fHint * fConf * fAttempt;

  return {
    ces,
    factors: { fTau, fHint, fConf, fAttempt },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 4: TRACE-KT Mastery Update (Dynamic G/S + Bayesian Posterior)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute dynamic Guess and Slip parameters using TRACE-KT formulation.
 *
 * G_t = G_base · (1 - w · (1 - E))
 * S_t = S_base · (1 - w · E)
 *
 * Derivation rationale:
 *   G represents the probability of guessing correctly without mastery.
 *   When evidence is strong (high w) and the question is hard (low E),
 *   a correct answer is very unlikely to be a guess, so G should be LOW.
 *   G = G_base · (1 - w·(1-E)):
 *     - w=0 (no evidence):     G = G_base            (baseline, no behavioral info)
 *     - w=1, E=0 (hard+strong): G = G_base · 0 = 0   (correct = definitive mastery evidence)
 *     - w=1, E=1 (easy+strong): G = G_base            (correct on easy → could still be guess)
 *
 *   S represents the probability of slipping (wrong despite mastery).
 *   When evidence is strong (high w) and the question is easy (high E),
 *   an incorrect answer is very unlikely to be a slip, so S should be LOW.
 *   S = S_base · (1 - w·E):
 *     - w=0 (no evidence):      S = S_base            (baseline)
 *     - w=1, E=1 (easy+strong):  S = S_base · 0 = 0   (incorrect = definitive non-mastery)
 *     - w=1, E=0 (hard+strong):  S = S_base            (incorrect on hard → forgivable slip)
 *
 * @param {number} expected — Elo expected correctness E ∈ (0, 1)
 * @param {number} weight   — effective evidence weight w = CES × trust ∈ [0, 1]
 * @returns {{ dynamicGuess: number, dynamicSlip: number }}
 */
function computeDynamicGS(expected, weight) {
  let dynamicGuess = BASE_GUESS * (1 - weight * (1 - expected));
  let dynamicSlip  = BASE_SLIP  * (1 - weight * expected);


  // Clamp to valid probability range
  dynamicGuess = Math.min(Math.max(dynamicGuess, G_MIN), G_MAX);
  dynamicSlip  = Math.min(Math.max(dynamicSlip, S_MIN), S_MAX);

  return { dynamicGuess, dynamicSlip };
}

/**
 * TRACE-KT Bayesian posterior update with dynamic G/S.
 *
 * On correct:  M+ = [M·(1-S)] / [M·(1-S) + (1-M)·G]
 * On incorrect: M+ = [M·S]   / [M·S + (1-M)·(1-G)]
 *
 * Then learning transition: M_new = M+ + (1 - M+) · P_T
 *
 * @param {number} prior    — current mastery probability P(M) ∈ [0, 1]
 * @param {boolean} correct — observed outcome
 * @param {number} expected — Elo expected correctness
 * @param {number} weight   — effective evidence weight (CES × trust)
 * @returns {{ posterior: number, newMastery: number, dynamicGuess: number, dynamicSlip: number }}
 */
function traceKTPosterior(prior, correct, expected, weight) {
  const { dynamicGuess, dynamicSlip } = computeDynamicGS(expected, weight);

  let posterior;
  if (correct) {
    const numerator   = prior * (1 - dynamicSlip);
    const denominator = numerator + (1 - prior) * dynamicGuess;
    posterior = denominator > 0 ? numerator / denominator : prior;
  } else {
    const numerator   = prior * dynamicSlip;
    const denominator = numerator + (1 - prior) * (1 - dynamicGuess);
    posterior = denominator > 0 ? numerator / denominator : prior;
  }

  // Learning transition: even after a wrong answer, engaging with the question
  // provides a chance to learn.
  const newMastery = posterior + (1 - posterior) * P_TRANSIT;

  return { posterior, newMastery, dynamicGuess, dynamicSlip };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Phase 5: Uncertainty Quantification — Contribution C3
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Update Beta distribution tracker for uncertainty quantification.
 *
 * On correct: α += w
 * On incorrect: β += w
 *
 * Where w is the effective evidence weight (CES × trust).
 * Higher-quality evidence contributes more to narrowing the distribution.
 *
 * @param {number} alpha   — current Beta α parameter
 * @param {number} beta    — current Beta β parameter
 * @param {boolean} correct — observed outcome
 * @param {number} weight  — effective evidence weight
 * @returns {{ alpha: number, beta: number }}
 */
function updateBetaTracker(alpha, beta, correct, weight) {
  if (correct) {
    return { alpha: alpha + weight, beta };
  } else {
    return { alpha, beta: beta + weight };
  }
}

/**
 * Compute normalized uncertainty from Beta distribution parameters.
 *
 * U = 2 · √(Var[Beta(α, β)])
 *   = 2 · √(αβ / ((α+β)² · (α+β+1)))
 *
 * Normalization factor of 2 maps the maximum std (at α=β=1) to approximately 0.5,
 * yielding U ∈ [0, ~0.58] in practice.
 *
 * @param {number} alpha — Beta α parameter
 * @param {number} beta  — Beta β parameter
 * @returns {number} uncertainty ∈ [0, 1]
 */
function computeUncertainty(alpha, beta) {
  const sum = alpha + beta;
  const variance = (alpha * beta) / (sum * sum * (sum + 1));
  const uncertainty = 2 * Math.sqrt(variance);
  return Math.min(uncertainty, 1.0); // clamp to [0, 1]
}

// ═══════════════════════════════════════════════════════════════════════════════
// Core Engine: TRACE-KT Update Pipeline
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run the full TRACE-KT mastery update pipeline for a complete attempt.
 *
 * Called after every graded Attempt. Executes in a single Prisma transaction:
 *   1. Upsert LearnerRating (default 1200)
 *   2. Per question: Elo update + CES computation + interaction logging
 *   3. Per concept: Trust-gated BKT posterior + Beta uncertainty update
 *
 * @param {string} userId
 * @param {Array} gradedAnswers — from assessment.service submitAttempt:
 *   [{ questionId, isCorrect, conceptTag, submittedIndex, correctIndex, explanation,
 *      responseTimeMs, hintCount, confidence }]
 * @param {Array} questions — full question rows from DB (need eloRating, trustScore)
 * @returns {Promise<{
 *   newRating: number,
 *   updatedConcepts: Array<{ tag: string, mastery: number, uncertainty: number }>
 * }>}
 */
async function runTraceKTEngine(userId, gradedAnswers, questions) {
  // Build a map from questionId → full question for O(1) lookup
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  // Get concept attempt counts for this user (for attempt decay factor)
  const existingMasteries = await prisma.conceptMastery.findMany({
    where: { userId },
    select: { conceptTag: true },
  });
  const existingConcepts = new Set(existingMasteries.map((m) => m.conceptTag));

  // Count existing interactions per concept for attempt numbering
  const interactionCounts = await prisma.interactionLog.groupBy({
    by: ['conceptTag'],
    where: { userId },
    _count: { id: true },
  });
  const conceptInteractionCount = new Map(
    interactionCounts.map((ic) => [ic.conceptTag, ic._count.id])
  );

  return prisma.$transaction(async (tx) => {
    // ── Phase 1: Get or create learner rating ──
    const learnerRecord = await tx.learnerRating.upsert({
      where:  { userId },
      create: { userId, rating: DEFAULT_RATING },
      update: {},
    });
    let currentRating = learnerRecord.rating;

    // ── Phases 1-3: Per-question processing ──
    // Accumulate per-concept evidence for Phase 4
    // conceptEvidence: Map<tag, { sumExpected, sumWeight, correctCount, totalCount, items[] }>
    const conceptEvidence = new Map();

    for (const ga of gradedAnswers) {
      const q = questionMap.get(ga.questionId);
      if (!q) continue;

      const correct = ga.isCorrect;
      const tag = ga.conceptTag || q.conceptTag;

      // ── Phase 1: Elo Update ──
      const expected = eloExpected(currentRating, q.eloRating);
      currentRating = updateLearnerRating(currentRating, expected, correct);
      const newQElo = updateQuestionElo(q.eloRating, expected, correct);

      // Update question Elo + empirical stats
      const newResponseCount = (q.responseCount || 0) + 1;
      const oldCorrectRate = q.empiricalCorrectRate ?? 0.5;
      const newCorrectRate = oldCorrectRate + ((correct ? 1 : 0) - oldCorrectRate) / newResponseCount;

      await tx.question.update({
        where: { id: q.id },
        data: {
          eloRating: newQElo,
          responseCount: newResponseCount,
          empiricalCorrectRate: newCorrectRate,
        },
      });

      // ── Phase 2: CES Computation ──
      const responseTimeSec = (ga.responseTimeMs || 30000) / 1000; // default 30s if not provided
      const hintCount = ga.hintCount || 0;
      const confidence = ga.confidence ?? 0.5; // default moderate confidence

      // Determine attempt number for this concept
      const priorInteractions = conceptInteractionCount.get(tag) || 0;
      // Count how many questions in this attempt have already been processed for this concept
      const currentBatchCount = conceptEvidence.has(tag) ? conceptEvidence.get(tag).totalCount : 0;
      const attemptNumber = priorInteractions + currentBatchCount + 1;

      const { ces, factors } = computeCES({
        responseTimeSec,
        hintCount,
        confidence,
        correct,
        attemptNumber,
        learnerRating: currentRating,
        questionElo: q.eloRating,
      });

      // ── Phase 3: Trust-Gated Evidence Weight ──
      const trustScore = q.trustScore ?? 0.5;
      const effectiveWeight = ces * trustScore;

      // Log interaction
      await tx.interactionLog.create({
        data: {
          userId,
          questionId: q.id,
          conceptTag: tag,
          correct,
          responseTimeMs: ga.responseTimeMs || 30000,
          hintCount,
          confidence,
          attemptNumber,
          cesScore: ces,
          effectiveWeight,
        },
      });

      // Accumulate concept evidence
      if (!conceptEvidence.has(tag)) {
        conceptEvidence.set(tag, {
          sumExpected: 0,
          sumWeight: 0,
          correctCount: 0,
          totalCount: 0,
        });
      }
      const ev = conceptEvidence.get(tag);
      ev.sumExpected  += expected;
      ev.sumWeight    += effectiveWeight;
      ev.correctCount += correct ? 1 : 0;
      ev.totalCount   += 1;
    }

    // Persist updated learner rating
    await tx.learnerRating.update({
      where: { userId },
      data:  { rating: currentRating },
    });

    // ── Phase 4 & 5: Per-concept TRACE-KT update ──
    const updatedConcepts = [];

    for (const [tag, ev] of conceptEvidence.entries()) {
      const avgExpected = ev.sumExpected / ev.totalCount;
      const avgWeight   = ev.sumWeight / ev.totalCount;
      const majorityCorrect = ev.correctCount > ev.totalCount / 2;

      // Get current mastery prior + Beta tracker (upsert at default if first encounter)
      const masteryRecord = await tx.conceptMastery.upsert({
        where:  { userId_conceptTag: { userId, conceptTag: tag } },
        create: {
          userId,
          conceptTag: tag,
          pMastery: DEFAULT_MASTERY,
          uncertainty: DEFAULT_UNCERTAINTY,
          betaAlpha: DEFAULT_BETA_ALPHA,
          betaBeta: DEFAULT_BETA_BETA,
        },
        update: {},
      });

      // ── Phase 4: Bayesian Posterior with Dynamic G/S ──
      const { newMastery, dynamicGuess, dynamicSlip } = traceKTPosterior(
        masteryRecord.pMastery,
        majorityCorrect,
        avgExpected,
        avgWeight
      );

      // ── Phase 5: Uncertainty Update ──
      const { alpha: newAlpha, beta: newBeta } = updateBetaTracker(
        masteryRecord.betaAlpha,
        masteryRecord.betaBeta,
        majorityCorrect,
        avgWeight
      );
      const newUncertainty = computeUncertainty(newAlpha, newBeta);

      // Persist
      const clampedMastery = Math.min(Math.max(newMastery, 0), 1);
      await tx.conceptMastery.update({
        where: { userId_conceptTag: { userId, conceptTag: tag } },
        data: {
          pMastery: clampedMastery,
          uncertainty: newUncertainty,
          betaAlpha: newAlpha,
          betaBeta: newBeta,
        },
      });

      updatedConcepts.push({
        tag,
        mastery: clampedMastery,
        uncertainty: newUncertainty,
        dynamicGuess,
        dynamicSlip,
      });
    }

    console.log(
      `[TRACE-KT] userId=${userId} | newRating=${currentRating.toFixed(1)} | ` +
      `concepts: ${updatedConcepts.map((c) => `${c.tag}(M=${c.mastery.toFixed(3)},U=${c.uncertainty.toFixed(3)})`).join(', ')}`
    );

    return { newRating: currentRating, updatedConcepts };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Query Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get learner's current Elo rating.
 * Returns DEFAULT_RATING (1200) for learners with no history — upserts on demand.
 * @param {string} userId
 * @returns {Promise<number>}
 */
async function getLearnerRating(userId) {
  const record = await prisma.learnerRating.upsert({
    where:  { userId },
    create: { userId, rating: DEFAULT_RATING },
    update: {},
  });
  return record.rating;
}

/**
 * Convert a continuous Elo rating to a 1-5 difficulty scale for NIM prompts.
 * Scale: 1200 baseline → difficulty 3 (medium).
 * Every ~200 rating points = 1 difficulty step.
 * @param {number} rating
 * @returns {number} integer 1-5
 */
function ratingToDifficulty(rating) {
  const diff = Math.round((rating - 800) / 200) + 1;
  return Math.min(Math.max(diff, 1), 5);
}

/**
 * Seed Elo rating for a question based on its discrete difficulty level.
 * @param {number} difficulty  1-5 integer from MCQ generation prompt
 * @returns {number}
 */
function difficultyToElo(difficulty) {
  return 800 + (difficulty - 1) * 200;
}

/**
 * Return concept tags where p_mastery < WEAK_THRESHOLD for a given user.
 * Used by the roadmap modification service to feed weak concepts into the diff prompt.
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
async function getWeakConcepts(userId) {
  const rows = await prisma.conceptMastery.findMany({
    where: { userId, pMastery: { lt: WEAK_THRESHOLD } },
    select: { conceptTag: true, pMastery: true },
    orderBy: { pMastery: 'asc' },
  });
  return rows.map((r) => r.conceptTag);
}

/**
 * Get full mastery + uncertainty data for all concepts of a user.
 * @param {string} userId
 * @returns {Promise<Array<{ conceptTag: string, pMastery: number, uncertainty: number }>>}
 */
async function getConceptMasteryWithUncertainty(userId) {
  return prisma.conceptMastery.findMany({
    where: { userId },
    select: {
      conceptTag: true,
      pMastery: true,
      uncertainty: true,
      betaAlpha: true,
      betaBeta: true,
    },
    orderBy: { pMastery: 'asc' },
  });
}

/**
 * Get weak concepts with uncertainty context — useful for prioritizing remediation.
 * A concept with low mastery AND high uncertainty is a priority target (insufficient data).
 * A concept with low mastery AND low uncertainty is a confirmed weakness.
 * @param {string} userId
 * @returns {Promise<Array<{ conceptTag: string, pMastery: number, uncertainty: number, status: string }>>}
 */
async function getWeakConceptsWithContext(userId) {
  const rows = await prisma.conceptMastery.findMany({
    where: { userId, pMastery: { lt: WEAK_THRESHOLD } },
    select: { conceptTag: true, pMastery: true, uncertainty: true },
    orderBy: { pMastery: 'asc' },
  });

  return rows.map((r) => ({
    ...r,
    status: r.uncertainty > 0.25 ? 'insufficient_data' : 'confirmed_weak',
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════════════

module.exports = {
  // Core engine
  runTraceKTEngine,

  // Query helpers
  getLearnerRating,
  ratingToDifficulty,
  difficultyToElo,
  getWeakConcepts,
  getConceptMasteryWithUncertainty,
  getWeakConceptsWithContext,

  // Pure functions (exported for unit testing and paper verification)
  eloExpected,
  updateLearnerRating,
  updateQuestionElo,
  computeCES,
  responseTimeFactor,
  hintFactor,
  confidenceFactor,
  attemptDecayFactor,
  computeDynamicGS,
  traceKTPosterior,
  updateBetaTracker,
  computeUncertainty,

  // Constants (exported for tests and documentation)
  WEAK_THRESHOLD,
  MASTERY_THRESHOLD,
  DEFAULT_RATING,
  DEFAULT_MASTERY,
  K_LEARNER,
  K_QUESTION,
  BASE_GUESS,
  BASE_SLIP,
  P_TRANSIT,
  TAU_BASE,
  BETA_TAU,
  GAMMA_TAU,
  ALPHA_HINT,
  LAMBDA_CONF,
  ALPHA_ATTEMPT,
};
