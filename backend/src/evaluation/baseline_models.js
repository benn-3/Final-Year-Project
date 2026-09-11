/**
 * TRACE-KT Baseline & Ablation Models
 * ═══════════════════════════════════════════════════════════════════════════════
 * Implements:
 * 1. Standard BKT (Corbett & Anderson, 1994)
 * 2. Elo-only Rating (Pelánek, 2016)
 * 3. Elo-BKT Hybrid (Prior work baseline)
 * 4. TRACE-KT (Proposed model with CES, Trust, Uncertainty)
 * 5. Full Ablation suite (A1-A6)
 */

const {
  eloExpected,
  computeCES,
  responseTimeFactor,
  hintFactor,
  confidenceFactor,
  attemptDecayFactor,
  computeDynamicGS,
  traceKTPosterior,
  updateBetaTracker,
  computeUncertainty,
  BASE_GUESS,
  BASE_SLIP,
  P_TRANSIT,
  K_LEARNER,
  K_QUESTION,
} = require('../services/tracekt.service');

// ─── 1. Standard BKT Model ───────────────────────────────────────────────────
class StandardBKTModel {
  constructor(options = {}) {
    this.name = 'Standard BKT';
    this.g = options.guess || BASE_GUESS;
    this.s = options.slip || BASE_SLIP;
    this.pTransit = options.pTransit || P_TRANSIT;
    this.defaultPrior = options.defaultPrior || 0.30;
    // Map: learnerId -> { conceptTag -> pMastery }
    this.mastery = new Map();
  }

  getMastery(learnerId, conceptTag) {
    const lMap = this.mastery.get(learnerId);
    if (!lMap || !lMap.has(conceptTag)) return this.defaultPrior;
    return lMap.get(conceptTag);
  }

  setMastery(learnerId, conceptTag, val) {
    if (!this.mastery.has(learnerId)) this.mastery.set(learnerId, new Map());
    this.mastery.get(learnerId).set(conceptTag, Math.max(0.001, Math.min(0.999, val)));
  }

  predict(interaction) {
    const prior = this.getMastery(interaction.learnerId, interaction.conceptTag);
    // P(Correct) = Prior * (1 - Slip) + (1 - Prior) * Guess
    const pCorrect = prior * (1 - this.s) + (1 - prior) * this.g;
    return Math.max(0.01, Math.min(0.99, pCorrect));
  }

  update(interaction) {
    const prior = this.getMastery(interaction.learnerId, interaction.conceptTag);
    let posterior;
    if (interaction.correct === 1) {
      posterior = (prior * (1 - this.s)) / (prior * (1 - this.s) + (1 - prior) * this.g);
    } else {
      posterior = (prior * this.s) / (prior * this.s + (1 - prior) * (1 - this.g));
    }
    const newMastery = posterior + (1 - posterior) * this.pTransit;
    this.setMastery(interaction.learnerId, interaction.conceptTag, newMastery);
  }
}

// ─── 2. Elo-Only Model ───────────────────────────────────────────────────────
class EloOnlyModel {
  constructor(options = {}) {
    this.name = 'Elo-Only';
    this.kLearner = options.kLearner || K_LEARNER;
    this.kQuestion = options.kQuestion || K_QUESTION;
    this.defaultRating = options.defaultRating || 1200;
    this.learnerRatings = new Map();
    this.questionRatings = new Map();
  }

  getLearnerRating(id) {
    return this.learnerRatings.get(id) || this.defaultRating;
  }

  getQuestionRating(id, seededElo = 1200) {
    if (!this.questionRatings.has(id)) {
      this.questionRatings.set(id, seededElo);
    }
    return this.questionRatings.get(id);
  }

  predict(interaction) {
    const rL = this.getLearnerRating(interaction.learnerId);
    const rQ = this.getQuestionRating(interaction.questionId, interaction.questionElo);
    return eloExpected(rL, rQ);
  }

  update(interaction) {
    const rL = this.getLearnerRating(interaction.learnerId);
    const rQ = this.getQuestionRating(interaction.questionId, interaction.questionElo);
    const expected = eloExpected(rL, rQ);
    const actual = interaction.correct;

    const newRL = rL + this.kLearner * (actual - expected);
    const newRQ = rQ + this.kQuestion * (expected - actual);

    this.learnerRatings.set(interaction.learnerId, newRL);
    this.questionRatings.set(interaction.questionId, newRQ);
  }
}

// ─── 3. Elo-BKT Hybrid (Prior System Baseline) ──────────────────────────────
class EloBKTModel {
  constructor(options = {}) {
    this.name = 'Elo-BKT (Legacy)';
    this.kLearner = options.kLearner || K_LEARNER;
    this.kQuestion = options.kQuestion || K_QUESTION;
    this.defaultRating = options.defaultRating || 1200;
    this.defaultPrior = options.defaultPrior || 0.30;
    this.baseGuess = options.baseGuess || BASE_GUESS;
    this.baseSlip = options.baseSlip || BASE_SLIP;
    this.pTransit = options.pTransit || P_TRANSIT;

    this.learnerRatings = new Map();
    this.questionRatings = new Map();
    this.mastery = new Map();
  }

  getLearnerRating(id) {
    return this.learnerRatings.get(id) || this.defaultRating;
  }

  getQuestionRating(id, seededElo = 1200) {
    if (!this.questionRatings.has(id)) {
      this.questionRatings.set(id, seededElo);
    }
    return this.questionRatings.get(id);
  }

  getMastery(learnerId, conceptTag) {
    const lMap = this.mastery.get(learnerId);
    if (!lMap || !lMap.has(conceptTag)) return this.defaultPrior;
    return lMap.get(conceptTag);
  }

  setMastery(learnerId, conceptTag, val) {
    if (!this.mastery.has(learnerId)) this.mastery.set(learnerId, new Map());
    this.mastery.get(learnerId).set(conceptTag, Math.max(0.001, Math.min(0.999, val)));
  }

  predict(interaction) {
    const rL = this.getLearnerRating(interaction.learnerId);
    const rQ = this.getQuestionRating(interaction.questionId, interaction.questionElo);
    const E = eloExpected(rL, rQ);
    const prior = this.getMastery(interaction.learnerId, interaction.conceptTag);

    // Legacy Elo-BKT: G and S derived ONLY from difficulty
    const dynamicG = Math.max(0.01, Math.min(0.49, this.baseGuess * E));
    const dynamicS = Math.max(0.01, Math.min(0.49, this.baseSlip * (1 - E)));

    const pCorrect = prior * (1 - dynamicS) + (1 - prior) * dynamicG;
    return Math.max(0.01, Math.min(0.99, pCorrect));
  }

  update(interaction) {
    const rL = this.getLearnerRating(interaction.learnerId);
    const rQ = this.getQuestionRating(interaction.questionId, interaction.questionElo);
    const E = eloExpected(rL, rQ);
    const actual = interaction.correct;

    // Elo update
    this.learnerRatings.set(interaction.learnerId, rL + this.kLearner * (actual - E));
    this.questionRatings.set(interaction.questionId, rQ + this.kQuestion * (E - actual));

    // Dynamic G/S (difficulty only)
    const dynamicG = Math.max(0.01, Math.min(0.49, this.baseGuess * E));
    const dynamicS = Math.max(0.01, Math.min(0.49, this.baseSlip * (1 - E)));

    const prior = this.getMastery(interaction.learnerId, interaction.conceptTag);
    let posterior;
    if (actual === 1) {
      posterior = (prior * (1 - dynamicS)) / (prior * (1 - dynamicS) + (1 - prior) * dynamicG);
    } else {
      posterior = (prior * dynamicS) / (prior * dynamicS + (1 - prior) * (1 - dynamicG));
    }
    const newMastery = posterior + (1 - posterior) * this.pTransit;
    this.setMastery(interaction.learnerId, interaction.conceptTag, newMastery);
  }
}

// ─── 4. TRACE-KT (Proposed Model + Flexible Ablation Config) ────────────────
class TraceKTModel {
  constructor(options = {}) {
    this.name = options.name || 'TRACE-KT (Proposed)';
    this.ablation = options.ablation || null;
    // Ablations:
    // 'no_ces': w_t = trustScore
    // 'no_trust': w_t = ces
    // 'no_rt': f_tau = 1
    // 'no_hints': f_h = 1
    // 'no_conf': f_kappa = 1
    // 'no_attempt': f_n = 1
    // 'no_uncertainty': beta tracker disabled

    this.kLearner = options.kLearner || K_LEARNER;
    this.kQuestion = options.kQuestion || K_QUESTION;
    this.defaultRating = options.defaultRating || 1200;
    this.defaultPrior = options.defaultPrior || 0.30;
    this.baseGuess = options.baseGuess || BASE_GUESS;
    this.baseSlip = options.baseSlip || BASE_SLIP;
    this.pTransit = options.pTransit || P_TRANSIT;

    this.learnerRatings = new Map();
    this.questionRatings = new Map();
    this.conceptState = new Map(); // learnerId -> { conceptTag -> { pMastery, alpha, beta, uncertainty, attempts } }
  }

  getLearnerRating(id) {
    return this.learnerRatings.get(id) || this.defaultRating;
  }

  getQuestionRating(id, seededElo = 1200) {
    if (!this.questionRatings.has(id)) {
      this.questionRatings.set(id, seededElo);
    }
    return this.questionRatings.get(id);
  }

  getConceptState(learnerId, conceptTag) {
    if (!this.conceptState.has(learnerId)) {
      this.conceptState.set(learnerId, new Map());
    }
    const lMap = this.conceptState.get(learnerId);
    if (!lMap.has(conceptTag)) {
      lMap.set(conceptTag, {
        pMastery: this.defaultPrior,
        alpha: 1.0,
        beta: 1.0,
        uncertainty: computeUncertainty(1.0, 1.0),
        attempts: 0,
      });
    }
    return lMap.get(conceptTag);
  }

  computeEffectiveWeight(interaction, currentRating, questionElo) {
    const trust = interaction.trustScore ?? 0.5;

    if (this.ablation === 'no_ces') {
      return trust;
    }

    const rtSec = interaction.responseTimeMs ? interaction.responseTimeMs / 1000 : 30;
    const fTau = this.ablation === 'no_rt'
      ? 1.0
      : responseTimeFactor(rtSec, questionElo, currentRating);

    const fH = this.ablation === 'no_hints'
      ? 1.0
      : hintFactor(interaction.hintCount || 0);

    const fKappa = this.ablation === 'no_conf'
      ? 1.0
      : confidenceFactor(interaction.confidence ?? 0.5, interaction.correct);

    const fN = this.ablation === 'no_attempt'
      ? 1.0
      : attemptDecayFactor(interaction.attemptNumber || 1);

    const ces = fTau * fH * fKappa * fN;

    if (this.ablation === 'no_trust') {
      return ces;
    }

    return ces * trust;
  }

  predict(interaction) {
    const rL = this.getLearnerRating(interaction.learnerId);
    const rQ = this.getQuestionRating(interaction.questionId, interaction.questionElo);
    const E = eloExpected(rL, rQ);
    const state = this.getConceptState(interaction.learnerId, interaction.conceptTag);

    // Compute effective weight for dynamic G/S
    const w = this.computeEffectiveWeight(interaction, rL, rQ);
    const { dynamicGuess, dynamicSlip } = computeDynamicGS(E, w);

    // P(C_t) = Mastery * (1 - Slip) + (1 - Mastery) * Guess
    const pCorrect = state.pMastery * (1 - dynamicSlip) + (1 - state.pMastery) * dynamicGuess;
    return Math.max(0.01, Math.min(0.99, pCorrect));
  }

  getPredictionInterval(interaction) {
    const pPred = this.predict(interaction);
    const state = this.getConceptState(interaction.learnerId, interaction.conceptTag);
    const u = this.ablation === 'no_uncertainty' ? 0.20 : state.uncertainty;
    const halfWidth = u * 0.5;
    return {
      lower: Math.max(0, pPred - halfWidth),
      upper: Math.min(1, pPred + halfWidth),
      uncertainty: u,
    };
  }

  update(interaction) {
    const rL = this.getLearnerRating(interaction.learnerId);
    const rQ = this.getQuestionRating(interaction.questionId, interaction.questionElo);
    const E = eloExpected(rL, rQ);
    const actual = interaction.correct;

    // Elo rating updates
    this.learnerRatings.set(interaction.learnerId, rL + this.kLearner * (actual - E));
    this.questionRatings.set(interaction.questionId, rQ + this.kQuestion * (E - actual));

    // Cognitive evidence weight
    const w = this.computeEffectiveWeight(interaction, rL, rQ);

    const state = this.getConceptState(interaction.learnerId, interaction.conceptTag);
    state.attempts += 1;

    // Bayesian posterior update
    const { newMastery } = traceKTPosterior(state.pMastery, actual === 1, E, w);
    state.pMastery = Math.max(0.001, Math.min(0.999, newMastery));

    // Epistemic uncertainty Beta update (unless ablated)
    if (this.ablation !== 'no_uncertainty') {
      const { alpha, beta } = updateBetaTracker(state.alpha, state.beta, actual === 1, w);
      state.alpha = alpha;
      state.beta = beta;
      state.uncertainty = computeUncertainty(alpha, beta);
    }
  }
}

module.exports = {
  StandardBKTModel,
  EloOnlyModel,
  EloBKTModel,
  TraceKTModel,
};
