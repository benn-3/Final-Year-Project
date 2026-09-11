/**
 * TRACE-KT: Question Trust Score Service
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Computes and manages Question Trust Scores (T_q) for AI-generated assessment items.
 * Low-trust questions have reduced influence on mastery estimation.
 *
 * Trust Score Components:
 *   T_q = w_c · T_concept + w_r · T_relevance + w_d · T_difficulty + w_f · T_format
 *
 *   T_concept   — Concept tag consistency (keyword overlap between tag and question text)
 *   T_relevance — Topical relevance to chapter objectives
 *   T_difficulty — Difficulty calibration accuracy (post-hoc, after ≥ MIN_RESPONSES responses)
 *   T_format    — Structural quality (distinct options, appropriate length, non-trivial distractors)
 *
 * Design Decisions:
 *   - Uses TF-IDF-style keyword overlap (not another LLM call) for reproducibility.
 *   - T_difficulty defaults to 0.5 until enough empirical data is collected.
 *   - Trust scores are computed at question generation time and recalibrated periodically.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ─── Trust Weight Configuration ──────────────────────────────────────────────

const TRUST_WEIGHTS = {
  concept: 0.35,     // w_c — Concept tag consistency
  relevance: 0.25,   // w_r — Chapter relevance
  difficulty: 0.25,  // w_d — Difficulty calibration
  format: 0.15,      // w_f — Structural quality
};

// Minimum responses before difficulty calibration component is meaningful
const MIN_RESPONSES_FOR_CALIBRATION = 5;

// ─── Text Processing Helpers ─────────────────────────────────────────────────

/**
 * Tokenize text into lowercase word tokens, removing common stop words.
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'must', 'need', 'dare',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
    'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'both',
    'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
    'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
    'and', 'but', 'or', 'if', 'while', 'because', 'about', 'which',
    'what', 'this', 'that', 'these', 'those', 'it', 'its',
    'following', 'given', 'using', 'used', 'use',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
}

/**
 * Compute keyword overlap ratio between two texts (Jaccard-like similarity).
 * @param {string} text1
 * @param {string} text2
 * @returns {number} similarity ∈ [0, 1]
 */
function keywordOverlap(text1, text2) {
  const tokens1 = new Set(tokenize(text1));
  const tokens2 = new Set(tokenize(text2));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let intersection = 0;
  for (const t of tokens1) {
    if (tokens2.has(t)) intersection++;
  }

  const union = new Set([...tokens1, ...tokens2]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Compute weighted keyword containment: what fraction of conceptTag tokens
 * appear in the question text? This is directional (tag → question).
 * @param {string} conceptTag — e.g., "TCP/IP Protocol Stack"
 * @param {string} questionText — full question text
 * @returns {number} containment ∈ [0, 1]
 */
function conceptContainment(conceptTag, questionText) {
  const tagTokens = tokenize(conceptTag);
  if (tagTokens.length === 0) return 0.5; // fallback for very short tags

  const questionTokenSet = new Set(tokenize(questionText));
  let found = 0;
  for (const t of tagTokens) {
    if (questionTokenSet.has(t)) found++;
  }

  return found / tagTokens.length;
}

// ─── Trust Component Functions ───────────────────────────────────────────────

/**
 * T_concept: Concept tag consistency score.
 *
 * Measures how well the concept_tag matches the question content.
 * Uses directional containment (tag tokens → question text) combined with
 * symmetric overlap (tag ↔ question) for robustness.
 *
 * @param {string} conceptTag
 * @param {string} questionText
 * @param {string[]} options — the 4 MCQ options
 * @returns {number} T_concept ∈ [0, 1]
 */
function computeConceptConsistency(conceptTag, questionText, options) {
  // Combine question text with all options for richer matching
  const fullText = [questionText, ...options].join(' ');

  // Directional containment has higher weight (0.7) — most important signal
  const containment = conceptContainment(conceptTag, fullText);
  // Symmetric overlap provides additional context
  const overlap = keywordOverlap(conceptTag, fullText);

  return 0.7 * containment + 0.3 * overlap;
}

/**
 * T_relevance: Chapter relevance score.
 *
 * Measures how well the question relates to the chapter's learning objectives.
 *
 * @param {string} questionText
 * @param {string[]} objectives — chapter learning objectives
 * @returns {number} T_relevance ∈ [0, 1]
 */
function computeRelevance(questionText, objectives) {
  if (!objectives || objectives.length === 0) return 0.5;

  // Compute overlap with each objective, take the maximum
  const objectiveText = objectives.join(' ');
  const overlap = keywordOverlap(questionText, objectiveText);

  // Also compute max individual objective overlap for specificity
  const maxIndividualOverlap = Math.max(
    ...objectives.map((obj) => keywordOverlap(questionText, obj))
  );

  // Blend: overall relevance + strongest individual match
  return 0.4 * overlap + 0.6 * maxIndividualOverlap;
}

/**
 * T_difficulty: Difficulty calibration score.
 *
 * Measures how well the question's predicted difficulty matches empirical difficulty.
 * Only meaningful after MIN_RESPONSES_FOR_CALIBRATION responses.
 *
 * T_difficulty = 1 - |E_empirical - E_predicted|
 *
 * @param {number|null} empiricalCorrectRate — observed correctness rate
 * @param {number} predictedExpected — Elo-predicted average correctness rate
 * @param {number} responseCount — number of responses collected
 * @returns {number} T_difficulty ∈ [0, 1]
 */
function computeDifficultyCalibration(empiricalCorrectRate, predictedExpected, responseCount) {
  if (responseCount < MIN_RESPONSES_FOR_CALIBRATION || empiricalCorrectRate === null) {
    return 0.5; // Uninformative default before sufficient data
  }

  return 1 - Math.abs(empiricalCorrectRate - predictedExpected);
}

/**
 * T_format: Structural quality score.
 *
 * Automated checks for question quality:
 *   - Distinct options (no duplicates)
 *   - Non-trivial option length (not too short)
 *   - Question has reasonable length (not too short or too long)
 *   - Options are not identical to the correct answer with minor variation
 *
 * @param {string} questionText
 * @param {string[]} options — the 4 MCQ options
 * @param {string} explanation
 * @returns {number} T_format ∈ [0, 1]
 */
function computeFormatQuality(questionText, options, explanation) {
  let score = 1.0;
  const penalties = [];

  // Check 1: Question length (penalize very short or very long questions)
  const qLen = questionText.trim().length;
  if (qLen < 20) {
    score -= 0.25;
    penalties.push('question_too_short');
  } else if (qLen > 500) {
    score -= 0.10;
    penalties.push('question_too_long');
  }

  // Check 2: Distinct options (penalize duplicate options)
  const uniqueOptions = new Set(options.map((o) => o.trim().toLowerCase()));
  if (uniqueOptions.size < options.length) {
    score -= 0.30;
    penalties.push('duplicate_options');
  }

  // Check 3: Option length (penalize very short options — likely not meaningful)
  const shortOptions = options.filter((o) => o.trim().length < 5).length;
  if (shortOptions >= 2) {
    score -= 0.15;
    penalties.push('short_options');
  }

  // Check 4: Option diversity (penalize if all options are too similar)
  const avgOptionLen = options.reduce((sum, o) => sum + o.length, 0) / options.length;
  const optionLenVariance = options.reduce((sum, o) =>
    sum + Math.pow(o.length - avgOptionLen, 2), 0) / options.length;
  if (optionLenVariance < 4 && avgOptionLen < 15) {
    score -= 0.10;
    penalties.push('low_option_diversity');
  }

  // Check 5: Explanation exists and is meaningful
  if (!explanation || explanation.trim().length < 20) {
    score -= 0.10;
    penalties.push('weak_explanation');
  }

  return Math.max(score, 0);
}

// ─── Composite Trust Score ───────────────────────────────────────────────────

/**
 * Compute the composite question trust score.
 *
 * T_q = w_c · T_concept + w_r · T_relevance + w_d · T_difficulty + w_f · T_format
 *
 * @param {object} params
 * @param {string} params.questionText
 * @param {string[]} params.options
 * @param {string} params.conceptTag
 * @param {string} params.explanation
 * @param {string[]} params.chapterObjectives
 * @param {number|null} [params.empiricalCorrectRate=null]
 * @param {number} [params.predictedExpected=0.5]
 * @param {number} [params.responseCount=0]
 * @returns {{
 *   overallTrust: number,
 *   components: { conceptConsistency: number, relevanceScore: number,
 *                 difficultyCalibration: number, formatScore: number }
 * }}
 */
function computeQuestionTrustScore({
  questionText,
  options,
  conceptTag,
  explanation,
  chapterObjectives,
  empiricalCorrectRate = null,
  predictedExpected = 0.5,
  responseCount = 0,
}) {
  const conceptConsistency = computeConceptConsistency(conceptTag, questionText, options);
  const relevanceScore = computeRelevance(questionText, chapterObjectives);
  const difficultyCalibration = computeDifficultyCalibration(
    empiricalCorrectRate, predictedExpected, responseCount
  );
  const formatScore = computeFormatQuality(questionText, options, explanation);

  const overallTrust =
    TRUST_WEIGHTS.concept * conceptConsistency +
    TRUST_WEIGHTS.relevance * relevanceScore +
    TRUST_WEIGHTS.difficulty * difficultyCalibration +
    TRUST_WEIGHTS.format * formatScore;

  return {
    overallTrust: Math.min(Math.max(overallTrust, 0), 1),
    components: {
      conceptConsistency,
      relevanceScore,
      difficultyCalibration,
      formatScore,
    },
  };
}

// ─── Database Integration ────────────────────────────────────────────────────

/**
 * Compute and persist trust score for a newly generated question.
 *
 * @param {string} questionId
 * @param {string[]} chapterObjectives
 * @returns {Promise<number>} the computed trust score
 */
async function computeAndPersistTrustScore(questionId, chapterObjectives) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
  });
  if (!question) throw new Error(`Question ${questionId} not found`);

  const { overallTrust, components } = computeQuestionTrustScore({
    questionText: question.text,
    options: question.options,
    conceptTag: question.conceptTag,
    explanation: question.explanation,
    chapterObjectives: chapterObjectives || [],
    empiricalCorrectRate: question.empiricalCorrectRate,
    predictedExpected: 0.5, // Initial — no empirical data yet
    responseCount: question.responseCount,
  });

  // Persist trust score on the question
  await prisma.question.update({
    where: { id: questionId },
    data: { trustScore: overallTrust },
  });

  // Log for audit
  await prisma.questionTrustLog.create({
    data: {
      questionId,
      conceptConsistency: components.conceptConsistency,
      relevanceScore: components.relevanceScore,
      difficultyCalibration: components.difficultyCalibration,
      formatScore: components.formatScore,
      overallTrust,
      isRecalibration: false,
    },
  });

  return overallTrust;
}

/**
 * Batch compute trust scores for all questions in an assessment.
 * Called after assessment generation completes.
 *
 * @param {string} assessmentId
 * @returns {Promise<Array<{ questionId: string, trustScore: number }>>}
 */
async function computeTrustScoresForAssessment(assessmentId) {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      questions: true,
      chapter: { select: { objectives: true } },
    },
  });
  if (!assessment) throw new Error(`Assessment ${assessmentId} not found`);

  const results = [];
  for (const question of assessment.questions) {
    const trustScore = await computeAndPersistTrustScore(
      question.id,
      assessment.chapter.objectives
    );
    results.push({ questionId: question.id, trustScore });
  }

  console.log(
    `[trust] Computed trust scores for assessment ${assessmentId}: ` +
    results.map((r) => `${r.questionId.slice(-6)}=${r.trustScore.toFixed(3)}`).join(', ')
  );

  return results;
}

/**
 * Recalibrate the difficulty component of trust scores for questions
 * that have received sufficient responses.
 *
 * Should be called periodically (e.g., after every N attempts).
 *
 * @param {string} assessmentId
 * @returns {Promise<number>} count of recalibrated questions
 */
async function recalibrateTrustScores(assessmentId) {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      questions: true,
      chapter: { select: { objectives: true } },
    },
  });
  if (!assessment) return 0;

  let recalibrated = 0;

  for (const question of assessment.questions) {
    if (question.responseCount < MIN_RESPONSES_FOR_CALIBRATION) continue;

    // Recompute with empirical data
    const predictedExpected = 0.5; // Could be refined with actual Elo expected
    const { overallTrust, components } = computeQuestionTrustScore({
      questionText: question.text,
      options: question.options,
      conceptTag: question.conceptTag,
      explanation: question.explanation,
      chapterObjectives: assessment.chapter.objectives,
      empiricalCorrectRate: question.empiricalCorrectRate,
      predictedExpected,
      responseCount: question.responseCount,
    });

    await prisma.question.update({
      where: { id: question.id },
      data: { trustScore: overallTrust },
    });

    await prisma.questionTrustLog.create({
      data: {
        questionId: question.id,
        conceptConsistency: components.conceptConsistency,
        relevanceScore: components.relevanceScore,
        difficultyCalibration: components.difficultyCalibration,
        formatScore: components.formatScore,
        overallTrust,
        isRecalibration: true,
      },
    });

    recalibrated++;
  }

  if (recalibrated > 0) {
    console.log(`[trust] Recalibrated ${recalibrated} questions for assessment ${assessmentId}`);
  }

  return recalibrated;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  // Core computation (pure functions — exported for testing)
  computeQuestionTrustScore,
  computeConceptConsistency,
  computeRelevance,
  computeDifficultyCalibration,
  computeFormatQuality,
  keywordOverlap,
  conceptContainment,
  tokenize,

  // Database integration
  computeAndPersistTrustScore,
  computeTrustScoresForAssessment,
  recalibrateTrustScores,

  // Configuration
  TRUST_WEIGHTS,
  MIN_RESPONSES_FOR_CALIBRATION,
};
