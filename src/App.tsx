import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { HomePage } from './pages/HomePage';
import {
  AboutPage,
  AgentsPage,
  ContactPage,
  IntegrationsPage,
  PlatformPage,
  SecurityPage,
  SolutionsPage,
} from './pages/PublicPages';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { CommandCenterPage } from './pages/dashboard/CommandCenterPage';
import { AgentsHubPage } from './pages/dashboard/AgentsHubPage';
import { PatientsPage } from './pages/dashboard/PatientsPage';
import { AppointmentsPage } from './pages/dashboard/AppointmentsPage';
import {
  AnalyticsPage,
  DepartmentsPage,
  IntegrationsDashPage,
  OperationsWorkflowsPage,
  ResourcesPage,
  SettingsAdminPage,
} from './pages/dashboard/OperationsSubPages';

function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const target = document.getElementById(hash.slice(1));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname, hash]);

  return null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollManager />
        <Routes>
          {/* Public Website */}
          <Route path="/" element={<HomePage />} />
          <Route path="/platform" element={<PlatformPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/solutions" element={<SolutionsPage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/security" element={<SecurityPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />

          {/* Authentication */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Protected CareOS Application */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <CommandCenterPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/agents"
            element={
              <ProtectedRoute>
                <AgentsHubPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/patients"
            element={
              <ProtectedRoute>
                <PatientsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/appointments"
            element={
              <ProtectedRoute>
                <AppointmentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/departments"
            element={
              <ProtectedRoute>
                <DepartmentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/operations"
            element={
              <ProtectedRoute>
                <OperationsWorkflowsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/resources"
            element={
              <ProtectedRoute>
                <ResourcesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/analytics"
            element={
              <ProtectedRoute>
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/integrations"
            element={
              <ProtectedRoute>
                <IntegrationsDashPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/settings"
            element={
              <ProtectedRoute>
                <SettingsAdminPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
