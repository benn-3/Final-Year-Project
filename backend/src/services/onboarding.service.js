const { PrismaClient } = require('@prisma/client');
const { diagnosticQueue } = require('../jobs/queue');

const prisma = new PrismaClient();

async function createProfile(userId, { goal, interests, preparedness, selfRatedKnowledge }) {
  // Upsert so re-running onboarding works cleanly
  const profile = await prisma.userProfile.upsert({
    where: { userId },
    create: {
      userId,
      goal,
      interestTags: interests,
      preparednessLevel: preparedness,
      selfRatedKnowledge: selfRatedKnowledge || 'beginner',
    },
    update: {
      goal,
      interestTags: interests,
      preparednessLevel: preparedness,
      selfRatedKnowledge: selfRatedKnowledge || 'beginner',
      // Reset diagnostic when re-onboarding
      diagnosticScore: null,
      diagnosticWeakConcepts: [],
    },
  });

  // Create a GenerationJob record for tracking
  const job = await prisma.generationJob.create({
    data: {
      type: 'diagnostic',
      resultRef: profile.id,
      metadata: { profileId: profile.id },
    },
  });

  // Enqueue the diagnostic MCQ generation
  await diagnosticQueue.add('generate-diagnostic', {
    jobId: job.id,
    profileId: profile.id,
  });

  return { profile, jobId: job.id };
}

async function getDiagnosticStatus(jobId) {
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
  if (!job) {
    const err = new Error('Job not found');
    err.status = 404;
    throw err;
  }
  return { status: job.status, error: job.error };
}

async function getDiagnosticQuestions(jobId) {
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
  if (!job) {
    const err = new Error('Job not found');
    err.status = 404;
    throw err;
  }
  if (job.status === 'pending') {
    const err = new Error('Diagnostic quiz is still being generated. Poll /status first.');
    err.status = 202;
    throw err;
  }
  if (job.status === 'failed') {
    const err = new Error(`Diagnostic generation failed: ${job.error}`);
    err.status = 500;
    throw err;
  }
  // Questions are stored in job.metadata by the diagnostic processor
  const questions = job.metadata?.questions || [];
  // Strip correct answers from frontend-facing response
  return questions.map(({ correct_index, explanation, ...q }) => q);
}

async function submitDiagnostic(userId, { jobId, answers }) {
  const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== 'ready') {
    const err = new Error('Diagnostic not ready or job not found');
    err.status = 400;
    throw err;
  }

  const questions = job.metadata?.questions || [];
  if (questions.length === 0) {
    const err = new Error('No diagnostic questions found in job');
    err.status = 400;
    throw err;
  }
  if (answers.length !== questions.length) {
    const err = new Error(`Expected ${questions.length} answers, got ${answers.length}`);
    err.status = 400;
    throw err;
  }

  // backend-side grading
  let correct = 0;
  const weakConcepts = [];
  questions.forEach((q, i) => {
    if (answers[i] === q.correct_index) {
      correct++;
    } else if (!weakConcepts.includes(q.concept_tag)) {
      weakConcepts.push(q.concept_tag);
    }
  });

  const diagnosticScore = parseFloat((correct / questions.length).toFixed(3));

  const profile = await prisma.userProfile.update({
    where: { userId },
    data: { diagnosticScore, diagnosticWeakConcepts: weakConcepts },
  });

  return { diagnosticScore, weakConcepts, correctCount: correct, totalCount: questions.length, profile };
}

module.exports = { createProfile, getDiagnosticStatus, getDiagnosticQuestions, submitDiagnostic };
