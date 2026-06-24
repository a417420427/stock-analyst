import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  StarOutlined,
  ThunderboltOutlined,
  NotificationOutlined,
  BarChartOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';

const { Sider, Content, Header } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/watchlist', icon: <StarOutlined />, label: '自选股' },
  { key: '/strategies', icon: <ThunderboltOutlined />, label: '策略引擎' },
  { key: '/push', icon: <NotificationOutlined />, label: '推送设置' },
  { key: '/ai', icon: <RobotOutlined />, label: 'AI 设置' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const selectedKey = '/' + location.pathname.split('/')[1];
  const selectedKeyFinal = menuItems.find(i => i.key === selectedKey) ? selectedKey : '/';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 深色侧边栏 */}
      <Sider
        width={220}
        theme="dark"
        style={{
          background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
          borderRight: 'none',
        }}
      >
        <div className="sidebar-logo" style={{ color: '#fff' }}>
          <span style={{ marginRight: 8, fontSize: 22 }}>📊</span>
          <span style={{ background: 'linear-gradient(90deg, #667eea, #764ba2)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            StockAnalyst
          </span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKeyFinal]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{
            background: 'transparent',
            borderRight: 'none',
            marginTop: 8,
          }}
        />
      </Sider>

      <Layout>
        {/* 顶部栏 */}
        <Header
          style={{
            background: '#fff',
            padding: '0 28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f0f0f0',
            height: 56,
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, color: '#1d2129' }}>
            {menuItems.find(i => i.key === selectedKeyFinal)?.label || '仪表盘'}
          </div>
          <div style={{ color: '#86909c', fontSize: 13 }}>
            {new Date().toLocaleString('zh-CN', {
              timeZone: 'Asia/Shanghai',
              hour12: false,
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </Header>

        {/* 内容区 */}
        <Content
          style={{
            padding: 24,
            background: '#f5f6fa',
            minHeight: 'calc(100vh - 56px)',
          }}
        >
          <div className="fade-in">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
