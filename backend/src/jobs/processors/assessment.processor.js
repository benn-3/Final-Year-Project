const { Worker } = require('bullmq');
const { PrismaClient } = require('@prisma/client');
const { connection } = require('../queue');
const { callNIM } = require('../../nim/nim.client');
const { buildMCQPrompt } = require('../../nim/nim.prompts');
const { mcqSchema } = require('../../nim/nim.schemas');
const { difficultyToElo } = require('../../services/tracekt.service');
const { computeTrustScoresForAssessment } = require('../../services/trust.service');

const prisma = new PrismaClient();

// Map 1-5 difficulty scale to a descriptive label for the NIM prompt.
// Existing Easy/Medium/Hard labels preserved for prompt readability.
const DIFFICULTY_LABELS = {
  1: 'Easy (beginner)',
  2: 'Easy-Medium',
  3: 'Medium (intermediate)',
  4: 'Medium-Hard',
  5: 'Hard (advanced)',
};

const assessmentWorker = new Worker(
  'assessment-gen',
  async (job) => {
    // difficulty is now Elo-derived (1-5) from assessment.service, no longer hardcoded to 2
    const { jobId, chapterId, assessmentId, difficulty = 3 } = job.data;
    console.log(
      `[assessment-gen] Starting job ${jobId} for assessment ${assessmentId} at difficulty ${difficulty}/5`
    );

    try {
      // Fetch chapter with user's goal via deep relation
      const chapter = await prisma.chapter.findUnique({
        where: { id: chapterId },
        include: {
          milestone: {
            include: {
              roadmap: {
                include: {
                  user: { include: { profile: true } },
                },
              },
            },
          },
        },
      });
      if (!chapter) throw new Error('Chapter not found');

      const goal = chapter.milestone.roadmap.user.profile?.goal || 'general learning';
      // Generate at least 2 questions per objective, minimum 5
      const count = Math.max(chapter.objectives.length * 2, 5);

      const { systemPrompt, userPrompt } = buildMCQPrompt({
        objectives: chapter.objectives,
        goal,
        difficulty,
        count,
        // Pass the human-readable label so the prompt is more descriptive
        conceptContext: `Difficulty level: ${DIFFICULTY_LABELS[difficulty] || difficulty}`,
      });

      const questions = await callNIM({
        systemPrompt,
        userPrompt,
        schema: mcqSchema,
        options: { temperature: 0.4, max_tokens: 4096, reasoning_budget: 2048 },
      });

      // ── Persist questions + seed Elo rating ─────────────────────────────────
      // Seed each question's elo_rating from the generation difficulty.
      // This is the starting point; the TRACE-KT engine will update it after attempts.
      const seedElo = difficultyToElo(difficulty);

      await prisma.$transaction(async (tx) => {
        // Delete old questions (in case of regeneration)
        await tx.question.deleteMany({ where: { assessmentId } });

        await tx.question.createMany({
          data: questions.map((q) => ({
            assessmentId,
            text:         q.question,
            options:      q.options,
            correctIndex: q.correct_index,
            conceptTag:   q.concept_tag,
            explanation:  q.explanation,
            eloRating:    seedElo,      // seeded from difficulty
            trustScore:   0.5,          // initial — will be computed below
          })),
        });

        await tx.generationJob.update({
          where: { id: jobId },
          data:  { status: 'ready', resultRef: assessmentId },
        });
      });

      // ── TRACE-KT: Compute trust scores for all generated questions ─────────
      // This runs after the transaction so questions exist in DB.
      try {
        await computeTrustScoresForAssessment(assessmentId);
      } catch (trustErr) {
        // Trust score computation failure is non-fatal — questions still work
        // with default trust score of 0.5
        console.error(`[assessment-gen] Trust score computation failed (non-fatal):`, trustErr.message);
      }

      console.log(
        `[assessment-gen] Job ${jobId} complete — ${questions.length} questions for ${assessmentId} (eloRating seeded at ${seedElo})`
      );
    } catch (err) {
      console.error(`[assessment-gen] Job ${jobId} failed:`, err.message);
      await prisma.generationJob.update({
        where: { id: jobId },
        data:  { status: 'failed', error: err.message },
      });
      throw err;
    }
  },
  { connection }
);

assessmentWorker.on('failed', (job, err) => {
  console.error(`[assessment-gen] Worker error on job ${job?.id}:`, err.message);
});

module.exports = assessmentWorker;
