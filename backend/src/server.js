const app = require('./app');

// Initialize BullMQ workers — importing them registers them
require('./jobs/processors/roadmap.processor');
require('./jobs/processors/assessment.processor');
require('./jobs/processors/diagnostic.processor');

const PORT = process.env.PORT || 8001;

app.listen(PORT, () => {
  console.log(`🚀 Learning Advisor API running on http://localhost:${PORT}`);
  console.log(`   NIM endpoint: ${process.env.NIM_BASE_URL}`);
  console.log(`   NIM model:    ${process.env.NIM_MODEL_NAME}`);
});
