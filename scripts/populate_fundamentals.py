import sys
import sqlite3
import yfinance as yf

DB_PATH = '/root/workspace/stock-analyst/backend/stock_analyst.db'


def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('SELECT id, symbol, market, name FROM stocks ORDER BY id')
    stocks = cursor.fetchall()
    print(f'Total: {len(stocks)} stocks')
    
    # Get A stock spot data once (includes PE PB market_cap)
    import akshare as ak
    print('Fetching A stock spot data...', end=' ', flush=True)
    spot = ak.stock_zh_a_spot_em()
    print(f'{len(spot)} stocks')
    
    ok = 0
    fail = 0
    
    for i, (stock_id, symbol, market, name) in enumerate(stocks, 1):
        print(f'[{i}/{len(stocks)}] {symbol} ({market}) {name}...', end=' ', flush=True)
        
        result = None
        try:
            if market == 'A':
                row = spot[spot['代码'] == symbol]
                if not row.empty:
                    r = row.iloc[0]
                    pe = r.get('市盈率-动态')
                    pb = r.get('市净率')
                    mcap = r.get('总市值')
                    pe = float(pe) if pe and float(pe) != 0 else None
                    pb = float(pb) if pb and float(pb) != 0 else None
                    mcap = float(mcap) if mcap and float(mcap) != 0 else None
                    result = (pe, pb, mcap, None, None, None)
            elif market == 'HK':
                stripped = symbol.lstrip('0')
                ticker = yf.Ticker(f'{stripped}.HK')
                info = ticker.info or {}
                if info:
                    pe = info.get('trailingPE') or info.get('forwardPE')
                    pb = info.get('priceToBook')
                    mcap = info.get('marketCap')
                    dy = info.get('dividendYield')
                    rg = info.get('revenueGrowth')
                    pm = info.get('profitMargins')
                    pe = round(float(pe), 2) if pe and float(pe) != 0 else None
                    pb = round(float(pb), 2) if pb and float(pb) != 0 else None
                    mcap = round(float(mcap), 2) if mcap and float(mcap) != 0 else None
                    dy = round(float(dy), 4) if dy and float(dy) != 0 else None
                    rg = round(float(rg), 4) if rg and float(rg) != 0 else None
                    pm = round(float(pm), 4) if pm and float(pm) != 0 else None
                    result = (pe, pb, mcap, dy, rg, pm)
            else:  # US
                ticker = yf.Ticker(symbol)
                info = ticker.info or {}
                if info:
                    pe = info.get('trailingPE') or info.get('forwardPE')
                    pb = info.get('priceToBook')
                    mcap = info.get('marketCap')
                    dy = info.get('dividendYield')
                    rg = info.get('revenueGrowth')
                    pm = info.get('profitMargins')
                    pe = round(float(pe), 2) if pe and float(pe) != 0 else None
                    pb = round(float(pb), 2) if pb and float(pb) != 0 else None
                    mcap = round(float(mcap), 2) if mcap and float(mcap) != 0 else None
                    dy = round(float(dy), 4) if dy and float(dy) != 0 else None
                    rg = round(float(rg), 4) if rg and float(rg) != 0 else None
                    pm = round(float(pm), 4) if pm and float(pm) != 0 else None
                    result = (pe, pb, mcap, dy, rg, pm)
        except Exception as e:
            pass
        
        if result:
            cursor.execute(
                'UPDATE stocks SET pe_ttm=?, pb=?, market_cap=?, dividend_yield=?, revenue_growth=?, profit_margin=? WHERE id=?',
                result + (stock_id,)
            )
            print(f'PE={result[0]} PB={result[1]}')
            ok += 1
        else:
            print('no data')
            fail += 1
        
        conn.commit()
        
        if i % 20 == 0:
            print(f'  [progress: {i}/{len(stocks)}, ok={ok}, fail={fail}]', flush=True)
    
    conn.close()
    print(f'\nDONE: ok={ok}, fail={fail}', flush=True)


if __name__ == '__main__':
    main()
