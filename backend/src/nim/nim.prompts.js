/**
 * Prompt builder functions for the three NIM tasks.
 * Each returns { systemPrompt, userPrompt } ready for callNIM().
 */

// ─── 1. Roadmap generation ────────────────────────────────────────────────────
function buildRoadmapPrompt(profile) {
  const systemPrompt = `You are a curriculum architect. Your only job is to design structured learning roadmaps.

STRICT RULES:
- Output ONLY valid JSON. No prose, no markdown fences, no explanations outside JSON.
- Do NOT provide learning material, links, explanations, or resources.
- Only produce: milestone titles, chapter titles, and 2-4 short learning objectives per chapter.
- Objectives must be action-oriented and measurable (start with a verb: "Explain", "Build", "Debug", "Configure").
- Order milestones foundational → advanced.
- Calibrate depth to diagnostic_score: 0.0 = complete beginner (more foundational chapters), 1.0 = expert (skip basics, go deeper).
- A null/missing diagnostic_score means treat as beginner (0.2).

Required JSON structure — return exactly this, nothing else:
{"milestones":[{"title":"","chapters":[{"title":"","objectives":["",""]}]}]}`;

  const userPrompt = `Generate a comprehensive learning roadmap for this learner:
${JSON.stringify(
    {
      goal: profile.goal,
      interests: profile.interestTags,
      preparedness: profile.preparednessLevel,
      self_rated_knowledge: profile.selfRatedKnowledge,
      diagnostic_score: profile.diagnosticScore ?? null,
      weak_concepts: profile.diagnosticWeakConcepts ?? [],
    },
    null,
    2
  )}

Return JSON only. No other text.`;

  return { systemPrompt, userPrompt };
}

// ─── 2. MCQ generation (used for both diagnostic + chapter assessments) ───────
function buildMCQPrompt({ objectives, goal, difficulty, count = 6, conceptContext = '' }) {
  const systemPrompt = `You are an expert assessment designer creating multiple-choice questions.

STRICT RULES:
- Generate exactly ${count} questions with 4 options each, exactly 1 correct answer.
- Every objective must be covered by at least one question.
- Distractors must be plausible — no obviously wrong options.
- Tag each question with the specific concept it tests (concept_tag).
- Include a brief post-attempt explanation of why the correct answer is correct.
- Difficulty scale 1-5: ${difficulty}/5.
- Output ONLY a valid JSON array. No prose, no markdown fences.

Required JSON structure:
[{"question":"","options":["","","",""],"correct_index":0,"concept_tag":"","explanation":""}]`;

  const userPrompt = `Learner goal: ${goal}
${conceptContext ? `Additional context: ${conceptContext}` : ''}

Objectives to assess:
${objectives.map((o, i) => `${i + 1}. ${o}`).join('\n')}

Generate ${count} MCQs at difficulty ${difficulty}/5. Return JSON array only. No other text.`;

  return { systemPrompt, userPrompt };
}

// ─── 3. Roadmap modification diff ────────────────────────────────────────────
/**
 * @param {{ compactRoadmap: object, userRequest: string, weakConcepts?: string[] }} params
 * weakConcepts — concept tags where the learner's BKT p_mastery < 0.6.
 * When present, NIM is instructed to proactively suggest reinforcement chapters
 * for those topics, even if the user didn't explicitly ask for them.
 */
function buildDiffPrompt({ compactRoadmap, userRequest, weakConcepts = [] }) {
  const systemPrompt = `You are a roadmap editor. You receive a compact roadmap summary (IDs + titles only) and a user modification request.

STRICT RULES:
- Output ONLY a diff using this EXACT constrained op vocabulary. Nothing else.
- Allowed operations and their required fields:
  • add_milestone:    { "op": "add_milestone",    "title": "",   "after_milestone_id": "<id|null>", "chapters": [{"title":"","objectives":[""]}] }
  • remove_milestone: { "op": "remove_milestone", "id": "<milestone_id>" }
  • add_chapter:      { "op": "add_chapter",      "milestone_id": "<id>", "title": "", "objectives": [""], "after_chapter_id": "<id|null>" }
  • remove_chapter:   { "op": "remove_chapter",   "id": "<chapter_id>" }
  • edit_chapter:     { "op": "edit_chapter",     "id": "<chapter_id>", "title": "<optional>", "objectives": ["<optional>"] }
  • reorder:          { "op": "reorder",           "type": "milestone|chapter", "id": "<id>", "new_order": <int> }
- Any op outside this list is FORBIDDEN and will be rejected.
- If weak concepts are listed below, proactively add reinforcement chapters covering those concepts where appropriate in the roadmap, even if not explicitly requested by the user.
- Include a one-line rationale.
- Output ONLY valid JSON — no prose, no markdown fences:
  {"operations":[...],"rationale":""}`;

  // Inject weak concepts into the user prompt when available.
  // This is the BKT→NIM connection: mastery engine → diff prompt → reinforcement chapter proposals.
  const weakConceptsSection = weakConcepts.length > 0
    ? `\nLearner's weak concepts (p_mastery < 0.6 — consider adding reinforcement chapters for these):\n${weakConcepts.map((c) => `  - ${c}`).join('\n')}\n`
    : '';

  const userPrompt = `Current roadmap (compact — IDs and titles only):
${JSON.stringify(compactRoadmap, null, 2)}
${weakConceptsSection}
User's modification request: "${userRequest}"

Return the diff JSON only. No other text.`;

  return { systemPrompt, userPrompt };
}

module.exports = { buildRoadmapPrompt, buildMCQPrompt, buildDiffPrompt };
