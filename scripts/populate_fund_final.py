import sys
import sqlite3
import akshare as ak
import yfinance as yf

DB_PATH = '/root/workspace/stock-analyst/backend/stock_analyst.db'

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('SELECT id, symbol, market, name FROM stocks WHERE pe_ttm IS NULL ORDER BY id')
    stocks = cursor.fetchall()
    
    print(f'Remaining: {len(stocks)} without fundamentals')
    
    ok = 0
    fail = 0
    
    for i, (stock_id, symbol, market, name) in enumerate(stocks, 1):
        print(f'[{i}/{len(stocks)}] {symbol} ({market}) {name}...', end=' ', flush=True)
        
        try:
            if market == 'HK':
                df = ak.stock_hk_financial_indicator_em(symbol=symbol)
                if df is not None and not df.empty:
                    row = df.iloc[0]
                    pe = row.get('市盈率')
                    pb = row.get('市净率')
                    mcap = row.get('总市值(港元)')
                    pm = row.get('销售净利率(%)')
                    
                    pe_v = round(float(pe), 2) if pe and float(pe) != 0 else None
                    pb_v = round(float(pb), 2) if pb and float(pb) != 0 else None
                    mcap_v = round(float(mcap), 2) if mcap and float(mcap) != 0 else None
                    pm_v = round(float(pm) / 100, 4) if pm and float(pm) != 0 else None
                    
                    cursor.execute(
                        'UPDATE stocks SET pe_ttm=?, pb=?, market_cap=?, profit_margin=? WHERE id=?',
                        (pe_v, pb_v, mcap_v, pm_v, stock_id)
                    )
                    print(f'PE={pe_v} PB={pb_v}')
                    ok += 1
                else:
                    print('no data')
                    fail += 1
            elif market == 'US':
                ticker = yf.Ticker(symbol)
                info = ticker.info or {}
                if info:
                    pe = info.get('trailingPE') or info.get('forwardPE')
                    pb = info.get('priceToBook')
                    mcap = info.get('marketCap')
                    dy = info.get('dividendYield')
                    rg = info.get('revenueGrowth')
                    pm = info.get('profitMargins')
                    
                    pe_v = round(float(pe), 2) if pe and float(pe) != 0 else None
                    pb_v = round(float(pb), 2) if pb and float(pb) != 0 else None
                    mcap_v = round(float(mcap), 2) if mcap and float(mcap) != 0 else None
                    dy_v = round(float(dy), 4) if dy and float(dy) != 0 else None
                    rg_v = round(float(rg), 4) if rg and float(rg) != 0 else None
                    pm_v = round(float(pm), 4) if pm and float(pm) != 0 else None
                    
                    cursor.execute(
                        'UPDATE stocks SET pe_ttm=?, pb=?, market_cap=?, dividend_yield=?, revenue_growth=?, profit_margin=? WHERE id=?',
                        (pe_v, pb_v, mcap_v, dy_v, rg_v, pm_v, stock_id)
                    )
                    print(f'PE={pe_v} PB={pb_v}')
                    ok += 1
                else:
                    print('no info')
                    fail += 1
            else:
                print('skip A')
                fail += 1
        except Exception as e:
            print(f'error: {str(e)[:60]}')
            fail += 1
        
        conn.commit()
        
        if i % 10 == 0:
            print(f'  [progress: {i}/{len(stocks)}, ok={ok}, fail={fail}]', flush=True)
    
    conn.close()
    print(f'DONE: ok={ok}, fail={fail}', flush=True)

if __name__ == "__main__":
    main()
