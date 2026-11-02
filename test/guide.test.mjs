import test from 'node:test';
import assert from 'node:assert/strict';
import {roleCompletions as complete,roleHint as hint,roleHelp as help} from '../guide.mjs';
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
