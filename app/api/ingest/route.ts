// app/api/ingest/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

// Helpers
function ymd(d: Date) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function daysBack(n: number) {
  const out: string[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - i);
    out.push(ymd(d));
  }
  return out;
}
function dayStartUTC(ymdStr: string) {
  return new Date(`${ymdStr}T00:00:00Z`);
}

export async function GET(req: NextRequest) {
  try {
    // Read ?days= from the query string (defaults to 7, clamp 1..31)
    const daysParam = req.nextUrl.searchParams.get('days') ?? '7';
    const days = Math.max(1, Math.min(31, Number.isFinite(+daysParam) ? parseInt(daysParam, 10) : 7));

    const companies = await prisma.company.findMany();
    if (companies.length === 0) {
      return NextResponse.json({ ok: true, created: 0, updated: 0, message: 'No companies found.' });
    }

    const targets = daysBack(days);
    let created = 0;
    let skipped = 0;

    for (const y of targets) {
      const date = dayStartUTC(y);
      for (const c of companies) {
        // If a row already exists for this (company, date), skip
        const existing = await prisma.drop.findUnique({
          where: { companyId_date: { companyId: c.id, date } },
          select: { id: true },
        });
        if (existing) {
          skipped++;
          continue;
        }

        // --- Placeholder price logic (replace with real prices later) ---
        // Generate plausible numbers so the UI has data
        const prevClose = +(100 + Math.random() * 50).toFixed(4);
        const close = +(prevClose * (1 - Math.random() * 0.2)).toFixed(4); // up to -20%
        const dollarDrop = +(prevClose - close).toFixed(4);
        const pctDrop = +(((prevClose - close) / prevClose) * 100).toFixed(2);

        await prisma.drop.create({
          data: {
            companyId: c.id,
            date,
            prevClose,        // number (Float in your schema)
            close,            // number (Float in your schema)
            dollarDrop,       // number
            pctDrop,          // number
            priceSource: 'placeholder', // change when you add real pricing
          },
        });

        created++;
      }
    }

    return NextResponse.json({ ok: true, created, skipped, days });
  } catch (err) {
    console.error('Ingest error:', err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
