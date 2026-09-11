import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useToast } from '../components/Toast';

export default function MasteryDashboard() {
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('concepts'); // 'concepts' | 'matrix' | 'evidence'
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'mastered' | 'in_progress' | 'weak'

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const res = await api.get('/mastery/overview');
      setData(res.data);
    } catch (err) {
      toast.error('Failed to load mastery data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner" />
        <p className="loading-text">Loading cognitive mastery & uncertainty estimates…</p>
      </div>
    );
  }

  const { learnerRating, difficultyLevel, attemptCount, summary, concepts = [], recentInteractions = [] } = data || {};

  // Filter concepts
  const filteredConcepts = concepts.filter((c) => {
    const matchesSearch = c.conceptTag.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter || (statusFilter === 'weak' && (c.status === 'weak' || c.status === 'evaluating'));
    return matchesSearch && matchesStatus;
  });

  // Quadrant classification:
  // Q1: Mastered & Confirmed (Mastery >= 0.70, Uncertainty <= 0.25)
  // Q2: Tentative High (Mastery >= 0.70, Uncertainty > 0.25)
  // Q3: Active Learning / Exploring (Mastery < 0.70, Uncertainty > 0.25)
  // Q4: Confirmed Knowledge Gap (Mastery < 0.70, Uncertainty <= 0.25)
  const q1 = concepts.filter((c) => c.pMastery >= 0.70 && c.uncertainty <= 0.25);
  const q2 = concepts.filter((c) => c.pMastery >= 0.70 && c.uncertainty > 0.25);
  const q3 = concepts.filter((c) => c.pMastery < 0.70 && c.uncertainty > 0.25);
  const q4 = concepts.filter((c) => c.pMastery < 0.70 && c.uncertainty <= 0.25);

  const getDifficultyBadge = (lvl) => {
    const badges = {
      1: { label: 'Level 1 • Beginner', color: 'var(--text-3)' },
      2: { label: 'Level 2 • Novice', color: 'var(--info)' },
      3: { label: 'Level 3 • Intermediate', color: 'var(--accent-light)' },
      4: { label: 'Level 4 • Advanced', color: 'var(--warning)' },
      5: { label: 'Level 5 • Master', color: 'var(--success)' },
    };
    return badges[lvl] || badges[3];
  };

  return (
    <div className="page" style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '1.75rem' }}>🧠</span>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
              TRACE-KT Cognitive Mastery
            </h1>
            <span className="badge badge-purple" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Research Engine
            </span>
          </div>
          <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', maxWidth: 650, margin: 0 }}>
            Bayesian Knowledge Tracing dynamically calibrated via <strong>Cognitive Evidence Strength (CES)</strong>, 
            <strong> Question Trust</strong>, and closed-form <strong>Beta Epistemic Uncertainty</strong>.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button className="btn btn-outline btn-sm" onClick={fetchOverview}>
            🔄 Refresh
          </button>
          <Link to="/roadmap" className="btn btn-primary btn-sm">
            🗺️ Back to Roadmap
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem',
      }}>
        {/* Learner Ability Card */}
        <div className="card" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Learner Ability (Elo)
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '2.25rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.03em' }}>
              {learnerRating || 1200}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--accent-light)', fontWeight: 600 }}>
              points
            </span>
          </div>
          <span className="badge" style={{
            background: 'rgba(124,58,237,0.15)',
            color: getDifficultyBadge(difficultyLevel).color,
            fontSize: '0.75rem',
            fontWeight: 600,
          }}>
            {getDifficultyBadge(difficultyLevel).label}
          </span>
        </div>

        {/* Average Mastery */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Average Knowledge Mastery
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '2.25rem', fontWeight: 900, color: 'var(--cyan)', letterSpacing: '-0.03em' }}>
              {Math.round((summary?.averageMastery || 0) * 100)}%
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>
              across {summary?.totalConcepts || 0} concepts
            </span>
          </div>
          <div className="progress-track" style={{ height: 6 }}>
            <div className="progress-fill" style={{
              width: `${(summary?.averageMastery || 0) * 100}%`,
              background: 'linear-gradient(90deg, var(--accent), var(--cyan))',
            }} />
          </div>
        </div>

        {/* Average Uncertainty */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Epistemic Uncertainty
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '2.25rem', fontWeight: 900, color: (summary?.averageUncertainty || 0.5) < 0.25 ? 'var(--success)' : 'var(--warning)', letterSpacing: '-0.03em' }}>
              ±{Math.round((summary?.averageUncertainty || 0.5) * 100)}%
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>
              {(summary?.averageUncertainty || 0.5) < 0.25 ? 'High confidence' : 'Exploring'}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>
            Tracks evidence count & response consistency
          </div>
        </div>

        {/* Concepts State Breakdown */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            Concept Breakdown
          </div>
          <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.25rem' }}>
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)' }}>{summary?.masteredCount || 0}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>Mastered</div>
            </div>
            <div style={{ width: 1, background: 'var(--border)' }} />
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-light)' }}>{summary?.inProgressCount || 0}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>In Progress</div>
            </div>
            <div style={{ width: 1, background: 'var(--border)' }} />
            <div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--danger)' }}>{summary?.weakCount || 0}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>Need Review</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
        borderBottom: '1px solid var(--border)',
        marginBottom: '1.5rem',
      }}>
        <button
          onClick={() => setActiveTab('concepts')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'concepts' ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeTab === 'concepts' ? 'var(--text)' : 'var(--text-3)',
            fontWeight: activeTab === 'concepts' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
            transition: 'all 0.15s ease',
          }}
        >
          📊 Concept Matrix ({concepts.length})
        </button>
        <button
          onClick={() => setActiveTab('matrix')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'matrix' ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeTab === 'matrix' ? 'var(--text)' : 'var(--text-3)',
            fontWeight: activeTab === 'matrix' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
            transition: 'all 0.15s ease',
          }}
        >
          🗂️ Mastery × Uncertainty Quadrants
        </button>
        <button
          onClick={() => setActiveTab('evidence')}
          style={{
            padding: '0.75rem 1.25rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'evidence' ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeTab === 'evidence' ? 'var(--text)' : 'var(--text-3)',
            fontWeight: activeTab === 'evidence' ? 700 : 500,
            cursor: 'pointer',
            fontSize: '0.9rem',
            transition: 'all 0.15s ease',
          }}
        >
          ⚡ Cognitive Evidence Logs ({recentInteractions.length})
        </button>
      </div>

      {/* Tab Content */}

      {/* TAB 1: Concept Matrix Table */}
      {activeTab === 'concepts' && (
        <div>
          {/* Controls: Search & Filter */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search concept tags…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input"
              style={{ maxWidth: 300, fontSize: '0.85rem' }}
            />
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {['all', 'mastered', 'in_progress', 'weak'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className="btn btn-sm"
                  style={{
                    fontSize: '0.75rem',
                    background: statusFilter === st ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                    color: statusFilter === st ? '#fff' : 'var(--text-2)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {st === 'all' ? 'All' : st === 'mastered' ? 'Mastered' : st === 'in_progress' ? 'In Progress' : 'Need Review'}
                </button>
              ))}
            </div>
          </div>

          {filteredConcepts.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎯</div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No concepts tracked yet</h3>
              <p style={{ color: 'var(--text-3)', fontSize: '0.85rem', maxWidth: 400, margin: '0 auto 1.25rem' }}>
                Complete chapter knowledge checks to activate the TRACE-KT cognitive evidence engine.
              </p>
              <Link to="/roadmap" className="btn btn-primary btn-sm">
                Start a Chapter
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filteredConcepts.map((c) => {
                const isMastered = c.pMastery >= 0.85;
                const isWeak = c.pMastery < 0.60;
                const statusColor = isMastered ? 'var(--success)' : isWeak ? 'var(--danger)' : 'var(--accent-light)';

                return (
                  <div
                    key={c.conceptTag}
                    className="card"
                    style={{
                      padding: '1rem 1.25rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1.25rem',
                      flexWrap: 'wrap',
                    }}
                  >
                    {/* Concept Name & Status */}
                    <div style={{ flex: '1 1 200px', minWidth: 160 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)', marginBottom: '0.2rem' }}>
                        {c.conceptTag}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span
                          className="badge"
                          style={{
                            fontSize: '0.65rem',
                            padding: '0.15rem 0.45rem',
                            background: isMastered ? 'var(--success-bg)' : isWeak ? 'var(--danger-bg)' : 'rgba(124,58,237,0.15)',
                            color: statusColor,
                            fontWeight: 700,
                          }}
                        >
                          {isMastered ? 'Mastered' : isWeak ? (c.status === 'evaluating' ? 'Gathering Evidence' : 'Needs Review') : 'In Progress'}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>
                          Beta(α={c.betaAlpha}, β={c.betaBeta})
                        </span>
                      </div>
                    </div>

                    {/* Visual Mastery Bar with Uncertainty Margin */}
                    <div style={{ flex: '2 1 280px', minWidth: 200 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.3rem' }}>
                        <span style={{ color: 'var(--text-2)' }}>Mastery Posterior</span>
                        <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                          {Math.round(c.pMastery * 100)}%
                          <span style={{ color: 'var(--text-3)', fontWeight: 400, marginLeft: 4 }}>
                            ±{Math.round(c.uncertainty * 100)}%
                          </span>
                        </span>
                      </div>

                      <div style={{ position: 'relative', height: 18, background: 'rgba(255,255,255,0.06)', borderRadius: 9, overflow: 'hidden' }}>
                        {/* Uncertainty Band (Confidence Interval) */}
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            height: '100%',
                            left: `${Math.max(0, (c.pMastery - c.uncertainty) * 100)}%`,
                            width: `${Math.min(100, c.uncertainty * 2 * 100)}%`,
                            background: 'rgba(124, 58, 237, 0.25)',
                            borderRadius: 9,
                          }}
                        />
                        {/* Solid Mastery Fill */}
                        <div
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            height: '100%',
                            width: `${c.pMastery * 100}%`,
                            background: statusColor,
                            borderRadius: 9,
                            opacity: 0.85,
                            transition: 'width 0.4s ease',
                          }}
                        />
                      </div>
                    </div>

                    {/* Uncertainty Badge */}
                    <div style={{ flex: '0 0 110px', textAlign: 'right' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginBottom: '0.1rem' }}>
                        Uncertainty
                      </div>
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: c.uncertainty < 0.20 ? 'var(--success)' : c.uncertainty < 0.35 ? 'var(--accent-light)' : 'var(--warning)',
                      }}>
                        {c.uncertainty < 0.20 ? '🟢 Confident' : c.uncertainty < 0.35 ? '🟡 Moderate' : '🟠 High (Cold)'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Quadrant Matrix */}
      {activeTab === 'matrix' && (
        <div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', marginBottom: '1.25rem' }}>
            The 2×2 Epistemic Matrix separates actual learner mastery from model certainty. Unlike standard KT, TRACE-KT identifies when low performance is due to confirmed knowledge gaps versus lack of interaction evidence.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.25rem',
          }}>
            {/* Q1: Mastered & Confirmed */}
            <div className="card" style={{ borderColor: 'rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.03)', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>🏆</span>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--success)' }}>
                    Mastered & Confirmed
                  </h3>
                </div>
                <span className="badge badge-success">{q1.length} concepts</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '1rem' }}>
                High Mastery (≥70%), Low Uncertainty (≤25%). Evidence is solid, verified across multiple consistent items.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {q1.length > 0 ? (
                  q1.map((c) => (
                    <span key={c.conceptTag} className="badge badge-muted" style={{ fontSize: '0.75rem', color: 'var(--text)' }}>
                      {c.conceptTag} ({Math.round(c.pMastery * 100)}%)
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>No concepts in this quadrant</span>
                )}
              </div>
            </div>

            {/* Q2: Tentative High */}
            <div className="card" style={{ borderColor: 'rgba(124,58,237,0.3)', background: 'rgba(124,58,237,0.03)', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>🧪</span>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--accent-light)' }}>
                    Tentative Mastery
                  </h3>
                </div>
                <span className="badge badge-purple">{q2.length} concepts</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '1rem' }}>
                High Mastery (≥70%), High Uncertainty (&gt;25%). Learner answered correctly, but with few attempts, hints used, or low-trust items. Needs validation.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {q2.length > 0 ? (
                  q2.map((c) => (
                    <span key={c.conceptTag} className="badge badge-muted" style={{ fontSize: '0.75rem', color: 'var(--text)' }}>
                      {c.conceptTag} (±{Math.round(c.uncertainty * 100)}%)
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>No concepts in this quadrant</span>
                )}
              </div>
            </div>

            {/* Q4: Confirmed Knowledge Gap */}
            <div className="card" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.03)', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--danger)' }}>
                    Confirmed Knowledge Gap
                  </h3>
                </div>
                <span className="badge badge-danger">{q4.length} concepts</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '1rem' }}>
                Low Mastery (&lt;70%), Low Uncertainty (≤25%). High evidence confirming the learner struggles here. Recommended for reinforcement chapters.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {q4.length > 0 ? (
                  q4.map((c) => (
                    <span key={c.conceptTag} className="badge" style={{ fontSize: '0.75rem', background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                      {c.conceptTag} ({Math.round(c.pMastery * 100)}%)
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>No confirmed weak gaps detected 🎉</span>
                )}
              </div>
            </div>

            {/* Q3: Exploring / Insufficient Data */}
            <div className="card" style={{ borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.03)', padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>🔍</span>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, color: 'var(--warning)' }}>
                    Cold Start / Exploring
                  </h3>
                </div>
                <span className="badge" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>{q3.length} concepts</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '1rem' }}>
                Low Mastery (&lt;70%), High Uncertainty (&gt;25%). Untested or nascent concepts with uninformative prior. More assessments needed before intervening.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {q3.length > 0 ? (
                  q3.map((c) => (
                    <span key={c.conceptTag} className="badge badge-muted" style={{ fontSize: '0.75rem', color: 'var(--text)' }}>
                      {c.conceptTag} (U={Math.round(c.uncertainty * 100)}%)
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>No concepts in this quadrant</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Cognitive Evidence Audit Log */}
      {activeTab === 'evidence' && (
        <div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', marginBottom: '1.25rem' }}>
            TRACE-KT audits every learner-item interaction. The <strong>Cognitive Evidence Strength (CES)</strong> is computed from response time, hint count, confidence calibration, and attempt repetition, then multiplied by the <strong>Question Trust Score</strong> to determine the effective Bayesian evidence weight.
          </p>

          {recentInteractions.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📝</div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No interaction logs yet</h3>
              <p style={{ color: 'var(--text-3)', fontSize: '0.85rem' }}>
                Interactions will appear here as you answer questions in chapter assessments.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recentInteractions.map((log, idx) => (
                <div
                  key={log.id || idx}
                  className="card"
                  style={{
                    padding: '1rem 1.25rem',
                    borderLeft: `4px solid ${log.correct ? 'var(--success)' : 'var(--danger)'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.1rem' }}>{log.correct ? '✅' : '❌'}</span>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)' }}>
                        {log.conceptTag}
                      </span>
                      <span className="badge badge-muted" style={{ fontSize: '0.7rem' }}>
                        Attempt #{log.attemptNumber}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem' }}>
                      <span style={{ color: 'var(--text-3)' }}>
                        {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {log.questionText && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-2)', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                      {log.questionText}
                    </div>
                  )}

                  {/* Behavioral signals & CES decomposition */}
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    background: 'rgba(255,255,255,0.025)',
                    padding: '0.6rem 0.8rem',
                    borderRadius: 8,
                    fontSize: '0.75rem',
                    alignItems: 'center',
                  }}>
                    <div>
                      <span style={{ color: 'var(--text-3)' }}>⏱ Time: </span>
                      <strong style={{ color: 'var(--text)' }}>{Math.round((log.responseTimeMs || 0) / 1000)}s</strong>
                    </div>
                    <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
                    <div>
                      <span style={{ color: 'var(--text-3)' }}>💡 Hints: </span>
                      <strong style={{ color: 'var(--text)' }}>{log.hintCount || 0}</strong>
                    </div>
                    <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
                    <div>
                      <span style={{ color: 'var(--text-3)' }}>Confidence: </span>
                      <strong style={{ color: 'var(--text)' }}>{Math.round((log.confidence || 0.5) * 100)}%</strong>
                    </div>
                    <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
                    <div>
                      <span style={{ color: 'var(--text-3)' }}>Question Elo: </span>
                      <strong style={{ color: 'var(--text)' }}>{log.questionElo}</strong>
                    </div>
                    <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
                    <div>
                      <span style={{ color: 'var(--text-3)' }}>Trust Score: </span>
                      <strong style={{ color: 'var(--cyan)' }}>{Math.round((log.trustScore ?? 0.5) * 100)}%</strong>
                    </div>
                    <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
                    <div>
                      <span style={{ color: 'var(--accent-light)', fontWeight: 700 }}>
                        CES: {log.cesScore !== null ? log.cesScore : '—'}
                      </span>
                      <span style={{ color: 'var(--text-3)', margin: '0 4px' }}>→</span>
                      <span style={{ color: 'var(--success)', fontWeight: 800 }}>
                        w = {log.effectiveWeight !== null ? log.effectiveWeight : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
