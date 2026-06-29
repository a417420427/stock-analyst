import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from './components/common/AppLayout';
import Dashboard from './pages/Dashboard';
import StocksPage from './pages/StocksPage';
import AnalysisPage from './pages/AnalysisPage';
import AISettingsPage from './pages/AISettingsPage';
import PortfolioPage from './pages/PortfolioPage';
import SectorPage from './pages/SectorPage';
import AuthPage from './pages/AuthPage';
import { useAuth } from './hooks/useAuth';

// 路由守卫 — 未登录跳登录页
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAuth();
  const location = useLocation();

  if (!isLoggedIn()) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#6366f1',
          colorSuccess: '#00a854',
          colorError: '#e34d4d',
          colorWarning: '#fa8c16',
          borderRadius: 8,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif",
          fontSize: 13,
        },
        components: {
          Card: {
            paddingLG: 20,
          },
          Table: {
            headerBg: '#fafafa',
            headerBorderRadius: 8,
          },
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={
            <PrivateRoute>
              <AppLayout />
            </PrivateRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="stocks" element={<StocksPage />} />
            <Route path="analysis/:stockId" element={<AnalysisPage />} />
            <Route path="portfolio" element={<PortfolioPage />} />
            <Route path="sectors" element={<SectorPage />} />
            <Route path="ai" element={<AISettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;
