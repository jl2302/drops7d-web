// app/details/[ticker]/[day]/page.tsx
type Props = { params: { ticker: string; day: string } };

export default function DetailsPage({ params }: Props) {
  const { ticker, day } = params;
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-2">Details for {ticker}</h1>
      <p>Date: {day}</p>
      <p className="mt-4 text-sm text-gray-500">
        If you can see this, the dynamic route is working.
      </p>
      <p className="mt-2">
        <a className="underline" href="/">Back to dashboard</a>
      </p>
    </main>
  );
}
