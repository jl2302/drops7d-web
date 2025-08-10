import { NextRequest, NextResponse } from 'next/server'; import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export async function GET(req: NextRequest){
  const { searchParams } = new URL(req.url);
  const day = searchParams.get('day');
  if(!day) return new NextResponse('Missing ?day=YYYY-MM-DD', { status: 400 });
  const dateKey = new Date(day + 'T00:00:00Z');
  const drops = await prisma.drop.findMany({ where:{ date: dateKey }, include:{ company:true } });
  const reasons = await prisma.reason.findMany({ where:{ date: dateKey }, include:{ company:true, sources:true } });
  const priors = await prisma.priorEvidence.findMany({ where:{ date: dateKey }, include:{ company:true } });
  function esc(s: any){ if(s===null||s===undefined) return ''; const str = String(s); return '\"' + str.replace(/\"/g,'\"\"') + '\"'; }
  let csv = 'Section,Ticker,Company,Field1,Field2,Field3,Field4,Field5,URL,Quote\\n';
  for(const d of drops){
    csv += ['Drop', d.company.ticker, d.company.name||'', `${d.pctDrop.toFixed(2)}%`, `$${d.dollarDrop.toFixed(2)}`, d.priceSource, day, '', '', ''].map(esc).join(',') + '\\n';
  }
  for(const r of reasons){
    csv += ['Reason', r.company.ticker, r.company.name||'', r.summary, r.confidence, r.llmProviderUsed||'', day, '', '', ''].map(esc).join(',') + '\\n';
    for(const s of r.sources){
      csv += ['ReasonSource', r.company.ticker, r.company.name||'', s.source, s.title, s.publishedAt? s.publishedAt.toISOString(): '', '', '', s.url, s.quote||''].map(esc).join(',') + '\\n';
    }
  }
  for(const p of priors){
    csv += ['Prior', p.company.ticker, p.company.name||'', p.kind, p.title, p.source||'', p.publishedAt? p.publishedAt.toISOString(): '', '', p.url, p.quote||''].map(esc).join(',') + '\\n';
  }
  return new NextResponse(csv, { status: 200, headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename=\"drops_${day}.csv\"` } });
}
