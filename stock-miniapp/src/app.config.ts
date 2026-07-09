export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/stocks/index',
    'pages/stock-detail/index',
    'pages/portfolio/index',
    'pages/sectors/index',
    'pages/login/index',
    'pages/logs/index'
  ],
  window: {
    backgroundColor: '#F5F7FA',
    backgroundTextStyle: 'dark',
    navigationBarTitleText: 'AI行情助手',
    navigationBarBackgroundColor: '#F5F7FA',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#B0B8C8',
    selectedColor: '#4F6EF7',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '大盘',
        iconPath: 'assets/icons/market.png',
        selectedIconPath: 'assets/icons/market-active.png'
      },
      {
        pagePath: 'pages/stocks/index',
        text: '股票',
        iconPath: 'assets/icons/stocks.png',
        selectedIconPath: 'assets/icons/stocks-active.png'
      },
      {
        pagePath: 'pages/portfolio/index',
        text: '组合',
        iconPath: 'assets/icons/portfolio.png',
        selectedIconPath: 'assets/icons/portfolio-active.png'
      },
      {
        pagePath: 'pages/sectors/index',
        text: '板块',
        iconPath: 'assets/icons/sectors.png',
        selectedIconPath: 'assets/icons/sectors-active.png'
      },
      {
        pagePath: 'pages/login/index',
        text: '我的',
        iconPath: 'assets/icons/user.png',
        selectedIconPath: 'assets/icons/user-active.png'
      }
    ]
  }
})
