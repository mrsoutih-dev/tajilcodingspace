import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/auth/AuthContext';
import { I18nProvider } from '@/i18n/I18nContext';
import { AppShell } from '@/components/AppShell';
import { AuthPage } from '@/pages/AuthPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { ProjectWorkspacePage } from '@/pages/ProjectWorkspacePage';
import { ChatPage } from '@/pages/ChatPage';
import { AgentsPage } from '@/pages/AgentsPage';
import { ModelsPage } from '@/pages/ModelsPage';
import { SkillsPage } from '@/pages/SkillsPage';
import { GithubPage } from '@/pages/GithubPage';
import { DeploymentsPage } from '@/pages/DeploymentsPage';
import { SettingsPage } from '@/pages/SettingsPage';

function ProtectedApp() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-950">
        <div className="h-8 w-8 rounded-full border-2 border-ink-700 border-t-brand-400 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/signin" replace />;
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectWorkspacePage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/models" element={<ModelsPage />} />
        <Route path="/skills" element={<SkillsPage />} />
        <Route path="/github" element={<GithubPage />} />
        <Route path="/deployments" element={<DeploymentsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/signin" element={<AuthPage mode="signin" />} />
            <Route path="/signup" element={<AuthPage mode="signup" />} />
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/*" element={<ProtectedApp />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  );
}
