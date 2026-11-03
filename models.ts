import type { ExtensionContext } from '@earendil-works/pi-coding-agent';

type ChatModel=NonNullable<ExtensionContext['model']>;
export type Effort=(m:ChatModel,pin?:NonNullable<ExtensionContext['scopedModels'][number]['thinkingLevel']>)=>{levels:readonly string[];thinking:string};
export type RoleModel = { ref:string; provider:string; id:string; name:string; main:boolean; thinking:string; levels:readonly string[] };
export function roleModels(c:ExtensionContext,effort:Effort):RoleModel[] {
  const current=c.model && `${c.model.provider}/${c.model.id}`;
  const scoped=new Map((c.scopedModels??[]).map(s=>[`${s.model.provider}/${s.model.id}`,s]));
  const rows=new Map<string,RoleModel>();
  for(const m of c.modelRegistry.getAvailable()){
    const ref=`${m.provider}/${m.id}`;
    if(rows.has(ref)||(!scoped.has(ref)&&scoped.size>0&&ref!==current))continue;
    const setting=effort(m,scoped.get(ref)?.thinkingLevel);if(!setting.levels.includes(setting.thinking))continue;
    rows.set(ref,{ref,provider:m.provider,id:m.id,name:m.name||m.id,main:ref===current,...setting});
  }
  return [...rows.values()].sort((a,b)=>Number(b.main)-Number(a.main)||a.ref.localeCompare(b.ref));
}
export function requireRoleModel(rows:RoleModel[],requested?:string,thinking?:string):RoleModel {
  const row=requested===undefined||requested==='main'?rows.find(r=>r.main):rows.find(r=>r.ref===requested);
  if(!row)throw Error('That role model is not available in this session. Choose an exact provider/model from the picker or the models action. No pane opened.');
  if(thinking===undefined)return row;
  if(!row.levels.includes(thinking))throw Error(`${row.ref} does not support thinking ${thinking}. Choose ${row.levels.join(', ')}. No pane opened.`);
  return {...row,thinking};
}
export function modelDirectory(rows:RoleModel[],scoped:boolean,query=''){
  const terms=query.trim().toLowerCase().split(/\s+/);
  const matches=rows.filter(r=>terms.every(t=>`${r.ref} ${r.name}`.toLowerCase().includes(t)));
  return {scope:scoped?'scoped + Main':'configured',count:matches.length,models:matches.slice(0,80),truncated:matches.length>80};
}
export const modelToken=(ref:string)=>/^[^\s"\\]+$/.test(ref)?ref:JSON.stringify(ref);
// Only leading switches after NAME are syntax. Once job text begins, keep it intact.
export function modelJob(job=''):{job:string;model?:string;thinking?:string}{
  const result:{model?:string;thinking?:string}={};
  while(/^--(?:model|thinking)(?:\s|$)/.test(job)){
    const m=/^--(model|thinking)\s+("(?:[^"\\]|\\.)*"|[^\s"]+)(?:\s+([\s\S]*))?$/.exec(job.trimEnd());
    if(!m||m[2].startsWith('--'))throw Error('Use NAME --model provider/model --thinking LEVEL [job].');
    const key=m[1] as 'model'|'thinking';if(result[key]!==undefined)throw Error(`Duplicate --${key}.`);
    let value=m[2];if(value.startsWith('"')){try{value=JSON.parse(value);}catch{throw Error(`Invalid quoted --${key} value.`);}}
    result[key]=value;job=m[3]??'';
  }
  return {...result,job};
}
