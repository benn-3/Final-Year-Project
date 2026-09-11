/**
 * Elo + Bayesian Knowledge Tracing (BKT) Mastery Engine
 *
 * Architecture:
 *   MasteryEngine
 *   ├── Elo          — per-learner rating + per-question difficulty (continuous)
 *   ├── BKT          — per-(learner, concept) posterior p_mastery
 *   ├── Elo-BKT Fusion — guess/slip derived from Elo expected, not fixed constants
 *   └── Weak Concept Detection — p_mastery < WEAK_THRESHOLD
 *
 * Elo update (runs per question per attempt):
 *   expected = 1 / (1 + 10^((q.elo_rating - learner.rating) / 400))
 *   learner.rating      += K_LEARNER  * (actual - expected)
 *   question.elo_rating +=  K_QUESTION * (expected - actual)
 *
 * BKT update (runs per concept_tag per attempt):
 *   Fusion point: P(G) and P(S) are derived from Elo's expected, not fixed —
 *   this is what makes a correct answer on a hard question stronger evidence
 *   of mastery than a correct answer on an easy question.
 *
 *   P(G) = BASE_GUESS * (1 - expected)   // harder question → higher guess weight
 *   P(S) = BASE_SLIP  * expected          // easier question → higher slip weight
 *
 *   posterior = correct
 *     ? (prior*(1-P_S)) / (prior*(1-P_S) + (1-prior)*P_G)
 *     : (prior*P_S)     / (prior*P_S     + (1-prior)*(1-P_G))
 *
 *   new_mastery = posterior + (1 - posterior) * P_TRANSIT   // P(T) = 0.1
 *
 * Both steps run in a single Prisma transaction after every graded Attempt.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ─── Constants ────────────────────────────────────────────────────────────────
const K_LEARNER   = 24;    // Elo K-factor for learner rating
const K_QUESTION  = 8;     // Elo K-factor for question difficulty (smaller — questions are more stable)
const BASE_GUESS  = 0.25;  // BKT base guess probability (1-in-4 for MCQ)
const BASE_SLIP   = 0.10;  // BKT base slip probability
const P_TRANSIT   = 0.10;  // BKT learning/transition probability per attempt
const WEAK_THRESHOLD  = 0.60; // p_mastery below this → weak concept
const DEFAULT_RATING  = 1200; // Starting Elo rating (Elo baseline)
const DEFAULT_MASTERY = 0.30; // Starting BKT prior

// ─── Elo helpers ──────────────────────────────────────────────────────────────

/**
 * Calculate Elo expected correctness for a learner vs question.
 * @param {number} learnerRating
 * @param {number} questionElo
 * @returns {number} expected ∈ (0, 1)
 */
function eloExpected(learnerRating, questionElo) {
  return 1 / (1 + Math.pow(10, (questionElo - learnerRating) / 400));
}

/**
 * New learner rating after one question.
 * @param {number} rating   current learner rating
 * @param {number} expected elo expected correctness
 * @param {boolean} correct actual outcome
 * @returns {number}
 */
function updateLearnerRating(rating, expected, correct) {
  return rating + K_LEARNER * ((correct ? 1 : 0) - expected);
}

/**
 * New question elo after one attempt.
 * @param {number} questionElo
 * @param {number} expected
 * @param {boolean} correct
 * @returns {number}
 */
function updateQuestionElo(questionElo, expected, correct) {
  // Question gains rating when learner gets it wrong (it was harder than expected)
  return questionElo + K_QUESTION * (expected - (correct ? 1 : 0));
}

// ─── BKT helpers ─────────────────────────────────────────────────────────────

/**
 * BKT posterior update using Elo-derived guess/slip (the fusion point).
 *
 * Fusion direction (correct per spec):
 *   - Hard question (low expected) → P(G) is LOW → correct answer is strong mastery evidence
 *   - Easy question (high expected) → P(G) is HIGH → correct answer is weaker mastery evidence
 *   - Easy question (high expected) → P(S) is LOW → incorrect is surprisingly negative evidence
 *   - Hard question (low expected) → P(S) is HIGH → incorrect is more forgivable
 *
 * Therefore:
 *   P(G) = BASE_GUESS * expected          // hard question → small guess prob → stronger evidence
 *   P(S) = BASE_SLIP  * (1 - expected)    // easy question → small slip prob → stronger negative evidence
 *
 * @param {number} prior    current p_mastery ∈ [0,1]
 * @param {boolean} correct outcome
 * @param {number} expected Elo expected correctness (used to modulate P_G / P_S)
 * @returns {number} new posterior ∈ [0,1]
 */
function bktPosterior(prior, correct, expected) {
  const pGuess = BASE_GUESS * expected;          // scales down for hard questions
  const pSlip  = BASE_SLIP  * (1 - expected);   // scales up for hard questions (more forgivable to slip)

  let posterior;
  if (correct) {
    const numerator   = prior * (1 - pSlip);
    const denominator = numerator + (1 - prior) * pGuess;
    posterior = denominator > 0 ? numerator / denominator : prior;
  } else {
    const numerator   = prior * pSlip;
    const denominator = numerator + (1 - prior) * (1 - pGuess);
    posterior = denominator > 0 ? numerator / denominator : prior;
  }

  // Apply learning/transition: even after a wrong answer, the learner
  // had a chance to learn from seeing the question.
  return posterior + (1 - posterior) * P_TRANSIT;
}

// ─── Core engine ──────────────────────────────────────────────────────────────

/**
 * Run Elo + BKT mastery update for a complete attempt.
 *
 * Called after every graded Attempt. Executes in a single Prisma transaction:
 *   1. Upsert LearnerRating (default 1200)
 *   2. Per question: compute expected, update learner & question Elo
 *   3. Per concept_tag: compute BKT posterior, upsert ConceptMastery
 *
 * @param {string}   userId
 * @param {Array}    gradedAnswers  — from assessment.service submitAttempt:
 *                   [{ questionId, isCorrect, conceptTag, submittedIndex, correctIndex, explanation }]
 * @param {Array}    questions      — full question rows from DB (need eloRating)
 * @returns {Promise<{ newRating: number, updatedConcepts: string[] }>}
 */
async function runMasteryEngine(userId, gradedAnswers, questions) {
  // Build a map from questionId → full question for O(1) lookup
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  return prisma.$transaction(async (tx) => {
    // ── 1. Get or create learner rating ──────────────────────────────────────
    const learnerRecord = await tx.learnerRating.upsert({
      where:  { userId },
      create: { userId, rating: DEFAULT_RATING },
      update: {}, // no-op — we update after computing new rating below
    });
    let currentRating = learnerRecord.rating;

    // ── 2. Elo update (per question) ─────────────────────────────────────────
    // Also accumulate per-concept evidence for BKT
    // conceptEvidence: Map<conceptTag, { totalExpected, correctCount, totalCount }>
    const conceptEvidence = new Map();

    for (const ga of gradedAnswers) {
      const q = questionMap.get(ga.questionId);
      if (!q) continue;

      const expected = eloExpected(currentRating, q.eloRating);
      const correct  = ga.isCorrect;

      // Update learner rating sequentially (each question sees the updated rating)
      currentRating = updateLearnerRating(currentRating, expected, correct);

      // Update question elo_rating in DB
      const newQElo = updateQuestionElo(q.eloRating, expected, correct);
      await tx.question.update({
        where: { id: q.id },
        data:  { eloRating: newQElo },
      });

      // Accumulate concept evidence (use last expected value per concept —
      // for concepts tested multiple times, average the expected values)
      const tag = ga.conceptTag || q.conceptTag;
      if (!conceptEvidence.has(tag)) {
        conceptEvidence.set(tag, { expectedSum: 0, correctCount: 0, totalCount: 0 });
      }
      const ev = conceptEvidence.get(tag);
      ev.expectedSum  += expected;
      ev.correctCount += correct ? 1 : 0;
      ev.totalCount   += 1;
    }

    // Persist updated learner rating
    await tx.learnerRating.update({
      where: { userId },
      data:  { rating: currentRating },
    });

    // ── 3. BKT update (per concept_tag) ─────────────────────────────────────
    const updatedConcepts = [];

    for (const [tag, ev] of conceptEvidence.entries()) {
      const avgExpected = ev.expectedSum / ev.totalCount;
      // Majority-vote: if more than half of questions on this concept were correct → correct evidence
      const majorityCorrect = ev.correctCount > ev.totalCount / 2;

      // Get current mastery prior (upsert at default if first encounter)
      const masteryRecord = await tx.conceptMastery.upsert({
        where:  { userId_conceptTag: { userId, conceptTag: tag } },
        create: { userId, conceptTag: tag, pMastery: DEFAULT_MASTERY },
        update: {},
      });

      const newMastery = bktPosterior(masteryRecord.pMastery, majorityCorrect, avgExpected);

      await tx.conceptMastery.update({
        where: { userId_conceptTag: { userId, conceptTag: tag } },
        data:  { pMastery: Math.min(Math.max(newMastery, 0), 1) }, // clamp [0,1]
      });

      updatedConcepts.push(tag);
    }

    console.log(
      `[mastery] userId=${userId} | newRating=${currentRating.toFixed(1)} | concepts updated: ${updatedConcepts.join(', ')}`
    );

    return { newRating: currentRating, updatedConcepts };
  });
}

// ─── Query helpers ────────────────────────────────────────────────────────────

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
  // rating 800 → 1, 1000 → 2, 1200 → 3, 1400 → 4, 1600+ → 5
  const diff = Math.round((rating - 800) / 200) + 1;
  return Math.min(Math.max(diff, 1), 5);
}

/**
 * Seed Elo rating for a question based on its discrete difficulty level.
 * @param {number} difficulty  1-5 integer from MCQ generation prompt
 * @returns {number}
 */
function difficultyToElo(difficulty) {
  // Mirrors ratingToDifficulty inverse
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

module.exports = {
  runMasteryEngine,
  getLearnerRating,
  ratingToDifficulty,
  difficultyToElo,
  getWeakConcepts,
  // Export constants for test/documentation purposes
  WEAK_THRESHOLD,
  DEFAULT_RATING,
};
