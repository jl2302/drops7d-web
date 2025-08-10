// app/page.tsx
import { PrismaClient } from '@prisma/client';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic'; // server-render on demand

// NOTE: do NOT export this (exporting would cause the “not a valid Page export field” error)
const prisma = new PrismaClient();

function lastNDays(n: number) {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setUTCDate(now.getUTCDate() - i);
    out.push(format(d, 'yyyy-MM-dd'));
  }
  return out;
}

export default async function Page() {
  try {
    const days = lastNDays(7);
    const records = await Promise.all(
      days.map(async (day) => {
        const start = new Date(`${day}T00:00:00Z`);
        const end = new Date(`${day}T23:59:59Z`);
        const drops = await prisma.drop.findMany({
          where: { date: { gte: start, lte: end } },
          include: { company: true },
          orderBy: { pctDrop: 'desc' },
        });
        return { day, drops };
      })
    );

    return (
      <main>
        <div className="mb-4 flex items-center gap-3">
          <form action="/api/ingest">
            <input type="hidden" name="days" value="7" />
            <button
              type="submit"
              className="rounded-xl border px-3 py-2 hover:bg-gray-100"
            >
              Run 7-Day Backfill
            </button>
          </form>
          <a className="rounded-xl border px-3 py-2 hover:bg-gray-100" href="/settings">
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
                          <a className="underline" href={`/details/${d.company.ticker}/${day}`}>
                            {d.company.ticker}
                          </a>
                        </td>
                        <td className="py-2 pr-4">{d.pctDrop.toFixed(1)}%</td>
                        <td className="py-2 pr-4">${d.dollarDrop.toFixed(2)}</td>
                        <td className="py-2 pr-4">{d.priceSource}</td>
                        <td className="py-2 pr-4">
                          <a className="underline" href={`/details/${d.company.ticker}/${day}`}>
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
  } catch (err: any) {
    // Show the error instead of falling into a 404
    return (
      <main className="space-y-3">
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <div className="rounded-md border p-3">
          <div className="mb-1 font-medium">Couldn’t load data.</div>
          <pre className="whitespace-pre-wrap text-sm opacity-80">
            {err?.message ?? String(err)}
          </pre>
        </div>
        <a className="underline" href="/ok">Check /ok</a>
      </main>
    );
  }
}
