// app/api/export/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const day = searchParams.get('day');
  if (!day) {
    return new NextResponse('Missing ?day=YYYY-MM-DD', { status: 400 });
  }

  const start = new Date(`${day}T00:00:00Z`);
  const end   = new Date(`${day}T23:59:59Z`);

  const drops = await prisma.drop.findMany({
    where: { date: { gte: start, lte: end } },
    include: { company: true },
    orderBy: [{ pctDrop: 'desc' }, { id: 'asc' }],
  });

  const esc = (s: any) => {
    if (s === null || s === undefined) return '';
    const str = String(s).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = [
    ['Ticker', '% Drop', '$ Drop', 'Source'],
    ...drops.map((d) => [
      d.company.ticker,
      d.pctDrop.toFixed(1),
      d.dollarDrop.toFixed(2),
      d.priceSource,
    ]),
  ];

  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');

  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="drops-${day}.csv"`,
    },
  });
}
