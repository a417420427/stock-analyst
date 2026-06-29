"""
增量更新价格数据 — 每天1次
只拉最近5个交易日的数据，追加到prices表，不删历史。
"""
import sys
import sqlite3
from datetime import datetime, timedelta

DB_PATH = '/root/workspace/stock-analyst/backend/stock_analyst.db'

def to_yahoo_ticker(symbol, market):
    if market == 'A':
        return f'{symbol}.SS' if symbol.startswith('6') else f'{symbol}.SZ'
    elif market == 'HK':
        stripped = symbol.lstrip('0')
        return f'{stripped}.HK'
    return symbol

def has_recent_data(cursor, stock_id, days=3):
    """检查近days天是否有数据"""
    cutoff = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
    cursor.execute(
        'SELECT COUNT(*) FROM prices WHERE stock_id=? AND date>=?',
        (stock_id, cutoff)
    )
    return cursor.fetchone()[0] > 0

def fetch_incremental(cursor, stock_id, symbol, market, name):
    """增量获取最近5个交易日"""
    import yfinance as yf

    ticker_symbol = to_yahoo_ticker(symbol, market)

    # Try primary, fall back to alternate
    variants = [ticker_symbol]
    if market == 'HK':
        variants.append(f'{symbol}.HK')
    if market == 'A':
        alt = f'{symbol}.SZ' if symbol.startswith('6') else f'{symbol}.SS'
        if alt != ticker_symbol:
            variants.append(alt)

    hist = None
    for vt in variants:
        try:
            ticker = yf.Ticker(vt)
            hist = ticker.history(period='5d')
            if hist is not None and not hist.empty:
                break
        except Exception:
            hist = None

    if hist is None or hist.empty:
        return 0

    count = 0
    for date, row in hist.iterrows():
        date_str = str(date.date())
        # Check if this date already exists
        cursor.execute(
            'SELECT COUNT(*) FROM prices WHERE stock_id=? AND date=?',
            (stock_id, date_str)
        )
        if cursor.fetchone()[0] > 0:
            continue  # skip existing

        cursor.execute(
            'INSERT INTO prices (stock_id, date, open, high, low, close, volume, amount) VALUES (?,?,?,?,?,?,?,?)',
            (stock_id, date_str,
             round(row['Open'], 4), round(row['High'], 4),
             round(row['Low'], 4), round(row['Close'], 4),
             int(row['Volume']),
             round(row['Close'] * row['Volume'], 2)))
        count += 1

    return count

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute('SELECT id, symbol, market, name FROM stocks ORDER BY id')
    stocks = cursor.fetchall()

    print(f'Total {len(stocks)} stocks, checking for recent data...')

    total_new = 0
    updated = 0
    skipped = 0
    failed = 0

    for i, (stock_id, symbol, market, name) in enumerate(stocks, 1):
        # Skip if already has data from last 3 days
        if has_recent_data(cursor, stock_id, days=3):
            skipped += 1
            continue

        n = fetch_incremental(cursor, stock_id, symbol, market, name)
        if n > 0:
            total_new += n
            updated += 1
        else:
            failed += 1

        conn.commit()

        if i % 20 == 0:
            print(f'  progress: {i}/{len(stocks)}, updated={updated}, up_to_date={skipped}, failed={failed}, new_rows={total_new}')

    conn.close()
    print(f'\nDone: {updated} updated, {skipped} up-to-date, {failed} failed, {total_new} new price rows')

if __name__ == '__main__':
    main()
