// app/api/ingest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma'; // NOTE: this path is correct from app/api/ingest

function dayStartUTC(daysAgo = 0) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function GET(req: NextRequest) {
  try {
    const daysParam = req.nextUrl.searchParams.get('days');
    const days = clamp(parseInt(daysParam ?? '7', 10) || 7, 1, 30);

    // Fetch all companies
    const companies = await prisma.company.findMany({
      select: { id: true, ticker: true },
    });

    // For each company & day, upsert a Drop.
    // We use numeric values (NOT strings) for prevClose/close so Prisma types match.
    for (const c of companies) {
      for (let i = 0; i < days; i++) {
        const date = dayStartUTC(i);

        // -----
        // TEMP PLACEHOLDER PRICES
        // Replace this with your real pricing fetch later.
        // These are numbers (not strings) to satisfy Prisma Float fields.
        const base = 100 + (c.id % 7) * 3 + i * 0.25; // deterministic-ish per company/day
        const prevClose = Number((base).toFixed(4));
        const close = Number((base * 0.92).toFixed(4));
        const dollarDrop = Number((prevClose - close).toFixed(4));
        const pctDrop = Number(((dollarDrop / prevClose) * 100).toFixed(2));
        // -----

        await prisma.drop.upsert({
          where: { companyId_date: { companyId: c.id, date } },
          update: {
            prevClose,            // number
            close,                // number
            dollarDrop,           // number
            pctDrop,              // number
            priceSource: 'placeholder', // change to your real source later
          },
          create: {
            company: { connect: { id: c.id } }, // relation (not raw FK)
            date,
            prevClose,            // number
            close,                // number
            dollarDrop,           // number
            pctDrop,              // number
            priceSource: 'placeholder',
          },
        });
      }
    }

    return NextResponse.json({ ok: true, companies: companies.length, days });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { ok: false, error: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
