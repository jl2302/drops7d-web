// app/page.tsx
export const dynamic = 'force-dynamic'; // ensure SSR, avoid stale SSG 404s

export default async function Page() {
  return (
    <main className="space-y-4">
      <div>Home is alive ✅</div>
      <div>If you can read this, routing is good.</div>
      <a className="underline" href="/ok">Go to /ok</a>
    </main>
  );
}
