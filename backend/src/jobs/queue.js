require('dotenv').config();
const { Queue } = require('bullmq');
const { Redis } = require('ioredis');

// Shared Redis connection for all queues and workers
const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null, // required by BullMQ
});

connection.on('error', (err) => console.error('[Redis] Connection error:', err.message));
connection.on('connect', () => console.log('[Redis] Connected'));

const roadmapQueue    = new Queue('roadmap-gen',    { connection });
const assessmentQueue = new Queue('assessment-gen', { connection });
const diagnosticQueue = new Queue('diagnostic-gen', { connection });

module.exports = { roadmapQueue, assessmentQueue, diagnosticQueue, connection };
