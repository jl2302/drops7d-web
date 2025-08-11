// app/settings/page.tsx
import { prisma } from '../../lib/prisma';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const companies = await prisma.company.findMany({ orderBy: { ticker: 'asc' } });

  async function addTicker(formData: FormData) {
    'use server';
    const raw = String(formData.get('ticker') || '').trim().toUpperCase();
    if (!raw) return;
    await prisma.company.upsert({ where: { ticker: raw }, update: {}, create: { ticker: raw } });
  }

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <form action={addTicker} className="flex gap-2">
        <input
          name="ticker"
          placeholder="Add ticker (e.g. AAPL)"
          className="border rounded px-3 py-2"
        />
        <button className="rounded border px-3 py-2 hover:bg-gray-100" type="submit">
          Add
        </button>
      </form>

      <div>
        <h2 className="font-semibold mb-2">Tracked tickers</h2>
        <ul className="list-disc ml-5">
          {companies.map(c => (
            <li key={c.id}>{c.ticker}</li>
          ))}
        </ul>
      </div>

      <a className="underline" href="/">Back to dashboard</a>
    </main>
  );
}
