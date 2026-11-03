import test from 'node:test';
import assert from 'node:assert/strict';
import {commandMenus} from '../command-menu.ts';
import {roleCompletions as complete,roleHint as hint,roleHelp as help} from '../guide.ts';
const main={mode:'main',inbox:1,roles:[{name:'Notes',state:'watching'},{name:'Old',state:'stopped'}]};
const child={mode:'role',state:'watching Main',roles:[],inbox:0};
test('argument replacement carries the verb, only offers addressable targets, and never rewrites free text',()=>{
 const values=(prefix,state)=>complete(prefix,state)?.map(x=>x.value)??[];
 assert.deepEqual(values('send ',main),['send Notes','send all']);assert.deepEqual(values('send n',main),['send Notes']);
 assert.deepEqual(values('stop ',main),['stop Notes']);assert.deepEqual(values('send ',child),['send main']);
 assert.deepEqual(values('send ',{...child,state:'disconnected'}),[]);
 assert(!values('',main).includes('Notes'));assert(!values('',child).includes('--work'));
 for(const s of ['send Notes hello','send main hi','Availability check stock','--work Writer write it','send Notes\nnew line'])assert.equal(complete(s,main),null);
 assert.equal(complete('Notes',child),null);assert.deepEqual(values('help se',child),['help send']);
});
test('hints disappear outside the command and explain scope before a user takes action',()=>{
 for(const s of ['plain /role','/roles','/roleplay'])assert.equal(hint(s,main),null);
 assert.match(hint('/role send Notes ',main).join(' '),/<message>/);assert.match(hint('/role --work Notes',main).join(' '),/edit files/);
 assert.match(hint('/role send main hi',child).join(' '),/Main keeps working/);assert.match(help(child,'send'),/next prompt/);assert.match(help(main,'send'),/broadcast/);
});
test('an old root choice cannot overwrite a newer job; a completion cannot reopen after a focus or draft change',async()=>{
 let draft='/wi',focused,requests=0;
 const editor={getText:()=>draft,getCursor:()=>({line:0,col:draft.length}),tryTriggerAutocomplete:()=>requests++};focused=editor;
 const cmd=value=>({label:value,value});const native={async getSuggestions(){return {prefix:'/wi',items:['widen','widget'].map(cmd)};},applyCompletion(_ls,_l,_c,i){const next='/'+i.value+' ';return {lines:[next],cursorLine:0,cursorCol:next.length};}};
 const menus=commandMenus(native,new Map([['widget',{choices:()=>['Critic','Notes'].map(cmd),bare:()=>'Critic'}]]),()=>focused,()=>draft);
 const opt={force:false,signal:new AbortController().signal};
 const {items}=await menus.getSuggestions(['/wi'],0,3,opt);assert.deepEqual(items.map(v=>v.value),['widget','widen']);
 const {items:root}=await menus.getSuggestions(['/widget'],0,7,opt);assert.deepEqual(root.map(v=>v.label),['Critic','Notes']);
 const job='/widget Curator keep the review short';assert.deepEqual(menus.applyCompletion([job],0,job.length,root[0],'/widget').lines,[job]);
 function accept(i){draft='/wi';focused=editor;draft=menus.applyCompletion([draft],0,3,i,'/wi').lines[0];}
 accept(items[0]);focused={};await Promise.resolve();assert.equal(requests,0);
 accept(items[0]);draft+='Curator';await Promise.resolve();assert.equal(requests,0);
 accept(items[1]);await Promise.resolve();assert.equal(draft,'/widen ');assert.equal(requests,0);
 accept(items[0]);await Promise.resolve();assert.equal(draft,'/widget ');assert.equal(requests,1);
});
