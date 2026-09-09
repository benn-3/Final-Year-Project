import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await register(email, password);
      toast.success('Account created! Let\'s set up your learning goal.');
      navigate('/onboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">🧠</div>
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-sub">Start building your personalized learning roadmap</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && (
            <div className="toast toast-error" style={{ position: 'static', animation: 'none', minWidth: 'unset' }}>
              <span>✕</span><span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label className="label" htmlFor="reg-email">Email</label>
            <input id="reg-email" type="email" className="input" placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div className="form-group">
            <label className="label" htmlFor="reg-password">Password</label>
            <input id="reg-password" type="password" className="input" placeholder="Min. 8 characters"
              value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="label" htmlFor="reg-confirm">Confirm password</label>
            <input id="reg-confirm" type="password" className="input" placeholder="Repeat your password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </div>

          <button id="btn-register-submit" type="submit" className="btn btn-primary btn-lg"
            disabled={loading} style={{ marginTop: '0.5rem' }}>
            {loading ? <><span className="spinner spinner-sm" /> Creating account…</> : 'Create account'}
          </button>
        </form>

        <div className="divider" />
        <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-2)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent-light)', fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
