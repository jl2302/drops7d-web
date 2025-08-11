// app/api/ingest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // if this alias doesn't work, change to: ../../../lib/prisma

export const runtime = 'nodejs';

function isoDaysBack(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  for (let i = 0; i < n; i++) {
    const d = new Date(todayUTC);
    d.setUTCDate(todayUTC.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10)); // YYYY-MM-DD
  }
  return out;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const daysParam = Number(searchParams.get('days') ?? '7');
  const days = Number.isFinite(daysParam) && daysParam > 0 ? daysParam : 7;

  const companies = await prisma.company.findMany({ select: { id: true, ticker: true } });

  let created = 0;
  let skipped = 0;

  for (const day of isoDaysBack(days)) {
    const date = new Date(`${day}T00:00:00Z`);

    for (const c of companies) {
      // --- mock prices so the UI has data; replace with real pricing later ---
      const prevClose = Number((50 + Math.random() * 150).toFixed(2)); // 50..200
      const pctDrop = Number((2 + Math.random() * 8).toFixed(2));      // 2%..10%
      const close = Number((prevClose * (1 - pctDrop / 100)).toFixed(2));
      const dollarDrop = Number((prevClose - close).toFixed(2));
      // ----------------------------------------------------------------------

      try {
        await prisma.drop.upsert({
          where: { companyId_date: { companyId: c.id, date } }, // compound unique
          update: {}, // keep existing row as-is
          create: {
            company: { connect: { id: c.id } }, // relation, not raw FK
            date,
            prevClose,
            close,
            pctDrop,
            dollarDrop,
            priceSource: 'mock',
          },
        });
        created++;
      } catch {
        skipped++;
      }
    }
  }

  return new NextResponse(
    `OK: created=${created}, skipped=${skipped}`,
    { status: 200, headers: { 'content-type': 'text/plain' } }
  );
}
