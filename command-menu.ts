import type { AutocompleteItem, AutocompleteProvider } from '@earendil-works/pi-tui';

export type CommandMenu = { choices: (args:string) => AutocompleteItem[] | null; bare: () => string };
type Editor = {
  getText?():string; getCursor?():{line:number;col:number}; isShowingAutocomplete?():boolean;
  tryTriggerAutocomplete?(explicitTab?:boolean):void;
};

// Pi 1.4/1.5 close the slash menu *after* applying a completion. Their editor
// has no public reopen API. Feature-detect its request-only method rather than
// dispatch a synthetic key that might fill a choice or submit someone's draft.
function continueIntoArgs(focus:()=>object|null|undefined, draft:()=>string, expected:string) {
  const editor=focus() as Editor | null | undefined;
  if(!editor?.tryTriggerAutocomplete)return;
  queueMicrotask(()=>{
    if(focus()!==editor || editor.getText?.()!==expected || draft()!==expected || editor.isShowingAutocomplete?.())return;
    const cursor=editor.getCursor?.();
    if(cursor?.line===0 && cursor.col===expected.length)editor.tryTriggerAutocomplete?.(false);
  });
}

export function commandMenus(current:AutocompleteProvider, menus:Map<string,CommandMenu>, focus:()=>object|null|undefined, draft:()=>string, roleFilled?:(name:string,command:string)=>void):AutocompleteProvider {
  const atEnd=(lines:string[],line:number,col:number)=>lines.length===1 && line===0 && col===lines[0].length?lines[0]:undefined;
  function parse(text:string|undefined){
    const m=text?.match(/^\/([\w-]+)(?: (.*))?$/), menu=m && menus.get(m[1]);
    return menu && m?{name:m[1],args:m[2],menu}:null;
  }
  // Tab/mouse fills the editor; Enter on a slash row instead submits it. Only
  // offer the draft picker if the original editor still owns that exact fill.
  function afterFill(result:{lines:string[];cursorLine:number;cursorCol:number}){
    const text=atEnd(result.lines,result.cursorLine,result.cursorCol),m=text?.match(/^\/(agent|role|widget|desk) ((?:open )?(?:--work )?)([a-z][\w-]{0,31})$/i);
    if(roleFilled&&text&&m&&menus.has(m[1])&&!((m[1]==='widget'||m[1]==='desk')&&m[2])&&!/^(main|all|open|send|stop|status|inbox|help)$/i.test(m[3])){
      const editor=focus() as Editor|undefined;
      queueMicrotask(()=>{const pos=editor?.getCursor?.();if(editor&&editor===focus()&&editor.getText?.()===text&&draft()===text&&pos?.line===0&&pos.col===text.length&&!editor.isShowingAutocomplete?.())roleFilled(m[3],text);});
    }
    return result;
  }
  return {
    triggerCharacters:current.triggerCharacters,
    async getSuggestions(lines,line,col,options){
      const text=atEnd(lines,line,col), root=parse(text);
      if(root && !(root.args??'').trim()){
        const {name,menu}=root, choices=menu.choices('')??[], bare=menu.bare();
        if(!choices.length)return null;
        // Bare Enter must retain its meaning even if Critic is already linked,
        // or the user is in a child where the bare command instead shows help.
        const first=choices.find(i=>i.value===bare)??{value:bare,label:bare,description:'Default agent · already linked'};
        const rows=[first,...choices.filter(i=>i.value!==bare)];
        return {prefix:text!,items:rows.map(i=>({...i,value:`${name} ${i.value}`}))};
      }
      if(root && options.force && root.args!==undefined){
        // Forced Tab normally asks Pi for files. Prefer a real agent argument at
        // an argument boundary; forward free-form job/message completion as-is.
        const items=root.menu.choices(root.args);
        if(items?.length)return {items,prefix:root.args};
      }
      const result=await current.getSuggestions(lines,line,col,options);
      const deskName=menus.has('desk')?'desk':'widget';
      if(text===`/${deskName.slice(0,2)}` && menus.has(deskName) && result?.prefix===text){
        const widget=result.items.find(i=>i.value===deskName);
        if(widget)return {...result,items:[widget,...result.items.filter(i=>i!==widget)]};
      }
      return result;
    },
    applyCompletion(lines,line,col,item,prefix){
      const offered=parse(prefix);
      if(offered && !(offered.args??'').trim() && item.value.startsWith(offered.name+' ')){
        // Never apply an old row over a different draft or cursor position.
        if(atEnd(lines,line,col)!==prefix)return {lines,cursorLine:line,cursorCol:col};
        const next='/'+item.value;
        return afterFill({lines:[next],cursorLine:0,cursorCol:next.length});
      }
      const result=current.applyCompletion(lines,line,col,item,prefix), expected=`/${item.value} `;
      if(menus.has(item.value) && prefix.startsWith('/') && atEnd(result.lines,result.cursorLine,result.cursorCol)===expected){
        continueIntoArgs(focus,draft,expected);
      }
      return afterFill(result);
    },
    shouldTriggerFileCompletion(lines,line,col){
      const root=parse(atEnd(lines,line,col));
      return !!root?.menu.choices(root.args??'')?.length || (current.shouldTriggerFileCompletion?.(lines,line,col)??true);
    },
  };
}
