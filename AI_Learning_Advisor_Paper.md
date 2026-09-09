---
title: "AI-Powered Adaptive Learning Advisor Using Elo Rating and Bayesian Knowledge Tracing"
stylesheet: []
body_class: journal-paper
pdf_options:
  format: A4
  margin: 25mm 20mm 25mm 20mm
  printBackground: true
  displayHeaderFooter: true
  headerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#888;font-family:Times New Roman,serif;">AI-Powered Adaptive Learning Advisor Using Elo Rating and Bayesian Knowledge Tracing</div>'
  footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#888;font-family:Times New Roman,serif;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>'
---

<style>
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 11pt;
    line-height: 1.5;
    color: #111;
    max-width: 100%;
  }
  h1 { font-size: 16pt; text-align: center; margin-top: 0; }
  h2 { font-size: 13pt; margin-top: 1.5em; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  h3 { font-size: 11.5pt; margin-top: 1.2em; }
  h4 { font-size: 11pt; font-style: italic; margin-top: 1em; }
  p { text-align: justify; margin: 0.5em 0; }
  table { width: 100%; border-collapse: collapse; margin: 1em 0; font-size: 10pt; }
  th, td { border: 1px solid #555; padding: 6px 8px; text-align: left; }
  th { background: #e8e8e8; font-weight: bold; }
  caption { font-size: 10pt; font-style: italic; margin-bottom: 4px; text-align: center; }
  code { font-family: "Courier New", monospace; font-size: 9.5pt; background: #f4f4f4; padding: 1px 4px; }
  pre { background: #f4f4f4; padding: 12px; font-size: 9pt; line-height: 1.4; border: 1px solid #ddd; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  blockquote { border-left: 3px solid #999; margin: 1em 0; padding: 0.5em 1em; background: #fafafa; font-style: italic; }
  .title-block { text-align: center; margin-bottom: 2em; }
  .title-block h1 { font-size: 18pt; margin-bottom: 0.3em; }
  .title-block p { text-align: center; margin: 0.2em 0; }
  .abstract-box { background: #f9f9f9; border: 1px solid #ddd; padding: 1em 1.2em; margin: 1em 0; }
  .eq { text-align: center; margin: 1em 0; font-family: "Times New Roman", serif; font-size: 11pt; }
  .fig-caption { text-align: center; font-size: 10pt; font-style: italic; margin: 0.5em 0 1.5em 0; }
</style>

<div class="title-block">

# AI-Powered Adaptive Learning Advisor Using Elo Rating and Bayesian Knowledge Tracing

**[Author Name]**
Department of Computer Science / Information Technology
[University Name], [City, Country]

**Supervisor:** [Supervisor Name and Title]

**Date:** September 2026

</div>

---

## Abstract

<div class="abstract-box">

The rapid growth of online education has created an urgent need for personalized learning experiences that adapt to individual learner abilities, knowledge gaps, and learning pace. Traditional e-learning platforms employ static curricula and fixed-difficulty assessments, failing to account for the substantial heterogeneity in learner preparedness, prior knowledge, and cognitive capacity. This paper presents the design and implementation of an **AI-Powered Adaptive Learning Advisor**, an intelligent web-based platform that generates personalized learning roadmaps and continuously adapts assessment difficulty and content recommendations based on real-time learner performance data.

The proposed system integrates two well-established adaptive modeling techniques — the **Elo Rating System** and **Bayesian Knowledge Tracing (BKT)** — into a novel hybrid fusion architecture. The Elo component maintains continuous ability estimates for learners and difficulty estimates for assessment questions, replacing static categorical labels (Easy, Medium, Hard) with dynamic numerical ratings that evolve after every interaction. The BKT component tracks fine-grained, concept-level mastery probabilities, providing a detailed map of what each learner knows and does not know.

The principal contribution of this work is the **Elo-BKT Fusion Mechanism**, wherein the expected probability of correctness computed by the Elo model is used to dynamically modulate the Guess and Slip parameters of the BKT update equations. This fusion ensures that evidence from learner responses is weighted according to item difficulty: a correct answer on a question that is difficult relative to the learner's ability provides substantially stronger evidence of concept mastery than a correct answer on a trivially easy question. Conversely, an incorrect answer on an easy question provides stronger negative evidence than an incorrect answer on a genuinely challenging item.

The system is implemented as a full-stack web application using React, Node.js, PostgreSQL, Redis, and NVIDIA NIM for AI-driven roadmap and assessment generation. The adaptive engine operates after every graded assessment attempt, updating learner models in real time and feeding updated parameters back into the content generation pipeline for continuous personalization.

</div>

**Keywords:** Adaptive Learning, Artificial Intelligence, Bayesian Knowledge Tracing, Elo Rating System, Personalized Learning, Intelligent Tutoring Systems, Knowledge Tracing, Educational Technology, Learner Modeling, AI in Education

---

## 1. Introduction

The proliferation of digital learning platforms over the past decade has fundamentally transformed how individuals acquire knowledge and develop skills [Citation Required]. Massive Open Online Courses (MOOCs), corporate training platforms, and self-directed learning tools have made high-quality educational content accessible to millions of learners worldwide. However, this democratization of access has exposed a critical limitation: the overwhelming majority of online learning systems deliver a uniform experience to all users, regardless of their prior knowledge, learning speed, cognitive style, or individual goals [Citation Required].

In traditional classroom settings, experienced educators adapt their instruction based on continuous observation of student understanding — adjusting the pace of instruction, providing additional examples for struggling students, and offering advanced challenges for high-performing ones. This natural adaptive behavior is largely absent from most digital learning environments, which present the same sequence of content, the same assessments at the same difficulty level, and the same progression path to every learner [Citation Required].

The consequences of this one-size-fits-all approach are well documented in educational research. Learners who find material too easy become disengaged and unmotivated, while those who encounter material that exceeds their current ability level experience frustration, cognitive overload, and ultimately abandonment [Citation Required]. Research in educational psychology, particularly Vygotsky's Zone of Proximal Development and Csikszentmihalyi's Flow Theory, suggests that optimal learning occurs when the challenge level is calibrated to slightly exceed the learner's current ability — difficult enough to promote growth, but not so difficult as to cause discouragement [Citation Required].

**Adaptive learning systems** attempt to address this fundamental mismatch by dynamically adjusting the learning experience based on real-time learner performance data. These systems model the learner's current knowledge state, estimate the difficulty of assessment items, and use these models to select appropriate content and questions [Citation Required]. However, existing adaptive systems typically employ either simplistic rule-based difficulty tiers (Easy, Medium, Hard) or sophisticated but isolated modeling techniques that capture only one dimension of the learner's state.

This paper presents the **AI Learning Advisor**, an intelligent, adaptive learning platform that combines two complementary modeling approaches — the **Elo Rating System** and **Bayesian Knowledge Tracing** — into a unified hybrid architecture. The Elo system provides a continuous, global estimate of learner ability and question difficulty, while BKT provides fine-grained, concept-level mastery tracking. The key innovation is a **fusion mechanism** that uses Elo-derived difficulty estimates to dynamically modulate BKT's evidence parameters, creating a more accurate and responsive learner model than either approach could achieve independently.

Additionally, the platform leverages large language models (LLMs) via NVIDIA's NIM inference API to generate personalized learning roadmaps, calibration quizzes, and chapter-level assessments — all tailored to the individual learner's goal, ability level, and identified knowledge gaps.

The remainder of this paper is organized as follows: Section 2 presents the problem statement. Section 3 outlines the objectives. Section 4 reviews related work. Section 5 describes the proposed system architecture. Section 6 details the methodology, including the Elo-BKT fusion algorithm. Section 7 covers database design. Section 8 discusses roadmap generation. Section 9 describes the recommendation engine. Section 10 covers implementation details. Section 11 presents the evaluation plan. Section 12 discusses expected results and limitations. Section 13 identifies contributions. Section 14 outlines future work. Section 15 concludes the paper.

---

## 2. Problem Statement

Despite significant advances in educational technology, several fundamental problems persist in contemporary online learning platforms:

**P1: Generic Learning Roadmaps.** Most platforms offer predefined courses with fixed sequences of topics. A learner pursuing "Full-Stack Web Development" receives the same roadmap regardless of whether they are a complete beginner, have strong server experience but weak client skills, or are an experienced developer seeking to fill specific knowledge gaps. This fails to optimize the learning path for individual needs.

**P2: Static Assessment Difficulty.** Traditional quiz systems assign fixed difficulty labels to questions (e.g., Easy, Medium, Hard). These labels are subjective, assigned at content creation time, and never updated based on actual learner performance data. A question labeled "Medium" may be trivially easy for advanced learners and impossibly difficult for beginners, providing little diagnostic value in either case.

**P3: Inability to Track Concept-Level Mastery.** Conventional systems typically track learning progress at the course or module level (e.g., "Completed Chapter 5"), but fail to model mastery at the concept level. A learner who passes a chapter assessment with 70% may have strong understanding of three concepts but complete ignorance of a fourth. Without concept-level tracking, the system cannot identify or address these specific gaps.

**P4: Absence of Continuous Adaptation.** Most platforms make no attempt to adapt the learning experience based on ongoing performance. Once a roadmap is generated or a course is assigned, it remains fixed regardless of the learner's evolving ability, discovered weaknesses, or changing goals.

**P5: Difficulty Identifying Individual Knowledge Gaps.** Without fine-grained mastery tracking and adaptive assessment, it is extremely difficult for either the system or the learner to identify precisely which concepts require additional study, which are well-understood, and which represent critical prerequisites for future topics.

**P6: Mismatched Content Difficulty.** Learners frequently encounter content that is either too easy (leading to boredom and disengagement) or too difficult (leading to frustration and dropout). This mismatch is a direct consequence of the inability to accurately model learner ability and calibrate content difficulty dynamically.

The proposed system addresses all six of these problems through an integrated approach combining AI-driven content generation with a hybrid adaptive mastery engine.

---

## 3. Objectives

### 3.1 Primary Objective

To design, develop, and evaluate an AI-powered adaptive learning advisor that generates personalized learning roadmaps and continuously adapts assessment difficulty and content recommendations through dynamic learner modeling using a hybrid Elo Rating and Bayesian Knowledge Tracing approach.

### 3.2 Secondary Objectives

1. **Dynamic Learner Ability Estimation:** Implement an Elo-based rating system that continuously estimates each learner's overall ability level as a numerical rating, replacing static categorical labels.

2. **Dynamic Question Difficulty Estimation:** Implement Elo-based difficulty tracking for assessment questions, where question difficulty ratings evolve based on aggregate learner performance.

3. **Concept-Level Mastery Tracking:** Implement Bayesian Knowledge Tracing to maintain per-concept mastery probability estimates for each learner, enabling identification of specific knowledge gaps.

4. **Elo-BKT Fusion:** Design and implement a hybrid algorithm wherein Elo's expected correctness probability dynamically modulates BKT's Guess and Slip parameters, providing difficulty-aware evidence weighting.

5. **Personalized Roadmap Generation:** Leverage large language models to generate structured learning roadmaps calibrated to each learner's stated goal, current ability level, and identified weaknesses.

6. **Knowledge Gap Identification:** Automatically surface concepts with low mastery probabilities (below a configurable threshold) and integrate these into the recommendation and roadmap adaptation pipelines.

7. **Adaptive Content Recommendation:** Select next learning activities (topics, questions, revision material) based on the combined Elo-BKT learner model, ensuring learners work within their optimal challenge zone.

8. **Continuous Model Adaptation:** Update the learner model after every assessment interaction, ensuring that recommendations and difficulty levels reflect the learner's most recent performance.

---

## 4. Literature Review

### 4.1 Intelligent Tutoring Systems

Intelligent Tutoring Systems (ITS) emerged in the 1970s as computer-based systems that model the learner's knowledge state and provide individualized instruction [Citation Required]. Early systems such as SCHOLAR and SOPHIE used rule-based expert models and natural language interaction to teach specific domains. Modern ITS incorporate machine learning techniques for learner modeling, natural language processing for dialogue management, and sophisticated pedagogical strategies for content selection [Citation Required].

Key ITS design principles include: maintaining an explicit learner model, comparing learner knowledge to an expert model, and selecting instructional actions based on the gap between the two [Citation Required]. The proposed Learning Advisor system adopts this framework, using the Elo-BKT hybrid model as its learner model and AI-generated roadmaps as its instructional strategy.

### 4.2 Adaptive Learning Systems

Adaptive learning systems dynamically adjust the presentation, sequence, difficulty, or content of learning materials based on learner characteristics and performance [Citation Required]. These systems range from simple rule-based adaptations (e.g., presenting easier questions after incorrect answers) to sophisticated model-based approaches that maintain detailed learner profiles and use optimization algorithms to select optimal learning paths [Citation Required].

Commercial adaptive learning platforms such as Knewton, DreamBox, and ALEKS have demonstrated that adaptive approaches can improve learning outcomes compared to static instruction [Citation Required]. However, most commercial systems use proprietary algorithms that are not fully disclosed, making it difficult to evaluate their methodological rigor or reproduce their results.

### 4.3 Computerized Adaptive Testing

Computerized Adaptive Testing (CAT) selects test items in real time based on the learner's estimated ability, with the goal of maximizing measurement precision while minimizing the number of items administered [Citation Required]. CAT systems typically use Item Response Theory (IRT) as their underlying measurement model, selecting items whose difficulty is well-matched to the current ability estimate.

While CAT has been widely adopted for standardized assessment (e.g., GRE, GMAT), its application to formative assessment in learning contexts has been more limited. CAT's focus on measurement efficiency does not inherently address learning objectives such as concept mastery tracking, knowledge gap identification, or pedagogical sequencing [Citation Required].

### 4.4 Elo Rating System

The Elo Rating System, originally developed by Arpad Elo for chess player ranking, models the relative strength of competitors through paired comparisons [Citation Required]. In educational contexts, the Elo system has been adapted to model both learner ability and item difficulty on a common scale, where the probability of a correct response depends on the difference between the learner's ability rating and the item's difficulty rating [Citation Required].

The Elo approach offers several advantages for educational applications: it is computationally simple, requires no prior calibration of items, adapts to changing ability levels in real time, and produces continuous rather than categorical estimates. Systems such as Math Garden and Oefenweb.nl have successfully deployed Elo-based adaptive practice environments at scale [Citation Required].

However, the Elo system has notable limitations in educational contexts. It models learner ability as a single global parameter, failing to capture the multi-dimensional nature of knowledge. A learner may be highly proficient in one topic area but weak in another — information that a single Elo rating cannot represent.

### 4.5 Bayesian Knowledge Tracing

Bayesian Knowledge Tracing (BKT), introduced by Corbett and Anderson (1994), models the probability that a learner has mastered a specific knowledge component (concept or skill) as a latent binary variable [Citation Required]. BKT uses a Hidden Markov Model with four parameters:

- **P(L₀):** The initial probability of mastery before any practice.
- **P(T):** The probability of transitioning from unlearned to learned state after a practice opportunity.
- **P(G):** The probability of a correct response despite not having mastered the concept (guessing).
- **P(S):** The probability of an incorrect response despite having mastered the concept (slipping).

BKT has been widely used in intelligent tutoring systems, including Carnegie Learning's Cognitive Tutor and the Open Learning Initiative, to make real-time predictions of learner mastery and determine when a learner is ready to move to the next topic [Citation Required].

A key limitation of standard BKT is that the Guess and Slip parameters are typically treated as fixed constants, estimated from historical data during model calibration. This means that BKT treats all correct answers as equally informative and all incorrect answers as equally informative, regardless of the difficulty of the question that produced them. This is a significant limitation: correctly answering a very difficult question should provide much stronger evidence of mastery than correctly answering a trivially easy one.

### 4.6 Deep Knowledge Tracing

Deep Knowledge Tracing (DKT), introduced by Piech et al. (2015), applies recurrent neural networks (specifically LSTMs) to the knowledge tracing problem, treating the learner's interaction history as a temporal sequence [Citation Required]. DKT can capture complex temporal dependencies and has shown improved prediction accuracy compared to standard BKT in several studies [Citation Required].

However, DKT has its own limitations: it requires large amounts of training data, its internal representations are not easily interpretable (making it difficult to extract actionable pedagogical insights), and it does not explicitly model individual knowledge components in the way that BKT does [Citation Required]. The proposed system prioritizes interpretability and explainability, making BKT's explicit concept-level mastery tracking more suitable for the target application.

### 4.7 Item Response Theory

Item Response Theory (IRT) provides a family of mathematical models for relating the probability of a correct response to latent learner ability and item characteristics [Citation Required]. The most common IRT models (1PL, 2PL, 3PL) estimate item difficulty, discrimination, and guessing parameters from calibration data.

IRT shares conceptual similarities with the Elo approach — both model the probability of a correct response as a function of the difference between ability and difficulty. However, IRT typically requires large pre-calibration datasets and assumes fixed item parameters, whereas Elo allows parameters to evolve dynamically [Citation Required].

### 4.8 Comparative Analysis

<table>
<caption>Table 1: Comparison of Adaptive Learning Approaches</caption>
<tr>
<th>Feature</th>
<th>Traditional LMS</th>
<th>CAT / IRT</th>
<th>Elo-Based</th>
<th>BKT</th>
<th>Proposed Elo-BKT Hybrid</th>
</tr>
<tr>
<td>Learner ability estimation</td>
<td>None</td>
<td>Static (per test)</td>
<td>Dynamic, continuous</td>
<td>Indirect (via mastery)</td>
<td>Dynamic, continuous (Elo)</td>
</tr>
<tr>
<td>Question difficulty</td>
<td>Fixed labels</td>
<td>Pre-calibrated</td>
<td>Dynamic, continuous</td>
<td>Not modeled</td>
<td>Dynamic, continuous (Elo)</td>
</tr>
<tr>
<td>Concept-level mastery</td>
<td>Not tracked</td>
<td>Not tracked</td>
<td>Not tracked</td>
<td>Per-concept P(mastery)</td>
<td>Per-concept P(mastery) (BKT)</td>
</tr>
<tr>
<td>Evidence weighting</td>
<td>N/A</td>
<td>Uniform</td>
<td>Difficulty-aware (global)</td>
<td>Uniform (fixed G, S)</td>
<td>Difficulty-aware (dynamic G, S)</td>
</tr>
<tr>
<td>Real-time adaptation</td>
<td>No</td>
<td>Within test only</td>
<td>Yes</td>
<td>Yes</td>
<td>Yes</td>
</tr>
<tr>
<td>Cold-start handling</td>
<td>N/A</td>
<td>Requires calibration data</td>
<td>Good (rapid convergence)</td>
<td>Requires parameter estimation</td>
<td>Good (defaults + rapid convergence)</td>
</tr>
<tr>
<td>Interpretability</td>
<td>High (simple)</td>
<td>Moderate</td>
<td>High</td>
<td>High</td>
<td>High</td>
</tr>
<tr>
<td>Knowledge gap identification</td>
<td>No</td>
<td>No</td>
<td>No</td>
<td>Yes</td>
<td>Yes (with difficulty context)</td>
</tr>
</table>

As shown in Table 1, the proposed Elo-BKT hybrid system combines the strengths of both approaches while addressing their individual limitations. Elo provides the dynamic difficulty estimation that BKT lacks, while BKT provides the concept-level granularity that Elo cannot offer. The fusion mechanism bridges the two, ensuring that evidence weighting is informed by question difficulty.

---

## 5. Proposed System Architecture

### 5.1 Architecture Overview

The Learning Advisor system follows a layered client-server architecture with clear separation of concerns. The architecture comprises six principal layers: Presentation, API Gateway, Business Logic, AI Orchestration, Adaptive Engine, and Data Persistence.

```
┌───────────────────────────────────────────────────────────────┐
│                    USER (Web Browser)                         │
└──────────────────────────┬────────────────────────────────────┘
                           │
┌──────────────────────────▼────────────────────────────────────┐
│              client APPLICATION (React + Vite)              │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
│  │Onboarding│ │ Roadmap  │ │Assessment│ │Progress Dashboard│  │
│  │  Flow    │ │  View    │ │  View    │ │  & Mastery View  │  │
│  └─────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
└──────────────────────────┬────────────────────────────────────┘
                           │ REST API (JSON)
┌──────────────────────────▼────────────────────────────────────┐
│                server API (Node.js + Express)                │
│  ┌──────┐ ┌──────────┐ ┌──────────┐ ┌───────┐ ┌──────────┐  │
│  │ Auth │ │Onboarding│ │ Roadmap  │ │Assess.│ │  Notes   │  │
│  │Routes│ │  Routes  │ │  Routes  │ │Routes │ │  Routes  │  │
│  └──┬───┘ └────┬─────┘ └────┬─────┘ └───┬───┘ └────┬─────┘  │
│     │          │            │            │          │         │
│  ┌──▼──────────▼────────────▼────────────▼──────────▼─────┐  │
│  │              SERVICE LAYER (Business Logic)            │  │
│  │  ┌────────────┐ ┌────────────┐ ┌───────────────────┐   │  │
│  │  │  Roadmap   │ │ Assessment │ │  Mastery Engine    │   │  │
│  │  │  Service   │ │  Service   │ │  ┌─────────────┐  │   │  │
│  │  │            │ │            │ │  │  Elo Engine  │  │   │  │
│  │  │            │ │            │ │  ├─────────────┤  │   │  │
│  │  │            │ │     ┌──────┼─┤  │  BKT Engine  │  │   │  │
│  │  │            │ │     │      │ │  ├─────────────┤  │   │  │
│  │  │       ◄────┼─┼─────┼──────┼─┤  │  Elo-BKT    │  │   │  │
│  │  │ (weak      │ │     │      │ │  │  Fusion     │  │   │  │
│  │  │  concepts) │ │     │      │ │  ├─────────────┤  │   │  │
│  │  │            │ │     │      │ │  │ Weak Concept│  │   │  │
│  │  │            │ │     │      │ │  │ Detection   │  │   │  │
│  │  └────────────┘ └─────┘      │ │  └─────────────┘  │   │  │
│  │                              │ └───────────────────┘   │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │           AI ORCHESTRATION LAYER                       │  │
│  │  ┌──────────┐  ┌───────────────┐  ┌────────────────┐  │  │
│  │  │ NIM      │  │ Prompt        │  │ Schema         │  │  │
│  │  │ Client   │  │ Templates     │  │ Validation     │  │  │
│  │  │ (OpenAI) │  │ (3 templates) │  │ (Zod)          │  │  │
│  │  └──────────┘  └───────────────┘  └────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │           ASYNC JOB QUEUE (BullMQ + Redis)             │  │
│  │  ┌──────────────┐ ┌────────────────┐ ┌──────────────┐ │  │
│  │  │Roadmap Worker│ │Assessment Worker│ │Diagnostic    │ │  │
│  │  │              │ │                │ │Worker        │ │  │
│  │  └──────────────┘ └────────────────┘ └──────────────┘ │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────┬────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
┌─────────▼──────┐ ┌──────▼──────┐ ┌───────▼──────┐
│  PostgreSQL    │ │   Redis     │ │  S3 / MinIO  │
│  (Primary DB)  │ │  (Queue +   │ │  (File       │
│                │ │   Cache)    │ │   Storage)   │
└────────────────┘ └─────────────┘ └──────────────┘
```

*Figure 1: System Architecture Diagram of the AI Learning Advisor*

### 5.2 Component Responsibilities

**client Application (React + Vite):** Handles all user-facing interactions including onboarding, roadmap visualization, assessment taking, note management, and progress tracking. Communicates exclusively via REST API calls to the server.

**server API (Node.js + Express):** Serves as the central application server, exposing RESTful endpoints for authentication, onboarding, roadmap management, assessment operations, and file management. All routes are protected by JWT authentication middleware.

**Service Layer:** Contains the core business logic, isolated from HTTP concerns. Key services include Roadmap Service (generation, modification, diff/confirm workflow), Assessment Service (generation, grading, status management), and Mastery Service (Elo + BKT engine).

**Mastery Engine:** The adaptive learning engine, detailed in Section 6. Comprises the Elo update module, BKT update module, Elo-BKT fusion mechanism, and weak concept detection.

**AI Orchestration Layer:** Manages all interactions with the NVIDIA NIM inference API, including prompt template construction, response parsing, JSON schema validation (via Zod), and retry logic for malformed AI outputs.

**Async Job Queue (BullMQ):** Handles long-running AI generation tasks (roadmap generation, assessment generation, diagnostic quiz generation) asynchronously. The client polls status endpoints rather than blocking on AI responses.

**Data Persistence:** PostgreSQL serves as the primary relational database (via Prisma ORM). Redis provides the job queue server and caching layer. S3-compatible object storage (MinIO) handles file uploads for learner notes.

---

## 6. Methodology

### 6.1 Learning Goal Analysis

The learning journey begins when a user provides a learning goal in natural language (e.g., "Become a full-stack web developer," "Master cybersecurity fundamentals," or "Learn machine learning for data science"). The system collects three additional data points during onboarding:

1. **Interest Areas:** The learner selects focus areas from a categorized taxonomy (e.g., server & APIs, Data & AI, Security), providing the AI with domain context.
2. **Preparedness Level:** A self-reported assessment of prior experience (Just Starting, Some Exposure, Comfortable).
3. **Diagnostic Score:** An AI-generated calibration quiz establishes a baseline ability estimate.

These inputs are composed into a structured prompt and sent to the NVIDIA NIM API, which generates a hierarchical roadmap of milestones and chapters, each with specific learning objectives calibrated to the learner's diagnosed level.

### 6.2 Calibration Quiz

The calibration (diagnostic) quiz serves as the system's initial assessment of learner ability. The process is as follows:

1. The system generates 8–15 multiple-choice questions spanning the learner's stated goal area, using the AI orchestration pipeline.
2. Questions are designed to span multiple difficulty levels (beginner through intermediate) and multiple sub-concepts of the goal area.
3. The learner's responses are graded server-side, producing a diagnostic score and identifying initial weak concepts.
4. The diagnostic score calibrates the initial difficulty level of the AI-generated roadmap — a learner scoring 80% receives a more advanced starting point than one scoring 30%.

### 6.3 Elo Rating Model

#### 6.3.1 Theoretical Foundation

The Elo Rating System models the interaction between a learner and a question as a paired comparison, analogous to a chess match between two players. Both the learner and the question possess a rating on a common numerical scale, and the probability of a correct answer is a function of the difference between these ratings.

#### 6.3.2 Expected Probability of Correctness

Given a learner with rating *R_L* and a question with rating *R_Q*, the expected probability that the learner answers correctly is:

<div class="eq">

**E(correct) = 1 / (1 + 10<sup>(R_Q − R_L) / 400</sup>)**

</div>

This logistic function has the following properties:
- When *R_L = R_Q* (learner and question are equally rated), *E = 0.5* (50% chance of correctness).
- When *R_L >> R_Q* (learner is much stronger than the question), *E → 1.0*.
- When *R_L << R_Q* (question is much harder than the learner), *E → 0.0*.
- The parameter 400 controls the spread of the function; a 400-point rating difference corresponds to an expected win rate of approximately 91%.

#### 6.3.3 Rating Updates

After the learner responds, both ratings are updated based on the deviation between the expected and actual outcomes:

<div class="eq">

**R_L(new) = R_L(old) + K_L × (actual − expected)**

**R_Q(new) = R_Q(old) + K_Q × (expected − actual)**

</div>

Where:
- *actual* = 1 if correct, 0 if incorrect
- *K_L* = 24 (learner K-factor; higher for faster adaptation)
- *K_Q* = 8 (question K-factor; lower for stability, since many learners attempt each question)

The asymmetric K-factors reflect the fact that learner ability should update rapidly based on individual performance, while question difficulty should update more gradually as it aggregates evidence across many learners.

#### 6.3.4 Worked Example

Consider a learner with rating *R_L = 1200* and a question with rating *R_Q = 1400*:

*Expected = 1 / (1 + 10^((1400 − 1200) / 400)) = 1 / (1 + 10^0.5) = 1 / (1 + 3.162) = 0.240*

The learner has only a 24% chance of answering correctly — this is a difficult question for them.

**If the learner answers correctly (upset):**
- *R_L(new) = 1200 + 24 × (1 − 0.240) = 1200 + 18.2 = 1218.2* (large gain — unexpected success)
- *R_Q(new) = 1400 + 8 × (0.240 − 1) = 1400 − 6.1 = 1393.9* (question was easier than expected)

**If the learner answers incorrectly (expected):**
- *R_L(new) = 1200 + 24 × (0 − 0.240) = 1200 − 5.8 = 1194.2* (small loss — expected outcome)
- *R_Q(new) = 1400 + 8 × (0.240 − 0) = 1400 + 1.9 = 1401.9* (question difficulty confirmed)

This asymmetry is a desirable property: surprising outcomes produce large rating changes, while expected outcomes produce small changes, enabling rapid convergence to accurate estimates.

### 6.4 Bayesian Knowledge Tracing

#### 6.4.1 Theoretical Foundation

Bayesian Knowledge Tracing models the learner's knowledge of a specific concept as a latent binary variable — either the learner has mastered the concept (*L = 1*) or has not (*L = 0*). The model uses a Hidden Markov Model with observations (correct/incorrect responses) to infer the hidden mastery state.

#### 6.4.2 BKT Parameters

The standard BKT model uses four parameters:

| Parameter | Symbol | Description | Typical Range |
|-----------|--------|-------------|---------------|
| Initial mastery | P(L₀) | Probability of mastery before any practice | 0.1 – 0.5 |
| Learning rate | P(T) | Probability of transitioning to mastered state | 0.05 – 0.2 |
| Guess probability | P(G) | Probability of correct answer when not mastered | 0.1 – 0.4 |
| Slip probability | P(S) | Probability of incorrect answer when mastered | 0.05 – 0.2 |

In the proposed system, the default initial mastery P(L₀) is set to 0.30, reflecting a conservative assumption that the learner begins with limited mastery. The learning rate P(T) is fixed at 0.10.

#### 6.4.3 Bayesian Update Equations

Given a prior mastery probability *P(L_n)* and an observed response, the posterior mastery probability is computed as follows:

**On a correct response:**

<div class="eq">

**P(L_n | correct) = P(L_n) × (1 − P(S)) / [P(L_n) × (1 − P(S)) + (1 − P(L_n)) × P(G)]**

</div>

**On an incorrect response:**

<div class="eq">

**P(L_n | incorrect) = P(L_n) × P(S) / [P(L_n) × P(S) + (1 − P(L_n)) × (1 − P(G))]**

</div>

After computing the posterior, the learning transition is applied:

<div class="eq">

**P(L_{n+1}) = P(L_n | response) + (1 − P(L_n | response)) × P(T)**

</div>

This transition accounts for the possibility that the learner acquires mastery simply by engaging with the question, regardless of the outcome.

### 6.5 Elo-BKT Fusion Algorithm

#### 6.5.1 The Core Innovation

The principal methodological contribution of this work is the **Elo-BKT Fusion Mechanism**. In standard BKT, the Guess and Slip probabilities are fixed constants estimated from historical data. This means that every correct answer is treated as equally strong evidence of mastery, regardless of whether the question was trivially easy or extremely difficult for the learner.

This is a significant shortcoming. Intuitively:
- A correct answer on a question where the learner had only a 10% chance of success (per Elo) provides much stronger evidence of mastery than a correct answer on a question where they had a 90% chance.
- An incorrect answer on a question where the learner had a 90% chance of success provides much stronger evidence of *non-mastery* than an incorrect answer on a question where they had only a 10% chance.

The proposed fusion mechanism addresses this by dynamically deriving the Guess and Slip probabilities from the Elo expected correctness:

<div class="eq">

**P(G) = P(G_base) × E(correct)**

**P(S) = P(S_base) × (1 − E(correct))**

</div>

Where:
- *P(G_base)* = 0.25 (base guess probability for 4-option MCQs)
- *P(S_base)* = 0.10 (base slip probability)
- *E(correct)* is the Elo-derived expected probability of correctness

#### 6.5.2 Why This Works

**Hard question (low expected correctness, e.g., E = 0.10):**
- *P(G) = 0.25 × 0.10 = 0.025* — very low guess probability
- *P(S) = 0.10 × 0.90 = 0.090* — moderate slip probability
- **Effect:** If the learner answers correctly, the low P(G) means guessing is nearly ruled out, so the correct answer provides very strong evidence of mastery. If the learner answers incorrectly, the higher P(S) makes it somewhat forgivable — the question was hard, so slipping is more plausible.

**Easy question (high expected correctness, e.g., E = 0.90):**
- *P(G) = 0.25 × 0.90 = 0.225* — substantial guess probability
- *P(S) = 0.10 × 0.10 = 0.010* — very low slip probability
- **Effect:** If the learner answers correctly, the higher P(G) means some of the evidence is "absorbed" by the possibility of guessing — the correct answer is weaker evidence. If the learner answers incorrectly, the very low P(S) means slipping is nearly impossible, so the incorrect answer provides very strong evidence of non-mastery.

This creates a coherent difficulty-aware evidence weighting system where the information content of each response is proportional to how surprising it is given the difficulty of the question.

#### 6.5.3 Complete Algorithm Pseudocode

```
FUNCTION RunMasteryEngine(learner, gradedAnswers, questions):

    // ─── Phase 1: Elo Updates (per question) ───────────────
    FOR EACH answer IN gradedAnswers:
        question = questions[answer.questionId]

        expected = EloExpected(
            learner.rating,
            question.eloRating
        )
        actual = 1 IF answer.isCorrect ELSE 0

        // Update learner rating
        learner.rating += K_LEARNER × (actual - expected)

        // Update question difficulty
        question.eloRating += K_QUESTION × (expected - actual)

        // Accumulate per-concept evidence
        AccumulateConceptEvidence(
            answer.conceptTag,
            expected,
            answer.isCorrect
        )
    END FOR

    // ─── Phase 2: BKT Updates (per concept) ─────────────────
    FOR EACH concept IN accumulatedConcepts:
        avgExpected = concept.totalExpected / concept.count
        majorityCorrect = concept.correctCount > concept.count / 2

        priorMastery = GetConceptMastery(
            learner.id,
            concept.tag
        )

        // ── Elo-BKT Fusion Point ────────────────────────────
        dynamicGuess = BASE_GUESS × avgExpected
        dynamicSlip  = BASE_SLIP  × (1 - avgExpected)

        // ── Bayesian Posterior Update ────────────────────────
        IF majorityCorrect:
            numerator   = priorMastery × (1 - dynamicSlip)
            denominator = numerator + (1 - priorMastery) × dynamicGuess
            posterior   = numerator / denominator
        ELSE:
            numerator   = priorMastery × dynamicSlip
            denominator = numerator + (1 - priorMastery) × (1 - dynamicGuess)
            posterior   = numerator / denominator
        END IF

        // ── Learning Transition ─────────────────────────────
        newMastery = posterior + (1 - posterior) × P_TRANSIT

        // ── Persist ─────────────────────────────────────────
        UpdateConceptMastery(
            learner.id,
            concept.tag,
            CLAMP(newMastery, 0, 1)
        )
    END FOR

    // ─── Phase 3: Persist Updated Ratings ───────────────────
    PersistLearnerRating(learner)
    PersistQuestionRatings(questions)

    RETURN updatedLearnerModel
END FUNCTION
```

*Figure 2: Pseudocode for the Elo-BKT Fusion Mastery Engine*

#### 6.5.4 Numerical Validation

The following table demonstrates the fusion mechanism's behavior across different scenarios, starting from a prior mastery of 0.30 and a learner rating of 1200:

<table>
<caption>Table 2: Elo-BKT Fusion Behavior Across Difficulty Scenarios</caption>
<tr>
<th>Scenario</th>
<th>Q. Elo</th>
<th>Expected</th>
<th>P(G)</th>
<th>P(S)</th>
<th>Outcome</th>
<th>New Mastery</th>
<th>Interpretation</th>
</tr>
<tr>
<td>Easy, Correct</td>
<td>800</td>
<td>0.909</td>
<td>0.227</td>
<td>0.009</td>
<td>Correct</td>
<td>0.686</td>
<td>Moderate boost — expected outcome</td>
</tr>
<tr>
<td>Medium, Correct</td>
<td>1200</td>
<td>0.500</td>
<td>0.125</td>
<td>0.050</td>
<td>Correct</td>
<td>0.826</td>
<td>Strong boost — moderate surprise</td>
</tr>
<tr>
<td>Hard, Correct</td>
<td>1600</td>
<td>0.091</td>
<td>0.023</td>
<td>0.091</td>
<td>Correct</td>
<td>0.950</td>
<td>Very strong boost — highly surprising</td>
</tr>
<tr>
<td>Easy, Incorrect</td>
<td>800</td>
<td>0.909</td>
<td>0.227</td>
<td>0.009</td>
<td>Incorrect</td>
<td>0.113*</td>
<td>Severe penalty — very surprising</td>
</tr>
<tr>
<td>Hard, Incorrect</td>
<td>1600</td>
<td>0.091</td>
<td>0.023</td>
<td>0.091</td>
<td>Incorrect</td>
<td>0.177*</td>
<td>Moderate penalty — expected outcome</td>
</tr>
</table>

*\* Incorrect scenarios use prior mastery of 0.50 for clearer demonstration.*

As Table 2 demonstrates, the fusion mechanism produces intuitively correct behavior: surprising outcomes (correct on hard, incorrect on easy) produce larger mastery changes than expected outcomes (correct on easy, incorrect on hard). This is precisely the difficulty-aware evidence weighting that standard BKT with fixed parameters cannot achieve.

---

## 7. Database Design

### 7.1 Entity Overview

The system's data model comprises twelve primary entities organized around five functional domains: User Management, Learning Structure, Assessment, Adaptive Engine, and Job Management.

<table>
<caption>Table 3: Database Entity Summary</caption>
<tr><th>Entity</th><th>Purpose</th><th>Key Fields</th></tr>
<tr><td>User</td><td>Account and authentication</td><td>id, email, password_hash, created_at</td></tr>
<tr><td>UserProfile</td><td>Learning preferences and diagnostic results</td><td>user_id, goal, interest_tags[], preparedness, diagnostic_score, diagnostic_weak_concepts[]</td></tr>
<tr><td>Roadmap</td><td>Top-level learning plan</td><td>id, user_id, status (active/archived), version</td></tr>
<tr><td>Milestone</td><td>Major stage within a roadmap</td><td>id, roadmap_id, order, title, status (locked/active/completed)</td></tr>
<tr><td>Chapter</td><td>Individual learning unit</td><td>id, milestone_id, order, title, objectives[], status</td></tr>
<tr><td>ChapterNote</td><td>User-uploaded study materials</td><td>id, chapter_id, user_id, file_url, content_text</td></tr>
<tr><td>Assessment</td><td>Set of MCQs for a chapter</td><td>id, chapter_id, difficulty, generated_at</td></tr>
<tr><td>Question</td><td>Individual MCQ item</td><td>id, assessment_id, text, options[4], correct_index, concept_tag, explanation, elo_rating</td></tr>
<tr><td>Attempt</td><td>Graded assessment submission</td><td>id, user_id, assessment_id, score, answers (JSONB), passed</td></tr>
<tr><td>LearnerRating</td><td>Elo ability estimate</td><td>user_id (PK), rating (default 1200)</td></tr>
<tr><td>ConceptMastery</td><td>BKT mastery per concept</td><td>user_id, concept_tag (unique pair), p_mastery (default 0.30)</td></tr>
<tr><td>GenerationJob</td><td>Async AI task tracking</td><td>id, type, status (pending/ready/failed), result_ref, error</td></tr>
<tr><td>RoadmapChangeLog</td><td>Modification audit trail</td><td>id, roadmap_id, version_from, version_to, diff_json, user_prompt</td></tr>
</table>

### 7.2 Entity Relationships

```
User ──1:1──► UserProfile
User ──1:N──► Roadmap
User ──1:N──► Attempt
User ──1:1──► LearnerRating
User ──1:N──► ConceptMastery
User ──1:N──► ChapterNote

Roadmap ──1:N──► Milestone
Roadmap ──1:N──► RoadmapChangeLog

Milestone ──1:N──► Chapter

Chapter ──1:N──► Assessment
Chapter ──1:N──► ChapterNote

Assessment ──1:N──► Question
Assessment ──1:N──► Attempt
```

*Figure 3: Entity Relationship Diagram*

### 7.3 Backward Compatibility

The LearnerRating and ConceptMastery tables are designed with upsert-on-first-access semantics. Existing users who registered before the mastery engine was deployed automatically receive default values (rating = 1200, p_mastery = 0.30) on their first assessment attempt, ensuring full backward compatibility with no data migration required.

---

## 8. Personalized Roadmap Generation

### 8.1 Generation Process

The roadmap generation pipeline proceeds as follows:

1. The learner's profile (goal, interests, preparedness, diagnostic score) is composed into a structured prompt.
2. The prompt is sent to the NVIDIA NIM API with a system prompt that instructs the model to act as a curriculum architect.
3. The model generates a hierarchical structure: Milestones → Chapters → Learning Objectives.
4. The response is validated against a predefined JSON schema using Zod.
5. If validation fails, the system retries once with a corrective prompt; if it fails again, the job is marked as failed.
6. The validated roadmap is persisted transactionally to the database.

### 8.2 Calibration to Learner Level

The diagnostic score directly influences the roadmap's starting point and depth. A learner scoring 80% on the calibration quiz receives a roadmap that skips foundational topics and begins at an intermediate level, while a learner scoring 30% receives a roadmap with comprehensive foundational coverage.

### 8.3 Example Roadmap

**Goal: Become a Cybersecurity Professional**

| Stage | Milestone | Representative Chapters | Rationale |
|-------|-----------|------------------------|-----------|
| 1 | Networking Fundamentals | TCP/IP Model, DNS & HTTP, Network Protocols | Foundation layer — prerequisite for all security topics |
| 2 | Linux Fundamentals | Command Line Mastery, File System & Permissions, Process Management | Most security tools run on Linux |
| 3 | Cybersecurity Principles | CIA Triad, Threat Modeling, Risk Assessment | Conceptual framework for security thinking |
| 4 | Web Security | OWASP Top 10, XSS & CSRF, SQL Injection | Most common attack surface |
| 5 | Network Security | Firewalls & IDS, VPNs & Tunneling, Packet Analysis | Defending network infrastructure |
| 6 | Ethical Hacking | Reconnaissance, Vulnerability Scanning, Exploitation Basics | Offensive security fundamentals |
| 7 | Advanced Security | Incident Response, Forensics, Security Architecture | Senior-level competencies |

A learner with strong networking knowledge (high mastery on networking concepts from the calibration quiz) would receive a roadmap that begins at Stage 3, bypassing Stages 1-2.

### 8.4 Adaptive Roadmap Modification

When the learner requests a roadmap modification, the system injects their current weak concepts (p_mastery < 0.6) into the AI's prompt context. The AI is instructed to proactively suggest reinforcement chapters for weak concepts, even if the learner did not explicitly request them. All modifications follow a diff-and-confirm pattern: the AI proposes changes, the user reviews and explicitly confirms or rejects them, and only confirmed changes are applied transactionally.

---

## 9. Adaptive Recommendation Engine

### 9.1 Recommendation Factors

The recommendation engine selects the next learning activity based on multiple factors derived from the Elo-BKT model:

1. **Low Concept Mastery:** Concepts with p_mastery below 0.6 are flagged as weak and prioritized for reinforcement.
2. **Elo Rating Gap:** The difference between the learner's current rating and the difficulty of available questions determines which questions are most informative (maximizing information gain by selecting questions near the learner's ability level).
3. **Learning Dependencies:** The roadmap's sequential structure ensures prerequisite topics are mastered before advancing.
4. **Previous Mistakes:** Concepts associated with incorrect answers in recent attempts are prioritized for review.
5. **Mastery Trajectory:** Concepts whose mastery is declining (or stagnant despite practice) receive additional attention.

### 9.2 Difficulty Selection for MCQ Generation

When generating new assessment questions, the learner's current Elo rating is converted to a 1–5 difficulty scale using the following mapping:

<table>
<caption>Table 4: Elo Rating to Difficulty Level Mapping</caption>
<tr><th>Elo Rating Range</th><th>Difficulty Level</th><th>Prompt Label</th></tr>
<tr><td>≤ 900</td><td>1</td><td>Easy (beginner)</td></tr>
<tr><td>901 – 1100</td><td>2</td><td>Easy-Medium</td></tr>
<tr><td>1101 – 1300</td><td>3</td><td>Medium (intermediate)</td></tr>
<tr><td>1301 – 1500</td><td>4</td><td>Medium-Hard</td></tr>
<tr><td>≥ 1501</td><td>5</td><td>Hard (advanced)</td></tr>
</table>

This mapping is passed to the NIM MCQ generation prompt, ensuring that question difficulty tracks the learner's evolving ability. Each generated question is also seeded with an initial Elo rating corresponding to its difficulty level (e.g., difficulty 3 → elo_rating 1200), which then evolves based on actual learner performance.

---

## 10. System Implementation

### 10.1 client Implementation

The client is built with **React** (using Vite as the build tool) and implements a single-page application architecture. Key views include:

- **Onboarding Flow:** Multi-step wizard collecting learning goal, interest areas, preparedness level, and administering the diagnostic quiz.
- **Roadmap View:** Interactive visualization of milestones and chapters with progress indicators and status tracking.
- **Assessment View:** MCQ presentation with server-side grading and result display including per-question explanations.
- **Progress Dashboard:** Visualization of concept mastery levels and learning trajectory.

The client communicates with the server exclusively via RESTful API calls, using JWT tokens for authentication. Long-running operations (roadmap generation, assessment generation) are handled through polling patterns.

### 10.2 server API Architecture

The server follows a layered architecture:

- **Routes Layer:** Express.js route handlers that validate input (Zod schemas), call service methods, and format HTTP responses.
- **Service Layer:** Business logic implementation, decoupled from HTTP concerns. Services coordinate between the database, job queue, AI orchestration, and mastery engine.
- **Middleware:** JWT authentication, request validation, and global error handling.

### 10.3 Database Implementation

**PostgreSQL** serves as the primary data store, accessed via **Prisma ORM**. Prisma provides type-safe database access, automatic migration generation, and a declarative schema definition language. The schema enforces referential integrity through foreign key constraints and cascading deletes.

### 10.4 Redis Usage

Redis serves dual purposes:
1. **Job Queue server:** BullMQ uses Redis as its message broker for asynchronous job processing.
2. **Connection Management:** Redis manages the lifecycle of background workers and provides reliable job delivery with retry semantics.

### 10.5 AI Integration

All AI interactions use the NVIDIA NIM inference API via an OpenAI-compatible chat completions endpoint. The system implements three prompt templates:

1. **Roadmap Generation:** Produces a hierarchical milestone/chapter/objectives structure.
2. **MCQ Generation:** Produces tagged, explained multiple-choice questions at a specified difficulty level.
3. **Roadmap Modification Diff:** Produces a constrained set of edit operations (add, remove, edit, reorder) given the current roadmap and user request.

Each template includes strict JSON schema validation, automatic retry with corrective prompts on malformed output, and markdown fence stripping.

### 10.6 Adaptive Engine Implementation

The mastery engine is implemented in a dedicated service module (`mastery.service.js`) containing:

- `runMasteryEngine()` — Executes the complete Elo + BKT update pipeline within a single database transaction.
- `getLearnerRating()` — Retrieves or initializes the learner's Elo rating.
- `getWeakConcepts()` — Queries ConceptMastery for tags below the weak threshold.
- `ratingToDifficulty()` / `difficultyToElo()` — Bidirectional mapping between continuous Elo ratings and discrete difficulty levels.

The engine runs after every graded assessment attempt, is non-blocking (failure does not prevent the learner from receiving their graded result), and executes within a single Prisma transaction to ensure atomicity.

---

## 11. Experimental Evaluation Plan

### 11.1 Evaluation Methodology

As the system is presented as a proposed implementation, this section describes the planned evaluation methodology rather than completed experimental results. All experimental results would need to be obtained through controlled user studies with appropriate institutional ethical approval.

### 11.2 Evaluation Metrics

<table>
<caption>Table 5: Proposed Evaluation Metrics</caption>
<tr><th>Metric</th><th>Definition</th><th>Measurement Method</th></tr>
<tr><td>Prediction Accuracy (AUC)</td><td>Accuracy of predicting correct/incorrect responses</td><td>Hold-out test set; area under ROC curve</td></tr>
<tr><td>Mastery Estimation Accuracy</td><td>Agreement between estimated mastery and post-test scores</td><td>Correlation between p_mastery and independent assessment scores</td></tr>
<tr><td>Question Difficulty Calibration</td><td>Agreement between Elo difficulty and observed pass rates</td><td>Correlation between question elo_rating and empirical difficulty</td></tr>
<tr><td>Learning Gain</td><td>Improvement in assessment scores over time</td><td>Pre-test vs. post-test normalized gain</td></tr>
<tr><td>Completion Rate</td><td>Proportion of learners completing their roadmap</td><td>Database query on roadmap/milestone/chapter status</td></tr>
<tr><td>Engagement</td><td>Frequency and duration of platform usage</td><td>Session logs, time-on-task metrics</td></tr>
<tr><td>Recommendation Relevance</td><td>Learner satisfaction with recommended next activities</td><td>Likert-scale survey responses</td></tr>
</table>

### 11.3 Comparative Baselines

The proposed evaluation would compare four conditions:

- **Baseline A (Static):** Fixed roadmap, fixed difficulty questions, no adaptation.
- **Baseline B (Elo Only):** Dynamic difficulty via Elo, but no concept-level mastery tracking.
- **Baseline C (BKT Only):** Concept-level mastery tracking with fixed Guess/Slip parameters.
- **Proposed Model (Elo-BKT Fusion):** Full hybrid system with dynamic Guess/Slip derived from Elo.

### 11.4 Hypothesized Outcomes

Based on the theoretical analysis presented in Section 6.5, the proposed Elo-BKT fusion model is expected to outperform all three baselines on prediction accuracy and mastery estimation accuracy, as the dynamic evidence weighting provides more informative updates than either fixed parameters (BKT) or global-only tracking (Elo). Learning gain and engagement are expected to improve due to better difficulty calibration and more targeted content recommendations.

> **Note:** These are hypothesized outcomes based on theoretical analysis. Actual experimental validation is required to confirm these expectations and would constitute important future work.

---

## 12. Expected Results and Discussion

### 12.1 Expected Benefits

**More Accurate Learner Modeling:** The combination of global ability tracking (Elo) and concept-level mastery tracking (BKT) provides a more complete picture of the learner's knowledge state than either approach alone.

**Better Difficulty Adaptation:** Dynamic Elo ratings replace static difficulty labels, ensuring that question difficulty reflects actual learner performance rather than subjective author estimates.

**Improved Concept Mastery Tracking:** The difficulty-aware evidence weighting from the fusion mechanism is expected to produce more accurate mastery estimates, particularly for concepts tested with questions of varying difficulty.

**Better Personalization:** The combined model enables personalization at multiple levels: global difficulty calibration (Elo), concept-specific content selection (BKT), and proactive identification of knowledge gaps (weak concept detection).

**Improved Learner Engagement:** By maintaining content difficulty within the learner's zone of proximal development, the system is expected to reduce both frustration (content too hard) and boredom (content too easy).

### 12.2 Potential Limitations

**Cold-Start Problem:** Both Elo and BKT require several interactions before producing reliable estimates. The diagnostic quiz partially addresses this, but early recommendations may be suboptimal. The system mitigates this by using conservative default values (Elo = 1200, p_mastery = 0.30).

**Initial Elo Rating Uncertainty:** With limited data, Elo ratings have high variance. The chosen K-factors (K_L = 24, K_Q = 8) represent a balance between responsiveness and stability, but may require tuning for specific educational contexts.

**BKT Parameter Calibration:** The base Guess (0.25) and Slip (0.10) parameters, while theoretically motivated (0.25 corresponds to random guessing on 4-option MCQs), may not be optimal for all content domains. These parameters should be empirically validated and potentially calibrated per domain.

**Concept Tagging Quality:** The accuracy of BKT mastery estimates depends heavily on the quality and consistency of concept tags assigned to questions by the AI. Inconsistent or overly broad tagging would degrade concept-level tracking.

**Sparse Learner Data:** Concepts tested by only one or two questions provide limited evidence for BKT updates. The system addresses this partially through the majority-vote aggregation when multiple questions test the same concept within a single assessment.

**AI-Generated Content Quality:** The quality of roadmaps, questions, and distractors depends on the underlying language model. Hallucinated content, factual errors, or poorly constructed distractors could undermine the educational value of the system.

**Fairness and Bias:** The AI components may introduce biases present in their training data. Content generation prompts should be carefully designed to ensure equitable treatment across learner demographics and subject areas.

**Privacy Concerns:** The system collects detailed behavioral data (response patterns, mastery estimates, learning trajectories). Appropriate data protection measures, consent mechanisms, and data minimization practices are essential.

---

## 13. Novelty and Contribution

The proposed contributions of this project are:

**Contribution 1: Dynamic Learner and Question Modeling.** The system implements an Elo-based rating system that maintains continuous, evolving estimates of both learner ability and question difficulty, replacing the static categorical labels common in conventional learning platforms.

**Contribution 2: Concept-Level Mastery Tracking.** The integration of Bayesian Knowledge Tracing provides fine-grained, per-concept mastery probabilities, enabling precise identification of knowledge gaps that global ability metrics cannot capture.

**Contribution 3: Elo-BKT Fusion Mechanism.** The proposed contribution of this project is a hybrid integration wherein Elo's expected correctness probability is used to dynamically modulate BKT's Guess and Slip parameters. This work investigates whether this fusion produces more accurate and contextually appropriate mastery updates than standard BKT with fixed parameters. The dynamic parameter estimation formulas (P(G) = P(G_base) × expected; P(S) = P(S_base) × (1 − expected)) are proposed model design choices that should be experimentally validated and calibrated using learner interaction data.

**Contribution 4: End-to-End Adaptive Learning Platform.** The integration of AI-generated personalized roadmaps, adaptive assessment, and the hybrid mastery engine into a complete, functional web application demonstrates the practical feasibility of the proposed approach.

> **Academic Caution:** The claim of novelty for the Elo-BKT fusion mechanism is limited to the specific formulation proposed in this work. While the general idea of combining ability-based and knowledge-tracing models has been explored in the literature [Citation Required], the specific mechanism of deriving BKT parameters from Elo expected correctness, as implemented here, represents a proposed variation that requires thorough empirical validation to establish its advantages over alternative approaches. A comprehensive literature search should be conducted to verify the originality of this specific formulation.

---

## 14. Limitations and Future Work

### 14.1 Current Limitations

- The system has not yet been validated with real learner populations in controlled experimental conditions.
- The Elo-BKT fusion parameter functions are proposed design choices that may require domain-specific calibration.
- The concept tagging relies entirely on AI generation quality and consistency.
- The system does not currently model forgetting over time.

### 14.2 Future Work

1. **Deep Knowledge Tracing Comparison:** Implement a DKT baseline using LSTMs or Transformers and compare prediction accuracy against the proposed Elo-BKT hybrid.

2. **Neural Knowledge Tracing:** Explore attention-based architectures (e.g., AKT, SAINT) that can model complex temporal dependencies in learner behavior.

3. **Reinforcement Learning for Recommendations:** Formulate content selection as a reinforcement learning problem, where the agent learns to select optimal sequences of learning activities to maximize long-term mastery.

4. **Multi-Concept Questions:** Extend the BKT model to handle questions that test multiple concepts simultaneously, using multi-dimensional knowledge tracing frameworks.

5. **Forgetting Curves:** Integrate spaced repetition and forgetting curve models (e.g., Ebbinghaus decay) to account for memory decay and schedule optimal review timing.

6. **Time-Aware BKT:** Incorporate response time as an additional evidence signal in the BKT update, as faster correct responses may indicate stronger mastery than slower correct responses.

7. **Explainable AI:** Develop learner-facing explanations of why specific content is recommended, showing the relationship between concept mastery estimates and content selection decisions.

8. **Large-Scale Validation:** Conduct controlled user studies with diverse learner populations across multiple domains to validate the effectiveness of the Elo-BKT fusion approach.

9. **A/B Testing Framework:** Implement infrastructure for running controlled experiments comparing different fusion parameter configurations and alternative adaptive algorithms.

10. **Learning Analytics Dashboard:** Develop instructor-facing analytics showing aggregate learner performance, common misconceptions, and question quality metrics derived from Elo difficulty evolution.

---

## 15. Conclusion

This paper has presented the design and implementation of an AI-Powered Adaptive Learning Advisor, an intelligent platform that generates personalized learning roadmaps and continuously adapts to individual learner performance through a hybrid Elo Rating and Bayesian Knowledge Tracing mastery engine.

The central challenge addressed by this work is the inadequacy of static, one-size-fits-all learning systems in serving the diverse needs of self-directed learners. By combining the Elo Rating System's continuous ability and difficulty estimation with Bayesian Knowledge Tracing's concept-level mastery tracking, the proposed system captures both the global ability dimension and the fine-grained concept dimension of learner knowledge.

The principal methodological contribution is the Elo-BKT Fusion Mechanism, which dynamically derives BKT's Guess and Slip probabilities from Elo's expected correctness, ensuring that the evidence weight of each learner response is proportional to how surprising it is given the question's difficulty relative to the learner's ability. Numerical analysis confirms that this fusion produces intuitively correct behavior: correct answers on difficult questions provide stronger mastery evidence than correct answers on easy questions, and incorrect answers on easy questions produce stronger negative evidence than incorrect answers on difficult questions.

The system has been implemented as a full-stack web application integrating React, Node.js, PostgreSQL, Redis, and NVIDIA NIM for AI-driven content generation. The architecture supports asynchronous AI generation, structured diff-and-confirm roadmap modification, and real-time mastery model updates after every assessment interaction.

Future work will focus on empirical validation with real learner populations, comparison against deep learning-based knowledge tracing approaches, and extension of the mastery model to incorporate forgetting curves and multi-concept questions. The proposed system demonstrates the practical feasibility of integrating traditional psychometric modeling techniques with modern AI capabilities to create genuinely adaptive, personalized learning experiences.

---

## References

> **Note:** The following are suggested reference categories and foundational works that should be independently verified before submission. Citation placeholders [Citation Required] throughout the document should be replaced with verified sources.

### References to be Verified

**Elo Rating System:**
- Elo, A. E. (1978). *The Rating of Chessplayers, Past and Present.* Arco Publishing.
- Pelánek, R. (2016). Applications of the Elo rating system in adaptive educational systems. *Computers & Education.*

**Bayesian Knowledge Tracing:**
- Corbett, A. T., & Anderson, J. R. (1994). Knowledge tracing: Modeling the acquisition of procedural knowledge. *User Modeling and User-Adapted Interaction.*

**Deep Knowledge Tracing:**
- Piech, C., et al. (2015). Deep knowledge tracing. *Advances in Neural Information Processing Systems.*

**Item Response Theory:**
- Lord, F. M. (1980). *Applications of Item Response Theory to Practical Testing Problems.* Erlbaum.

**Adaptive Learning Systems:**
- Brusilovsky, P., & Peylo, C. (2003). Adaptive and intelligent web-based educational systems. *International Journal of Artificial Intelligence in Education.*

**Intelligent Tutoring Systems:**
- VanLehn, K. (2011). The relative effectiveness of human tutoring, intelligent tutoring systems, and other tutoring systems. *Educational Psychologist.*

**Zone of Proximal Development:**
- Vygotsky, L. S. (1978). *Mind in Society: The Development of Higher Psychological Processes.* Harvard University Press.

**Flow Theory:**
- Csikszentmihalyi, M. (1990). *Flow: The Psychology of Optimal Experience.* Harper & Row.

**Computerized Adaptive Testing:**
- van der Linden, W. J., & Glas, C. A. W. (Eds.). (2000). *Computerized Adaptive Testing: Theory and Practice.* Springer.

**Educational Technology:**
- Luckin, R., et al. (2016). Intelligence Unleashed: An argument for AI in Education. *Pearson Education.*

---

*This document is a Final Year Project research paper. Experimental validation of the proposed Elo-BKT fusion mechanism has not yet been completed. All claims of novelty and effectiveness should be understood as proposed contributions pending empirical validation.*
