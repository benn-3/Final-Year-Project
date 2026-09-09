import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './components/Toast';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OnboardingPage from './pages/OnboardingPage';
import RoadmapPage from './pages/RoadmapPage';
import ChapterPage from './pages/ChapterPage';
import AssessmentPage from './pages/AssessmentPage';

function ProtectedRoute({ children }) {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
}

function GuestRoute({ children }) {
  const { isLoggedIn } = useAuth();
  return !isLoggedIn ? children : <Navigate to="/roadmap" replace />;
}

function Layout({ children }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
    </>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/roadmap" replace />} />
      <Route path="/login"    element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
      <Route path="/onboard"  element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
      <Route path="/roadmap"  element={<ProtectedRoute><Layout><RoadmapPage /></Layout></ProtectedRoute>} />
      <Route path="/chapters/:id"            element={<ProtectedRoute><Layout><ChapterPage /></Layout></ProtectedRoute>} />
      <Route path="/chapters/:id/assessment" element={<ProtectedRoute><Layout><AssessmentPage /></Layout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/roadmap" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
