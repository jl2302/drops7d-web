// app/api/ingest/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';


// Helper: build array of yyyy-mm-dd strings for N days back (today inclusive)
function lastNDays(n: number) {
  const out: string[] = [];
  const t = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())); // midnight UTC
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10)); // yyyy-mm-dd
  }
  return out;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = Math.max(1, Math.min(30, Number(url.searchParams.get('days') ?? 7)));

  // Ensure we have at least one company to write drops for
  let companies = await prisma.company.findMany();
  if (companies.length === 0) {
    const aapl = await prisma.company.upsert({
      where: { ticker: 'AAPL' },
      update: {},
      create: { ticker: 'AAPL', name: 'Apple Inc.' },
    });
    companies = [aapl];
  }

  const dayKeys = lastNDays(days);
  let created = 0;

  // Upsert a row per (company, day). (Uses @@unique([companyId, date]) in your schema)
  for (const c of companies) {
    for (const d of dayKeys) {
      const date = new Date(d + 'T00:00:00Z');

      await prisma.drop.upsert({
        where: { companyId_date: { companyId: c.id, date } },
        update: {}, // already exists: leave as-is
        create: {
  company: { connect: { id: c.id } }, // <-- relation, not raw FK
  date,
  pctDrop,
  dollarDrop,
  priceSource: 'mock',
},

      });

      created++;
    }
  }

  // Bounce back to the dashboard with a small status flag
  return NextResponse.redirect(new URL(`/?backfill=ok&rows=${created}`, req.url));
}
