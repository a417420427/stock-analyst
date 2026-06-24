"""批量股票数据注入 — 从真实数据源拉取股票列表"""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Stock


class StockLoader:
    """批量加载股票主数据"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def load_a_shares(self) -> int:
        """从 AKShare 拉取 A 股全量股票列表"""
        count = 0
        try:
            import akshare as ak
            df = ak.stock_info_a_code_name()
            for _, row in df.iterrows():
                code = str(row["code"])
                name = str(row["name"])
                # 跳过北交所（8 开头）和退市整理
                if code.startswith("8") or code.startswith("4"):
                    continue
                await self._upsert_stock(code, "A", name)
                count += 1
        except ImportError:
            print("akshare not available, using fallback A-share list")
            count = await self._fallback_a_list()
        except Exception as e:
            # AKShare 可能网络问题，fallback 到内置列表
            count = await self._fallback_a_list()
        await self.db.flush()
        return count

    async def load_hk_shares(self) -> int:
        """加载港股列表（内置主要标的）"""
        stocks = [
            ("00001", "长和"), ("00002", "中电控股"), ("00003", "香港中华煤气"),
            ("00005", "汇丰控股"), ("00011", "恒生银行"), ("00016", "新鸿基地产"),
            ("00017", "新世界发展"), ("00027", "银河娱乐"), ("00066", "港铁公司"),
            ("00083", "信和置业"), ("00101", "恒隆地产"), ("00175", "吉利汽车"),
            ("00241", "阿里健康"), ("00267", "中信股份"), ("00288", "万洲国际"),
            ("00291", "华润啤酒"), ("00316", "东方海外国际"), ("00322", "康师傅控股"),
            ("00386", "中国石油化工"), ("00388", "香港交易所"),
            ("00669", "创科实业"), ("00688", "中国海外发展"),
            ("00700", "腾讯控股"), ("00728", "中国电信"), ("00762", "中国联通"),
            ("00780", "同程旅行"), ("00788", "中国铁塔"),
            ("00823", "领展房产基金"), ("00857", "中国石油股份"),
            ("00883", "中国海洋石油"), ("00939", "中国建设银行"),
            ("00941", "中国移动"), ("00981", "中芯国际"),
            ("00992", "联想集团"), ("01038", "长江基建集团"),
            ("01044", "恒安国际"), ("01057", "浙江沪杭甬"),
            ("01066", "威高股份"), ("01088", "中国神华"),
            ("01093", "石药集团"), ("01099", "国药控股"),
            ("01109", "华润置地"), ("01113", "长实集团"),
            ("01171", "兖矿能源"), ("01177", "中国生物制药"),
            ("01209", "华润万象生活"), ("01211", "比亚迪股份"),
            ("01299", "友邦保险"), ("01347", "华虹半导体"),
            ("01378", "中国宏桥"), ("01398", "工商银行"),
            ("01448", "福寿园"), ("01658", "邮储银行"),
            ("01772", "赣锋锂业"), ("01776", "广发证券"),
            ("01810", "小米集团-W"), ("01833", "平安好医生"),
            ("01876", "百威亚太"), ("01898", "中煤能源"),
            ("01919", "中远海控"), ("01928", "金沙中国有限公司"),
            ("01929", "周大福"), ("01997", "九龙仓置业"),
            ("02007", "碧桂园服务"), ("02013", "微盟集团"),
            ("02015", "理想汽车-W"), ("02018", "瑞声科技"),
            ("02020", "安踏体育"), ("02057", "中通快递-W"),
            ("02269", "药明生物"), ("02313", "申洲国际"),
            ("02318", "中国平安"), ("02319", "蒙牛乳业"),
            ("02328", "中国财险"), ("02331", "李宁"),
            ("02333", "长城汽车"), ("02359", "药明康德"),
            ("02382", "舜宇光学科技"), ("02388", "中银香港"),
            ("02469", "粉笔"), ("02518", "汽车之家-S"),
            ("02601", "中国太保"), ("02618", "京东物流"),
            ("02628", "中国人寿"), ("02688", "新奥能源"),
            ("02899", "紫金矿业"), ("03328", "交通银行"),
            ("03333", "中国恒大"), ("03690", "美团-W"),
            ("03888", "金山软件"), ("03968", "招商银行"),
            ("03988", "中国银行"), ("06060", "众安在线"),
            ("06098", "碧桂园"), ("06160", "百济神州"),
            ("06185", "康龙化成"), ("06618", "京东健康"),
            ("06690", "海尔智家"), ("06862", "海底捞"),
            ("06969", "思摩尔国际"), ("09618", "京东集团-SW"),
            ("09626", "哔哩哔哩-W"), ("09633", "农夫山泉"),
            ("09698", "万国数据-SW"), ("09888", "百度集团-SW"),
            ("09899", "云音乐"), ("09901", "新东方在线"),
            ("09961", "携程集团-S"), ("09988", "阿里巴巴-SW"),
            ("09992", "泡泡玛特"), ("09999", "网易-S"),
        ]
        for code, name in stocks:
            await self._upsert_stock(code, "HK", name)
        await self.db.flush()
        return len(stocks)

    async def load_us_shares(self) -> int:
        """加载美股列表（主要标的）"""
        stocks = [
            ("AAPL", "Apple Inc."), ("MSFT", "Microsoft Corp"),
            ("GOOGL", "Alphabet Inc."), ("AMZN", "Amazon.com Inc."),
            ("NVDA", "NVIDIA Corp"), ("META", "Meta Platforms Inc."),
            ("TSLA", "Tesla Inc."), ("BRK.B", "Berkshire Hathaway"),
            ("JPM", "JPMorgan Chase"), ("V", "Visa Inc."),
            ("JNJ", "Johnson & Johnson"), ("WMT", "Walmart Inc."),
            ("PG", "Procter & Gamble"), ("MA", "Mastercard Inc."),
            ("UNH", "UnitedHealth Group"), ("HD", "Home Depot Inc."),
            ("DIS", "The Walt Disney Co"), ("BAC", "Bank of America"),
            ("NFLX", "Netflix Inc."), ("ADBE", "Adobe Inc."),
            ("CRM", "Salesforce Inc."), ("INTC", "Intel Corp"),
            ("AMD", "Advanced Micro Devices"), ("PYPL", "PayPal Holdings"),
            ("BA", "Boeing Co"), ("NKE", "Nike Inc."),
            ("KO", "Coca-Cola Co"), ("PEP", "PepsiCo Inc."),
            ("TMO", "Thermo Fisher Scientific"), ("ABNB", "Airbnb Inc."),
            ("UBER", "Uber Technologies"), ("SQ", "Block Inc."),
            ("SNAP", "Snap Inc."), ("PINS", "Pinterest Inc."),
            ("COIN", "Coinbase Global"), ("MARA", "Marathon Digital"),
            ("PLTR", "Palantir Technologies"), ("SOFI", "SoFi Technologies"),
            ("RIVN", "Rivian Automotive"), ("LCID", "Lucid Group"),
            ("DASH", "DoorDash Inc."), ("HOOD", "Robinhood Markets"),
            ("TSM", "Taiwan Semiconductor"), ("BABA", "Alibaba Group"),
            ("JD", "JD.com Inc."), ("BIDU", "Baidu Inc."),
            ("NIO", "NIO Inc."), ("LI", "Li Auto Inc."),
            ("XPEV", "XPeng Inc."), ("SE", "Sea Limited"),
        ]
        for code, name in stocks:
            await self._upsert_stock(code, "US", name)
        await self.db.flush()
        return len(stocks)

    async def _fallback_a_list(self) -> int:
        """AKShare 不可用时的 A 股后备列表（沪深 300 成分股 + 热门）"""
        stocks = [
            ("600519", "贵州茅台"), ("000858", "五粮液"), ("000568", "泸州老窖"),
            ("002304", "洋河股份"), ("000596", "古井贡酒"), ("600809", "山西汾酒"),
            ("000333", "美的集团"), ("000651", "格力电器"), ("600690", "海尔智家"),
            ("002415", "海康威视"), ("000725", "京东方A"), ("002475", "立讯精密"),
            ("600036", "招商银行"), ("601166", "兴业银行"), ("600016", "民生银行"),
            ("601398", "工商银行"), ("601939", "建设银行"), ("601288", "农业银行"),
            ("601328", "交通银行"), ("600000", "浦发银行"),
            ("600030", "中信证券"), ("601211", "国泰君安"), ("600837", "海通证券"),
            ("601688", "华泰证券"), ("000776", "广发证券"),
            ("600887", "伊利股份"), ("603288", "海天味业"), ("002714", "牧原股份"),
            ("000002", "万科A"), ("600048", "保利发展"), ("001979", "招商蛇口"),
            ("601318", "中国平安"), ("601628", "中国人寿"), ("601601", "中国太保"),
            ("600900", "长江电力"), ("601985", "中国核电"), ("600905", "三峡能源"),
            ("601012", "隆基绿能"), ("300750", "宁德时代"), ("002459", "晶澳科技"),
            ("600941", "中国移动"), ("601728", "中国电信"), ("600050", "中国联通"),
            ("601857", "中国石油"), ("600028", "中国石化"), ("601088", "中国神华"),
            ("600585", "海螺水泥"), ("601899", "紫金矿业"), ("600019", "宝钢股份"),
            ("601225", "陕西煤业"), ("600436", "片仔癀"), ("000538", "云南白药"),
            ("300760", "迈瑞医疗"), ("603259", "药明康德"), ("002007", "华兰生物"),
            ("600276", "恒瑞医药"), ("300015", "爱尔眼科"), ("600196", "复星医药"),
            ("002230", "科大讯飞"), ("300124", "汇川技术"), ("002049", "紫光国微"),
            ("603986", "兆易创新"), ("688981", "中芯国际"), ("603501", "韦尔股份"),
            ("002371", "北方华创"), ("688012", "中微公司"), ("688036", "传音控股"),
            ("601318", "中国平安"), ("600309", "万华化学"), ("002812", "恩捷股份"),
            ("300274", "阳光电源"), ("601766", "中国中车"), ("600104", "上汽集团"),
            ("000625", "长安汽车"), ("002594", "比亚迪"), ("601633", "长城汽车"),
            ("600031", "三一重工"), ("000157", "中联重科"), ("600406", "国电南瑞"),
            ("601390", "中国中铁"), ("601668", "中国建筑"), ("601669", "中国电建"),
            ("600570", "恒生电子"), ("002410", "广联达"), ("300033", "同花顺"),
            ("300059", "东方财富"), ("600958", "东方证券"),
            ("601236", "红塔证券"), ("600999", "招商证券"),
        ]
        for code, name in stocks:
            await self._upsert_stock(code, "A", name)
        return len(stocks)

    async def _upsert_stock(self, symbol: str, market: str, name: str):
        """创建或更新股票"""
        result = await self.db.execute(
            select(Stock).where(Stock.symbol == symbol, Stock.market == market)
        )
        stock = result.scalar_one_or_none()
        if not stock:
            stock = Stock(symbol=symbol, market=market, name=name)
            self.db.add(stock)
