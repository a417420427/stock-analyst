import { useEffect, useState } from 'react';
import {
  Card, Input, Table, Tag, Button, Space, message, Modal, Form, Tabs,
} from 'antd';
import { SearchOutlined, PlusOutlined } from '@ant-design/icons';
import api from '../services/api';

const { Search } = Input;

interface Stock {
  id: number;
  symbol: string;
  market: string;
  name: string;
  sector?: string;
  industry?: string;
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

  useEffect(() => {
    loadGroups();
    loadAllStocks();
  }, []);

  const loadGroups = async () => {
    try {
      const res = await api.get('/market/watchlists');
      setGroups(res.data);
    } catch {
      message.error('加载自选股失败');
    }
  };

  const loadAllStocks = async () => {
    setLoadingAll(true);
    try {
      const res = await api.get('/market/stocks/all', {
        params: { limit: 500 },
      });
      if (Array.isArray(res.data)) {
        setAllStocks(res.data);
      }
    } catch {
      message.error('加载股票列表失败');
    }
    setLoadingAll(false);
  };

  const handleSearch = async (value: string) => {
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get('/market/stocks/search', { params: { q: value.trim() } });
      setSearchResults(res.data);
    } catch {
      message.error('搜索失败');
    }
    setSearching(false);
  };

  const handleRemove = async (stock: Stock) => {
    try {
      const targetGroup = groups[0];
      if (!targetGroup) return;
      await api.delete(`/market/watchlists/${targetGroup.id}/items/${stock.id}`);
      message.success(`已移出 ${stock.name}`);
      loadGroups();
    } catch {
      message.error('移出失败');
    }
  };

  const handleAdd = async (stock: Stock) => {
    try {
      const targetGroup = groups[0];
      if (!targetGroup) {
        message.error('请先创建一个自选股分组');
        return;
      }
      const res = await api.post(`/market/watchlists/${targetGroup.id}/items`, {
        stock_id: stock.id,
      });
      if (res.data?.message === '已存在') {
        message.info(`${stock.name} 已在自选股中`);
      } else {
        message.success(`已添加 ${stock.name}`);
      }
      loadGroups();
    } catch {
      message.error('添加失败');
    }
  };

  // 搜索列（带添加按钮）
  const searchColumns = [
    {
      title: '市场',
      dataIndex: 'market',
      key: 'market',
      width: 70,
      render: (m: string) => <Tag color={marketTag[m] || 'default'}>{m}</Tag>,
    },
    { title: '代码', dataIndex: 'symbol', key: 'symbol', width: 100 },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '行业', dataIndex: 'industry', key: 'industry', width: 100 },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, record: Stock) => (
        <Button type="link" size="small" onClick={() => handleAdd(record)}>
          添加
        </Button>
      ),
    },
  ];

  // 自选股列
  const watchlistColumns = [
    {
      title: '市场',
      dataIndex: 'market',
      key: 'market',
      width: 70,
      render: (m: string) => <Tag color={marketTag[m] || 'default'}>{m}</Tag>,
    },
    { title: '代码', dataIndex: 'symbol', key: 'symbol', width: 100 },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '行业', dataIndex: 'industry', key: 'industry', width: 100 },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: Stock) => {
        return (
          <Space>
            <Button type="link" size="small" href={`/analysis/${record.id}`}>
              分析
            </Button>
            <Button type="link" size="small" danger onClick={() => handleRemove(record)}>
              移出
            </Button>
          </Space>
        );
      },
    },
  ];

  // 全部可搜索股票列表
  const allStockFiltered = allStocks.filter(
    (s) =>
      s.symbol.toLowerCase().includes(searchText.toLowerCase()) ||
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
            label: '⭐ 我的自选股',
            children: (
              <Card>
                {groups.length === 0 ? (
                  <span style={{ color: '#999' }}>暂无分组</span>
                ) : (
                  <Tabs
                    items={groups.map((g) => ({
                      key: String(g.id),
                      label: g.name,
                      children: (
                        <Table
                          dataSource={g.stocks}
                          columns={watchlistColumns}
                          rowKey="id"
                          pagination={false}
                          size="small"
                        />
                      ),
                    }))}
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
                  placeholder="输入股票代码或名称搜索（如 600519 / AAPL / 腾讯）"
                  enterButton={<><SearchOutlined /> 搜索</>}
                  size="large"
                  loading={searching}
                  onSearch={handleSearch}
                  style={{ marginBottom: 16 }}
                />
                {searchResults.length > 0 && (
                  <Table
                    dataSource={searchResults}
                    columns={searchColumns}
                    rowKey="id"
                    pagination={false}
                    size="small"
                  />
                )}
                {searchResults.length === 0 && !searching && (
                  <span style={{ color: '#999' }}>输入关键词搜索 A 股 / 港股 / 美股</span>
                )}
              </Card>
            ),
          },
          {
            key: 'all',
            label: '📋 股票列表',
            children: (
              <Card
                title={`全部股票 (${allStocks.length})`}
                extra={
                  <Input
                    placeholder="筛选..."
                    size="small"
                    style={{ width: 180 }}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    allowClear
                  />
                }
                loading={loadingAll}
              >
                <Table
                  dataSource={allStockFiltered}
                  columns={[
                    {
                      title: '市场',
                      dataIndex: 'market',
                      key: 'market',
                      width: 70,
                      render: (m: string) => <Tag color={marketTag[m] || 'default'}>{m}</Tag>,
                    },
                    { title: '代码', dataIndex: 'symbol', key: 'symbol', width: 100 },
                    { title: '名称', dataIndex: 'name', key: 'name' },
                    { title: '行业', dataIndex: 'industry', key: 'industry', width: 100 },
                    {
                      title: '操作',
                      key: 'action',
                      width: 200,
                      render: (_: any, record: Stock) => {
                        const inWatchlist = groups.some((g) =>
                          g.stocks.some((s) => s.id === record.id)
                        );
                        return (
                          <Space>
                            <Button type="link" size="small" href={`/analysis/${record.id}`}>
                              分析
                            </Button>
                            {!inWatchlist ? (
                              <Button type="link" size="small" onClick={() => handleAdd(record)}>
                                添加自选
                              </Button>
                            ) : (
                              <>
                                <Button type="link" size="small" danger onClick={() => handleRemove(record)}>
                                  移出自选
                                </Button>
                              </>
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
    </div>
  );
}
