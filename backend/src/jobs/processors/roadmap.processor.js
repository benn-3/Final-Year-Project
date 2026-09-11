const { Worker } = require('bullmq');
const { Prismafrontend } = require('@prisma/frontend');
const { connection } = require('../queue');
const { callNIM } = require('../../nim/nim.frontend');
const { buildRoadmapPrompt } = require('../../nim/nim.prompts');
const { roadmapSchema } = require('../../nim/nim.schemas');

const prisma = new Prismafrontend();

const roadmapWorker = new Worker(
  'roadmap-gen',
  async (job) => {
    const { jobId, userId, profileId, roadmapId } = job.data;
    console.log(`[roadmap-gen] Starting job ${jobId} for roadmap ${roadmapId}`);

    try {
      const profile = await prisma.userProfile.findUnique({ where: { id: profileId } });
      if (!profile) throw new Error('UserProfile not found');

      const { systemPrompt, userPrompt } = buildRoadmapPrompt(profile);
      const result = await callNIM({
        systemPrompt,
        userPrompt,
        schema: roadmapSchema,
        options: { temperature: 0.3, max_tokens: 6000, reasoning_budget: 4096 },
      });

      // Persist the entire roadmap tree in a single transaction
      await prisma.$transaction(async (tx) => {
        for (let mi = 0; mi < result.milestones.length; mi++) {
          const ms = result.milestones[mi];
          const milestone = await tx.milestone.create({
            data: {
              roadmapId,
              order: mi + 1,
              title: ms.title,
              // First milestone is active, rest are locked
              status: mi === 0 ? 'active' : 'locked',
            },
          });

          for (let ci = 0; ci < ms.chapters.length; ci++) {
            const ch = ms.chapters[ci];
            await tx.chapter.create({
              data: {
                milestoneId: milestone.id,
                order: ci + 1,
                title: ch.title,
                objectives: ch.objectives,
                status: 'not_started',
              },
            });
          }
        }

        // Mark job as ready
        await tx.generationJob.update({
          where: { id: jobId },
          data: { status: 'ready', resultRef: roadmapId },
        });
      });

      console.log(`[roadmap-gen] Job ${jobId} complete — roadmap ${roadmapId} ready`);
    } catch (err) {
      console.error(`[roadmap-gen] Job ${jobId} failed:`, err.message);
      await prisma.generationJob.update({
        where: { id: jobId },
        data: { status: 'failed', error: err.message },
      });
      throw err; // BullMQ will mark job as failed
    }
  },
  { connection }
);

roadmapWorker.on('failed', (job, err) => {
  console.error(`[roadmap-gen] Worker error on job ${job?.id}:`, err.message);
});

module.exports = roadmapWorker;
