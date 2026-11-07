import {CustomEditor,type ExtensionContext} from '@earendil-works/pi-coding-agent';
import {matchesKey,isKeyRelease,wrapTextWithAnsi} from '@earendil-works/pi-tui';
import {items} from './presentation.mjs';

type Card={id:number,text:string,state:'ready'|'sending'|'sent'|'unconfirmed',item?:number};
export function replyTray(c:ExtensionContext,deliver:(id:number,text:string)=>Promise<any>,live:()=>boolean){
 const cards:Card[]=[];let serial=0,selected:number|null=null,page=0,pages=1,status='',armedDraft='',refresh=()=>{};
 const current=()=>cards.find(v=>v.id===selected);
 const clear=()=>{selected=null;page=0;status='';};
 function browse(step:number){const i=cards.findIndex(v=>v.id===selected);selected=cards[i<0?cards.length-1:Math.max(0,Math.min(cards.length-1,i+step))].id;page=0;status='';refresh();}
 async function forward(id:number){const card=cards.find(v=>v.id===id);if(!live()||!card)throw Error('Reply unavailable. Select a current reply.');if(card.state==='sent')return {id,state:'already in Main’s inbox'};if(card.state==='sending')throw Error('Send pending.');if(card.text.length>2400)throw Error('Reply exceeds 2,400 characters. Ask for a shorter note.');card.state='sending';refresh();try{const receipt=await deliver(id,card.text);card.state='sent';return {id,receipt};}catch(e){card.state='unconfirmed';throw e;}finally{refresh();}}
 // Wrap the configured editor instead of watching global terminal input. Pickers,
 // confirmation dialogs, Main and the RPC desk never pass through this handler.
 let menu=()=>false;const previous=c.ui.getEditorComponent?.();
 c.ui.setEditorComponent((tui,theme,kb)=>{const editor=previous?.(tui,theme,kb)??new CustomEditor(tui,theme,kb);const native=editor.handleInput.bind(editor);
   menu=()=>!!(editor as typeof editor & {isShowingAutocomplete?:()=>boolean}).isShowingAutocomplete?.();
   editor.handleInput=(data:string)=>{const draft=()=>editor.getExpandedText?.()??editor.getText(),before=draft();const ac=editor as typeof editor & {isShowingAutocomplete?:()=>boolean};
     const eligible=live()&&!before.includes('\n')&&!before.startsWith('/')&&ac.isShowingAutocomplete?.()===false;
     if(!eligible){clear();native(data);return;}
     if(selected!==null&&armedDraft!==before)clear();
     if(!isKeyRelease(data)){
       if(cards.length&&(matchesKey(data,'up')||matchesKey(data,'down'))){armedDraft=before;browse(matchesKey(data,'up')?-1:1);return;}
       if(selected!==null){
         if(matchesKey(data,'escape')){clear();refresh();return;}
         if(matchesKey(data,'enter')){const id=selected;void forward(id).catch(e=>{if(selected===id)status=e.message;refresh();});return;}
         if(matchesKey(data,'pageUp')||matchesKey(data,'pageDown')){page=Math.max(0,Math.min(pages-1,page+(matchesKey(data,'pageUp')?-1:1)));refresh();return;}
       }
     }
     native(data);if(before!==draft()){clear();refresh();}
   };return editor;
 });
 c.ui.setWidget('temporary-role.reply-tray',(tui,theme)=>{refresh=()=>tui.requestRender();return {invalidate(){},render(width){
   if(!live())return [];const wrap=(s:string)=>wrapTextWithAnsi(s,Math.max(1,width));
   const draft=c.ui.getEditorText();if(draft.includes('\n'))return wrap('Multiline draft · ↑/↓ move cursor').map(v=>theme.fg('muted',v));
   if(menu()||draft.startsWith('/'))return wrap(menu()?'Pi completions · ↑/↓ choose':'Pi command · Enter runs it').map(v=>theme.fg('muted',v));
   if(selected===null)return wrap(cards.length?'↑/↓ select reply · Enter asks':'Enter asks · ↑/↓ select when a reply arrives').map(v=>theme.fg('muted',v));
   const card=current();if(!card)return wrap('Selected reply expired · ↑/↓ select again · Esc draft');
   const lines=card.text.split('\n').flatMap(s=>wrap(s.replace(/\t/g,'    '))),size=4;pages=Math.max(1,Math.ceil(lines.length/size));page=Math.min(page,pages-1);
   const action=card.state==='sent'?'Sent to Main':card.state==='sending'?'Sending…':card.text.length>2400?'Too long to send':'Enter sends to Main';
   return [...wrap(`${card.item?'Item '+card.item:'Whole reply'} · ${action}`).map(v=>theme.fg('accent',theme.bold(v))),...lines.slice(page*size,(page+1)*size),...wrap((pages>1?`PgUp/PgDn ${page+1}/${pages} · `:'')+'↑/↓ select · Esc draft').map(v=>theme.fg('muted',v)),...(status?wrap(status):[])];
 }};},{placement:'belowEditor'});
 // Item cards go in reverse so the first ↑ selects item 1 of the newest reply and further ↑ walks down its list (John, 2026-11-07).
 return {add(text:string,name='Role'){cards.push({id:++serial,text,state:'ready'});for(const i of items(text).reverse())cards.push({id:++serial,text:`${name} ${i.n}: ${i.text}`,state:'ready',item:i.n});while(cards.length>24)cards.shift();refresh();},list(){return cards.map(v=>({...v}));},forward,clear(){cards.length=0;clear();refresh();}};
}
