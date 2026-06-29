import sys
import sqlite3
import yfinance as yf

DB_PATH = '/root/workspace/stock-analyst/backend/stock_analyst.db'

def to_yahoo_ticker(symbol, market):
    if market == 'A':
        return f'{symbol}.SS' if symbol.startswith('6') else f'{symbol}.SZ'
    elif market == 'HK':
        stripped = symbol.lstrip('0')
        return f'{stripped}.HK'
    return symbol

# Special mapping for US stocks that yfinance might handle differently
US_ALT = {
    'BRK.B': 'BRK-B',
}

def fetch_for_stock(cursor, stock_id, symbol, market, name, days=60):
    ticker_symbol = to_yahoo_ticker(symbol, market)
    
    variants = [ticker_symbol]
    if symbol in US_ALT:
        variants.append(US_ALT[symbol])
    if market == 'HK':
        variants.append(f'{symbol}.HK')
    
    hist = None
    last_error = None
    for vt in variants:
        try:
            ticker = yf.Ticker(vt)
            hist = ticker.history(period=f'{days}d')
            if hist is not None and not hist.empty:
                break
        except Exception as e:
            last_error = str(e)
            hist = None
    
    if hist is None or hist.empty:
        err = str(last_error) if last_error else 'no data'
        print(f'  [{symbol}] fail: {err}')
        return 0

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

    print(f'  [{symbol}] {name}: {count}')
    return count

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute('''
        SELECT s.id, s.symbol, s.market, s.name 
        FROM stocks s 
        WHERE s.id NOT IN (SELECT DISTINCT stock_id FROM prices)
        ORDER BY s.id
    ''')
    stocks = cursor.fetchall()

    print(f'Missing: {len(stocks)} stocks')
    
    total = 0
    ok = 0
    fail = 0
    for i, (stock_id, symbol, market, name) in enumerate(stocks, 1):
        print(f'[{i}/{len(stocks)}] ', end='')
        n = fetch_for_stock(cursor, stock_id, symbol, market, name)
        if n > 0:
            total += n
            ok += 1
        else:
            fail += 1
        conn.commit()

    print(f'\nDONE: ok={ok}, fail={fail}, new_prices={total}')

if __name__ == '__main__':
    main()
