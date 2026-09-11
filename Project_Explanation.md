# AI Learning Advisor - Project Architecture & Mastery Engine

## 1. Project Overview

The **AI Learning Advisor** is a self-directed learning companion designed to guide users through custom-tailored educational roadmaps. Unlike traditional learning management systems, the AI never provides the learning material directly. Instead, it acts as a mentor by:
1. **Structuring Knowledge:** Building a personalized roadmap of milestones and chapters toward a user's stated goal.
2. **Validating Mastery:** Generating adaptive multiple-choice knowledge-check assessments for each chapter.
3. **Adapting the Path:** Proposing structured edits to the roadmap when the user asks for changes, or proactively suggesting reinforcement chapters for concepts the user is struggling with.

### Tech Stack
- **backend:** Node.js, Express.js
- **Database:** PostgreSQL with Prisma ORM
- **Job Queue:** Redis + BullMQ (for asynchronous AI generations)
- **AI Orchestration:** NVIDIA NIM (Nemotron model)
- **frontend:** React.js, Vite

---

## 2. System Architecture

The application enforces strict architectural rules to ensure reliability and performance:
- **Asynchronous AI Generation:** All long-running AI tasks (roadmap generation, diagnostic quizzes, chapter assessments) run as background jobs using BullMQ. The frontend polls the status endpoints without blocking the main HTTP threads.
- **Structured AI Outputs:** The AI communicates exclusively in strictly validated JSON schemas. Any malformed output triggers an automatic retry loop backend-side.
- **Diff & Confirm Pattern:** Modifications to the learning roadmap are never silently applied. The AI generates a "diff" (add, remove, edit, reorder), which is presented to the user for explicit confirmation before being transactionally committed to the database.

---

## 3. The Mastery Engine: Elo + BKT Fusion

The core intelligence of the application (outside of LLM generation) is the **Hybrid Adaptive Mastery Engine**. It combines the **Elo Rating System** and **Bayesian Knowledge Tracing (BKT)** into a single, cohesive algorithm. 

Typically, these are two separate algorithms: Elo tracks continuous player/question difficulty, while BKT tracks the probability that a learner understands a specific concept. This project innovates by fusing them together, allowing the continuous difficulty of a question to directly influence the statistical weight of the learner's answer.

### Step 1: The Elo Rating Update
Every learner starts with a baseline rating of `1200`. Every question is generated with an initial difficulty (mapped to a starting Elo, e.g., Medium = `1200`).

When a learner answers a question, the engine calculates the **Expected Correctness** (\`expected\`) using the standard Elo formula:
\`expected = 1 / (1 + 10^((Question_Elo - Learner_Rating) / 400))\`

After the attempt, both ratings are updated:
- The **Learner's Rating** increases if they get it right, and decreases if wrong.
- The **Question's Difficulty** increases if the learner gets it wrong (meaning the question was harder than expected), and decreases if they get it right.

### Step 2: The Bayesian Knowledge Tracing (BKT) Update
BKT tracks the probability that a learner has mastered a specific \`concept_tag\` (e.g., "React Hooks", "SQL Joins"). The state updates based on four probabilities:
- **Prior:** The current probability of mastery before answering.
- **P(G) - Guess:** The probability of getting it right despite not knowing the concept.
- **P(S) - Slip:** The probability of getting it wrong despite knowing the concept.
- **P(T) - Transit:** The probability of learning the concept just by seeing the question.

### The Fusion Point: Dynamic Guess and Slip
In traditional BKT, \`P(G)\` and \`P(S)\` are static, hardcoded constants. In the **AI Learning Advisor**, they are **dynamically derived from the Elo Expected Correctness**. 

This solves a major flaw in standard BKT: answering a brutally hard question correctly should prove mastery much faster than answering a trivial question correctly.

**The Math:**
- \`P(G) = BASE_GUESS * expected\`
- \`P(S) = BASE_SLIP * (1 - expected)\`

**Why this works:**
1. **Hard Question (Low Expected):** The expected correctness is low (e.g., `0.10`). Therefore, the Guess probability \`P(G)\` shrinks drastically. If the learner gets it correct, the BKT algorithm recognizes that a lucky guess was highly unlikely, resulting in a **massive boost** to their concept mastery score.
2. **Easy Question (High Expected):** The expected correctness is high (e.g., `0.90`). The Slip probability \`P(S)\` shrinks. If the learner gets it wrong, the algorithm recognizes that a simple mistake ("slip") was unlikely, resulting in a **severe penalty** to their concept mastery score.

### Step 3: Closing the Loop (Adaptation)
After the BKT posterior updates, the system checks for **Weak Concepts** (any concept where \`p_mastery < 0.6\`).
1. **Adaptive Difficulty:** The learner's updated Elo rating is mapped back to a 1-5 scale and fed directly into the NVIDIA NIM prompt for future MCQ generation. A stronger learner will automatically receive harder questions.
2. **Proactive Roadmap Modification:** When the user asks the AI to modify their roadmap, the backend invisibly injects their Weak Concepts into the AI's context window. The AI is instructed to proactively suggest new reinforcement chapters targeting those exact weaknesses.
