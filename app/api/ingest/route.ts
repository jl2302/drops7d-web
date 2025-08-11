// app/api/ingest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = Math.max(1, Math.min(30, parseInt(searchParams.get('days') ?? '7', 10)));

  const companies = await prisma.company.findMany({ orderBy: { id: 'asc' } });

  let created = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);

    for (const c of companies) {
      // Simple mock so the UI has something to show; replace with real pricing later
      const prevClose = 100 + (i % 3);        // 100,101,102...
      const close = Number((prevClose * 0.95).toFixed(2)); // -5%
      const dollarDrop = Number((prevClose - close).toFixed(2));
      const pctDrop = Number((((prevClose - close) / prevClose) * 100).toFixed(1));

      await prisma.drop.upsert({
        where: { companyId_date: { companyId: c.id, date: d } },
        update: {}, // keep existing
        create: {
          company: { connect: { id: c.id } }, // relation, not raw FK
          date: d,
          prevClose,
          close,
          pctDrop,
          dollarDrop,
          priceSource: 'mock',
        },
      });

      created++;
    }
  }

  return NextResponse.json({ ok: true, created });
}
