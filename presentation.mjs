// Prompts control prose; the UI controls attribution and quote length. Never invent fields or change a model's answer to make it fit.
const formats={
  historian:['Answer','Evidence','Unknown'],critic:['Risk','Why it matters','Next check'],notes:['Decided','Still open','Next action'],research:['Finding','Evidence','Unknown'],
};
export function template(name){return formats[String(name).toLowerCase()]??['Finding','Basis','Next step'];}
export function responseGuide(name){
 const fields=template(name);
 const job=({critic:'Lead with one consequential risk. Name the actual assumption, not a general warning. Give one check that could disprove it. If there is no new concern, say so in one line.',notes:'Record decisions as decisions only when someone actually settles them. Attribute them. Keep suggestions under Still open; never invent an owner or deadline.',research:'Separate what you verified from what was merely said. Cite the actual source or observation; if none is available, label the gap.'})[String(name).toLowerCase()]??'Lead with the result of your assigned job, then its basis and a useful next step.';
 const brief=String(name).toLowerCase()==='critic'
   ? 'Make the headline the risk itself (not “Risk” or “Critique”). Explain the trigger and consequence in one short paragraph. Finish with “## Next check” and the smallest test that would settle it. If multiple steps are actually needed, use a short numbered list.'
   : 'Make the headline the answer, decision or finding itself. Follow with the evidence. Use only the relevant sections: '+fields.join(', ')+'.';
 return `Write for a narrow Markdown pane. ${job} ${brief} Start a substantive answer with a single # followed by your conclusion in 5–10 words, not a topic label. Then explain how it happens. Within that explanation, surround the few words that matter most with double asterisks for bold. Emphasize a specific trigger, consequence, or decision, not a whole sentence or a standalone label. Separate the next section with a blank line and a ## heading. Use numbered steps only for a sequence. Omit unnecessary sections. Never describe the template. No invented facts, decorative icons, tables, greetings, or generic recap. Prefer under 120 words. For a trivial reply, just answer. Honor an explicitly requested format.`+(String(name).toLowerCase()==='critic'? '\nHere is a finished critique about a DIFFERENT problem, to illustrate the typography and level of specificity. Use its shape, not its subject:\n\n# A retry can charge the customer twice\n\nIf the payment succeeds but its response is lost, retrying can create **a second charge** for the same order.\n\n## Next check\nDrop the response after the first charge, retry, and verify the ledger still shows one payment.':'');
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
