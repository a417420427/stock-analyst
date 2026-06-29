"""
增量更新基本面数据 — 每周1次
跳过已有数据的股票，只补没有PE/PB的或者有新股票的。
"""
import sys
import sqlite3
import yfinance as yf

DB_PATH = '/root/workspace/stock-analyst/backend/stock_analyst.db'

def main():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Only stocks where fundamentals are missing
    cursor.execute('''
        SELECT id, symbol, market, name FROM stocks 
        WHERE pe_ttm IS NULL OR pb IS NULL
        ORDER BY id
    ''')
    stocks = cursor.fetchall()

    print(f'{len(stocks)} stocks missing fundamentals')

    if not stocks:
        print('All stocks have fundamentals, nothing to do.')
        conn.close()
        return

    import akshare as ak

    ok = 0
    fail = 0

    for i, (stock_id, symbol, market, name) in enumerate(stocks, 1):
        print(f'[{i}/{len(stocks)}] {symbol} ({market}) {name}...', end=' ', flush=True)

        try:
            if market == 'A':
                df = ak.stock_zh_a_spot_em()
                row = df[df['代码'] == symbol]
                if row.empty:
                    print('no data')
                    fail += 1
                    continue
                r = row.iloc[0]
                pe = r.get('市盈率-动态')
                pb = r.get('市净率')
                mcap = r.get('总市值')
                pe_v = float(pe) if pe and float(pe) != 0 else None
                pb_v = float(pb) if pb and float(pb) != 0 else None
                mcap_v = float(mcap) if mcap and float(mcap) != 0 else None
                cursor.execute(
                    'UPDATE stocks SET pe_ttm=?, pb=?, market_cap=? WHERE id=?',
                    (pe_v, pb_v, mcap_v, stock_id)
                )
                print(f'PE={pe_v} PB={pb_v}')

            elif market == 'HK':
                df = ak.stock_hk_financial_indicator_em(symbol=symbol)
                if df is None or df.empty:
                    print('no data')
                    fail += 1
                    continue
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

            else:  # US
                ticker = yf.Ticker(symbol)
                info = ticker.info or {}
                if not info:
                    print('no info')
                    fail += 1
                    continue
                pe = info.get('trailingPE') or info.get('forwardPE')
                pb = info.get('priceToBook')
                mcap = info.get('marketCap')
                pe_v = round(float(pe), 2) if pe and float(pe) != 0 else None
                pb_v = round(float(pb), 2) if pb and float(pb) != 0 else None
                mcap_v = round(float(mcap), 2) if mcap and float(mcap) != 0 else None
                cursor.execute(
                    'UPDATE stocks SET pe_ttm=?, pb=?, market_cap=? WHERE id=?',
                    (pe_v, pb_v, mcap_v, stock_id)
                )
                print(f'PE={pe_v} PB={pb_v}')

            ok += 1
        except Exception as e:
            print(f'error: {str(e)[:60]}')
            fail += 1

        conn.commit()

        if i % 10 == 0:
            print(f'  [progress: {i}/{len(stocks)}, ok={ok}, fail={fail}]', flush=True)

    conn.close()
    print(f'Done: ok={ok}, fail={fail}', flush=True)

if __name__ == '__main__':
    main()
