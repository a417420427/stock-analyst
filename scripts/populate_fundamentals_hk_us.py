import sys
import sqlite3
import yfinance as yf

DB_PATH = '/root/workspace/stock-analyst/backend/stock_analyst.db'

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Only process HK and US stocks where fundamentals are NULL
    cursor.execute('SELECT id, symbol, market, name FROM stocks WHERE market IN (?, ?) AND pe_ttm IS NULL ORDER BY id', ('HK', 'US'))
    stocks = cursor.fetchall()
    
    print(f'Processing {len(stocks)} HK/US stocks without fundamentals')
    
    ok = 0
    fail = 0
    
    for i, (stock_id, symbol, market, name) in enumerate(stocks, 1):
        yahoo_symbol = symbol
        if market == 'HK':
            stripped = symbol.lstrip('0')
            yahoo_symbol = f'{stripped}.HK'
        
        print(f'[{i}/{len(stocks)}] {symbol} ({market}) {name}...', end=' ', flush=True)
        
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
            
            pe = round(float(pe), 2) if pe and float(pe) != 0 else None
            pb = round(float(pb), 2) if pb and float(pb) != 0 else None
            mcap = round(float(mcap), 2) if mcap and float(mcap) != 0 else None
            dy = round(float(dy), 4) if dy and float(dy) != 0 else None
            rg = round(float(rg), 4) if rg and float(rg) != 0 else None
            pm = round(float(pm), 4) if pm and float(pm) != 0 else None
            
            cursor.execute(
                'UPDATE stocks SET pe_ttm=?, pb=?, market_cap=?, dividend_yield=?, revenue_growth=?, profit_margin=? WHERE id=?',
                (pe, pb, mcap, dy, rg, pm, stock_id)
            )
            print(f'PE={pe} PB={pb}')
            ok += 1
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
