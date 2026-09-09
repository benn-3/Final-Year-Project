const { PrismaClient } = require('@prisma/client');
const { roadmapQueue } = require('../jobs/queue');
const { callNIM } = require('../nim/nim.client');
const { buildDiffPrompt } = require('../nim/nim.prompts');
const { diffSchema } = require('../nim/nim.schemas');
const { getWeakConcepts } = require('./mastery.service');

const prisma = new PrismaClient();

// ─── Create (enqueue generation) ─────────────────────────────────────────────
async function createRoadmap(userId) {
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) {
    const err = new Error('Complete onboarding before generating a roadmap');
    err.status = 400;
    throw err;
  }

  // Archive any existing active roadmaps so the user can generate a fresh one
  await prisma.roadmap.updateMany({
    where: { userId, status: 'active' },
    data: { status: 'archived' },
  });

  const roadmap = await prisma.roadmap.create({ data: { userId } });

  const job = await prisma.generationJob.create({
    data: {
      type: 'roadmap',
      resultRef: roadmap.id,
      metadata: { roadmapId: roadmap.id, profileId: profile.id },
    },
  });

  await roadmapQueue.add('generate-roadmap', {
    jobId: job.id,
    userId,
    profileId: profile.id,
    roadmapId: roadmap.id,
  });

  return { jobId: job.id, roadmapId: roadmap.id };
}

// ─── Poll status (by jobId) ───────────────────────────────────────────────────
async function getRoadmapJobStatus(jobId) {
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
  if (!job) {
    const err = new Error('Job not found');
    err.status = 404;
    throw err;
  }
  return { status: job.status, roadmapId: job.resultRef, error: job.error };
}

// ─── Get full roadmap tree ────────────────────────────────────────────────────
async function getRoadmap(roadmapId, userId) {
  const roadmap = await prisma.roadmap.findFirst({
    where: { id: roadmapId, userId },
    include: {
      milestones: {
        orderBy: { order: 'asc' },
        include: {
          chapters: { orderBy: { order: 'asc' } },
        },
      },
    },
  });

  if (!roadmap) {
    const err = new Error('Roadmap not found');
    err.status = 404;
    throw err;
  }

  // Compute progress metrics
  const allChapters = roadmap.milestones.flatMap((m) => m.chapters);
  const total = allChapters.length;
  const completed = allChapters.filter((c) => c.status === 'completed').length;

  return {
    ...roadmap,
    progress: { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 },
  };
}

// ─── Get user's active roadmap (convenience) ─────────────────────────────────
async function getActiveRoadmap(userId) {
  const roadmap = await prisma.roadmap.findFirst({
    where: { userId, status: 'active' },
    include: {
      milestones: {
        orderBy: { order: 'asc' },
        include: { chapters: { orderBy: { order: 'asc' } } },
      },
    },
  });

  if (!roadmap) {
    const err = new Error('No active roadmap found');
    err.status = 404;
    throw err;
  }

  const allChapters = roadmap.milestones.flatMap((m) => m.chapters);
  const total = allChapters.length;
  const completed = allChapters.filter((c) => c.status === 'completed').length;

  return {
    ...roadmap,
    progress: { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 },
  };
}

// ─── Propose modification (synchronous NIM call + store as pending) ───────────
async function proposeModification(roadmapId, userId, userPrompt) {
  const roadmap = await prisma.roadmap.findFirst({
    where: { id: roadmapId, userId },
    include: {
      milestones: {
        orderBy: { order: 'asc' },
        include: { chapters: { select: { id: true, title: true }, orderBy: { order: 'asc' } } },
      },
    },
  });
  if (!roadmap) {
    const err = new Error('Roadmap not found');
    err.status = 404;
    throw err;
  }

  // Build compact roadmap context (IDs + titles only — keeps NIM prompt small)
  const compactRoadmap = {
    roadmap_id: roadmap.id,
    milestones: roadmap.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      chapters: m.chapters.map((c) => ({ id: c.id, title: c.title })),
    })),
  };

  // Fetch weak concepts from the mastery engine so the diff prompt context
  // includes them — NIM can then proactively suggest reinforcement chapters
  // even when the user hasn't explicitly asked for them.
  let weakConcepts = [];
  try {
    weakConcepts = await getWeakConcepts(userId);
  } catch (e) {
    // Non-fatal: if mastery data is unavailable, proceed with empty list
    console.warn('[roadmap] Could not fetch weak concepts for diff prompt:', e.message);
  }

  const { systemPrompt, userPrompt: nimPrompt } = buildDiffPrompt({
    compactRoadmap,
    userRequest: userPrompt,
    weakConcepts,
  });
  const diff = await callNIM({
    systemPrompt,
    userPrompt: nimPrompt,
    schema: diffSchema,
    options: { temperature: 0.3, max_tokens: 2048, reasoning_budget: 2048 },
  });

  // Store as pending — nothing is applied yet
  const changeLog = await prisma.roadmapChangeLog.create({
    data: {
      roadmapId,
      versionFrom: roadmap.version,
      versionTo: roadmap.version + 1,
      diffJson: diff,
      userPrompt,
      status: 'pending',
    },
  });

  return { changeId: changeLog.id, diff };
}

// ─── Confirm modification (apply diff transactionally) ────────────────────────
async function confirmModification(roadmapId, userId, changeId) {
  const roadmap = await prisma.roadmap.findFirst({ where: { id: roadmapId, userId } });
  if (!roadmap) {
    const err = new Error('Roadmap not found');
    err.status = 404;
    throw err;
  }

  const changeLog = await prisma.roadmapChangeLog.findFirst({
    where: { id: changeId, roadmapId, status: 'pending' },
  });
  if (!changeLog) {
    const err = new Error('Pending change not found');
    err.status = 404;
    throw err;
  }

  const diff = changeLog.diffJson;

  await prisma.$transaction(async (tx) => {
    for (const op of diff.operations) {
      switch (op.op) {
        case 'add_milestone': {
          const count = await tx.milestone.count({ where: { roadmapId } });
          await tx.milestone.create({
            data: {
              roadmapId,
              order: count + 1,
              title: op.title,
              status: 'locked',
              chapters: {
                create: (op.chapters || []).map((c, i) => ({
                  order: i + 1,
                  title: c.title,
                  objectives: c.objectives || [],
                })),
              },
            },
          });
          break;
        }
        case 'remove_milestone':
          await tx.milestone.delete({ where: { id: op.id } });
          break;
        case 'add_chapter': {
          const count = await tx.chapter.count({ where: { milestoneId: op.milestone_id } });
          await tx.chapter.create({
            data: {
              milestoneId: op.milestone_id,
              order: count + 1,
              title: op.title,
              objectives: op.objectives || [],
            },
          });
          break;
        }
        case 'remove_chapter':
          await tx.chapter.delete({ where: { id: op.id } });
          break;
        case 'edit_chapter': {
          const data = {};
          if (op.title) data.title = op.title;
          if (op.objectives) data.objectives = op.objectives;
          await tx.chapter.update({ where: { id: op.id }, data });
          break;
        }
        case 'reorder':
          if (op.type === 'milestone') {
            await tx.milestone.update({ where: { id: op.id }, data: { order: op.new_order } });
          } else {
            await tx.chapter.update({ where: { id: op.id }, data: { order: op.new_order } });
          }
          break;
        default:
          console.warn(`[roadmap] Unknown op '${op.op}' skipped`);
      }
    }

    await tx.roadmap.update({ where: { id: roadmapId }, data: { version: { increment: 1 } } });
    await tx.roadmapChangeLog.update({
      where: { id: changeId },
      data: { status: 'confirmed', confirmedAt: new Date() },
    });
  });

  return { success: true, newVersion: roadmap.version + 1, rationale: diff.rationale };
}

// ─── Reject modification ──────────────────────────────────────────────────────
async function rejectModification(roadmapId, userId, changeId) {
  const changeLog = await prisma.roadmapChangeLog.findFirst({
    where: { id: changeId, roadmapId, status: 'pending' },
  });
  if (!changeLog) {
    const err = new Error('Pending change not found');
    err.status = 404;
    throw err;
  }
  await prisma.roadmapChangeLog.update({ where: { id: changeId }, data: { status: 'rejected' } });
  return { success: true };
}

module.exports = {
  createRoadmap,
  getRoadmapJobStatus,
  getRoadmap,
  getActiveRoadmap,
  proposeModification,
  confirmModification,
  rejectModification,
};
