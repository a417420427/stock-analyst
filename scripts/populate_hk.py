import sys
import sqlite3
from datetime import datetime, timedelta

DB_PATH = '/root/workspace/stock-analyst/backend/stock_analyst.db'

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get stocks with NO price data (mostly HK)
    cursor.execute('''
        SELECT s.id, s.symbol, s.market, s.name 
        FROM stocks s 
        WHERE s.id NOT IN (SELECT DISTINCT stock_id FROM prices)
        ORDER BY s.id
    ''')
    stocks = cursor.fetchall()
    
    hk_stocks = [(s[0], s[1], s[3]) for s in stocks if s[2] == 'HK']
    us_stocks = [(s[0], s[1], s[3]) for s in stocks if s[2] != 'HK']
    
    print(f'HK: {len(hk_stocks)}, US: {len(us_stocks)}, total: {len(stocks)}')
    
    total_ok = 0
    total_fail = 0
    total_prices = 0
    
    if hk_stocks:
        print('\n--- Processing HK stocks with akshare ---')
        import akshare as ak
        end_date = datetime.now().strftime('%Y%m%d')
        start_date = (datetime.now() - timedelta(days=90)).strftime('%Y%m%d')
        
        for i, (stock_id, symbol, name) in enumerate(hk_stocks, 1):
            print(f'[{i}/{len(hk_stocks)}] {symbol} {name}...', end=' ')
            try:
                # akshare uses symbol without .HK
                df = ak.stock_hk_hist(symbol=symbol, period='daily', 
                                       start_date=start_date, end_date=end_date, adjust='')
                if df is None or df.empty:
                    print('no data')
                    total_fail += 1
                    continue
                
                cursor.execute(f'DELETE FROM prices WHERE stock_id={stock_id}')
                count = 0
                for _, row in df.iterrows():
                    date_str = row['日期']
                    if hasattr(date_str, 'strftime'):
                        date_str = date_str.strftime('%Y-%m-%d')
                    cursor.execute(
                        'INSERT OR IGNORE INTO prices (stock_id, date, open, high, low, close, volume, amount) VALUES (?,?,?,?,?,?,?,?)',
                        (stock_id, str(date_str),
                         round(float(row['开盘']), 4), round(float(row['最高']), 4),
                         round(float(row['最低']), 4), round(float(row['收盘']), 4),
                         int(float(row['成交量'])) if '成交量' in df.columns else 0,
                         round(float(row['成交额']), 2) if '成交额' in df.columns else 0))
                    count += 1
                
                print(f'{count} rows')
                total_prices += count
                total_ok += 1
                conn.commit()
            except Exception as e:
                print(f'error: {e}')
                total_fail += 1
    
    if us_stocks:
        print('\n--- Processing US stocks with yfinance ---')
        import yfinance as yf
        
        US_ALT = {
            'BRK.B': 'BRK-B',
            'BRK.B': 'BRK-A',
        }
        
        for i, (stock_id, symbol, name) in enumerate(us_stocks, 1):
            print(f'[{i}/{len(us_stocks)}] {symbol} {name}...', end=' ')
            
            variants = [symbol]
            if symbol in US_ALT:
                variants.append(US_ALT[symbol])
            
            hist = None
            for v in variants:
                try:
                    ticker = yf.Ticker(v)
                    hist = ticker.history(period='60d')
                    if hist is not None and not hist.empty:
                        break
                except:
                    pass
            
            if hist is None or hist.empty:
                print('no data')
                total_fail += 1
                continue
            
            cursor.execute(f'DELETE FROM prices WHERE stock_id={stock_id}')
            count = 0
            for date, row in hist.iterrows():
                cursor.execute(
                    'INSERT OR IGNORE INTO prices (stock_id, date, open, high, low, close, volume, amount) VALUES (?,?,?,?,?,?,?,?)',
                    (stock_id, str(date.date()),
                     round(row['Open'], 4), round(row['High'], 4),
                     round(row['Low'], 4), round(row['Close'], 4),
                     int(row['Volume']),
                     round(row['Close'] * row['Volume'], 2)))
                count += 1
            
            print(f'{count} rows')
            total_prices += count
            total_ok += 1
            conn.commit()
    
    conn.close()
    print(f'\nDONE: ok={total_ok}, fail={total_fail}, new_prices={total_prices}')

if __name__ == '__main__':
    main()
