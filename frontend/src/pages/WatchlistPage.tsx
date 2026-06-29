import { useEffect, useState } from 'react';
import {
  Card, Input, Table, Tag, Button, Space, message, Tabs,
  Modal, Dropdown, Popconfirm,
} from 'antd';
import {
  SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  MoreOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import api from '../services/api';
import StockDetailModal from '../components/market/StockDetailModal';

const { Search } = Input;

interface Stock {
  id: number;
  symbol: string;
  market: string;
  name: string;
  sector?: string;
  industry?: string;
  pe_ttm?: number | null;
  pb?: number | null;
  market_cap?: number | null;
}

interface WatchlistGroup {
  id: number;
  name: string;
  stocks: Stock[];
}

const marketTag: Record<string, string> = { A: 'blue', HK: 'purple', US: 'green' };

export default function WatchlistPage() {
  const [groups, setGroups] = useState<WatchlistGroup[]>([]);
  const [searchResults, setSearchResults] = useState<Stock[]>([]);
  const [searching, setSearching] = useState(false);
  const [allStocks, setAllStocks] = useState<Stock[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState('watchlist');
  const [renameModal, setRenameModal] = useState<{ id: number; name: string } | null>(null);
  const [detailStockId, setDetailStockId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    loadGroups();
    loadAllStocks();
  }, []);

  const loadGroups = async () => {
    try {
      const res = await api.get('/market/watchlists');
      setGroups(res.data || []);
    } catch { message.error('加载自选股失败'); }
  };

  const loadAllStocks = async () => {
    setLoadingAll(true);
    try {
      const res = await api.get('/market/stocks/all', { params: { limit: 500 } });
      setAllStocks(Array.isArray(res.data) ? res.data : []);
    } catch { message.error('加载股票列表失败'); }
    setLoadingAll(false);
  };

  const handleSearch = async (value: string) => {
    if (!value.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await api.get('/market/stocks/search', { params: { q: value.trim() } });
      setSearchResults(res.data);
    } catch { message.error('搜索失败'); }
    setSearching(false);
  };

  const handleAdd = async (stock: Stock, groupId?: number) => {
    const targetId = groupId || groups[0]?.id;
    if (!targetId) { message.error('请先创建分组'); return; }
    try {
      const res = await api.post(`/market/watchlists/${targetId}/items`, { stock_id: stock.id });
      if (res.data?.message === '已存在') {
        message.info(`${stock.name} 已在自选股中`);
      } else {
        message.success(`已添加 ${stock.name}`);
      }
      loadGroups();
    } catch { message.error('添加失败'); }
  };

  const handleRemove = async (stock: Stock) => {
    const g = groups.find(gg => gg.stocks.some(s => s.id === stock.id));
    if (!g) return;
    try {
      await api.delete(`/market/watchlists/${g.id}/items/${stock.id}`);
      message.success(`已移出 ${stock.name}`);
      loadGroups();
    } catch { message.error('移出失败'); }
  };

  const handleCreateGroup = async () => {
    const name = prompt('输入分组名称：');
    if (!name?.trim()) return;
    try {
      await api.post('/market/watchlists', name.trim(), { headers: { 'Content-Type': 'application/json' } });
      message.success('分组已创建');
      loadGroups();
    } catch { message.error('创建失败'); }
  };

  const handleRename = async () => {
    if (!renameModal) return;
    try {
      await api.patch(`/market/watchlists/${renameModal.id}`, renameModal.name, {
        headers: { 'Content-Type': 'application/json' },
      });
      message.success('重命名成功');
      setRenameModal(null);
      loadGroups();
    } catch { message.error('重命名失败'); }
  };

  const handleDeleteGroup = async (id: number) => {
    try {
      await api.delete(`/market/watchlists/${id}`);
      message.success('分组已删除');
      loadGroups();
    } catch { message.error('删除失败'); }
  };

  const handleMoveStock = async (stock: Stock, targetGroupId: number) => {
    const currentGroup = groups.find(gg => gg.stocks.some(s => s.id === stock.id));
    if (!currentGroup || currentGroup.id === targetGroupId) return;
    try {
      await api.delete(`/market/watchlists/${currentGroup.id}/items/${stock.id}`);
      await api.post(`/market/watchlists/${targetGroupId}/items`, { stock_id: stock.id });
      message.success(`已移到 ${groups.find(gg => gg.id === targetGroupId)?.name}`);
      loadGroups();
    } catch { message.error('移动失败'); }
  };

  const searchColumns = [
    { title: '市场', dataIndex: 'market', width: 70, render: (m: string) => <Tag color={marketTag[m]}>{m}</Tag> },
    { title: '代码', dataIndex: 'symbol', width: 100 },
    { title: '名称', dataIndex: 'name' },
    { title: '行业', dataIndex: "sector", width: 100 },
    {
      title: '操作', key: 'action', width: 140,
      render: (_: unknown, r: Stock) => (
        <AddToGroupSelect groups={groups} stock={r} onAdd={handleAdd} />
      ),
    },
  ];

  const watchlistColumns = (groupId: number) => [
    { title: '市场', dataIndex: 'market', width: 70, render: (m: string) => <Tag color={marketTag[m]}>{m}</Tag> },
    { title: '代码', dataIndex: 'symbol', width: 100 },
    { title: '名称', dataIndex: 'name' },
    { title: '行业', dataIndex: "sector", width: 100 },
    {
      title: '基本面', key: 'fundamentals', width: 200,
      render: (_: unknown, r: Stock) => {
        const parts: string[] = [];
        if (r.pe_ttm != null && Number(r.pe_ttm) > 0) parts.push(`PE:${Number(r.pe_ttm).toFixed(1)}`);
        if (r.pb != null && Number(r.pb) > 0) parts.push(`PB:${Number(r.pb).toFixed(1)}`);
        return parts.length > 0 ? (
          <span style={{ fontSize: 11, color: '#86909c' }}>{parts.join(' ')}</span>
        ) : <span style={{ fontSize: 11, color: '#ddd' }}>-</span>;
      },
    },
    {
      title: '操作', key: 'action', width: 160,
      render: (_: unknown, r: Stock) => (
        <Space>
          <Button type="link" size="small" onClick={() => { setDetailStockId(r.id); setDetailOpen(true); }} icon={<InfoCircleOutlined />}>详情</Button>
          <Button type="link" size="small" href={`/analysis/${r.id}`}>分析</Button>
          <Dropdown menu={{
            items: [
              ...groups.filter(gg => gg.id !== groupId).map(gg => ({
                key: `move-${gg.id}`,
                label: `移到「${gg.name}」`,
                onClick: () => handleMoveStock(r, gg.id),
              })),
              { type: 'divider' as const },
              { key: 'remove', label: '移出', danger: true, onClick: () => handleRemove(r) },
            ],
          }}>
            <Button type="link" size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      ),
    },
  ];

  const allStockFiltered = allStocks.filter(
    s => s.symbol.toLowerCase().includes(searchText.toLowerCase()) ||
         s.name.toLowerCase().includes(searchText.toLowerCase())
  );

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'watchlist',
            label: `⭐ 自选股 (${groups.reduce((s, g) => s + g.stocks.length, 0)})`,
            children: (
              <Card
                extra={
                  <Space>
                    <Button size="small" icon={<PlusOutlined />} onClick={handleCreateGroup}>新建分组</Button>
                  </Space>
                }
              >
                {groups.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无分组，点击「新建分组」创建</div>
                ) : (
                  <Tabs
                    tabBarExtraContent={
                      groups.length > 0 ? (
                        <Space>
                          <Button size="small" icon={<EditOutlined />}
                            onClick={() => {
                              const first = groups[0];
                              setRenameModal({ id: first.id, name: first.name });
                            }}>
                            重命名
                          </Button>
                          {groups.length > 1 && (
                            <Popconfirm title="删除整个分组及其包含的股票？" onConfirm={() => handleDeleteGroup(groups[0].id)}>
                              <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
                            </Popconfirm>
                          )}
                        </Space>
                      ) : null
                    }
                    items={groups.map(g => ({
                      key: String(g.id),
                      label: `${g.name} (${g.stocks.length})`,
                      children: (
                        <Table dataSource={g.stocks} columns={watchlistColumns(g.id)} rowKey="id" pagination={false} size="small" />
                      ),
                    }))}
                    onChange={(key) => {
                      const g = groups.find(gg => String(gg.id) === key);
                      if (g) setRenameModal({ id: g.id, name: g.name });
                    }}
                  />
                )}
              </Card>
            ),
          },
          {
            key: 'search',
            label: '🔍 搜索股票',
            children: (
              <Card>
                <Search
                  placeholder="输入股票代码或名称搜索"
                  enterButton={<><SearchOutlined /> 搜索</>}
                  size="large"
                  loading={searching}
                  onSearch={handleSearch}
                  style={{ marginBottom: 16 }}
                />
                {searchResults.length > 0 ? (
                  <Table dataSource={searchResults} columns={searchColumns} rowKey="id" pagination={false} size="small" />
                ) : !searching ? (
                  <span style={{ color: '#999' }}>输入关键词搜索 A 股 / 港股 / 美股</span>
                ) : null}
              </Card>
            ),
          },
          {
            key: 'all',
            label: `📋 全部股票 (${allStocks.length})`,
            children: (
              <Card
                extra={
                  <Input
                    placeholder="筛选..."
                    size="small"
                    style={{ width: 180 }}
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    allowClear
                  />
                }
                loading={loadingAll}
              >
                <Table
                  dataSource={allStockFiltered}
                  columns={[
                    { title: '市场', dataIndex: 'market', width: 70, render: (m: string) => <Tag color={marketTag[m]}>{m}</Tag> },
                    { title: '代码', dataIndex: 'symbol', width: 100 },
                    { title: '名称', dataIndex: 'name' },
                    { title: '行业', dataIndex: "sector", width: 100 },
                    {
                      title: '操作', key: 'action', width: 200,
                      render: (_: unknown, r: Stock) => {
                        const inWatchlist = groups.some(gg => gg.stocks.some(s => s.id === r.id));
                        return (
                          <Space>
                            <Button type="link" size="small" onClick={() => { setDetailStockId(r.id); setDetailOpen(true); }} icon={<InfoCircleOutlined />}>详情</Button>
                            <Button type="link" size="small" href={`/analysis/${r.id}`}>分析</Button>
                            {!inWatchlist ? (
                              <AddToGroupSelect groups={groups} stock={r} onAdd={handleAdd} />
                            ) : (
                              <Button type="link" size="small" danger onClick={() => handleRemove(r)}>移出</Button>
                            )}
                          </Space>
                        );
                      },
                    },
                  ]}
                  rowKey="id"
                  pagination={{ pageSize: 10, size: 'small' }}
                  size="small"
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title="重命名分组"
        open={!!renameModal}
        onOk={handleRename}
        onCancel={() => setRenameModal(null)}
        okText="确定"
        cancelText="取消"
      >
        <Input
          value={renameModal?.name || ''}
          onChange={e => setRenameModal(prev => prev ? { ...prev, name: e.target.value } : null)}
          placeholder="输入新名称"
        />
      </Modal>

      {/* 股票详情弹窗 */}
      <StockDetailModal
        stockId={detailStockId}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailStockId(null);
        }}
      />
    </div>
  );
}

/** 添加至分组的下拉选择器 */
function AddToGroupSelect({ groups, stock, onAdd }: {
  groups: WatchlistGroup[];
  stock: Stock;
  onAdd: (stock: Stock, groupId?: number) => void;
}) {
  if (groups.length === 0) return <span style={{ color: '#999', fontSize: 12 }}>无分组</span>;
  return (
    <select
      value=""
      onChange={(e) => {
        const v = parseInt(e.target.value);
        if (v) onAdd(stock, v);
      }}
      style={{
        padding: '2px 8px',
        borderRadius: 6,
        border: '1px solid #d9d9d9',
        fontSize: 12,
        background: '#fff',
        cursor: 'pointer',
        maxWidth: 120,
      }}
    >
      <option value="">添加到...</option>
      {groups.map(g => (
        <option key={g.id} value={g.id}>{g.name}</option>
      ))}
    </select>
  );
}
