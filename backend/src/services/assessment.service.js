const { PrismaClient } = require('@prisma/client');
const { assessmentQueue } = require('../jobs/queue');
const { runMasteryEngine, getLearnerRating, ratingToDifficulty } = require('./mastery.service');

const prisma = new PrismaClient();
const PASS_THRESHOLD = parseFloat(process.env.PASS_THRESHOLD || '0.70');

// ─── Get or trigger generation ────────────────────────────────────────────────
async function getOrCreateAssessment(chapterId, userId) {
  // Ensure chapter belongs to this user
  const chapter = await prisma.chapter.findFirst({
    where: {
      id: chapterId,
      milestone: { roadmap: { userId } },
    },
    include: {
      assessments: {
        orderBy: { generatedAt: 'desc' },
        take: 1,
        include: { questions: { select: { id: true, text: true, options: true, conceptTag: true } } },
      },
    },
  });
  if (!chapter) {
    const err = new Error('Chapter not found');
    err.status = 404;
    throw err;
  }

  const latest = chapter.assessments[0];

  // Already has questions — return it
  if (latest && latest.questions.length > 0) {
    return { status: 'ready', assessment: latest };
  }

  // Fetch learner Elo rating and convert to 1-5 difficulty scale for the prompt
  const learnerRating = await getLearnerRating(userId);
  const difficulty    = ratingToDifficulty(learnerRating);

  // Create assessment record (or reuse empty one from previous failed job)
  const assessment = latest || (await prisma.assessment.create({ data: { chapterId, difficulty } }));

  // Enqueue generation
  const job = await prisma.generationJob.create({
    data: {
      type: 'assessment',
      resultRef: assessment.id,
      metadata: { chapterId, assessmentId: assessment.id },
    },
  });

  await assessmentQueue.add('generate-assessment', {
    jobId: job.id,
    chapterId,
    assessmentId: assessment.id,
    difficulty, // Elo-derived, not hardcoded
  });

  return { status: 'pending', jobId: job.id, assessmentId: assessment.id };
}

// ─── Poll generation status (by assessmentId — finds latest job) ──────────────
async function getAssessmentStatus(assessmentId, userId) {
  const job = await prisma.generationJob.findFirst({
    where: { resultRef: assessmentId, type: 'assessment' },
    orderBy: { createdAt: 'desc' },
  });
  if (!job) return { status: 'unknown' };
  return { status: job.status, error: job.error };
}

// ─── Regenerate MCQ set ───────────────────────────────────────────────────────
async function regenerateAssessment(assessmentId, userId) {
  const assessment = await prisma.assessment.findFirst({
    where: {
      id: assessmentId,
      chapter: { milestone: { roadmap: { userId } } },
    },
  });
  if (!assessment) {
    const err = new Error('Assessment not found');
    err.status = 404;
    throw err;
  }

  // Use current learner Elo for the fresh difficulty level
  const learnerRating = await getLearnerRating(userId);
  const difficulty    = ratingToDifficulty(learnerRating);

  const job = await prisma.generationJob.create({
    data: {
      type: 'assessment',
      resultRef: assessmentId,
      metadata: { chapterId: assessment.chapterId, assessmentId },
    },
  });

  await assessmentQueue.add('generate-assessment', {
    jobId: job.id,
    chapterId: assessment.chapterId,
    assessmentId,
    difficulty,
  });

  return { jobId: job.id };
}

// ─── Get assessment with questions (client-safe — no correct answers) ─────────
async function getAssessmentWithQuestions(assessmentId, userId) {
  const assessment = await prisma.assessment.findFirst({
    where: {
      id: assessmentId,
      chapter: { milestone: { roadmap: { userId } } },
    },
    include: {
      questions: {
        select: {
          id: true,
          text: true,
          options: true,
          conceptTag: true,
          // correctIndex, explanation, eloRating omitted intentionally from client response
        },
      },
    },
  });
  if (!assessment) {
    const err = new Error('Assessment not found');
    err.status = 404;
    throw err;
  }
  return assessment;
}

// ─── Submit attempt (server-side grading + mastery engine) ───────────────────
async function submitAttempt(assessmentId, userId, answers) {
  // Fetch with correct answers for grading (server-side only)
  const assessment = await prisma.assessment.findFirst({
    where: {
      id: assessmentId,
      chapter: { milestone: { roadmap: { userId } } },
    },
    include: {
      // Include eloRating for the mastery engine
      questions: true,
      chapter: { select: { id: true, milestoneId: true } },
    },
  });
  if (!assessment) {
    const err = new Error('Assessment not found');
    err.status = 404;
    throw err;
  }
  if (assessment.questions.length === 0) {
    const err = new Error('This assessment has no questions yet');
    err.status = 400;
    throw err;
  }
  if (answers.length !== assessment.questions.length) {
    const err = new Error(`Expected ${assessment.questions.length} answers, got ${answers.length}`);
    err.status = 400;
    throw err;
  }

  // ── Server-side grading ───────────────────────────────────────────────────
  let correct = 0;
  const gradedAnswers = assessment.questions.map((q, i) => {
    const submitted = answers[i];
    const isCorrect = submitted === q.correctIndex;
    if (isCorrect) correct++;
    return {
      questionId:     q.id,
      submittedIndex: submitted,
      correctIndex:   q.correctIndex,
      isCorrect,
      explanation:    q.explanation,
      conceptTag:     q.conceptTag,
    };
  });

  const score  = correct / assessment.questions.length;
  const passed = score >= PASS_THRESHOLD;

  const attempt = await prisma.attempt.create({
    data: { userId, assessmentId, score, answers: gradedAnswers, passed },
  });

  // ── Update chapter status ─────────────────────────────────────────────────
  if (passed) {
    await prisma.chapter.update({
      where: { id: assessment.chapter.id },
      data:  { status: 'completed' },
    });
    await checkMilestoneCompletion(assessment.chapter.milestoneId);
  } else {
    await prisma.chapter.update({
      where: { id: assessment.chapter.id },
      data:  { status: 'knowledge_check_pending' },
    });
  }

  // ── Run Elo + BKT mastery engine (non-blocking: failure must not fail the attempt response) ─
  try {
    await runMasteryEngine(userId, gradedAnswers, assessment.questions);
  } catch (masteryErr) {
    // Log but do not surface to client — mastery engine failure should never
    // block the learner from receiving their graded result
    console.error('[mastery] Engine error (non-fatal):', masteryErr.message);
  }

  return {
    attemptId:    attempt.id,
    score:        Math.round(score * 100),
    passed,
    passThreshold: Math.round(PASS_THRESHOLD * 100),
    gradedAnswers,
  };
}

// ─── Milestone completion + auto-unlock ──────────────────────────────────────
async function checkMilestoneCompletion(milestoneId) {
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: {
      chapters: { select: { status: true } },
      roadmap:  { include: { milestones: { orderBy: { order: 'asc' }, select: { id: true, order: true } } } },
    },
  });
  if (!milestone) return;

  const allComplete = milestone.chapters.every((c) => c.status === 'completed');
  if (!allComplete) return;

  await prisma.milestone.update({ where: { id: milestoneId }, data: { status: 'completed' } });

  // Auto-unlock next milestone
  const sorted = milestone.roadmap.milestones;
  const idx = sorted.findIndex((m) => m.id === milestoneId);
  if (idx >= 0 && idx + 1 < sorted.length) {
    await prisma.milestone.update({
      where: { id: sorted[idx + 1].id },
      data:  { status: 'active' },
    });
    console.log(`[assessment] Milestone ${sorted[idx + 1].id} unlocked`);
  }
}

module.exports = {
  getOrCreateAssessment,
  getAssessmentStatus,
  regenerateAssessment,
  getAssessmentWithQuestions,
  submitAttempt,
};
