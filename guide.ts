// All guidance is local to the pane. Completion values replace Pi's entire argument prefix.
const presets = [['Critic','Challenge assumptions'],['Notes','Track decisions and open questions'],['Research','Check claims against evidence'],['Historian','Search Main’s history on demand']];
const topics = {
  open: ['Open a role', '/role [NAME] [one-sentence job]', 'Choose a role, then its model. The fast default (Haiku) is highlighted, because roles are quick visual support. /role Notes --model fast takes it without a picker; --model main uses Main’s model; --model provider/model pins an exact choice. You can also name your own role. The fork starts here and watches future Main prompts and answers.'],
  work: ['Allow workspace tools', '/role --work Notes Keep decisions in notes.md', 'Opt in at creation. The role can use write, edit and shell tools available in Main, in the same project. Otherwise it only has inspection and messaging tools.'],
  send: ['Send a message', '/role send TARGET MESSAGE', 'A direct request goes to the named role. Its answer stays in its pane. Use all to broadcast. From a linked role, send main queues a note; it never interrupts Main.'],
  inbox: ['Read pending notes', '/role inbox', 'Inspect notes without a model call. They join Main’s context on its next user prompt. Inspecting does not consume them.'],
  status: ['Inspect links', '/role status', 'Opening means the new pane has not connected yet. Watching means its link is active. A stopped or disconnected pane is still an ordinary Pi conversation.'],
  stop: ['Disconnect a link', '/role stop NAME', 'Disconnect without closing either pane. In a role, /role stop disconnects just that role. A new link requires a fresh fork from Main.'],
};
const mainTopics=Object.keys(topics), childTopics=['send','status','stop'];
const children=s=>s.roles.filter(r=>r.state==='watching'||r.state==='opening');
const linked=s=>s.state==='watching Main';
const fresh=s=>presets.filter(([n])=>!children(s).some(r=>r.name.toLowerCase()===n.toLowerCase()));
const names=s=>children(s).map(r=>[r.name,`${r.state==='opening'?'Opening':'Linked role'} · ${r.name}`]);
function choices(prefix,items,head='') {
  const matches=items.filter(([v])=>v.toLowerCase().startsWith(prefix.toLowerCase()));
  // An exact word is already a valid draft. Don't make Enter select it instead of running it.
  if(!matches.length || matches.some(([v])=>v.toLowerCase()===prefix.toLowerCase()))return null;
  return matches.map(([label,description])=>({value:head+label,label,description}));
}
function roots(s){
  const common=[['status','Inspect this pane’s links'],['help','Show commands and examples']];
  if(s.mode==='role')return [...(linked(s)?[['send','Leave a note for Main'],['stop','Disconnect this role']]:[]),...common];
  return [...fresh(s),['open','Give a named role one job'],...(children(s).length?[['send','Address one role or all'],['stop','Disconnect one role']]:[]),['inbox',`Read pending notes (${s.inbox})`],...common,['--work','Opt in to workspace changes']];
}
export function roleCompletions(raw,s){
  if(/[\r\n]/.test(raw))return null;
  const words=raw.trimStart().split(/\s+/), lead=words.slice(0,-1).map(w=>w.toLowerCase()).join(' '), tail=words.at(-1), head=raw.slice(0,raw.length-tail.length);
  if(!lead)return choices(tail,roots(s),head);
  if(lead==='help')return choices(tail,(s.mode==='role'?childTopics:mainTopics).map(t=>[t,topics[t][0]]),head);
  if(lead==='send')return choices(tail,s.mode==='role'?(linked(s)?[['main','Queue a note without waking Main']]:[]):[...names(s),...(children(s).length?[['all','Broadcast to every linked role']]:[])],head);
  if(s.mode==='role')return null;
  if(lead==='stop')return choices(tail,names(s),head);
  if(['open','--work','open --work'].includes(lead))return choices(tail,[...fresh(s),...(lead==='open'?[['--work','Allow workspace tools']]:[])],head);
  return null; // Never complete inside a free-form message or job.
}
export function roleHint(draft,s){
  if(!/^\/role(?:\s|$)/.test(draft))return null;
  const raw=draft.slice(5).trimStart(), [first='', second='']=raw.trimEnd().split(/\s+/), a=first.toLowerCase(), child=s.mode==='role', rows=children(s);
  if(!a)return child?['/role help',linked(s)?'Send a note: /role send main <message>':'Disconnected · chat here, or open a new role from Main.']:['/role [name] [job]', 'Default: Critic · choose a role, then its model · Esc dismisses'];
  if(a==='help')return ['/role help [topic]','Space for topics; Enter shows the guide.'];
  if(a==='send'){
    if(child&&!linked(s))return ['/role status','Disconnected: no note can be sent.'];
    if(!child&&!rows.length)return ['/role Critic','No linked roles yet. Open one before sending.'];
    const targets=child?['main']:[...rows.map(r=>r.name),'all'];const found=targets.find(t=>t.toLowerCase()===second.toLowerCase());
    return found?[`/role send ${found} <message>`,child?'Queues a note; Main keeps working.':found==='all'?'Broadcast to every linked role.':'Only this role receives your message.']: [child?'/role send main <message>':'/role send <role | all> <message>',child?'Tab: main · Queues a note for Main.':`Tab: ${targets.join(', ')} · Choose a recipient.`];
  }
  if(a==='stop')return child?['/role stop','Disconnect here; keep both panes.']:['/role stop <linked role>',rows.length?'Disconnect the link, not the pane.':'No active links to stop.'];
  if(a==='status'||(!child&&a==='inbox'))return [`/role ${a}`,topics[a][0]+'. No model call.'];
  const match=roleCompletions(raw,s)?.[0];if(match && !/\s$/.test(raw))return [`/role ${match.value}`,match.description+' · Tab to complete.'];
  if(child)return ['/role help',linked(s)?'Send to main, inspect status, or stop the link.':'Not linked. Use /role status.'];
  const work=/^(?:open\s+)?--work(?:\s|$)/i.test(raw);
  return [work?'/role --work <name> [job]':'/role <name> [one-sentence job]',work?'May edit files or run commands in this project.':'Opens beside Main; inspection tools only.'];
}
export function roleHelp(s,raw=''){
  const t=raw.trim().toLowerCase(),child=s.mode==='role';
  if(t){if(!Object.hasOwn(topics,t))return `Unknown help topic. Try /role help ${child?'send':'open'}.`;
    if(child&&t==='send')return `/role send main <message>\nExample: /role send main Check the cancellation policy.\n${linked(s)?'Main reads it on its next prompt. Your usual replies stay here.':'This role is disconnected; open a new one from Main to send notes.'}`;
    if(child&&t==='stop')return '/role stop\nDisconnect this role. Its conversation stays open.';
    const [,usage,details]=topics[t];return `${usage}\n${details}${t==='send'?'\nExample: /role send '+(children(s)[0]?.name||'Critic')+' What should I double-check?':''}`;}
  const list=child?[...(linked(s)?['/role send main <message>  ·  Leave a note','/role stop  ·  Disconnect this role']:['No live link to Main. Open a fresh role there to reconnect.']),'/role status  ·  Check this link']:['/role  ·  Open a Critic beside Main','/role Notes  ·  Track decisions','/role Research  ·  Check evidence','/historian QUESTION  ·  Answer here using Main’s history','/role Historian  ·  Open a private history desk','/role <name> [job]  ·  Give a role your own job','/role --work <name> [job]  ·  Allow workspace changes','/role send <name | all> <message>  ·  Address linked roles','/role inbox  ·  Read pending notes','/role status  ·  Inspect links','/role stop <name>  ·  Disconnect, keep the pane'];
  return [...list,'','Choose a role, then its model. Tab prepares a draft; Enter confirms. /role Critic --model main skips the picker.','/role help send  ·  Messaging examples'].join('\n');
}
