import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { useToast } from '../components/Toast';

const LETTERS = ['A', 'B', 'C', 'D'];

export default function AssessmentPage() {
  const { id: chapterId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [phase, setPhase] = useState('loading'); // loading | polling | quiz | results
  const [assessmentId, setAssessmentId] = useState(null);
  const [pollingJobId, setPollingJobId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

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
      setAnswers(new Array(data.questions.length).fill(null));
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

  const handleAnswer = (idx) => {
    const next = [...answers];
    next[currentQ] = idx;
    setAnswers(next);
  };

  const handleSubmit = async () => {
    if (answers.some((a) => a === null)) {
      toast.error('Please answer all questions');
      return;
    }
    setSubmitting(true);
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

  // ── Phase: Loading ─────────────────────────────────────────────────────────
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

  // ── Phase: Results ─────────────────────────────────────────────────────────
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
              onClick={() => { setPhase('quiz'); setAnswers(new Array(questions.length).fill(null)); setCurrentQ(0); }}>
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

  // ── Phase: Quiz ────────────────────────────────────────────────────────────
  const q = questions[currentQ];
  const answered = answers[currentQ] !== null;
  const allAnswered = answers.every((a) => a !== null);

  return (
    <div className="page" style={{ maxWidth: 700 }}>
      {/* Progress */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <Link to={`/chapters/${chapterId}`} style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>← Chapter</Link>
        <span style={{ color: 'var(--text-2)', fontSize: '0.875rem' }}>
          {currentQ + 1} / {questions.length}
        </span>
      </div>
      <div className="progress-track mb-3">
        <div className="progress-fill" style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} />
      </div>

      {/* Question */}
      {q && (
        <div className="card mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="badge badge-purple">Q{currentQ + 1}</span>
            {q.conceptTag && <span className="badge badge-muted">{q.conceptTag}</span>}
          </div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', lineHeight: 1.5, color: 'var(--text)' }}>
            {q.text}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {q.options.map((opt, oi) => (
              <button
                key={oi}
                id={`mcq-option-${currentQ}-${oi}`}
                className={`mcq-option ${answers[currentQ] === oi ? 'selected' : ''}`}
                onClick={() => handleAnswer(oi)}
              >
                <span className="option-letter">{LETTERS[oi]}</span>
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setCurrentQ((c) => c - 1)} disabled={currentQ === 0}>
          ← Prev
        </button>
        <div style={{ flex: 1, display: 'flex', gap: '0.4rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {questions.map((_, qi) => (
            <button key={qi} onClick={() => setCurrentQ(qi)} style={{
              width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: qi === currentQ ? 'var(--accent)' :
                answers[qi] !== null ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.07)',
              color: qi === currentQ ? '#fff' : answers[qi] !== null ? 'var(--accent-light)' : 'var(--text-3)',
              fontWeight: 700, fontSize: '0.75rem', transition: 'all 0.15s ease',
            }}>
              {qi + 1}
            </button>
          ))}
        </div>
        {currentQ < questions.length - 1 ? (
          <button className="btn btn-outline btn-sm" onClick={() => setCurrentQ((c) => c + 1)} disabled={!answered}>
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
