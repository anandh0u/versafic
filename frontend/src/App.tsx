import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './hooks/AuthProvider';
import { BillingProvider } from './hooks/BillingProvider';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { DashboardShell } from './components/layout/DashboardShell';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OverviewPage from './pages/OverviewPage';
import BillingPage from './pages/BillingPage';
import DemoLabPage from './pages/DemoLabPage';
import BusinessProfilePage from './pages/BusinessProfilePage';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route
            path="/dashboard"
            element={
              <BillingProvider>
                <DashboardShell />
              </BillingProvider>
            }
          >
            <Route index element={<OverviewPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="demo" element={<DemoLabPage />} />
            <Route path="business" element={<BusinessProfilePage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
