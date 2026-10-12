import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { openProject } from '../state/project'
import { MODRINTH_API } from '../lib/api'
import '../styles/copper.css'
type Hit = { project_id: string; slug: string; title: string; description: string; icon_url?: string; project_type: string }
export function Mods({ on }: { on: boolean }) { return <section className={'screen'+(on?' on':'')} id="s-mods"><CatalogPane /></section> }
export function CatalogPane(_props: { content?: boolean; onOpenPack?: (slug:string)=>boolean|void; servers?: ReactNode }) {
  const [query,setQuery]=useState(''),[hits,setHits]=useState<Hit[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const active=useRef<AbortController|null>(null)
  async function search(q:string) {
    active.current?.abort()
    const request=new AbortController(); active.current=request
    setBusy(true);setError('')
    try {
      const params=new URLSearchParams({query:q,limit:'24',index:'relevance',facets:JSON.stringify([['project_type:mod','project_type:modpack','project_type:resourcepack','project_type:shader']])})
      const response=await fetch(MODRINTH_API+'/v2/search?'+params,{signal:request.signal})
      if(!response.ok)throw Error('HTTP '+response.status)
      const data=await response.json() as {hits:Hit[]}
      if(active.current===request)setHits(data.hits)
    } catch(e) { if(!request.signal.aborted)setError('Modrinth недоступен: '+String(e)) }
    finally {if(active.current===request)setBusy(false)}
  }
  useEffect(()=>{void search('');return ()=>active.current?.abort()},[])
  function submit(e:FormEvent){e.preventDefault();void search(query)}
  return <div className="copper-catalog"><h1>Каталог Modrinth</h1><p>Моды, сборки, ресурспаки и шейдеры — напрямую из Modrinth.</p>
    <form onSubmit={submit}><input aria-label="Поиск в Modrinth" placeholder="Название мода или сборки" value={query} onChange={e=>setQuery(e.target.value)} /><button className="btn md primary" type="submit">Найти</button></form>
    {busy?<p role="status">Загрузка…</p>:error?<p role="alert">{error}</p>:!hits.length?<p>Ничего не найдено.</p>:<div className="copper-results">{hits.map(hit=><article className="copper-result" key={hit.project_id}>
      {hit.icon_url?<img src={hit.icon_url} alt="" />:null}<h2>{hit.title}</h2><p>{hit.description}</p><button className="btn md secondary" onClick={()=>void openProject(hit.slug,hit.project_type)}>Открыть / установить</button>
    </article>)}</div>}
  </div>
}
