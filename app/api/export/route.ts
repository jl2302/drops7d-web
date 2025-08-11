// app/api/export/route.ts
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { prisma } from '../../../lib/prisma'; // from app/api/export/route.ts => ../../../lib/prisma

function todayYMD() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function dayRangeUTC(ymd: string) {
  const start = new Date(`${ymd}T00:00:00Z`);
  const end = new Date(`${ymd}T23:59:59Z`);
  return { start, end };
}

export async function GET(req: NextRequest) {
  const day = req.nextUrl.searchParams.get('day') ?? todayYMD();
  const { start, end } = dayRangeUTC(day);

  const drops = await prisma.drop.findMany({
    where: { date: { gte: start, lte: end } },
    include: { company: true },
    orderBy: [{ pctDrop: 'desc' }, { dollarDrop: 'desc' }],
  });

  const rows = [
    ['ticker', 'date', 'prevClose', 'close', 'dollarDrop', 'pctDrop', 'priceSource'],
    ...drops.map((d) => [
      d.company?.ticker ?? '',
      day,
      d.prevClose?.toString() ?? '',
      d.close?.toString() ?? '',
      d.dollarDrop?.toString() ?? '',
      d.pctDrop?.toString() ?? '',
      d.priceSource ?? '',
    ]),
  ];

  const csv = rows
    .map((r) =>
      r
        .map((v) => {
          const s = String(v ?? '');
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(',')
    )
    .join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="drops-${day}.csv"`,
    },
  });
}
