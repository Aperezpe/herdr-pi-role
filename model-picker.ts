import { DynamicBorder, getSelectListTheme, type ExtensionContext } from '@earendil-works/pi-coding-agent';
import { Container, Input, SelectList, Text, fuzzyFilter } from '@earendil-works/pi-tui';
import { roleModels } from './models.ts';

// Use Pi's public selector primitives and a stable, per-opening snapshot. The
// global /model command changes Main and is intentionally never invoked here.
export async function pickRoleModel(ctx:ExtensionContext, name:string, mode:'draft'|'open', signal:AbortSignal):Promise<string|null>{
  const rows=roleModels(ctx);
  if(!rows.length)throw Error('No configured chat models for this role. Set up a model in Pi first.');
  if(signal.aborted)return null;
  return ctx.ui.custom<string|null>((tui,theme,kb,done)=>{
    const input=new Input(), slot=new Container(), detail=new Text('',1,0);
    let list:SelectList, closed=false;
    const finish=(ref:string|null)=>{if(!closed){closed=true;signal.removeEventListener('abort',cancel);done(ref);}};
    const cancel=()=>finish(null);
    function filter(){
      const q=input.getValue().trim(),matches=q?fuzzyFilter(rows,q,r=>`${r.ref} ${r.name}${r.main?' same as Main':''}`):rows;
      list=new SelectList(matches.map(r=>({value:r.ref,label:r.main?'Same as Main':r.id,description:r.main?r.ref:r.provider})),7,getSelectListTheme(),{minPrimaryColumnWidth:14,maxPrimaryColumnWidth:36});
      list.onCancel=cancel;list.onSelect=item=>finish(item.value);list.onSelectionChange=item=>detail.setText(theme.fg('accent',item.value));
      detail.setText(matches.length?theme.fg('accent',matches[0].ref):theme.fg('muted','No matching configured model.'));
      slot.clear();slot.addChild(list);
    }
    class Picker extends Container {
      readonly capturesViewportInput=true;
      get focused(){return input.focused;} set focused(v:boolean){input.focused=v;}
      handleInput(data:string){
        if((['tui.select.up','tui.select.down','tui.select.pageUp','tui.select.pageDown','tui.select.confirm','tui.select.cancel'] as const).some(k=>kb.matches(data,k)))list.handleInput(data);
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
