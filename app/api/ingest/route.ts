// app/api/ingest/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function getYahooDailyCloses(ticker: string, days: number) {
  // ask for a little extra so we always have the previous day too
  const rangeDays = Math.max(days + 2, 8);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker
  )}?range=${rangeDays}d&interval=1d`;

  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`Yahoo fetch failed ${r.status}`);

  const j = await r.json();
  const res = j?.chart?.result?.[0];
  if (!res) throw new Error('No chart result');

  const ts: number[] = res.timestamp ?? [];
  const closes: number[] = res.indicators?.quote?.[0]?.close ?? [];

  const out: Record<string, number> = {};
  for (let i = 0; i < ts.length; i++) {
    const t = new Date(ts[i] * 1000); // seconds -> ms
    // normalize to UTC date key
    const key = ymd(new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())));
    const close = closes[i];
    if (close != null) out[key] = close;
  }
  return out;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const days = Math.max(1, Math.min(30, Number(searchParams.get('days') ?? 7)));

    const companies = await prisma.company.findMany({ orderBy: { id: 'asc' } });
    if (companies.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No tickers. Add some in /settings.' },
        { status: 400 }
      );
    }

    let created = 0;
    const today = new Date(Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate()
    ));

    for (const c of companies) {
      try {
        const closeByDay = await getYahooDailyCloses(c.ticker, days + 1);

        for (let i = 0; i < days; i++) {
          const d = new Date(today);
          d.setUTCDate(d.getUTCDate() - i);
          const dayKey = ymd(d);

          const prev = new Date(d);
          prev.setUTCDate(prev.getUTCDate() - 1);
          const prevKey = ymd(prev);

          const close = closeByDay[dayKey];
          const prevClose = closeByDay[prevKey];
          if (close == null || prevClose == null) continue;

          const pctDrop = ((close - prevClose) / prevClose) * 100; // negative on drop
          const dollarDrop = close - prevClose;                    // negative on drop

          // If you only want real "drops", uncomment:
          // if (pctDrop >= 0) continue;

          await prisma.drop.upsert({
            where: { companyId_date: { companyId: c.id, date: d } },
            update: {
              prevClose, close, pctDrop, dollarDrop, priceSource: 'yahoo',
            },
            create: {
              company: { connect: { id: c.id } },
              date: d,
              prevClose,
              close,
              pctDrop,
              dollarDrop,
              priceSource: 'yahoo',
            },
          });

          created++;
        }
      } catch (e) {
        console.error(`Ingest failed for ${c.ticker}`, e);
      }
    }

    return NextResponse.json({ ok: true, created });
  } catch (err: any) {
    console.error('INGEST ERROR', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'Unknown error' }, { status: 500 });
  }
}
