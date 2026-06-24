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

  // 计算当前选中菜单项（支持子路径）
  const selectedKey = '/' + location.pathname.split('/')[1];
  const selectedKeyFinal = menuItems.find(i => i.key === selectedKey) ? selectedKey : '/';

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light" width={220} style={{ borderRight: '1px solid #f0f0f0' }}>
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 18,
          fontWeight: 700,
          color: '#1677ff',
          borderBottom: '1px solid #f0f0f0',
        }}>
          📊 StockAnalyst
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKeyFinal]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 'none', marginTop: 8 }}
        />
      </Sider>
      <Layout>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0',
          height: 56,
        }}>
          <div style={{ fontSize: 16, fontWeight: 500 }}>
            {menuItems.find(i => i.key === selectedKeyFinal)?.label || '仪表盘'}
          </div>
          <div style={{ color: '#999', fontSize: 13 }}>
            {new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
          </div>
        </Header>
        <Content style={{ padding: 24, background: '#f0f2f5' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
