// app/api/ingest/route.ts
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

// ---------- helpers ----------
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
function dayStartUTC(s: string) {
  return new Date(`${s}T00:00:00Z`);
}
// --------------------------------

export async function GET(req: NextRequest) {
  try {
    // inputs
    const daysParam = req.nextUrl.searchParams.get('days') ?? '7';
    const days = Math.max(1, Math.min(31, Number.isFinite(+daysParam) ? parseInt(daysParam, 10) : 7));
    const overwrite = ['1', 'true', 'y', 'yes', 'on'].includes(
      (req.nextUrl.searchParams.get('overwrite') ?? '').toLowerCase()
    );

    const companies = await prisma.company.findMany();
    if (companies.length === 0) {
      return NextResponse.json({ ok: true, created: 0, updated: 0, skipped: 0, days, message: 'No companies found' });
    }

    const targets = daysBack(days);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const day of targets) {
      const date = dayStartUTC(day);

      for (const c of companies) {
        const existing = await prisma.drop.findUnique({
          where: { companyId_date: { companyId: c.id, date } },
          select: { id: true },
        });

        // --- placeholder price logic (replace with your real prices later) ---
        const prevClose = +(100 + Math.random() * 50).toFixed(4);
        const close = +(prevClose * (1 - Math.random() * 0.2)).toFixed(4); // up to -20%
        const dollarDrop = +(prevClose - close).toFixed(4);
        const pctDrop = +(((prevClose - close) / prevClose) * 100).toFixed(2);
        const priceSource = 'placeholder';

        if (existing) {
          if (overwrite) {
            await prisma.drop.update({
              where: { companyId_date: { companyId: c.id, date } },
              data: { prevClose, close, dollarDrop, pctDrop, priceSource },
            });
            updated++;
          } else {
            skipped++;
          }
        } else {
          await prisma.drop.create({
            data: {
              companyId: c.id,
              date,
              prevClose,
              close,
              dollarDrop,
              pctDrop,
              priceSource,
            },
          });
          created++;
        }
      }
    }

    return NextResponse.json({ ok: true, created, updated, skipped, days });
  } catch (err) {
    console.error('Ingest error:', err);
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
