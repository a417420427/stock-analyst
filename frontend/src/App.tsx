import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import AppLayout from './components/common/AppLayout';
import Dashboard from './pages/Dashboard';
import StocksPage from './pages/StocksPage';
import StrategyPage from './pages/StrategyPage';
import AnalysisPage from './pages/AnalysisPage';
import AISettingsPage from './pages/AISettingsPage';
import PortfolioPage from './pages/PortfolioPage';
import SectorPage from './pages/SectorPage';

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
          <Route path="/" element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="stocks" element={<StocksPage />} />
            <Route path="analysis/:stockId" element={<AnalysisPage />} />
            <Route path="strategies" element={<StrategyPage />} />
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
