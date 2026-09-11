import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { useToast } from '../components/Toast';

const LETTERS = ['A', 'B', 'C', 'D'];

// ── TRACE-KT: 5-point Likert confidence scale ───────────────────────────────
const CONFIDENCE_LEVELS = [
  { value: 0,    label: 'Guessing',         emoji: '🎲', color: 'var(--danger)' },
  { value: 0.25, label: 'Low Confidence',   emoji: '🤔', color: 'var(--warning)' },
  { value: 0.5,  label: 'Moderate',         emoji: '😐', color: 'var(--text-2)' },
  { value: 0.75, label: 'Fairly Confident', emoji: '😊', color: 'var(--accent-light)' },
  { value: 1.0,  label: 'Very Confident',   emoji: '💪', color: 'var(--success)' },
];

export default function AssessmentPage() {
  const { id: chapterId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [phase, setPhase] = useState('loading'); // loading | polling | quiz | results
  const [assessmentId, setAssessmentId] = useState(null);
  const [pollingJobId, setPollingJobId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // ── TRACE-KT: Per-question behavioral state ──
  const [answers, setAnswers] = useState([]);       // { answerIndex, responseTimeMs, hintCount, confidence }
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [eliminatedOptions, setEliminatedOptions] = useState([]); // indices of eliminated distractors
  const timerRef = useRef(null);

  // ── Timer management ──
  const startTimer = useCallback(() => {
    setQuestionStartTime(Date.now());
    setElapsedTime(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Clean up timer on unmount
  useEffect(() => () => stopTimer(), [stopTimer]);

  // Start timer when entering quiz or changing question
  useEffect(() => {
    if (phase === 'quiz') {
      startTimer();
      setEliminatedOptions([]);
    }
    return () => stopTimer();
  }, [currentQ, phase, startTimer, stopTimer]);

  // Fetch or trigger assessment generation
  useEffect(() => {
    api.get(`/chapters/${chapterId}/assessment`).then(({ data }) => {
      if (data.status === 'ready') {
        loadQuestions(data.assessment.id);
      } else if (data.status === 'pending') {
        setAssessmentId(data.assessmentId);
        setPollingJobId(data.jobId);
        setPhase('polling');
      }
    }).catch(() => {
      setError('Failed to load assessment');
      setPhase('error');
    });
  }, [chapterId]);

  async function loadQuestions(asmId) {
    try {
      const { data } = await api.get(`/assessments/${asmId}`);
      setAssessmentId(asmId);
      setQuestions(data.questions);
      // Initialize TRACE-KT answer objects
      setAnswers(data.questions.map(() => ({
        answerIndex: null,
        responseTimeMs: null,
        hintCount: 0,
        confidence: 0.5, // default moderate
      })));
      setPhase('quiz');
    } catch {
      setError('Failed to load questions');
      setPhase('error');
    }
  }

  // Poll for generation
  usePolling(
    () => api.get(`/assessments/${assessmentId}/status`).then((r) => r.data),
    {
      enabled: phase === 'polling' && !!assessmentId,
      onReady: () => loadQuestions(assessmentId),
      onFailed: () => {
        setError('MCQ generation failed. Try regenerating.');
        setPhase('error');
        toast.error('AI generation failed');
      },
    }
  );

  // ── TRACE-KT: Answer with response time capture ──
  const handleAnswer = (idx) => {
    const now = Date.now();
    const responseTimeMs = questionStartTime ? now - questionStartTime : 30000;

    setAnswers((prev) => {
      const next = [...prev];
      next[currentQ] = {
        ...next[currentQ],
        answerIndex: idx,
        responseTimeMs,
      };
      return next;
    });
  };

  // ── TRACE-KT: Hint system (distractor elimination) ──
  const handleHint = () => {
    const q = questions[currentQ];
    const currentAnswer = answers[currentQ];
    if (!q || currentAnswer.hintCount >= 2) return; // max 2 hints (leaves 2 options)

    // Find a wrong option that hasn't been eliminated yet
    const wrongOptions = q.options
      .map((_, i) => i)
      .filter((i) => i !== q?.correctIndex && !eliminatedOptions.includes(i));

    if (wrongOptions.length === 0) return;

    // Eliminate a random wrong option
    const toEliminate = wrongOptions[Math.floor(Math.random() * wrongOptions.length)];
    setEliminatedOptions((prev) => [...prev, toEliminate]);

    setAnswers((prev) => {
      const next = [...prev];
      next[currentQ] = {
        ...next[currentQ],
        hintCount: next[currentQ].hintCount + 1,
      };
      return next;
    });

    toast.info(`Hint used (${currentAnswer.hintCount + 1}/2) — one wrong answer eliminated`);
  };

  // ── TRACE-KT: Confidence selection ──
  const handleConfidence = (value) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[currentQ] = { ...next[currentQ], confidence: value };
      return next;
    });
  };

  // ── Navigation with timer management ──
  const goToQuestion = (qi) => {
    stopTimer();
    setCurrentQ(qi);
    // Reset eliminated options for the new question
    setEliminatedOptions([]);
  };

  const handleSubmit = async () => {
    if (answers.some((a) => a.answerIndex === null)) {
      toast.error('Please answer all questions');
      return;
    }
    setSubmitting(true);
    stopTimer();
    try {
      const { data } = await api.post(`/assessments/${assessmentId}/attempt`, { answers });
      setResult(data);
      setPhase('results');
    } catch {
      toast.error('Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegenerate = async () => {
    setPhase('polling');
    setError('');
    try {
      const { data } = await api.post(`/assessments/${assessmentId}/regenerate`);
      setPollingJobId(data.jobId);
    } catch {
      toast.error('Regeneration failed');
      setPhase('error');
    }
  };

  // Format time as m:ss
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── Phase: Loading / Polling ──────────────────────────────────────────────
  if (phase === 'loading' || phase === 'polling') {
    return (
      <div className="loading-page">
        <div className="spinner" />
        <p className="loading-text">
          {phase === 'polling' ? 'AI is generating your knowledge check…' : 'Loading assessment…'}
        </p>
        {phase === 'polling' && <p style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>This may take 30–60 seconds</p>}
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="loading-page">
        <p style={{ color: 'var(--danger)' }}>{error || 'Something went wrong'}</p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-outline" onClick={() => navigate(`/chapters/${chapterId}`)}>← Back</button>
          <button className="btn btn-primary" onClick={handleRegenerate}>Regenerate Quiz</button>
        </div>
      </div>
    );
  }

  // ── Phase: Results ────────────────────────────────────────────────────────
  if (phase === 'results' && result) {
    const passed = result.passed;
    return (
      <div className="page" style={{ maxWidth: 700 }}>
        {/* Result header */}
        <div className="card mb-3" style={{
          textAlign: 'center', padding: '2.5rem',
          borderColor: passed ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.3)',
          background: passed ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)',
        }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem' }}>{passed ? '🎉' : '📚'}</div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>
            {passed ? 'Chapter Complete!' : 'Keep Practicing'}
          </h1>
          <p style={{ color: 'var(--text-2)', marginBottom: '1rem' }}>
            {passed
              ? 'You passed the knowledge check. This chapter is now marked complete.'
              : `You scored ${result.score}% — ${result.passThreshold}% required to pass.`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: passed ? 'var(--success)' : 'var(--danger)' }}>
                {result.score}%
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Score</div>
            </div>
            <div style={{ width: 1, background: 'var(--border)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-2)' }}>
                {result.gradedAnswers?.filter((a) => a.isCorrect).length}/{result.gradedAnswers?.length}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Correct</div>
            </div>
            <div style={{ width: 1, background: 'var(--border)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-light)' }}>
                {result.passThreshold}%
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Pass mark</div>
            </div>
          </div>
        </div>

        {/* TRACE-KT: Mastery output with uncertainty */}
        {result.mastery && result.mastery.concepts && result.mastery.concepts.length > 0 && (
          <div className="card mb-3" style={{ padding: '1.25rem' }}>
            <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🧠 Knowledge Mastery
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {result.mastery.concepts.map((c) => (
                <div key={c.tag} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-2)', minWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.tag}
                  </span>
                  <div style={{ flex: 1, position: 'relative', height: 24, background: 'rgba(255,255,255,0.05)', borderRadius: 12, overflow: 'hidden' }}>
                    {/* Uncertainty band */}
                    <div style={{
                      position: 'absolute', top: 0, height: '100%', borderRadius: 12,
                      left: `${Math.max(0, (c.mastery - c.uncertainty) * 100)}%`,
                      width: `${Math.min(100, c.uncertainty * 2 * 100)}%`,
                      background: 'rgba(124,58,237,0.15)',
                    }} />
                    {/* Mastery fill */}
                    <div style={{
                      position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 12,
                      width: `${c.mastery * 100}%`,
                      background: c.mastery >= 0.85 ? 'var(--success)' :
                        c.mastery >= 0.6 ? 'var(--accent)' : 'var(--danger)',
                      opacity: 0.8,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', minWidth: 55, textAlign: 'right' }}>
                    {Math.round(c.mastery * 100)}% ±{Math.round(c.uncertainty * 100)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Per-question breakdown */}
        <h2 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '1rem' }}>Question Breakdown</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          {result.gradedAnswers?.map((g, i) => (
            <div key={i} className="card" style={{
              borderColor: g.isCorrect ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)',
              padding: '1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>{g.isCorrect ? '✅' : '❌'}</span>
                <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)' }}>
                  Q{i + 1}: {questions[i]?.text}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingLeft: '1.6rem' }}>
                {questions[i]?.options?.map((opt, oi) => (
                  <div key={oi} style={{
                    fontSize: '0.82rem', padding: '0.35rem 0.6rem', borderRadius: 6,
                    background: oi === g.correctIndex ? 'var(--success-bg)' :
                      oi === g.submittedIndex && !g.isCorrect ? 'var(--danger-bg)' : 'transparent',
                    color: oi === g.correctIndex ? 'var(--success)' :
                      oi === g.submittedIndex && !g.isCorrect ? 'var(--danger)' : 'var(--text-2)',
                    fontWeight: (oi === g.correctIndex || (oi === g.submittedIndex && !g.isCorrect)) ? 600 : 400,
                  }}>
                    {LETTERS[oi]}. {opt}
                    {oi === g.correctIndex && ' ✓'}
                    {oi === g.submittedIndex && !g.isCorrect && ' ✗'}
                  </div>
                ))}
              </div>
              {g.explanation && (
                <div style={{ marginTop: '0.6rem', paddingLeft: '1.6rem', fontSize: '0.8rem', color: 'var(--text-3)', fontStyle: 'italic' }}>
                  💡 {g.explanation}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/roadmap" className="btn btn-outline" style={{ flex: 1 }}>← Back to Roadmap</Link>
          {!passed && (
            <button id="btn-retry-quiz" className="btn btn-primary" style={{ flex: 1 }}
              onClick={() => {
                setPhase('quiz');
                setAnswers(questions.map(() => ({ answerIndex: null, responseTimeMs: null, hintCount: 0, confidence: 0.5 })));
                setCurrentQ(0);
                setEliminatedOptions([]);
              }}>
              Retry Quiz
            </button>
          )}
          {passed && (
            <Link to="/roadmap" className="btn btn-primary" style={{ flex: 1 }}>
              Continue Learning →
            </Link>
          )}
        </div>
      </div>
    );
  }

  // ── Phase: Quiz ───────────────────────────────────────────────────────────
  const q = questions[currentQ];
  const currentAnswer = answers[currentQ];
  const answered = currentAnswer?.answerIndex !== null;
  const allAnswered = answers.every((a) => a.answerIndex !== null);
  const selectedConfidence = currentAnswer?.confidence ?? 0.5;

  return (
    <div className="page" style={{ maxWidth: 700 }}>
      {/* Progress + Timer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <Link to={`/chapters/${chapterId}`} style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>← Chapter</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* TRACE-KT: Live timer */}
          <span style={{
            fontSize: '0.85rem', fontWeight: 600, fontFamily: 'monospace',
            color: elapsedTime > 60 ? 'var(--warning)' : 'var(--text-3)',
            background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: 6,
          }}>
            ⏱ {formatTime(elapsedTime)}
          </span>
          <span style={{ color: 'var(--text-2)', fontSize: '0.875rem' }}>
            {currentQ + 1} / {questions.length}
          </span>
        </div>
      </div>
      <div className="progress-track mb-3">
        <div className="progress-fill" style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
      </div>

      {/* Question */}
      {q && (
        <div className="card mb-3">
          <div className="flex items-center gap-2 mb-2" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="badge badge-purple">Q{currentQ + 1}</span>
              {q.conceptTag && <span className="badge badge-muted">{q.conceptTag}</span>}
            </div>
            {/* TRACE-KT: Hint button */}
            <button
              id={`btn-hint-${currentQ}`}
              onClick={handleHint}
              disabled={currentAnswer?.hintCount >= 2}
              style={{
                fontSize: '0.75rem', padding: '0.3rem 0.6rem', borderRadius: 6,
                background: currentAnswer?.hintCount >= 2 ? 'rgba(255,255,255,0.03)' : 'rgba(251,191,36,0.1)',
                color: currentAnswer?.hintCount >= 2 ? 'var(--text-3)' : 'var(--warning)',
                border: '1px solid',
                borderColor: currentAnswer?.hintCount >= 2 ? 'rgba(255,255,255,0.05)' : 'rgba(251,191,36,0.2)',
                cursor: currentAnswer?.hintCount >= 2 ? 'not-allowed' : 'pointer',
                fontWeight: 600, transition: 'all 0.15s ease',
              }}
            >
              💡 Hint ({currentAnswer?.hintCount || 0}/2)
            </button>
          </div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', lineHeight: 1.5, color: 'var(--text)' }}>
            {q.text}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {q.options.map((opt, oi) => {
              const isEliminated = eliminatedOptions.includes(oi);
              return (
                <button
                  key={oi}
                  id={`mcq-option-${currentQ}-${oi}`}
                  className={`mcq-option ${currentAnswer?.answerIndex === oi ? 'selected' : ''}`}
                  onClick={() => !isEliminated && handleAnswer(oi)}
                  disabled={isEliminated}
                  style={{
                    opacity: isEliminated ? 0.3 : 1,
                    textDecoration: isEliminated ? 'line-through' : 'none',
                    cursor: isEliminated ? 'not-allowed' : 'pointer',
                    position: 'relative',
                  }}
                >
                  <span className="option-letter">{LETTERS[oi]}</span>
                  {opt}
                  {isEliminated && (
                    <span style={{
                      position: 'absolute', right: 12, fontSize: '0.7rem',
                      color: 'var(--danger)', fontWeight: 600,
                    }}>
                      ✗ eliminated
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* TRACE-KT: Confidence selector */}
          {answered && (
            <div style={{ marginTop: '1.25rem', padding: '1rem', background: 'rgba(124,58,237,0.05)', borderRadius: 10, border: '1px solid rgba(124,58,237,0.1)' }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', marginBottom: '0.6rem' }}>
                How confident are you in this answer?
              </p>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {CONFIDENCE_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    id={`confidence-${currentQ}-${level.value}`}
                    onClick={() => handleConfidence(level.value)}
                    style={{
                      flex: '1 1 auto', minWidth: 80, padding: '0.5rem 0.4rem',
                      borderRadius: 8, border: '2px solid',
                      borderColor: selectedConfidence === level.value ? level.color : 'rgba(255,255,255,0.08)',
                      background: selectedConfidence === level.value ? `${level.color}15` : 'rgba(255,255,255,0.03)',
                      color: selectedConfidence === level.value ? level.color : 'var(--text-3)',
                      cursor: 'pointer', fontSize: '0.72rem', fontWeight: 600,
                      transition: 'all 0.15s ease', textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '1rem', marginBottom: '0.15rem' }}>{level.emoji}</div>
                    {level.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => goToQuestion(currentQ - 1)} disabled={currentQ === 0}>
          ← Prev
        </button>
        <div style={{ flex: 1, display: 'flex', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {questions.map((_, qi) => (
            <button key={qi} onClick={() => goToQuestion(qi)} style={{
              width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: qi === currentQ ? 'var(--accent)' :
                answers[qi]?.answerIndex !== null ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.07)',
              color: qi === currentQ ? '#fff' : answers[qi]?.answerIndex !== null ? 'var(--accent-light)' : 'var(--text-3)',
              fontWeight: 700, fontSize: '0.75rem', transition: 'all 0.15s ease',
            }}>
              {qi + 1}
            </button>
          ))}
        </div>
        {currentQ < questions.length - 1 ? (
          <button className="btn btn-outline btn-sm" onClick={() => goToQuestion(currentQ + 1)} disabled={!answered}>
            Next →
          </button>
        ) : (
          <button id="btn-submit-quiz" className="btn btn-primary btn-sm"
            onClick={handleSubmit} disabled={!allAnswered || submitting}>
            {submitting ? <span className="spinner spinner-sm" /> : 'Submit All'}
          </button>
        )}
      </div>
    </div>
  );
}
