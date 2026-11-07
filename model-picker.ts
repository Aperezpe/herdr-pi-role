import { DynamicBorder, getSelectListTheme, type ExtensionContext } from '@earendil-works/pi-coding-agent';
import { Container, Input, SelectList, Text, fuzzyFilter } from '@earendil-works/pi-tui';
import type { RoleModel } from './models.ts';
type Choice={ref:string;thinking:string};

// Use Pi's public selector primitives and a stable, per-opening snapshot. The
// global /model command changes Main and is intentionally never invoked here.
export async function pickRoleModel(ctx:ExtensionContext, name:string, mode:'draft'|'open', signal:AbortSignal,rows:RoleModel[]):Promise<Choice|null>{
  if(!rows.length)throw Error('No configured chat models for this role. Set up a model in Pi first.');
  if(signal.aborted)return null;
  return ctx.ui.custom<Choice|null>((tui,theme,kb,done)=>{
    const input=new Input(), slot=new Container(), detail=new Text('',1,0);
    let list:SelectList, closed=false;
    const overrides=new Map<string,string>(), byRef=new Map(rows.map(r=>[r.ref,r]));
    function describe(){const row=byRef.get(list.getSelectedItem()?.value??'');detail.setText(row?theme.fg('accent',row.ref)+'\n'+theme.fg('text',`Thinking: ${overrides.get(row.ref)??row.thinking}`)+theme.fg('dim',row.levels.length===1?' (fixed)':` · Tab to cycle (${row.levels.join(' / ')})`):theme.fg('muted','No matching configured model.'));}
    function cycle(){const row=byRef.get(list.getSelectedItem()?.value??'');if(row&&row.levels.length>1){const i=row.levels.indexOf(overrides.get(row.ref)??row.thinking);overrides.set(row.ref,row.levels[(i+1)%row.levels.length]);describe();}}
    const finish=(choice:Choice|null)=>{if(!closed){closed=true;signal.removeEventListener('abort',cancel);done(choice);}};
    const cancel=()=>finish(null);
    function filter(){
      const q=input.getValue().trim(),matches=q?fuzzyFilter(rows,q,r=>`${r.ref} ${r.name}${r.main?' same as Main':''}${r.fast?' fast default':''}`):rows;
      list=new SelectList(matches.map(r=>({value:r.ref,label:r.fast?`${r.id} · fast default`:r.main?'Same as Main':r.id,description:r.fast?`${r.provider} · quick support`:r.main?r.ref:r.provider})),7,getSelectListTheme(),{minPrimaryColumnWidth:14,maxPrimaryColumnWidth:36});
      list.onCancel=cancel;list.onSelect=item=>{const row=byRef.get(item.value)!;finish({ref:row.ref,thinking:overrides.get(row.ref)??row.thinking});};list.onSelectionChange=describe;
      describe();
      slot.clear();slot.addChild(list);
    }
    class Picker extends Container {
      readonly capturesViewportInput=true;
      get focused(){return input.focused;} set focused(v:boolean){input.focused=v;}
      handleInput(data:string){
        if(kb.matches(data,'tui.input.tab'))cycle();
        else if((['tui.select.up','tui.select.down','tui.select.pageUp','tui.select.pageDown','tui.select.confirm','tui.select.cancel'] as const).some(k=>kb.matches(data,k)))list.handleInput(data);
        else{const before=input.getValue();input.handleInput(data);if(input.getValue()!==before)filter();}
        tui.requestRender();
      }
      dispose(){closed=true;signal.removeEventListener('abort',cancel);}
    }
    const view=new Picker();view.addChild(new DynamicBorder());
    view.addChild(new Text(theme.fg('accent',theme.bold(`Model for ${name}`)),1,0));
    view.addChild(new Text(theme.fg('muted','This provider receives the fork and watched text. Main’s model stays unchanged.'),1,0));
    if(!rows.some(r=>r.main))view.addChild(new Text(theme.fg('warning','Main’s model is unavailable in this profile. Choose a configured model explicitly.'),1,0));
    view.addChild(input);view.addChild(slot);view.addChild(detail);
    view.addChild(new Text(theme.fg('dim',`Type to filter · ↑↓ choose · Enter ${mode==='draft'?'fills draft':'opens role'} · Esc cancels`),1,0));
    view.addChild(new DynamicBorder());filter();signal.addEventListener('abort',cancel,{once:true});return view;
  },{overlay:true,overlayOptions:{width:'94%',anchor:'center'}});
}
