import { PrismaClient } from '@prisma/client'; const prisma=new PrismaClient();
export default async function Page({ params }:{ params:{ ticker:string, day:string } }){ const {ticker,day}=params; const start=new Date(day+'T00:00:00Z'); const company=await prisma.company.findUnique({ where:{ ticker } }); if(!company) return (<main>No data.</main>);
  const drop=await prisma.drop.findUnique({ where:{ companyId_date:{ companyId: company.id, date: start } } });
  const reason=await prisma.reason.findUnique({ where:{ companyId_date:{ companyId: company.id, date: start } }, include:{ sources:true } });
  const priors=await prisma.priorEvidence.findMany({ where:{ companyId: company.id, date: start }, orderBy:[{kind:'asc'},{publishedAt:'desc'}] });
  return (<main><div className="flex items-center justify-between mb-2"><h2 className="text-xl font-semibold">{ticker} - {day}</h2><a className="text-sm underline" href={`/api/export?day=${day}`}>Export CSV for {day}</a></div>
    {reason? (<section className="mb-6"><h3 className="font-semibold">Reason</h3><p className="text-sm">{reason.summary} <span className="text-gray-500">({reason.confidence})</span></p>
      <ul className="list-disc ml-6 text-sm mt-2">{reason.sources.map(s=>(<li key={s.id}><a className="underline" target="_blank" href={s.url}>{s.source}: {s.title}</a>{s.quote? <blockquote className="mt-1 pl-3 border-l text-gray-700 italic">{s.quote}</blockquote> : null}</li>))}</ul>
      <details className="mt-4"><summary className="cursor-pointer text-sm underline">LLM Inspector</summary>
        <div className="mt-2 text-sm">
          <div><strong>Provider used:</strong> {reason.llmProviderUsed || "n/a"}</div>
          <div className="mt-2"><strong>OpenAI output:</strong> <em>{reason.llmOpenAIText || "—"}</em></div>
          <div className="mt-2"><strong>xAI (Grok) output:</strong> <em>{reason.llmXAIText || "—"}</em></div>
        </div>
      </details>
    </section>) : (<div className="text-sm text-gray-500 mb-6">No reason captured.</div>)}
    <section><h3 className="font-semibold">Priors (SEC, Press Releases, Calls, News)</h3>{priors.length===0? <div className="text-sm text-gray-500">None.</div> : (<ul className="list-disc ml-6 text-sm">
      {priors.map(p=>(<li key={p.id}><span className="px-2 py-0.5 border rounded mr-2">{p.kind}</span><a className="underline" href={p.url} target="_blank">{p.title}</a>{p.quote? <blockquote className="mt-1 pl-3 border-l text-gray-700 italic">{p.quote}</blockquote>:null}</li>))}
    </ul>)}</section>
  </main>); }
