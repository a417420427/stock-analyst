import { Layout, Menu, Space, Input, AutoComplete, Dropdown, Button } from 'antd';
import { useState, useEffect } from 'react';
import {
  DashboardOutlined,
  ThunderboltOutlined,
  SearchOutlined,
  RobotOutlined,
  WalletOutlined,
  ApartmentOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import TradingCalendar from './TradingCalendar';
import { useAuth } from '../../hooks/useAuth';

const { Sider, Content, Header } = Layout;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: '大盘行情' },
  { key: '/stocks', icon: <SearchOutlined />, label: '全部股票' },
  { key: '/strategies', icon: <ThunderboltOutlined />, label: '策略引擎' },
  { key: '/portfolio', icon: <WalletOutlined />, label: '模拟交易' },
  { key: '/sectors', icon: <ApartmentOutlined />, label: '行业板块' },
  { key: '/ai', icon: <RobotOutlined />, label: 'AI 设置' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchVal, setSearchVal] = useState('');
  const [searchOptions, setSearchOptions] = useState<{ value: string; label: string }[]>([]);
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!searchVal.trim() || searchVal.length < 1) {
      setSearchOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/v1/market/stocks/search?q=' + encodeURIComponent(searchVal.trim()));
        const data = await res.json();
        setSearchOptions(
          (data || []).slice(0, 8).map((s: any) => ({
            value: String(s.id) + ':' + s.symbol,
            label: `${s.name} (${s.symbol}.${s.market})`,
          }))
        );
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [searchVal]);

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
          {/* 全局搜索框 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, maxWidth: 420 }}>
            <AutoComplete
              value={searchVal}
              onChange={setSearchVal}
              onSelect={(val) => {
                // val 格式 "{id}:{symbol}"
                const id = val.split(':')[0];
                if (id) navigate(`/analysis/${id}`);
                setSearchVal('');
              }}
              options={searchOptions}
              style={{ width: '100%' }}
            >
              <Input
                prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
                placeholder="搜索股票（代码/名称）"
                style={{ borderRadius: 20, background: '#f5f5f5', border: 'none' }}
              />
            </AutoComplete>
          </div>
          <Space>
            <TradingCalendar />
            <span style={{ color: '#86909c', fontSize: 13 }}>
              {new Date().toLocaleString('zh-CN', {
                timeZone: 'Asia/Shanghai',
                hour12: false,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            {user && (
              <Dropdown menu={{
                items: [
                  { key: 'user', label: user.username, disabled: true },
                  { type: 'divider' },
                  { key: 'logout', label: '退出登录', danger: true, onClick: () => { logout(); navigate('/auth'); } },
                ],
              }}>
                <Button type="text" icon={<UserOutlined />} style={{ borderRadius: 20 }}>
                  {user.username}
                </Button>
              </Dropdown>
            )}
          </Space>
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
