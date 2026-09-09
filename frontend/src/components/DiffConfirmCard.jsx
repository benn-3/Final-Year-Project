const OP_CONFIG = {
  add_milestone: { label: 'Add Milestone', cls: 'diff-add', icon: '+ M' },
  remove_milestone: { label: 'Remove Milestone', cls: 'diff-remove', icon: '− M' },
  add_chapter: { label: 'Add Chapter', cls: 'diff-add', icon: '+ C' },
  remove_chapter: { label: 'Remove Chapter', cls: 'diff-remove', icon: '− C' },
  edit_chapter: { label: 'Edit Chapter', cls: 'diff-edit', icon: '✎ C' },
  reorder: { label: 'Reorder', cls: 'diff-reorder', icon: '⇅' },
};

function OpItem({ op }) {
  const cfg = OP_CONFIG[op.op] || { label: op.op, cls: 'diff-edit', icon: '?' };
  return (
    <div className={`diff-op ${cfg.cls}`}>
      <span style={{ fontWeight: 800, fontSize: '0.72rem', flexShrink: 0, opacity: 0.8 }}>{cfg.icon}</span>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{cfg.label}</div>
        <div style={{ fontSize: '0.78rem', opacity: 0.8, marginTop: '0.15rem' }}>
          {op.title && <span>"{op.title}"</span>}
          {op.id && <span> (id: {op.id})</span>}
          {op.milestone_id && <span> → milestone {op.milestone_id}</span>}
          {op.objectives && <span> · {op.objectives.length} objectives</span>}
          {op.type && op.new_order !== undefined && <span> {op.type} → order {op.new_order}</span>}
        </div>
      </div>
    </div>
  );
}

export default function DiffConfirmCard({ diff, onConfirm, onReject }) {
  return (
    <div className="overlay">
      <div className="modal" style={{ maxWidth: 580 }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontWeight: 800, marginBottom: '0.5rem' }}>Proposed Changes</h3>
          <p style={{ color: 'var(--text-2)', fontSize: '0.875rem' }}>
            The AI proposes the following changes. Review carefully before confirming.
          </p>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          {diff.operations.map((op, i) => <OpItem key={i} op={op} />)}
        </div>

        {diff.rationale && (
          <div style={{
            padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)',
            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
            fontSize: '0.83rem', color: 'var(--text-2)', marginBottom: '1.25rem',
          }}>
            <strong style={{ color: 'var(--text)', display: 'block', marginBottom: '0.25rem' }}>Rationale</strong>
            {diff.rationale}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button id="btn-diff-reject" className="btn btn-danger" style={{ flex: 1 }} onClick={onReject}>
            ✕ Reject
          </button>
          <button id="btn-diff-confirm" className="btn btn-primary" style={{ flex: 1 }} onClick={onConfirm}>
            ✓ Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
}
