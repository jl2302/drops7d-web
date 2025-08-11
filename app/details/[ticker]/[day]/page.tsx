v// app/details/[ticker]/[day]/page.tsx
type Props = { params: { ticker: string; day: string } };

export default function DetailsPage({ params }: Props) {
  const { ticker, day } = params;
  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">Details</h1>
      <p>Ticker: {ticker}</p>
      <p>Day: {day}</p>
      <p>If you can see this, the dynamic route works.</p>
    </main>
  );
}
