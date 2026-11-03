import type { ExtensionContext } from '@earendil-works/pi-coding-agent';

// Only expose names from Pi's configured chat catalogue, never auth material.
export type RoleModel = { ref:string; provider:string; id:string; name:string; main:boolean; thinking?:string };
export function roleModels(c:ExtensionContext):RoleModel[] {
  const current=c.model && `${c.model.provider}/${c.model.id}`;
  const available=c.modelRegistry.getAvailable();
  const scoped=new Map((c.scopedModels??[]).map(s=>[`${s.model.provider}/${s.model.id}`,s]));
  const rows=new Map<string,RoleModel>();
  for(const m of available){
    const ref=`${m.provider}/${m.id}`;
    if(rows.has(ref)||(!scoped.has(ref)&&scoped.size>0&&ref!==current))continue;
    rows.set(ref,{ref,provider:m.provider,id:m.id,name:m.name||m.id,main:ref===current,thinking:scoped.get(ref)?.thinkingLevel});
  }
  return [...rows.values()].sort((a,b)=>Number(b.main)-Number(a.main)||a.ref.localeCompare(b.ref));
}
export function requireRoleModel(c:ExtensionContext,requested?:string):RoleModel {
  const rows=roleModels(c), row=requested===undefined||requested==='main'?rows.find(r=>r.main):rows.find(r=>r.ref===requested);
  if(!row)throw Error('That role model is not available in this session. Choose an exact provider/model from the picker or the models action. No pane opened.');
  return row;
}
export function modelDirectory(c:ExtensionContext,query=''){
  const terms=query.trim().toLowerCase().split(/\s+/);
  const matches=roleModels(c).filter(r=>terms.every(t=>`${r.ref} ${r.name}`.toLowerCase().includes(t)));
  return {scope:(c.scopedModels??[]).length?'scoped + Main':'configured',count:matches.length,models:matches.slice(0,80),truncated:matches.length>80};
}
// Only the switch immediately after NAME is syntax; later '--model' is job text.
export const modelToken=(ref:string)=>/^[^\s"\\]+$/.test(ref)?ref:JSON.stringify(ref);
export function modelJob(job=''):{job:string;model?:string}{
  if(!/^--model(?:\s|$)/.test(job))return {job};
  const m=/^--model\s+("(?:[^"\\]|\\.)*"|[^\s"]+)(?:\s+([\s\S]*))?$/.exec(job.trimEnd());
  if(!m)throw Error('Use NAME --model main or NAME --model provider/model [job].');
  let model=m[1];if(model.startsWith('"')){try{model=JSON.parse(model);}catch{throw Error('Invalid quoted model ID. Choose the model again.');}}
  return {model,job:m[2]??''};
}
