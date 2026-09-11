import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../api/frontend';
import { usePolling } from '../hooks/usePolling';
import { useToast } from '../components/Toast';
import DiffConfirmCard from '../components/DiffConfirmCard';

const STATUS_COLORS = {
  not_started: 'var(--text-3)',
  in_progress: 'var(--info)',
  knowledge_check_pending: 'var(--warning)',
  completed: 'var(--success)',
};
const STATUS_LABELS = {
  not_started: 'Not started',
  in_progress: 'In progress',
  knowledge_check_pending: 'Quiz pending',
  completed: 'Completed',
};

export default function RoadmapPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  // Could arrive with a jobId from onboarding
  const { jobId: incomingJobId, roadmapId: incomingRoadmapId } = location.state || {};

  const [polling, setPolling] = useState(!!incomingJobId);
  const [jobId] = useState(incomingJobId);
  const [roadmap, setRoadmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeMs, setActiveMs] = useState(null);

  // Roadmap modification
  const [modifyOpen, setModifyOpen] = useState(false);
  const [modifyText, setModifyText] = useState('');
  const [modifyLoading, setModifyLoading] = useState(false);
  const [pendingDiff, setPendingDiff] = useState(null); // { changeId, diff }

  // Poll roadmap generation if coming from onboarding
  usePolling(
    () => api.get(`/roadmaps/${jobId}/status`).then((r) => r.data),
    {
      enabled: polling,
      onReady: async (data) => {
        setPolling(false);
        if (data.roadmapId) await loadRoadmap(data.roadmapId);
        else await loadActiveRoadmap();
      },
      onFailed: () => {
        setPolling(false);
        setLoading(false);
        setError('Roadmap generation failed. Please try again.');
        toast.error('AI generation failed');
      },
    }
  );

  async function loadRoadmap(id) {
    try {
      const { data } = await api.get(`/roadmaps/${id}`);
      setRoadmap(data);
      setActiveMs(data.milestones.find((m) => m.status !== 'locked')?.id || data.milestones[0]?.id);
    } catch {
      setError('Failed to load roadmap');
    } finally {
      setLoading(false);
    }
  }

  async function loadActiveRoadmap() {
    try {
      const { data } = await api.get('/roadmaps/active');
      setRoadmap(data);
      setActiveMs(data.milestones.find((m) => m.status !== 'locked')?.id || data.milestones[0]?.id);
    } catch (err) {
      if (err.response?.status === 404) navigate('/onboard');
      else setError('Failed to load roadmap');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!polling) {
      if (incomingRoadmapId) loadRoadmap(incomingRoadmapId);
      else loadActiveRoadmap();
    }
  }, []);

  const handleModifySubmit = async () => {
    if (!modifyText.trim()) return;
    setModifyLoading(true);
    try {
      const { data } = await api.post(`/roadmaps/${roadmap.id}/modify`, { prompt: modifyText.trim() });
      setPendingDiff(data);
      setModifyOpen(false);
      setModifyText('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'AI modification failed');
    } finally {
      setModifyLoading(false);
    }
  };

  const handleConfirmDiff = async () => {
    try {
      await api.post(`/roadmaps/${roadmap.id}/modify/${pendingDiff.changeId}/confirm`);
      toast.success('Roadmap updated!');
      setPendingDiff(null);
      await loadRoadmap(roadmap.id);
    } catch {
      toast.error('Failed to apply changes');
    }
  };

  const handleRejectDiff = async () => {
    try {
      await api.post(`/roadmaps/${roadmap.id}/modify/${pendingDiff.changeId}/reject`);
      setPendingDiff(null);
    } catch {
      toast.error('Failed to reject changes');
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (polling || loading) {
    return (
      <div className="loading-page">
        <div className="spinner" />
        <p className="loading-text">
          {polling ? 'AI is building your personalized roadmap…' : 'Loading your roadmap…'}
        </p>
        {polling && <p style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>This may take a minute or two</p>}
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-page">
        <p style={{ color: 'var(--danger)', fontSize: '1rem' }}>{error}</p>
        <button className="btn btn-primary" onClick={() => navigate('/onboard')}>Start over</button>
      </div>
    );
  }

  if (!roadmap) return null;

  const currentMs = roadmap.milestones.find((m) => m.id === activeMs);

  return (
    <div className="page">
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <div>
          <h1 className="section-title" style={{ fontSize: '1.6rem' }}>Your Roadmap</h1>
          <p style={{ color: 'var(--text-2)', fontSize: '0.875rem' }}>
            v{roadmap.version} · {roadmap.progress.completed}/{roadmap.progress.total} chapters complete
          </p>
        </div>
        <button id="btn-modify-roadmap" className="btn btn-outline btn-sm" onClick={() => setModifyOpen(true)}>
          ✏️ Modify with AI
        </button>
      </div>

      {/* Overall progress */}
      <div className="card mb-3">
        <div className="flex justify-between items-center mb-1">
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Overall Progress</span>
          <span style={{ color: 'var(--accent-light)', fontWeight: 700 }}>{roadmap.progress.percent}%</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${roadmap.progress.percent}%` }} />
        </div>
      </div>

      {/* Layout: milestones sidebar + chapters main */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Milestones list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {roadmap.milestones.map((ms, idx) => {
            const totalCh = ms.chapters?.length || 0;
            const doneCh = ms.chapters?.filter((c) => c.status === 'completed').length || 0;
            return (
              <button
                key={ms.id}
                onClick={() => ms.status !== 'locked' && setActiveMs(ms.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${ms.id === activeMs ? 'var(--accent)' : 'var(--border)'}`,
                  background: ms.id === activeMs ? 'rgba(124,58,237,0.1)' : 'var(--bg-card)',
                  cursor: ms.status === 'locked' ? 'not-allowed' : 'pointer',
                  opacity: ms.status === 'locked' ? 0.45 : 1,
                  textAlign: 'left', width: '100%', fontFamily: 'var(--font)',
                  color: 'var(--text)', transition: 'all 0.15s ease',
                }}
              >
                <div className={`milestone-dot ${ms.status}`} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    M{idx + 1}. {ms.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                    {ms.status === 'locked' ? '🔒 Locked' : `${doneCh}/${totalCh} chapters`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Chapters area */}
        <div>
          {currentMs ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>{currentMs.title}</h2>
                <span className={`badge badge-${currentMs.status === 'completed' ? 'success' : currentMs.status === 'active' ? 'purple' : 'muted'}`}>
                  {currentMs.status}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {currentMs.chapters.map((ch, ci) => (
                  <Link
                    key={ch.id}
                    to={`/chapters/${ch.id}`}
                    className={`chapter-card ${ch.status === 'completed' ? 'completed' : ''}`}
                    id={`chapter-card-${ch.id}`}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                      <span style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: 700,
                        background: ch.status === 'completed' ? 'var(--success-bg)' : 'rgba(255,255,255,0.06)',
                        color: ch.status === 'completed' ? 'var(--success)' : 'var(--text-3)',
                      }}>
                        {ch.status === 'completed' ? '✓' : ci + 1}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{ch.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                          {ch.objectives?.length || 0} objectives
                        </div>
                      </div>
                    </div>
                    <span className="badge" style={{ color: STATUS_COLORS[ch.status], background: 'transparent', border: 'none', flexShrink: 0 }}>
                      {STATUS_LABELS[ch.status]}
                    </span>
                  </Link>
                ))}
              </div>
            </>
          ) : (
            <p style={{ color: 'var(--text-2)' }}>Select a milestone to view its chapters</p>
          )}
        </div>
      </div>

      {/* Modify modal */}
      {modifyOpen && (
        <div className="overlay" onClick={() => setModifyOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Modify Roadmap with AI</h3>
            <p style={{ color: 'var(--text-2)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              Describe your change in plain language. The AI will propose a diff for you to review.
            </p>
            <textarea id="modify-prompt-input" className="input" rows={4}
              placeholder='e.g. "I already know Express basics — skip those chapters and add one on GraphQL"'
              value={modifyText} onChange={(e) => setModifyText(e.target.value)} autoFocus />
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button className="btn btn-ghost" onClick={() => setModifyOpen(false)}>Cancel</button>
              <button id="btn-modify-submit" className="btn btn-primary" style={{ flex: 1 }}
                onClick={handleModifySubmit} disabled={modifyLoading || !modifyText.trim()}>
                {modifyLoading ? <><span className="spinner spinner-sm" /> Generating diff…</> : '✨ Generate Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diff confirm card */}
      {pendingDiff && (
        <DiffConfirmCard
          diff={pendingDiff.diff}
          onConfirm={handleConfirmDiff}
          onReject={handleRejectDiff}
        />
      )}
    </div>
  );
}
