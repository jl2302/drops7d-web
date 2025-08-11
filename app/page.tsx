// app/page.tsx
import { format } from 'date-fns';
import { prisma } from '../lib/prisma';

function days(n: number) {
  const out: string[] = [];
  const t = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(t);
    d.setDate(t.getDate() - i);
    out.push(format(d, 'yyyy-MM-dd'));
  }
  return out;
}

export default async function Page() {
  const ds = days(7);

  const records = await Promise.all(
    ds.map(async (d) => {
      const start = new Date(d + 'T00:00:00Z');
      const end = new Date(d + 'T23:59:59Z');
      const drops = await prisma.drop.findMany({
        where: { date: { gte: start, lte: end } },
        include: { company: true },
        orderBy: [{ pctDrop: 'desc' }, { dollarDrop: 'desc' }],
      });
      return { day: d, drops };
    })
  );

  return (
    <main className="p-6">
      <div className="mb-4 flex items-center gap-3">
        <form action="/api/ingest">
          <input type="hidden" name="days" value="7" />
          <button className="rounded-xl border px-3 py-2 hover:bg-gray-100" type="submit">
            Run 7-Day Backfill
          </button>
        </form>
        <a className="rounded-xl border px-3 py-2 hover:bg-gray-100" href="/settings">
          Edit Tickers
        </a>
      </div>

      {records.map(({ day, drops }) => (
        <section key={day} className="mb-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold mb-2">{day}</h2>
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
                  <tr className="text-left border-b">
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
}
