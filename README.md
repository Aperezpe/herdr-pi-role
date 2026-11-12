# Herdr Pi Agent

Fork a temporary, interactive agent from your current Pi conversation in Herdr. The agent can watch Main without interrupting it.

`/agent` was `/role` until 2026-11-11. `/role` still works and its hints show the new name. Unchanged for now: the `temporary_role` tool, the `.pi/roles.json` file for project agents and the `temporary-role` folder name in the course download.

In a **local Herdr app pane** running Pi, type:

```text
/agent Critic
```

Choose the model for Critic. The **fast default** (Haiku, or Luna when that is what you have) is highlighted, because an agent is quick visual support; Enter accepts it. **Same as Main** is next in the list. A second Pi opens beside Main at the current point in its history. There is no tree picker, summary request, or naming step. Keep talking in Main. The Critic sees new prompts and finished replies as they arrive, even while Main is working. Read the critique in its pane, or talk to it there. **Nothing it says is automatically sent back.**

## Installation

You need Node 22.19+, Pi (npm distribution, 1.4 or 1.5), a configured model, and an interactive **local Herdr desktop** pane with `hc` and `herdr-app` on PATH. The reference desktop is Herdr app 0.1.12 with hc 0.1.17. A standalone terminal, legacy Herdr multiplexer, or Pi print/RPC process cannot open an agent pane.

Choose **one** install method:

- **From GitHub:** repository access and authenticated Git are required while the repository is private. In the project where you want `/agent`, run `pi install --local git:github.com/johnlindquist/herdr-pi-role`. If your Git credential setup uses a local checkout, `gh repo clone johnlindquist/herdr-pi-role` and `pi install --local /absolute/path/to/herdr-pi-role` also work. Keep that checkout in place.
- **From the course download:** unzip `temporary-role.zip`; copy the entire `temporary-role` directory to `.pi/extensions/temporary-role/` inside your project. No GitHub account is required for a copy you already have.

Start Pi in the project or run `/reload`. Review the code before granting Pi project trust. No separate npm install, Pine, `/split` extension, or new model login is needed if your Pi model already works. To remove a package install, run `pi remove --local` with the same source you installed; for a copied extension, delete its directory. Then `/reload`.

## Find your way while typing

Type **`/agent`**. Pi lists the agents and commands immediately; no Space or Tab is needed to reveal them. Choose an agent with ↑/↓. **Enter** opens a searchable model picker; confirm to open that agent. **Tab** on an agent also shows the picker, but choosing a model only fills the draft so you can still add a job. Esc cancels without forking. You can also type a name and a job before pressing Enter. A dim usage hint above the editor shows the next argument without inserting it. For example, with Notes already open, type `/agent se`, Tab to complete `send`, then Space for the recipient hint. Press Tab to list or complete recipients, or type the first letter to narrow the choices. Choose a target, add a space and write your message; submit the finished draft with Enter. Esc dismisses a visible list so you can keep typing your own name. Free-form jobs and messages are not completed or replaced.

Main offers starter agents and live recipients. A linked child offers `main`, not its siblings; disconnected children don’t offer send. `--work` is always explicit. Run `/agent help` for the guide in this pane or `/agent help send` for messaging details. Other help topics: `open`, `work`, `inbox`, `status`, `stop`.

## Ask Historian from Main

`/historian Why did we drop the first demo?` uses Main’s model for one read-only history turn. The answer appears right in this thread; no pane or inbox step is required. Or ask Main in ordinary language to consult Historian.

Historian searches the active branch of this Pi session, including original messages before compaction. Ask for the speaker, entry ID and exact wording. It can distinguish a compaction summary from an original message, but cannot recover deleted entries. Other sessions, sibling branches, raw tool output, hidden thinking and images are outside the search.

For a private ongoing conversation, open /agent Historian (or /widget Historian with the optional desk). Unlike a watching agent, it starts with just its job, waits for a question, and requests excerpts from its linked Main. It has no shell or file tools. A different chosen provider can receive those excerpts. Private answers stay there unless explicitly sent back.

Agent interface: historian({query, beforeCompaction?, page?}) searches literal text; omit query for newest entries. historian({entry, offset?}) reads a longer excerpt by ID. Results report total matches and source positions; no match is not proof the event never happened.

## Give a pane a job

`/agent` opens a Critic. `/agent Notes` and `/agent Research` also have starter jobs. To name your own agent and set its job in one line:

```text
/agent Availability Check whether we still offer a home after someone books it.
```

The chosen **provider/model** runs in the child; Main’s model never changes. The picker lists configured chat models (scoped choices when configured, plus Main); type to filter by provider, ID or name. To bypass the picker, use `/agent Critic --model main`, or `/agent NAME --model provider/model [job]` with an exact ID. Inside the model picker, **Tab** cycles the highlighted model’s supported thinking levels; Enter keeps the displayed setting. A non-reasoning model shows **off (fixed)**. The initial level comes from the scoped model setting or Main, adjusted to the model’s capabilities. For a direct launch, add `--thinking high` immediately after `--model provider/model` and before the job. Unsupported explicit levels are rejected rather than substituted. The child verifies its model before linking. Changing its model later ends the link rather than silently forwarding new Main messages to a different provider.

For watching agents, the chosen provider receives the fork and subsequent watched text when the agent runs. Historian instead reads excerpts on demand. The fork includes the current **branch**, including its prior tool history. After the fork, only new prompt and answer **text** is forwarded, not tool calls, tool results, images, or reasoning. Each observation can use model tokens. Busy agents batch observations rather than interrupt an answer. Long observations are trimmed; if an agent falls more than 24 messages behind, it reports skipped observations. Both panes run on the same computer and use the same Pi profile; the chosen provider may use a different account.

By default the agent can inspect files using the reading tools available in Main. For a job that needs to change files or run commands, opt in when you open it (the agent then gets write, edit and shell tools even when Main itself is read-only): `/agent --work Notes Keep agreed decisions in notes.md`. Work agents share the project directory; give each writer its own files. These are Pi tool limits, not an operating-system sandbox. The extension needs normal local permissions and does not transmit messages to an external messaging service.

## Project agents connected to a local app

A project can define its own named agents in `.pi/roles.json`. A project agent has a one-sentence `hint` for the menus, a `job`, optional read-only `state` endpoints, an optional pinned `model` (exact provider/model) with a `thinking` level, and an optional `vocab` line for its reply items:

```jsonc
{ "roles": { "Review": {
    "hint": "Moment review · live state",
    "job": "Support the review. Fetch desk_state before answering.",
    "state": { "state": "https://review.example.localhost/api/state" },
    "model": "provider/model", "thinking": "medium" } } }
```

Project agents appear in the `/agent` list under the built-ins (which they cannot shadow), open like any other agent, and keep the normal read-only file tools. An agent with `state` also gets the **desk_state** tool: a GET of its configured endpoints only, restricted to `*.localhost` over HTTPS (verified against the portless CA in `~/.portless/ca.pem` when present) or `127.0.0.1` over HTTP. A very large JSON view is returned as a bounded sample; `view` plus `path` (`parts.0.slides`) reads an exact slice. An unreachable app is reported as such — the agent is told to say so rather than guess. A pinned model is that agent's default and skips the picker; an explicit `--model` still overrides it, and the pinned ref stays selectable even when `/scoped-models` leaves it out. Changing `roles.json` takes effect at the next open; already-linked panes keep the job they started with.

A project agent can also run as its **own standalone pi session**, without a Main link: `run-role.mjs` exports `runProjectRole(name)`, which starts `pi` on the agent's pinned model and thinking level with `standalone.ts` loaded — the same job in the system prompt and the same `desk_state` tool. A thin project wrapper is enough:

```ts
#!/usr/bin/env node
import { runProjectRole } from '../.pi/extensions/temporary-role/run-role.mjs';
process.chdir(new URL('..', import.meta.url).pathname);
runProjectRole('Review');
```

Extra arguments pass through to `pi` (`agents/review.ts -p "…"` runs one print-mode turn). The standalone session is an ordinary pi session with its normal tools; the agent's read-only discipline comes from its job text, not a tool cage.

## Use the agent pane from the keyboard

In a linked terminal agent, type and press **Enter** to ask privately. Press **↑/↓** in a single-line draft to select a finished reply. A preview under the editor shows what would be sent; **PgUp/PgDn** reads longer previews. **Enter** sends only the selected reply to Main’s inbox, once. New arrivals don’t move your selection. **Esc** or editing returns to writing without clearing your draft. Multiline drafts, slash commands and autocomplete keep Pi’s normal keys. Main’s editor is unchanged.

The last twelve finished answers from this link are selectable, not inherited history, tool output or partial answers. Replies over 2,400 characters can be inspected but not forwarded. For automation inside the linked agent, use temporary_role with action **replies**, then **forward** with the exact reply number on explicit request. Manual `/agent send main …` still works.

## Read an agent’s reply

Every agent is quick visual support: its reply is a `#` verdict led by a status emoji, then a numbered list of one-line findings, each led by an emoji. Critic grades the request (🟢 A to 🔴 D) and has three jobs: ❓ information the prompt leaves out that Main would have to guess, 💥 the blast radius (what else the change touches, asked as “should it change too?”) and ✂️ a task too big for one step, with the first smaller step; then one ➡️ next step. Notes lists ✅ decided, ❓ open and ⏭️ next; Research lists 🔎 findings with sources and trust stars. Send one finding to Main with `/agent send main #2` (or `#1,3`), or press ↑ in the agent's input: each numbered item is its own card, so Enter sends just that piece. Critic is adversarial and checks files before objecting. Besides prompts and answers, Critic receives Main’s progress: tool steps (without their output) in batches of three and a note when Main is interrupted. Research can also use installed web tools (`web_search`, `fetch_content`, `get_search_content`, `source_check`, `google_search`) and cites URLs or file paths. Other agents use the same verdict and numbered findings. These are writing instructions for the agent, not a parser: the model can honor a different format you request, and `#N` only works on numbered lines.

A watched turn shows its origin and a two-line excerpt. Expand it with Pi’s expand-output shortcut to read the forwarded Markdown. Leading Pi skill attachments are identified by name rather than repeated in full; long observations retain the beginning and the end. Main’s original message is unchanged.

## Send a message deliberately

| Where you type | Command | What happens |
|---|---|---|
| Main | `/agent send Critic Which assumption should I check first?` | Only Critic gets a direct request. Its answer stays in its pane. |
| Main | `/agent send all Focus on what the guest sees.` | Each linked agent gets the same request. A busy agent waits until its current answer is finished. |
| Critic | `/agent send main A second search still offers the booked home.` | Main gets an inbox note, not a new prompt. Its current answer and editor draft are untouched. |
| Main | `/agent inbox` | Read pending notes without calling a model. On Main’s next user prompt they enter context as attributed notes, not instructions. |
| Either | `/agent status` | Inspect the links. **Opening** means the pane has not checked in; **watching** means the fork has connected. |
| Main / agent | `/agent stop Critic` / `/agent stop` | Disconnect the link. Both conversations stay open and usable. |

The message receipt confirms acceptance by the other pane, not a completed answer. An offline agent or full inbox reports a failure. A lost connection before a receipt means delivery is uncertain: inspect before resending. Close an agent pane normally when you are done. Closing, reloading or switching a linked session disconnects it; changing branches does not silently redirect it. Open a fresh agent from Main to start a new link. Pi keeps normal session history, but no reusable agent or background watcher is installed.

## Agent access

The `temporary_role` tool uses the same operations as `/agent`. Start with `{"action":"help"}` or `{"action":"help","topic":"send"}` for the current pane, then `{"action":"status"}` for its actual links. `models` (optional `query`) returns exact configured IDs. `open` takes `name`, `job`, optional `work` and optional `model` (exact provider/model; defaults to Main without a picker), and optional `thinking` (one of that model’s `levels`); `send` takes `target` and `message`; `stop` takes a target in Main; `inbox` lists pending notes in Main. Use the **session ID** from status for a specific agent, `all` for a broadcast, or `main` from a child. Open visible panes or send messages only on request. An agent cannot use the tool to send a note during an automatic observation. A direct agent conversation or explicit command can. A stale ID never addresses a replacement with the same name.

## Troubleshooting

- **No `/agent` in the slash menu:** check that the whole package was installed in the current project, that project extensions are trusted, and run `/reload`. Avoid installing a second copy under a different source.
- **No adjacent pane:** run the command in Main inside the local Herdr desktop. `hc get "$HC_TERMINAL_ID"` and `herdr-app ls` should identify that same terminal and pane. The extension refuses to guess the focused pane. Check the new pane for a trust prompt or model error if status stays *opening*.
- **A link ended:** reloads, branch changes and pane closure disconnect the link. The old fork is still readable. Open a new agent from Main; existing manually split panes are not adopted.
- **No note appeared:** normal replies are not messages to Main. Use `/agent send main …` in the linked agent and `/agent inbox` in Main. Don’t retry on an uncertain receipt until you’ve checked the inbox.

## Implementation and verification

`index.ts` registers `/agent`, its Pi hooks and the agent tool; `guide.ts` supplies pane-aware help, completions and hints. `command-menu.ts` shows those choices in Pi’s own selector and continues into arguments when a command name is Tab-completed. `presentation.mjs` defines reply templates and compacts watched excerpts. A trusted sibling extension may request a local renderer on the model-aware `herdr-role:view.v2` Pi event (legacy v1 inherits Main), bound to the current session ID. The host still owns the fork, read-only access, agent identity, inbox and disconnect signal. No external renderer is required for `/agent`. `host.mjs` verifies the caller’s Herdr pane and forks the current Pi branch. `role-launch.ts` verifies the Pi CLI and selected model arguments before launch; `launch.mjs` starts the terminal child in the same project. `wire.mjs` links the two local processes using a private single-use ticket. It is not a remote messaging service or a security boundary between untrusted users.

From a repository checkout run `npm test` for the guidance, observation-filtering, pending-tool and ticket checks. For a smoke test in a disposable Herdr workspace, open `/agent Notes`, send a unique phrase in Main, and look for it in Notes. From Notes, use `/agent send main Check the second booking.` Verify that Main’s draft remains intact, `/agent inbox` shows exactly one note, and `/agent stop Notes` disconnects without closing the pane.
