import sys
import sqlite3
import yfinance as yf

DB_PATH = '/root/workspace/stock-analyst/backend/stock_analyst.db'

def hk_to_yahoo(symbol):
    s = symbol.lstrip('0')
    return f'{s}.HK'

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('SELECT id, symbol, market, name FROM stocks WHERE pe_ttm IS NULL ORDER BY id')
    stocks = cursor.fetchall()
    
    print(f'Remaining: {len(stocks)} stocks without fundamentals')
    
    ok = 0
    fail = 0
    
    for i, (stock_id, symbol, market, name) in enumerate(stocks, 1):
        if market == 'HK':
            yahoo_symbol = hk_to_yahoo(symbol)
        elif market == 'A':
            print(f'[{i}/{len(stocks)}] {symbol} (A) {name}... skip A', flush=True)
            fail += 1
            continue
        else:
            yahoo_symbol = symbol
        
        print(f'[{i}/{len(stocks)}] {symbol} ({market}) {name} -> {yahoo_symbol}...', end=' ', flush=True)
        
        try:
            ticker = yf.Ticker(yahoo_symbol)
            info = ticker.info or {}
            if not info:
                print('no info')
                fail += 1
                continue
            
            pe = info.get('trailingPE') or info.get('forwardPE')
            pb = info.get('priceToBook')
            mcap = info.get('marketCap')
            dy = info.get('dividendYield')
            rg = info.get('revenueGrowth')
            pm = info.get('profitMargins')
            
            if pe or pb:
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
                print('no PE/PB')
                fail += 1
        except Exception as e:
            print(f'error: {e}')
            fail += 1
        
        conn.commit()
        
        if i % 10 == 0:
            print(f'  [progress: {i}/{len(stocks)}, ok={ok}, fail={fail}]', flush=True)
    
    conn.close()
    print(f'\nDONE: ok={ok}, fail={fail}', flush=True)


if __name__ == '__main__':
    main()
