import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, isLoggedIn, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!isLoggedIn) return null;

  return (
    <nav className="navbar">
      <Link to="/roadmap" className="navbar-brand">
        🧠 Learning<span>Advisor</span>
      </Link>

      <div className="flex items-center gap-2">
        {user?.email && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>
            {user.email}
          </span>
        )}
        <button
          id="btn-new-roadmap"
          onClick={() => navigate('/onboard')}
          className="btn btn-outline btn-sm"
        >
          New Goal
        </button>
        <button
          id="btn-logout"
          onClick={handleLogout}
          className="btn btn-ghost btn-sm"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
