import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import type { RoleModel } from './models.ts';

// Main can outlive its pnpm release. Use only that installation's declared
// replacement. Never try another PATH entry, provider or model on failure.
export function roleCli(old:string):string {
  const file=(p:string)=>fs.statSync(p,{throwIfNoEntry:false})?.isFile();
  if(old && file(old))return old;
  const parts=old && path.isAbsolute(old)?old.split(path.sep):[],i=parts.lastIndexOf('.pnpm'),name='@earendil-works/pi-coding-agent';
  if(i<1||!parts[i+1]?.startsWith('@earendil-works+pi-coding-agent@')||parts.slice(i+2,i+5).join('/')!=='node_modules/'+name)throw Error('Main’s Pi launcher is no longer installed. Restart Pi in this saved session. No pane opened.');
  try{
    const store=parts.slice(0,i).join(path.sep),pkg=path.join(path.basename(store)==='node_modules'?store:path.join(store,'node_modules'),name);
    const data=JSON.parse(fs.readFileSync(path.join(pkg,'package.json'),'utf8'));
    if(data.name!==name||typeof data.bin?.pi!=='string'||path.isAbsolute(data.bin.pi))throw Error();
    const base=fs.realpathSync(pkg),entry=fs.realpathSync(path.resolve(base,data.bin.pi));
    if(!entry.startsWith(base+path.sep)||!file(entry))throw Error();return entry;
  }catch{throw Error('Main’s Pi was upgraded and its replacement CLI could not be verified. Restart Pi in this saved session. No pane opened.');}
}
export function launchSpec(pi:ExtensionAPI,ctx:ExtensionContext,file:string,allowed:string[],agentDir:string,model:RoleModel,cli:string){
  const keep=new Set(['--no-extensions','-ne','--no-context-files','--no-mcp','--no-approve','-na','--no-skills','-ns','--no-prompt-templates','--no-themes','--offline','--no-builtin-tools']);
  const valued=new Set(['--extension','-e','--exclude-tools','--system-prompt','--append-system-prompt']);
  const args:string[]=[],original=process.argv.slice(2);
  for(let i=0;i<original.length;i++){const a=original[i];if(a==='--')break;if(keep.has(a))args.push(a);else if(valued.has(a)&&original[i+1])args.push(a,original[++i]);}
  args.push('-e',fileURLToPath(new URL('./index.ts',import.meta.url)),'--no-mcp','--tools',[...allowed,'temporary_role'].join(','),'--session-dir',ctx.sessionManager.getSessionDir(),'--session',file,
    '--provider',model.provider,'--model',model.id,'--thinking',model.thinking??pi.getThinkingLevel());
  const preloads:string[]=[];for(let i=0;i<process.execArgv.length;i++)if(['--require','-r','--import'].includes(process.execArgv[i])&&process.execArgv[i+1])preloads.push(process.execArgv[i],process.execArgv[++i]);
  return {cwd:ctx.cwd,env:{PATH:process.env.PATH||'',PI_CODING_AGENT_DIR:agentDir},argv:[...preloads,cli,...args]};
}
