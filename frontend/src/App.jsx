import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import BlueprintLoader from './components/BlueprintLoader';

const CRMLoginPage = lazy(() => import('./pages/CRMLoginPage'));
const CRMDashboard = lazy(() => import('./pages/CRMDashboard'));

const ProtectedCRMRoute = ({ children }) => {
  const token = localStorage.getItem('crm_token');
  if (!token) {
    return <Navigate to="/crm/login" replace />;
  }
  return children;
};

export default function App() {
  return (
    <Router>
      <Suspense fallback={<BlueprintLoader />}>
        <Routes>
          <Route path="/crm/login" element={<CRMLoginPage />} />
          <Route path="/login" element={<Navigate to="/crm/login" replace />} />
          <Route
            path="/crm"
            element={
              <ProtectedCRMRoute>
                <CRMDashboard />
              </ProtectedCRMRoute>
            }
          />
          <Route
            path="/crm/pre-sales"
            element={
              <ProtectedCRMRoute>
                <CRMDashboard forcedPipeline="pre_sales" />
              </ProtectedCRMRoute>
            }
          />
          <Route
            path="/crm/main-sales"
            element={
              <ProtectedCRMRoute>
                <CRMDashboard forcedPipeline="main_sales" />
              </ProtectedCRMRoute>
            }
          />
          <Route
            path="/crm/post-sales"
            element={
              <ProtectedCRMRoute>
                <CRMDashboard forcedPipeline="post_sales" />
              </ProtectedCRMRoute>
            }
          />
          <Route path="/" element={<Navigate to="/crm" replace />} />
          <Route path="*" element={<Navigate to="/crm" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

