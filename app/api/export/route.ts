// app/api/export/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = req.nextUrl.searchParams.get('day');
    const day = searchParams.get('day');

    if (!day) {
      return NextResponse.json(
        { ok: false, error: 'Missing query param: day=YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // UTC window for the requested day
    const start = new Date(`${day}T00:00:00.000Z`);
    const end   = new Date(`${day}T23:59:59.999Z`);

    const drops = await prisma.drop.findMany({
      where: { date: { gte: start, lte: end } },
      include: { company: true },
      orderBy: [{ pctDrop: 'asc' }], // most negative first
    });

    // Build CSV
    const header = ['Date','Ticker','% Drop','$ Drop','Source'];
    const rows = drops.map(d => [
      day,
      d.company.ticker,
      d.pctDrop.toFixed(1),
      d.dollarDrop.toFixed(2),
      d.priceSource ?? ''
    ]);
    const csv = [header, ...rows].map(r => r.join(',')).join('\n');

    return new NextResponse(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="drops-${day}.csv"`
      }
    });
  } catch (err: any) {
    console.error('EXPORT FAILED:', err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? 'Unknown error' },
      { status: 500 }
    );
  }
}
