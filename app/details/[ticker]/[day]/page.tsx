// app/details/[ticker]/[day]/page.tsx
import { prisma } from '../../../../lib/prisma';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

type Props = { params: { ticker: string; day: string } };

export default async function DetailsPage({ params }: Props) {
  const ticker = params.ticker.toUpperCase();
  const day = params.day;

  // Basic YYYY-MM-DD check
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    notFound();
  }

  const start = new Date(`${day}T00:00:00Z`);
  const end = new Date(`${day}T23:59:59Z`);

  const company = await prisma.company.findFirst({ where: { ticker } });
  if (!company) notFound();

  const drop = await prisma.drop.findFirst({
    where: { companyId: company.id, date: { gte: start, lte: end } },
  });

  const reasons = await prisma.reason.findMany({
    where: { companyId: company.id, date: { gte: start, lte: end } },
    include: { sources: true },
    orderBy: { id: 'asc' },
  });

  const priors = await prisma.priorEvidence.findMany({
    where: { companyId: company.id, date: { gte: start, lte: end } },
    orderBy: { id: 'asc' },
  });

  return (
    <main>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {ticker} — {day}
        </h1>
        <Link className="text-sm underline" href="/">
          Back to Dashboard
        </Link>
      </div>

      {!drop ? (
        <p className="text-sm text-gray-500">No drop recorded for this day.</p>
      ) : (
        <div className="mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl border p-3">
              <div className="text-xs text-gray-500">Prev Close</div>
              <div className="font-mono">${Number(drop.prevClose).toFixed(2)}</div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="text-xs text-gray-500">Close</div>
              <div className="font-mono">${Number(drop.close).toFixed(2)}</div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="text-xs text-gray-500">% Drop</div>
              <div className="font-mono">{Number(drop.pctDrop).toFixed(1)}%</div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="text-xs text-gray-500">$ Drop</div>
              <div className="font-mono">${Number(drop.dollarDrop).toFixed(2)}</div>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">Source: {drop.priceSource}</div>
        </div>
      )}

      <section className="mb-6">
        <h2 className="font-semibold mb-2">Reasons</h2>
        {reasons.length === 0 ? (
          <p className="text-sm text-gray-500">No reasons captured.</p>
        ) : (
          <ul className="space-y-2">
            {reasons.map((r) => (
              <li key={r.id} className="rounded-xl border p-3">
                <div className="mb-1">{r.text}</div>
                {r.sources.length > 0 && (
                  <ul className="list-disc pl-5 text-sm text-blue-700">
                    {r.sources.map((s) => (
                      <li key={s.id}>
                        <a className="underline break-all" href={s.url} target="_blank">
                          {s.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Prior Evidence</h2>
        {priors.length === 0 ? (
          <p className="text-sm text-gray-500">No prior evidence captured.</p>
        ) : (
          <ul className="list-disc pl-5">
            {priors.map((p) => (
              <li key={p.id}>{p.note ?? '(no note)'}</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
