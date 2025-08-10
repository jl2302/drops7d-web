// app/page.tsx
import { PrismaClient } from '@prisma/client';
import { format, addDays } from 'date-fns';

export const dynamic = 'force-dynamic'; // don't cache SSR
export const revalidate = 0;

// --- Prisma singleton (prevents multiple clients in dev) ---
declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}
const prisma = global.__prisma__ ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') global.__prisma__ = prisma;

// --- helpers ---
function days(n: number) {
  const out: string[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(format(d, 'yyyy-MM-dd'));
  }
  return out;
}
const asNum = (x: any) => (typeof x === 'number' ? x : Number(x));
const fmtPct = (x: any) =>
  Number.isFinite(asNum(x)) ? `${asNum(x).toFixed(1)}%` : '-';
const fmtUsd = (x: any) =>
  Number.isFinite(asNum(x)) ? `$${asNum(x).toFixed(2)}` : '-';

export default async function Page() {
  const dateKeys = days(7);

  // fetch each day's drops (UTC day window)
  const records = await Promise.all(
    dateKeys.map(async (key) => {
      const start = new Date(`${key}T00:00:00Z`);
      const end = addDays(start, 1);
      const drops = await prisma.drop.findMany({
        where: { date: { gte: start, lt: end } },
        include: { company: true },
        orderBy: { pctDrop: 'desc' },
      });
      return { day: key, drops };
    })
  );

  return (
    <main className="p-4">
      <div className="mb-4 flex items-center gap-3">
        {/* Backfill last 7 days (make sure your route exists at /api/ingest) */}
        <form action="/api/ingest" method="GET">
          <input type="hidden" name="days" value="7" />
          <button
            className="rounded-xl border px-3 py-2 hover:bg-gray-100"
            type="submit"
          >
            Run 7-Day Backfill
          </button>
        </form>

        <a
          className="rounded-xl border px-3 py-2 hover:bg-gray-100"
          href="/settings"
        >
          Edit Tickers
        </a>
      </div>

      {records.map(({ day, drops }) => (
        <section key={day} className="mb-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xl font-semibold">{day}</h2>
            <a className="text-sm underline" href={`/api/export?day=${day}`}>
              Export CSV
            </a>
          </div>

          {drops.length === 0 ? (
            <div className="text-sm text-gray-500">No records yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4">Ticker</th>
                    <th className="py-2 pr-4">% Drop</th>
                    <th className="py-2 pr-4">$ Drop</th>
                    <th className="py-2 pr-4">Source</th>
                    <th className="py-2 pr-4">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {drops.map((d) => (
                    <tr key={d.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-4">
                        <a
                          className="underline"
                          href={`/details/${d.company.ticker}/${day}`}
                        >
                          {d.company.ticker}
                        </a>
                      </td>
                      <td className="py-2 pr-4">{fmtPct(d.pctDrop)}</td>
                      <td className="py-2 pr-4">{fmtUsd(d.dollarDrop)}</td>
                      <td className="py-2 pr-4">{d.priceSource}</td>
                      <td className="py-2 pr-4">
                        <a
                          className="underline"
                          href={`/details/${d.company.ticker}/${day}`}
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
    </main>
  );
}
