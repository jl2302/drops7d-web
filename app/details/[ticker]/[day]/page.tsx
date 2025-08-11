// app/details/[ticker]/[day]/page.tsx
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { prisma } from '../../../../lib/prisma';

type Props = { params: { ticker: string; day: string } };

export default async function DetailsPage({ params }: Props) {
  const { ticker, day } = params;

  // Validate date
  const isoDay = /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
  if (!isoDay) return notFound();

  const start = new Date(`${isoDay}T00:00:00Z`);
  const end = new Date(`${isoDay}T23:59:59Z`);

  // Get the company
  const company = await prisma.company.findUnique({ where: { ticker } });
  if (!company) return notFound();

  // Get the drop for that day
  const drop = await prisma.drop.findFirst({
    where: { companyId: company.id, date: { gte: start, lte: end } },
  });

  // Get reasons + sources
  const reasons = await prisma.reason.findMany({
    where: { companyId: company.id, date: { gte: start, lte: end } },
    include: { sources: true },
    orderBy: { id: 'asc' },
  });

  return (
    <main className="space-y-6">
      <a className="text-sm underline" href="/">← Back</a>

      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {company.ticker} — {format(start, 'yyyy-MM-dd')}
        </h1>
      </header>

      {drop ? (
        <section className="rounded-xl border p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><div className="text-gray-500">Prev Close</div><div>${drop.prevClose.toFixed(2)}</div></div>
            <div><div className="text-gray-500">Close</div><div>${drop.close.toFixed(2)}</div></div>
            <div><div className="text-gray-500">% Drop</div><div>{drop.pctDrop.toFixed(1)}%</div></div>
            <div><div className="text-gray-500">$ Drop</div><div>${drop.dollarDrop.toFixed(2)}</div></div>
          </div>
          <div className="mt-2 text-xs text-gray-500">Source: {drop.priceSource}</div>
        </section>
      ) : (
        <div className="text-sm text-gray-500">No drop record for this day.</div>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-2">Reasons</h2>
        {reasons.length === 0 ? (
          <div className="text-sm text-gray-500">No reasons saved for this day.</div>
        ) : (
          <ul className="space-y-3">
            {reasons.map((r) => (
              <li key={r.id} className="rounded-xl border p-3">
                <div className="mb-1">
                  {/* The schema uses llmXAIText, not text */}
                  {r.llmXAIText || r.sources[0]?.snippet || '(no explanation)'}
                </div>

                {r.sources.length > 0 && (
                  <ul className="list-disc pl-5 text-sm text-blue-700">
                    {r.sources.map((s) => (
                      <li key={s.id}>
                        <a className="underline" href={s.url} target="_blank" rel="noreferrer">
                          {s.title || s.url}
                        </a>
                        {s.publishedAt ? (
                          <span className="text-gray-500 ml-2">
                            ({format(new Date(s.publishedAt), 'yyyy-MM-dd')})
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
