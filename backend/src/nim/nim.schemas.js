const { z } = require('zod');

// ─── Allowed diff op vocabulary ───────────────────────────────────────────────
const ALLOWED_OPS = [
  'add_milestone',
  'remove_milestone',
  'add_chapter',
  'remove_chapter',
  'edit_chapter',
  'reorder',
];

// ─── Roadmap generation schema ────────────────────────────────────────────────
const roadmapSchema = z.object({
  milestones: z
    .array(
      z.object({
        title: z.string().min(1),
        chapters: z
          .array(
            z.object({
              title: z.string().min(1),
              objectives: z.array(z.string().min(1)).min(1).max(6),
            })
          )
          .min(1),
      })
    )
    .min(1),
});

// ─── MCQ / assessment schema ─────────────────────────────────────────────────
const mcqSchema = z
  .array(
    z.object({
      question: z.string().min(1),
      options: z.array(z.string().min(1)).length(4),
      correct_index: z.number().int().min(0).max(3),
      concept_tag: z.string().min(1),
      explanation: z.string().min(1),
    })
  )
  .min(1);

// ─── Roadmap modification diff schema ────────────────────────────────────────
const diffOperationSchema = z
  .object({ op: z.enum(ALLOWED_OPS) })
  .passthrough(); // allow extra fields per op type

const diffSchema = z.object({
  operations: z.array(diffOperationSchema).min(1),
  rationale: z.string().min(1),
});

module.exports = { roadmapSchema, mcqSchema, diffSchema };
