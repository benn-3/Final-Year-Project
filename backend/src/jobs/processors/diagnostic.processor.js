const { Worker } = require('bullmq');
const { Prismafrontend } = require('@prisma/frontend');
const { connection } = require('../queue');
const { callNIM } = require('../../nim/nim.frontend');
const { buildMCQPrompt } = require('../../nim/nim.prompts');
const { mcqSchema } = require('../../nim/nim.schemas');

const prisma = new Prismafrontend();

const diagnosticWorker = new Worker(
  'diagnostic-gen',
  async (job) => {
    const { jobId, profileId } = job.data;
    console.log(`[diagnostic-gen] Starting job ${jobId} for profile ${profileId}`);

    try {
      const profile = await prisma.userProfile.findUnique({ where: { id: profileId } });
      if (!profile) throw new Error('UserProfile not found');

      // Create calibration objectives spanning the user's stated goal
      const objectives = [
        `Demonstrate foundational understanding of core ${profile.goal} concepts`,
        `Apply intermediate ${profile.goal} techniques to solve problems`,
        `Analyze and debug ${profile.goal} issues`,
        `Design solutions using ${profile.goal} best practices`,
      ];

      const { systemPrompt, userPrompt } = buildMCQPrompt({
        objectives,
        goal: profile.goal,
        difficulty: 3, // mixed difficulty — will span beginner to intermediate
        count: 8,
        conceptContext: `
Interest areas: ${profile.interestTags.join(', ')}.
Self-rated level: ${profile.selfRatedKnowledge}.
Span questions from beginner (difficulty 1-2) through intermediate (difficulty 3-4) to calibrate accurately.`,
      });

      const questions = await callNIM({
        systemPrompt,
        userPrompt,
        schema: mcqSchema,
        options: { temperature: 0.4, max_tokens: 4096 },
      });

      // Store questions as JSON in job metadata — no Assessment record needed for diagnostic
      await prisma.generationJob.update({
        where: { id: jobId },
        data: {
          status: 'ready',
          resultRef: profileId,
          metadata: { questions },
        },
      });

      console.log(`[diagnostic-gen] Job ${jobId} complete — ${questions.length} questions`);
    } catch (err) {
      console.error(`[diagnostic-gen] Job ${jobId} failed:`, err.message);
      await prisma.generationJob.update({
        where: { id: jobId },
        data: { status: 'failed', error: err.message },
      });
      throw err;
    }
  },
  { connection }
);

diagnosticWorker.on('failed', (job, err) => {
  console.error(`[diagnostic-gen] Worker error on job ${job?.id}:`, err.message);
});

module.exports = diagnosticWorker;
