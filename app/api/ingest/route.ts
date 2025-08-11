import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

const ONE_DAY = 24 * 60 * 60 * 1000;
const MIN_DROP_PCT = Number(process.env.MIN_DROP_PCT ?? '4'); // 4% by default

function isoDay(d: Date) {
  // YYYY-MM-DD in UTC
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
    .toISOString()
    .slice(0, 10);
}

function dayStartUTC(day: string) {
  return new Date(`${day}T00:00:00.000Z`);
}
function dayEndUTC(day: string) {
  return new Date(`${day}T23:59:59.999Z`);
}

type YahooChart =
  | {
      chart: {
        result: Array<{
          timestamp: number[];
          indicators: { quote: Array<{ close: (number | null)[] }> };
          meta?: { gmtoffset?: number };
        }>;
        error: any;
      };
    }
  | any;

async function getDailyClosesFromYahoo(
  ticker: string,
  lookbackDays: number
): Promise<Map<string, number>> {
  // We fetch a few extra days so we can always find the previous trading day
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker
  )}?range=${Math.max(lookbackDays + 7, 10)}d&interval=1d&includePrePost=false&events=div,splits`;
  const res = await fetch(url, {
    headers: {
      // Yahoo is picky without a UA
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      accept: 'application/json'
    },
    cache: 'no-store'
  });

  if (!res.ok) throw new Error(`Yahoo fetch failed for ${ticker}: ${res.status}`);

  const data = (await res.json()) as YahooChart;
  const r = data?.chart?.result?.[0];
  const closes = r?.indicators?.quote?.[0]?.close ?? [];
  const ts = r?.timestamp ?? [];
  const map = new Map<string, number>();

  ts.forEach((sec: number, i: number) => {
    const c = closes[i];
    if (c != null) {
      const day = isoDay(new Date(sec * 1000));
      map.set(day, Number(c));
    }
  });

  return map;
}

export async function GET(req: NextRequest) {
  try {
    const u = new URL(req.url);
    const days = Math.max(1, Math.min(14, Number(u.searchParams.get('days') ?? '7')));

    const companies = await prisma.company.findMany({
      select: { id: true, ticker: true }
    });

    const today = new Date();
    const targets: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
      targets.push(isoDay(d));
    }

    let created = 0;
    let updated = 0;
    let deleted = 0;
    const errors: string[] = [];

    for (const c of companies) {
      try {
        const closes = await getDailyClosesFromYahoo(c.ticker, days);

        for (const day of targets) {
          // Find same-day close
          const close = closes.get(day);

          // Find previous trading day's close by walking back up to 10 calendar days
          let prev: number | undefined;
          for (let back = 1; back <= 10 && prev === undefined; back++) {
            const prevDay = isoDay(new Date(dayStartUTC(day).getTime() - back * ONE_DAY));
            if (closes.has(prevDay)) prev = closes.get(prevDay);
          }

          // If we can't compute both values, remove any existing row for that day and continue
          if (prev == null || close == null || isNaN(prev) || isNaN(close)) {
            const del = await prisma.drop.deleteMany({
              where: {
                companyId: c.id,
                date: { gte: dayStartUTC(day), lte: dayEndUTC(day) }
              }
            });
            deleted += del.count;
            continue;
          }

          const dollarDrop = +(prev - close);
          const pctDrop = +((dollarDrop / prev) * 100);

          if (dollarDrop > 0 && pctDrop >= MIN_DROP_PCT) {
            // We have a real drop — upsert as yahoo
            const existing = await prisma.drop.findUnique({
              where: { companyId_date: { companyId: c.id, date: dayStartUTC(day) } },
              select: { id: true }
            });

            await prisma.drop.upsert({
              where: { companyId_date: { companyId: c.id, date: dayStartUTC(day) } },
              update: {
                prevClose: prev.toFixed(4), // Decimal in schema: send as string
                close: close.toFixed(4),
                dollarDrop,
                pctDrop,
                priceSource: 'yahoo'
              },
              create: {
                company: { connect: { id: c.id } },
                date: dayStartUTC(day),
                prevClose: prev.toFixed(4),
                close: close.toFixed(4),
                dollarDrop,
                pctDrop,
                priceSource: 'yahoo'
              }
            });

            if (existing) updated++;
            else created++;
          } else {
            // No qualifying drop this day — remove any mock/old row so the UI shows "No records yet."
            const del = await prisma.drop.deleteMany({
              where: {
                companyId: c.id,
                date: { gte: dayStartUTC(day), lte: dayEndUTC(day) }
              }
            });
            deleted += del.count;
          }
        }
      } catch (e: any) {
        errors.push(`${c.ticker}: ${e?.message ?? e}`);
      }
    }

    return NextResponse.json({ ok: true, created, updated, deleted, minDropPct: MIN_DROP_PCT, errors });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message ?? String(err) }, { status: 500 });
  }
}
