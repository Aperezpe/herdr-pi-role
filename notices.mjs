// The words a person reads when something is missing or when a finding arrives. One home, so the README can quote them.
export const NEEDS_HERDR = '/agent opens its pane with Herdr. Run Pi inside a pane of the Herdr desktop app (with hc and herdr-app on PATH), then try again. /agent --help works anywhere.';
export const missingTool = (bin, e) => `/agent could not run ${bin}${e ? ` (${String(e?.message ?? e).slice(0, 120)})` : ''}. Install Herdr's command-line tools so that hc and herdr-app are on PATH, then try again. No pane opened.`;
/** The one line Main shows when an agent's finding arrives: "from critic · This might break existing bookings…". */
export function noteNotice(name, text) {
  const body = String(text).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim().replace(new RegExp(`^${String(name).replace(/[^\w-]/g, '')} \\d{1,2}: `, 'i'), '');
  return `from ${name} · ${body.length > 96 ? body.slice(0, 95).trimEnd() + '…' : body}  (waits for your next prompt · /agent inbox)`;
}
