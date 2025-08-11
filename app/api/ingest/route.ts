// app/api/ingest/route.ts
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = Number(url.searchParams.get('days') ?? 7);

  // TODO: call your real backfill/ingest here.
  // e.g. await runBackfill({ days });

  // Send the user back to the dashboard with a little status flag
  return NextResponse.redirect(new URL(`/?backfill=ok&days=${days}`, req.url));
}

// Optional: support POST as well, in case you change the form to POST later.
export async function POST(req: Request) {
  const form = await req.formData();
  const days = Number(form.get('days') ?? 7);

  // TODO: real backfill here too.

  return NextResponse.redirect(new URL(`/?backfill=ok&days=${days}`, req.url));
}
