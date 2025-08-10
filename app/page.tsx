// app/page.tsx
import { format } from "date-fns";
import { PrismaClient } from "@prisma/client";

// Make Prisma a singleton in dev to avoid too many connections
const globalForPrisma = global as unknown as { prisma?: PrismaClient };
export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ["warn", "error"] });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Force dynamic rendering so Next.js doesn’t try to prerender this page
export const dynamic = "force-dynamic";
export const revalidate = 0;

function lastNDays(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    d.setUTCDate(d.getUTCDate() - i);
    out.push(format(d, "yyyy-MM-dd"));
  }
  return out;
}

export default async function Page() {
  const days = lastNDays(7);

  const records = await Promise.all(
    days.map(async (day) => {
      // Build an inclusive UTC window for that calendar day
      const start = new Date(`${day}T00:00:00.000Z`);
      const end = new Date(`${day}T23:59:59.999Z`);

      const drops = await prisma.drop.findMany({
        where: { date: { gte: start, lte: end } },
        include: { company: true },
        orderBy: [{ pctDrop: "desc" }, { dollarDrop: "desc" }],
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
            className="rounded-xl border px-3 py-2 hover:bg-gray-100"
            type="submit"
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
                        <a
                          className="underline"
                          href={`/details/${d.company.ticker}/${day}`}
                        >
                          {d.company.ticker}
                        </a>
                      </td>
                      <td className="py-2 pr-4">
                        {Number(d.pctDrop).toFixed(1)}%
                      </td>
                      <td className="py-2 pr-4">
                        ${Number(d.dollarDrop).toFixed(2)}
                      </td>
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
