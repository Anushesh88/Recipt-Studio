import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import Templates from './pages/Templates';
import { Editor } from './pages/Editor';
import { Generate } from './pages/Generate';
import { History } from './pages/History';
import { Settings } from './pages/Settings';
import { Welcome } from './pages/Welcome';
import { Reports } from './pages/Reports';
import { WakingUpNotice } from './components/WakingUpNotice';
import { PrivacyPolicy, TermsOfService } from './pages/Legal';
import { ForgotPassword, ResetPassword } from './pages/PasswordReset';
import { AdminFeedback } from './pages/AdminFeedback';
import { FeedbackButton } from './components/FeedbackButton';
import { Landing } from './pages/Landing';

function App() {
  const token = useAuthStore((state) => state.token);
  const requireAuth = (page: ReactNode) => (token ? page : <Navigate to="/login" />);

  return (
    <BrowserRouter>
      <WakingUpNotice />
      <Routes>
        {/* What Receipt Studio is, for visitors; signed in, straight to work */}
        <Route path="/" element={token ? <Navigate to="/templates" /> : <Landing />} />
        <Route path="/login" element={token ? <Navigate to="/templates" /> : <Login />} />
        {/* Public, signed in or not */}
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/forgot-password" element={token ? <Navigate to="/templates" /> : <ForgotPassword />} />
        {/* Works signed in too: the link may be opened in a browser with another session */}
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/templates" element={requireAuth(<Templates />)} />
        {/* /editor = new blank template, /editor/:id = saved template */}
        <Route path="/editor/:id?" element={requireAuth(<Editor />)} />
        <Route path="/generate/:templateId" element={requireAuth(<Generate />)} />
        <Route path="/history" element={requireAuth(<History />)} />
        <Route path="/settings" element={requireAuth(<Settings />)} />
        <Route path="/welcome" element={requireAuth(<Welcome />)} />
        <Route path="/reports" element={requireAuth(<Reports />)} />
        <Route path="/admin/feedback" element={requireAuth(<AdminFeedback />)} />
        <Route path="*" element={<Navigate to={token ? "/templates" : "/"} />} />
      </Routes>
      {token && <FeedbackButton />}
    </BrowserRouter>
  );
}

export default App;
