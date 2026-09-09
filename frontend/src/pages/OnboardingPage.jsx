import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { useToast } from '../components/Toast';

const FOCUS_AREA_GROUPS = [
  {
    category: "Programming Languages",
    areas: ["JavaScript", "Python", "Java", "Go", "Rust", "C++", "C#", "Kotlin", "Swift", "Ruby"]
  },
  {
    category: "server & APIs",
    areas: ["APIs", "server", "Microservices", "GraphQL", "Node.js", "REST Design", "gRPC", "Message Queues", "WebSockets"]
  },
  {
    category: "client & Mobile",
    areas: ["client", "React", "Vue", "TypeScript", "Mobile Development", "iOS Development", "Android Development", "UI/UX Design", "Web Performance", "Accessibility"]
  },
  {
    category: "Databases & Data Engineering",
    areas: ["Databases", "SQL", "NoSQL", "Data Modeling", "Data Warehousing", "ETL Pipelines", "Caching Strategies", "Database Performance Tuning"]
  },
  {
    category: "Data & AI",
    areas: ["Data Structures", "Algorithms", "Machine Learning", "Deep Learning", "Data Science", "Computer Vision", "NLP", "LLMs & Prompt Engineering", "MLOps", "Statistics for ML"]
  },
  {
    category: "Software Architecture & Design",
    areas: ["System Design", "Design Patterns", "Domain-Driven Design", "Clean Architecture", "Event-Driven Architecture", "Distributed Systems", "Scalability"]
  },
  {
    category: "Infrastructure & Cloud",
    areas: ["Cloud", "AWS", "Azure", "Google Cloud", "DevOps", "Docker", "Kubernetes", "Networking", "Site Reliability Engineering", "CI/CD", "Infrastructure as Code"]
  },
  {
    category: "Security",
    areas: ["Security", "Cybersecurity Fundamentals", "Ethical Hacking", "Cryptography", "Application Security", "Network Security", "Cloud Security"]
  },
  {
    category: "Quality & Testing",
    areas: ["Testing", "Test Automation", "Unit Testing", "Performance Testing", "QA Fundamentals", "Debugging Techniques"]
  },
  {
    category: "Product & Business",
    areas: ["Product Management", "Agile & Scrum", "Technical Writing", "Project Management", "Business Analysis"]
  },
  {
    category: "Career & Soft Skills",
    areas: ["System Design Interviews", "Coding Interviews", "Communication Skills", "Leadership", "Technical Mentorship"]
  },
  {
    category: "Specialized & Emerging Tech",
    areas: ["Blockchain", "Game Development", "Embedded Systems", "AR/VR", "IoT", "Quantum Computing", "Edge Computing"]
  }
];

// Flat list for easy lookup — derived from groups
const ALL_TAGS = FOCUS_AREA_GROUPS.flatMap((g) => g.areas);

const PREPAREDNESS_OPTIONS = [
  { value: 'just_starting', label: 'Just starting', desc: 'No prior experience in this area', icon: '🌱' },
  { value: 'some_exposure', label: 'Some exposure', desc: 'Dabbled a bit, know the basics', icon: '🌿' },
  { value: 'comfortable', label: 'Comfortable', desc: 'Have hands-on experience, want structure', icon: '🌳' },
];

const STEPS = ['Goal', 'Interests', 'Level', 'Quiz'];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 0 — Goal
  const [goal, setGoal] = useState('');

  // Step 1 — Interests
  const [interests, setInterests] = useState([]);

  // Step 2 — Preparedness
  const [preparedness, setPreparedness] = useState('');

  // Step 3 — Diagnostic quiz
  const [jobId, setJobId] = useState(null);
  const [quizReady, setQuizReady] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);

  // Poll for diagnostic MCQ generation
  usePolling(
    () => api.get(`/onboarding/diagnostic/${jobId}/status`).then((r) => r.data),
    {
      enabled: !!jobId && !quizReady,
      onReady: async () => {
        const { data } = await api.get(`/onboarding/diagnostic/${jobId}`);
        setQuestions(data.questions);
        setAnswers(new Array(data.questions.length).fill(null));
        setQuizReady(true);
      },
      onFailed: () => {
        setError('Diagnostic generation failed. Please try again.');
        toast.error('AI generation failed');
      },
    }
  );

  // ── Step handlers ──────────────────────────────────────────────────────────
  const handleGoalNext = () => {
    if (goal.trim().length < 5) { setError('Please describe your goal (at least 5 characters)'); return; }
    setError(''); setStep(1);
  };

  const handleInterestsNext = () => {
    if (interests.length === 0) { setError('Select at least one interest area'); return; }
    setError(''); setStep(2);
  };

  const handleLevelNext = async () => {
    if (!preparedness) { setError('Please select your experience level'); return; }
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/onboarding/profile', {
        goal: goal.trim(),
        interests,
        preparedness,
      });
      setJobId(data.jobId);
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSelect = (qIdx, aIdx) => {
    if (submitted) return;
    const next = [...answers];
    next[qIdx] = aIdx;
    setAnswers(next);
  };

  const handleQuizSubmit = async () => {
    if (answers.some((a) => a === null)) { setError('Please answer all questions before submitting'); return; }
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/onboarding/diagnostic/submit', { jobId, answers });
      setResult(data);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRoadmap = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/roadmaps');
      toast.info('Generating your roadmap…');
      navigate('/roadmap', { state: { jobId: data.jobId, roadmapId: data.roadmapId } });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start roadmap generation');
    } finally {
      setLoading(false);
    }
  };

  // ── UI helpers ─────────────────────────────────────────────────────────────
  const toggleInterest = (tag) => {
    setInterests((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  return (
    <div style={{ minHeight: '100vh', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🧠</div>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Set up your learning goal</h1>
        <p style={{ color: 'var(--text-2)' }}>
          Answer a few questions so the AI can build you a personalized roadmap
        </p>
      </div>

      {/* Step indicator */}
      <div className="steps" style={{ maxWidth: 400, width: '100%' }}>
        {STEPS.map((label, i) => (
          <div key={label} className="step-item">
            <div className={`step-circle ${i < step ? 'completed' : i === step ? 'active' : ''}`}>
              {i < step ? '✓' : i + 1}
            </div>
            {i < STEPS.length - 1 && <div className={`step-line ${i < step ? 'done' : ''}`} />}
          </div>
        ))}
      </div>

      {/* Card */}
      <div className="card" style={{ maxWidth: 560, width: '100%' }}>
        {error && (
          <div className="toast toast-error" style={{ position: 'static', animation: 'none', minWidth: 'unset', marginBottom: '1rem' }}>
            <span>✕</span><span>{error}</span>
          </div>
        )}

        {/* ── Step 0: Goal ────────────────────────────────────────────────── */}
        {step === 0 && (
          <>
            <h2 className="section-title">What do you want to learn?</h2>
            <p className="section-sub">Be specific — the AI uses this to design your roadmap</p>
            <textarea
              id="onboard-goal-input"
              className="input"
              placeholder='e.g. "Become job-ready in server development with Node.js and PostgreSQL"'
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={4}
              autoFocus
            />
            <button id="btn-goal-next" className="btn btn-primary" onClick={handleGoalNext} style={{ marginTop: '1.25rem', width: '100%' }}>
              Continue →
            </button>
          </>
        )}

        {/* ── Step 1: Interests ───────────────────────────────────────────── */}
        {step === 1 && (
          <>
            <h2 className="section-title">What are your focus areas?</h2>
            <p className="section-sub">Select all that apply to your goal</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {FOCUS_AREA_GROUPS.map((group, gi) => (
                <div key={group.category}>
                  {/* Category label */}
                  <p style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--graphite)',
                    fontWeight: 500,
                    marginBottom: '0.4rem',
                    letterSpacing: '0.01em',
                  }}>
                    {group.category}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {group.areas.map((tag) => (
                      <button
                        key={tag}
                        className={`tag ${interests.includes(tag) ? 'selected' : ''}`}
                        onClick={() => toggleInterest(tag)}
                        aria-pressed={interests.includes(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  {/* Hairline between groups (not after last) */}
                  {gi < FOCUS_AREA_GROUPS.length - 1 && (
                    <div style={{ height: 1, background: 'var(--line)', marginTop: 'var(--space-2)' }} aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button className="btn btn-ghost" onClick={() => setStep(0)}>← Back</button>
              <button id="btn-interests-next" className="btn btn-primary" style={{ flex: 1 }} onClick={handleInterestsNext}>
                Continue → ({interests.length} selected)
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Preparedness ────────────────────────────────────────── */}
        {step === 2 && (
          <>
            <h2 className="section-title">What's your current level?</h2>
            <p className="section-sub">This helps calibrate the starting point of your roadmap</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {PREPAREDNESS_OPTIONS.map((opt) => (
                <button key={opt.value}
                  className={`card ${preparedness === opt.value ? 'card-glow' : ''}`}
                  onClick={() => setPreparedness(opt.value)}
                  style={{
                    textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '1rem',
                    borderColor: preparedness === opt.value ? 'var(--accent)' : 'var(--border)', padding: '1rem 1.25rem'
                  }}>
                  <span style={{ fontSize: '1.75rem' }}>{opt.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>{opt.label}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-2)' }}>{opt.desc}</div>
                  </div>
                  {preparedness === opt.value && (
                    <span style={{ marginLeft: 'auto', color: 'var(--accent-light)', fontSize: '1.25rem' }}>✓</span>
                  )}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button id="btn-level-next" className="btn btn-primary" style={{ flex: 1 }}
                onClick={handleLevelNext} disabled={loading}>
                {loading ? <><span className="spinner spinner-sm" /> Setting up…</> : 'Start Calibration Quiz →'}
              </button>
            </div>
          </>
        )}

        {/* ── Step 3: Diagnostic quiz ─────────────────────────────────────── */}
        {step === 3 && (
          <>
            {!quizReady && !submitted && (
              <div className="loading-page" style={{ minHeight: 200 }}>
                <div className="spinner" />
                <p className="loading-text">AI is generating your calibration quiz…</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>This may take 30–60 seconds</p>
              </div>
            )}

            {quizReady && !submitted && (
              <>
                <h2 className="section-title">Calibration Quiz</h2>
                <p className="section-sub">
                  {questions.length} questions · Helps the AI set the right difficulty for your roadmap
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  {questions.map((q, qi) => (
                    <div key={qi}>
                      <p style={{ fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text)' }}>
                        {qi + 1}. {q.question}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {q.options.map((opt, oi) => (
                          <button key={oi} className={`mcq-option ${answers[qi] === oi ? 'selected' : ''}`}
                            onClick={() => handleAnswerSelect(qi, oi)}>
                            <span className="option-letter">{['A', 'B', 'C', 'D'][oi]}</span>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <button id="btn-quiz-submit" className="btn btn-primary" style={{ width: '100%' }}
                  onClick={handleQuizSubmit} disabled={loading || answers.some((a) => a === null)}>
                  {loading ? <><span className="spinner spinner-sm" /> Grading…</> : 'Submit Answers'}
                </button>
              </>
            )}

            {submitted && result && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                  {result.diagnosticScore >= 0.7 ? '🎉' : result.diagnosticScore >= 0.4 ? '📚' : '🌱'}
                </div>
                <h2 className="section-title">
                  You scored {Math.round(result.diagnosticScore * 100)}%
                </h2>
                <p style={{ color: 'var(--text-2)', marginBottom: '0.5rem' }}>
                  {result.correctCount} / {result.totalCount} correct
                </p>
                {result.weakConcepts?.length > 0 && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginBottom: '1.5rem' }}>
                    Concepts to focus on: {result.weakConcepts.join(', ')}
                  </p>
                )}
                <p style={{ color: 'var(--text-2)', marginBottom: '1.5rem' }}>
                  The AI will calibrate your roadmap to this level.
                </p>
                <button id="btn-generate-roadmap" className="btn btn-primary btn-lg"
                  onClick={handleGenerateRoadmap} disabled={loading} style={{ width: '100%' }}>
                  {loading ? <><span className="spinner spinner-sm" /> Starting…</> : '🗺️ Generate My Roadmap →'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
