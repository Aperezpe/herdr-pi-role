// Prompts control prose; the UI controls attribution and quote length. Never invent fields or change a model's answer to make it fit.
const formats={
  historian:['Answer','Evidence','Unknown'],critic:['Risk','Why it matters','Next check'],notes:['Decided','Still open','Next action'],research:['Finding','Evidence','Unknown'],
};
export function template(name){return formats[String(name).toLowerCase()]??['Finding','Basis','Next step'];}
export function responseGuide(name){
 const fields=template(name);
 const job=({critic:'Lead with one consequential risk. Name the actual assumption, not a general warning. Give one check that could disprove it. If there is no new concern, say so in one line.',notes:'Record decisions as decisions only when someone actually settles them. Attribute them. Keep suggestions under Still open; never invent an owner or deadline.',research:'Separate what you verified from what was merely said. Cite the actual source or observation; if none is available, label the gap.'})[String(name).toLowerCase()]??'Lead with the result of your assigned job, then its basis and a useful next step.';
 return `Write for a narrow role pane. Use this Markdown reply template, one short paragraph per present field, separated by a blank line:\n${fields.map(f=>`**${f}** — …`).join('\n\n')}\n${job} Omit empty or irrelevant fields; never print placeholders. No greeting, table, generic recap, or quotation of the whole prompt. Prefer concrete details over repeated headings. If the person directly requests a different output format, honor it.`;
}
export function watchText(text,from){
 let body=text;const skills=[];
 if(from==='user')for(;;){
   const match=/^\s*<skill name="([\w.-]+)"(?: location="[^"\n]+")?\s*>\n[\s\S]*?\n<\/skill>[ \t]*(?:\n|$)/.exec(body);
   if(!match)break;skills.push(match[1]);body=body.slice(match[0].length);
 }
 body=body.trim();
 const suffix=skills.length?'\n[Attached skills: '+skills.join(', ')+']':'';
 const value=((body||'(No accompanying request.)')+suffix).trim();
 return value.length<=4000?value:value.slice(0,1790)+'\n[… middle trimmed …]\n'+value.slice(-2160);
}
// The underlying custom message still carries the whole bounded excerpt; expanding shows it as Markdown.
export function excerpt(content){
 const body=content.slice(content.indexOf('\n')+1),plain=body.replace(/^Main’s (?:prompt|reply):\s*/, '').replace(/\n\[Attached skills: [^\n]+\]$/, '').replace(/\s+/g,' ').trim();
 const origin=/^Main’s reply:/.test(body)?'reply':/^Main’s prompt:/.test(body)?'prompt':null;
 return {body,plain,origin};
}
