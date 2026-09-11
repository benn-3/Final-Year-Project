import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/frontend';
import { useToast } from '../components/Toast';

export default function ChapterPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [chapter, setChapter] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [noteText, setNoteText] = useState('');
  const [noteFile, setNoteFile] = useState(null);
  const [noteLoading, setNoteLoading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    Promise.all([
      api.get(`/chapters/${id}`),
      api.get(`/chapters/${id}/notes`),
    ]).then(([ch, n]) => {
      setChapter(ch.data);
      setNotes(n.data);
    }).catch(() => setError('Failed to load chapter'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleNoteSubmit = async (e) => {
    e.preventDefault();
    if (!noteText.trim() && !noteFile) return;
    setNoteLoading(true);
    try {
      const form = new FormData();
      if (noteFile) form.append('file', noteFile);
      if (noteText.trim()) form.append('text', noteText.trim());
      const { data } = await api.post(`/chapters/${id}/notes`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setNotes((n) => [data, ...n]);
      setNoteText('');
      setNoteFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('Note saved');
    } catch {
      toast.error('Failed to save note');
    } finally {
      setNoteLoading(false);
    }
  };

  if (loading) return <div className="loading-page"><div className="spinner" /></div>;
  if (error) return <div className="loading-page"><p style={{ color: 'var(--danger)' }}>{error}</p></div>;
  if (!chapter) return null;

  const STATUS_BADGE = {
    not_started: { label: 'Not started', cls: 'badge-muted' },
    in_progress: { label: 'In progress', cls: 'badge-info' },
    knowledge_check_pending: { label: 'Quiz pending', cls: 'badge-warning' },
    completed: { label: 'Completed', cls: 'badge-success' },
  };
  const badge = STATUS_BADGE[chapter.status] || STATUS_BADGE.not_started;

  return (
    <div className="page" style={{ maxWidth: 800 }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', marginBottom: '1rem' }}>
        <Link to="/roadmap" style={{ color: 'var(--text-3)' }}>Roadmap</Link>
        {' / '}
        <span style={{ color: 'var(--text-2)' }}>{chapter.milestone?.title}</span>
        {' / '}
        {chapter.title}
      </div>

      {/* Chapter header */}
      <div className="card mb-3" style={{ borderColor: chapter.status === 'completed' ? 'rgba(16,185,129,0.3)' : 'var(--border)' }}>
        <div className="flex justify-between items-center mb-2">
          <span className={`badge ${badge.cls}`}>{badge.label}</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}>
            {chapter.milestone?.title} · Chapter {chapter.order}
          </span>
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.25rem' }}>{chapter.title}</h1>

        <div>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.6rem' }}>
            Learning Objectives
          </p>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {chapter.objectives.map((obj, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', fontSize: '0.9rem', color: 'var(--text)' }}>
                <span style={{ color: 'var(--accent-light)', fontWeight: 700, flexShrink: 0 }}>→</span>
                {obj}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Assessment CTA */}
      <div className="card mb-3" style={{
        background: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(6,182,212,0.05))',
        borderColor: 'rgba(124,58,237,0.2)',
      }}>
        <div className="flex justify-between items-center">
          <div>
            <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
              {chapter.status === 'completed' ? '✅ Chapter Complete' : '🎯 Knowledge Check'}
            </div>
            <p style={{ fontSize: '0.875rem' }}>
              {chapter.status === 'completed'
                ? 'You passed the knowledge check for this chapter.'
                : 'Test your understanding with an AI-generated quiz.'}
            </p>
          </div>
          <button
            id={`btn-start-assessment-${id}`}
            className={`btn ${chapter.status === 'completed' ? 'btn-outline' : 'btn-primary'} btn-sm`}
            onClick={() => navigate(`/chapters/${id}/assessment`)}
            style={{ flexShrink: 0 }}
          >
            {chapter.status === 'completed' ? 'Review Quiz' : chapter.status === 'knowledge_check_pending' ? 'Retry Quiz' : 'Start Quiz'}
          </button>
        </div>
      </div>

      {/* Notes section */}
      <div>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>📝 My Notes</h2>

        {/* Note input */}
        <form onSubmit={handleNoteSubmit} className="card mb-2" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <textarea
            id="note-text-input"
            className="input"
            placeholder="Add a text note or paste a summary…"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={3}
          />
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-2)' }}>
              <input id="note-file-input" type="file" ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.doc,.docx"
                onChange={(e) => setNoteFile(e.target.files[0] || null)}
              />
              📎 {noteFile ? noteFile.name : 'Attach file'}
            </label>
            <button id="btn-save-note" type="submit" className="btn btn-primary btn-sm"
              disabled={noteLoading || (!noteText.trim() && !noteFile)} style={{ marginLeft: 'auto' }}>
              {noteLoading ? <span className="spinner spinner-sm" /> : 'Save Note'}
            </button>
          </div>
        </form>

        {/* Existing notes */}
        {notes.length === 0 && (
          <p style={{ color: 'var(--text-3)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem' }}>
            No notes yet. Add your first note above.
          </p>
        )}
        {notes.map((note) => (
          <div key={note.id} className="card mb-1" style={{ padding: '1rem' }}>
            {note.contentText && (
              <p style={{ fontSize: '0.875rem', color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{note.contentText}</p>
            )}
            {note.signedUrl && (
              <a href={note.signedUrl} target="_blank" rel="noopener noreferrer"
                className="btn btn-outline btn-sm" style={{ marginTop: note.contentText ? '0.5rem' : 0 }}>
                📄 {note.fileType?.includes('image') ? 'View Image' : 'Download File'}
              </a>
            )}
            <p style={{ fontSize: '0.72rem', color: 'var(--text-3)', marginTop: '0.5rem' }}>
              {new Date(note.uploadedAt).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
