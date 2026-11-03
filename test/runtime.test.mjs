import test from 'node:test';
import assert from 'node:assert/strict';
import { statSync, readFileSync, existsSync } from 'node:fs';
import { observation, spec, unfinished } from '../host.mjs';
import { listen, connect } from '../wire.mjs';
import { modelJob, modelToken, modelDirectory, requireRoleModel } from '../models.ts';
import { launchSpec } from '../role-launch.ts';
test('resolve exact, available scoped IDs; put the intended provider and nested model ID on the fork, never on Main',()=>{
 const main={provider:'a',id:'v/one',name:'One'},alt={...main,provider:'b'},outside={provider:'excluded',id:'v/two',name:'Two'};
 let available=[main,alt,outside];const c={model:main,cwd:'/example',modelRegistry:{getAvailable:()=>available},scopedModels:[{model:alt,thinkingLevel:'low'}],sessionManager:{getSessionDir:()=>'/sessions'}};
 assert.deepEqual(modelDirectory(c).models.map(r=>r.ref),['a/v/one','b/v/one']);assert.deepEqual(modelDirectory(c,'b/v').models.map(r=>r.ref),['b/v/one']);assert.equal(requireRoleModel(c).ref,'a/v/one');
 assert.throws(()=>requireRoleModel(c,'v/one'));assert.throws(()=>requireRoleModel(c,'excluded/v/two'));
 const selected=requireRoleModel(c,'b/v/one'),launch=launchSpec({getThinkingLevel:()=> 'high'},c,'child.jsonl',['read'],'/profile',selected,'/installed/pi.js');
 assert.deepEqual(launch.argv.slice(-6),['--provider','b','--model','v/one','--thinking','low']);assert.deepEqual(c.model,main);
 available=[main,outside];assert.throws(()=>requireRoleModel(c,selected.ref));
 assert.equal(modelJob('--model '+modelToken('local/a model')+' Short job').model,'local/a model');available=[];assert.throws(()=>requireRoleModel(c,'main'));
 assert.deepEqual(modelJob('--model b/v/one Review --model literally'),{model:'b/v/one',job:'Review --model literally'});assert.deepEqual(modelJob('Review --model main'),{job:'Review --model main'});assert.throws(()=>modelJob('--model'));
});

test('the live feed shares prompt and answer text, not tools, aborted replies, hidden thinking, images or return notes',()=>{
  const types=['thinking','image','text'].map(type=>({type,text:type==='text'?'A room opened.':'PRIVATE'}));
  assert.deepEqual(observation({role:'assistant',stopReason:'stop',content:types}),{from:'assistant',text:'A room opened.'});
  assert.deepEqual(observation({role:'user',content:types}),{from:'user',text:'A room opened.'});
  for(const m of [{role:'toolResult'},{role:'system'},{role:'custom'},{role:'assistant',stopReason:'aborted'},{role:'assistant',stopReason:'toolUse'}]) assert.equal(observation({...m,content:types}),undefined);
  const long=observation({role:'user',content:'a'.repeat(50_000)+'Actual request.'}).text;assert.match(long,/middle trimmed/);assert.match(long,/Actual request\.$/);
  const attached='<skill name="here-now" location="/private/example">\n'+ 'Large instructions. '.repeat(400)+'\n</skill>\n';
  assert.equal(observation({role:'user',content:attached+attached.replace('here-now','another')+'\nOpen the recording room.'}).text,'Open the recording room.\n[Attached skills: here-now, another]');
  assert.match(observation({role:'user',content:'Example: '+attached}).text,/Example: <skill/);
  for(const n of ['all','Main','send','\nfoo bar']) assert.throws(()=>spec(n));
});
test('an agent opening a role mid-tool does not orphan an old call or duplicate a completed result',()=>{
  const turn=(...ids)=>({type:'message',message:{role:'assistant',stopReason:'toolUse',content:ids.map(id=>({type:'toolCall',id,name:id}))}});
  const result=id=>({type:'message',message:{role:'toolResult',toolCallId:id}});
  assert.deepEqual(unfinished([turn('old'),turn('a','b'),result('a'),{type:'session_info'}]).map(b=>b.id),['b']);
  assert.deepEqual(unfinished([turn('old'),{type:'message',message:{role:'user'}}]),[]);
});
test('one private ticket binds one role; wrong or reused tickets cannot receive or send notes',async()=>{
  const received=[];let peer, accepted=0;
  const channel=await listen((msg,p)=>{assert.equal(msg.child,'expected');peer=p;accepted++;return {ready:true};},(type,v)=>{received.push(v);return 'received';},()=>{});
  const clients=[];
  try {
    channel.ticket({child:'expected'});const ticket=JSON.parse(readFileSync(channel.path,'utf8'));
    if(process.platform!=='win32') assert.equal(statSync(channel.path).mode&0o777,0o600);
    const stranger=connect(ticket,()=>{},()=>{});clients.push(stranger);
    await assert.rejects(stranger.call('hello',{token:'incorrect',child:'expected'}));assert.equal(accepted,0);
    const child=connect(ticket,(type,v)=>({type,seen:v}),()=>{});clients.push(child);
    assert.deepEqual(await child.call('hello',ticket),{ready:true});assert.equal(accepted,1);assert(!existsSync(channel.path));
    assert.equal(await child.call('note','check the date'),'received');assert.deepEqual(received,['check the date']);
    assert.deepEqual(await peer.call('direct','only you'),{type:'direct',seen:'only you'});
    const late=connect(ticket,()=>{},()=>{});clients.push(late);await assert.rejects(late.call('hello',ticket));assert.equal(accepted,1);
  } finally {channel.close(); for(const c of clients)c.close();}
});
