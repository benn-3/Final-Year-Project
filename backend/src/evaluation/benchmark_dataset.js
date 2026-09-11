/**
 * Benchmark Dataset Generator for Knowledge Tracing Evaluation
 * ═══════════════════════════════════════════════════════════════════════════════
 * Generates reproducible synthetic interaction sequences modeling empirical
 * characteristics observed in ASSISTments, EdNet, and Junyi Academy datasets:
 * - Ability-difficulty interaction (Rasch/Elo logit probability)
 * - Response times following log-normal distribution conditioned on item difficulty
 * - Realistic hint usage patterns (higher probability on difficult questions)
 * - 5-point Likert confidence reports with calibration error distribution
 * - AI question generation quality variations (item trust score in [0.40, 0.98])
 * - True latent concept mastery progression with transition probabilities
 */

// Simple seeded LCG PRNG for reproducibility
class LCG {
  constructor(seed = 42) {
    this.state = seed;
  }
  next() {
    this.state = (this.state * 1664525 + 1013904223) % 4294967296;
    return this.state / 4294967296;
  }
  gaussian(mean = 0, std = 1) {
    // Box-Muller transform
    const u1 = Math.max(1e-7, this.next());
    const u2 = this.next();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z * std;
  }
  choice(array) {
    return array[Math.floor(this.next() * array.length)];
  }
}

/**
 * Generate a synthetic multi-learner, multi-concept dataset.
 * @param {object} config
 */
function generateBenchmarkDataset({
  numLearners = 80,
  numConcepts = 12,
  itemsPerConcept = 8,
  seed = 2026,
} = {}) {
  const rng = new LCG(seed);
  const concepts = Array.from({ length: numConcepts }, (_, i) => `concept_${i + 1}`);

  // Create item bank
  const items = [];
  let questionIdCounter = 1;
  for (const concept of concepts) {
    for (let i = 0; i < itemsPerConcept; i++) {
      // Elo difficulty centered at 1200 with spread [950, 1450]
      const eloRating = Math.round(rng.gaussian(1200, 120));
      // Trust score: Beta-like distribution between 0.45 and 0.98
      const trustScore = Math.min(0.98, Math.max(0.40, rng.gaussian(0.82, 0.12)));

      items.push({
        id: `q_${questionIdCounter++}`,
        conceptTag: concept,
        eloRating,
        trustScore,
      });
    }
  }

  // Generate learner interactions
  const dataset = [];

  for (let l = 1; l <= numLearners; l++) {
    const learnerId = `learner_${l}`;
    // True underlying ability
    const trueAbility = rng.gaussian(1200, 160);

    // True underlying mastery per concept (starts between 0.15 and 0.55)
    const latentMastery = new Map();
    for (const c of concepts) {
      latentMastery.set(c, Math.max(0.1, Math.min(0.6, rng.gaussian(0.30, 0.10))));
    }

    // Concept attempt counter
    const conceptAttempts = new Map();

    // Shuffle items for this learner
    const learnerItems = [...items].sort(() => rng.next() - 0.5);

    for (const item of learnerItems) {
      const concept = item.conceptTag;
      const currentLatentMastery = latentMastery.get(concept);
      const attemptNum = (conceptAttempts.get(concept) || 0) + 1;
      conceptAttempts.set(concept, attemptNum);

      // True probability of correct answer depends on:
      // 1. Latent mastery (BKT component)
      // 2. Ability vs Item difficulty (Elo component)
      const eloProb = 1 / (1 + Math.pow(10, (item.eloRating - trueAbility) / 400));
      // Blended generative probability: 60% mastery, 40% ability-difficulty logit
      let pTrue = 0.60 * currentLatentMastery + 0.40 * eloProb;
      pTrue = Math.max(0.05, Math.min(0.95, pTrue));

      // Realize correctness
      const correct = rng.next() < pTrue ? 1 : 0;

      // Realistic response time:
      // Median ~30s, scaled by (difficulty - ability), plus log-normal noise
      const diffDiff = (item.eloRating - trueAbility) / 400;
      const medianTime = Math.max(5, 30 * Math.exp(0.4 * diffDiff));
      const responseTimeMs = Math.round(
        Math.max(3000, medianTime * Math.exp(rng.gaussian(0, 0.45)) * 1000)
      );

      // Hint usage: higher if difficult or struggling
      let hintCount = 0;
      const hintProb = Math.max(0.05, 0.5 - 0.4 * pTrue);
      if (rng.next() < hintProb) {
        hintCount = rng.next() < 0.35 ? 2 : 1;
      }

      // Confidence report (5-point Likert: 0, 0.25, 0.5, 0.75, 1.0)
      // Correlated with pTrue with realistic human miscalibration
      const perceivedP = Math.max(0, Math.min(1, pTrue + rng.gaussian(0, 0.22)));
      const likertLevels = [0, 0.25, 0.5, 0.75, 1.0];
      // Find closest Likert
      let confidence = 0.5;
      let minDiff = 999;
      for (const lvl of likertLevels) {
        if (Math.abs(lvl - perceivedP) < minDiff) {
          minDiff = Math.abs(lvl - perceivedP);
          confidence = lvl;
        }
      }

      dataset.push({
        learnerId,
        questionId: item.id,
        conceptTag: concept,
        questionElo: item.eloRating,
        trustScore: Math.round(item.trustScore * 100) / 100,
        correct,
        responseTimeMs,
        hintCount,
        confidence,
        attemptNumber: attemptNum,
        trueAbility,
        pTrue,
      });

      // Update latent mastery (learning happens)
      if (correct === 1) {
        const updated = currentLatentMastery + (1 - currentLatentMastery) * 0.12;
        latentMastery.set(concept, Math.min(0.95, updated));
      } else {
        const updated = currentLatentMastery + (1 - currentLatentMastery) * 0.04;
        latentMastery.set(concept, Math.min(0.95, updated));
      }
    }
  }

  return {
    items,
    interactions: dataset,
    numLearners,
    numConcepts,
    totalInteractions: dataset.length,
  };
}

module.exports = {
  generateBenchmarkDataset,
};
