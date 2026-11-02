# Herdr Pi Role

Fork a temporary, interactive role from your current Pi conversation in Herdr. The role can watch Main without interrupting it.

In a **local Herdr app pane** running Pi, type:

```text
/role Critic
```

A second Pi opens beside Main at the current point in its history. There is no tree picker, summary request, or naming step. Keep talking in Main. The Critic sees new prompts and finished replies as they arrive, even while Main is working. Read the critique in its pane, or talk to it there. **Nothing it says is automatically sent back.**

## Installation

You need Node 22.19+, Pi (npm distribution, 1.4 or 1.5), a configured model, and an interactive **local Herdr desktop** pane with `hc` and `herdr-app` on PATH. The reference desktop is Herdr app 0.1.12 with hc 0.1.17. A standalone terminal, legacy Herdr multiplexer, or Pi print/RPC process cannot open a role pane.

Choose **one** install method:

- **From GitHub:** repository access and authenticated Git are required while the repository is private. In the project where you want `/role`, run `pi install --local git:github.com/johnlindquist/herdr-pi-role`. If your Git credential setup uses a local checkout, `gh repo clone johnlindquist/herdr-pi-role` and `pi install --local /absolute/path/to/herdr-pi-role` also work. Keep that checkout in place.
- **From the course download:** unzip `temporary-role.zip`; copy the entire `temporary-role` directory to `.pi/extensions/temporary-role/` inside your project. No GitHub account is required for a copy you already have.

Start Pi in the project or run `/reload`. Review the code before granting Pi project trust. No separate npm install, Pine, `/split` extension, or new model login is needed if your Pi model already works. To remove a package install, run `pi remove --local` with the same source you installed; for a copied extension, delete its directory. Then `/reload`.

## Find your way while typing

Type **`/role` and a space**. Pi lists choices with descriptions; type a few letters to narrow the list. Use ↑/↓ to highlight and **Tab** to fill the draft. A dim usage hint above the editor shows the next argument without inserting it. For example, with Notes already open, type `/role se`, Tab to complete `send`, then Space for the recipient hint. Press Tab to list or complete recipients, or type the first letter to narrow the choices. Choose a target, add a space and write your message; submit the finished draft with Enter. Esc dismisses a visible list so you can keep typing your own name. Free-form jobs and messages are not completed or replaced.

Main offers starter roles and live recipients. A linked child offers `main`, not its siblings; disconnected children don’t offer send. `--work` is always explicit. Run `/role help` for the guide in this pane or `/role help send` for messaging details. Other help topics: `open`, `work`, `inbox`, `status`, `stop`.

## Give a pane a job

`/role` opens a Critic. `/role Notes` and `/role Research` also have starter jobs. To name your own role and set its job in one line:

```text
/role Availability Check whether we still offer a home after someone books it.
```

The role uses Main’s selected model and thinking setting. The fork includes the current **branch**, including its prior tool history. After the fork, only new prompt and answer **text** is forwarded, not tool calls, tool results, images, or reasoning. Each observation can use model tokens. Busy roles batch observations rather than interrupt an answer. Long observations are trimmed; if a role falls more than 24 messages behind, it reports skipped observations. The same computer and Pi account host both panes.

By default the role can inspect files using the reading tools available in Main. For a job that needs to change files or run commands, opt in when you open it: `/role --work Notes Keep agreed decisions in notes.md`. Work roles share the project directory; give each writer its own files. These are Pi tool limits, not an operating-system sandbox. The extension needs normal local permissions and does not transmit messages to an external messaging service.

## Send a message deliberately

| Where you type | Command | What happens |
|---|---|---|
| Main | `/role send Critic Which assumption should I check first?` | Only Critic gets a direct request. Its answer stays in its pane. |
| Main | `/role send all Focus on what the guest sees.` | Each linked role gets the same request. A busy role waits until its current answer is finished. |
| Critic | `/role send main A second search still offers the booked home.` | Main gets an inbox note, not a new prompt. Its current answer and editor draft are untouched. |
| Main | `/role inbox` | Read pending notes without calling a model. On Main’s next user prompt they enter context as attributed notes, not instructions. |
| Either | `/role status` | Inspect the links. **Opening** means the pane has not checked in; **watching** means the fork has connected. |
| Main / role | `/role stop Critic` / `/role stop` | Disconnect the link. Both conversations stay open and usable. |

The message receipt confirms acceptance by the other pane, not a completed answer. An offline role or full inbox reports a failure. A lost connection before a receipt means delivery is uncertain: inspect before resending. Close a role pane normally when you are done. Closing, reloading or switching a linked session disconnects it; changing branches does not silently redirect it. Open a fresh role from Main to start a new link. Pi keeps normal session history, but no reusable agent or background watcher is installed.

## Agent access

The `temporary_role` tool uses the same operations as `/role`. Start with `{"action":"help"}` or `{"action":"help","topic":"send"}` for the current pane, then `{"action":"status"}` for its actual links. `open` takes `name`, `job`, and optional `work`; `send` takes `target` and `message`; `stop` takes a target in Main; `inbox` lists pending notes in Main. Use the **session ID** from status for a specific role, `all` for a broadcast, or `main` from a child. Open visible panes or send messages only on request. A role cannot use the tool to send a note during an automatic observation. A direct role conversation or explicit command can. A stale ID never addresses a replacement with the same name.

## Troubleshooting

- **No `/role` in the slash menu:** check that the whole package was installed in the current project, that project extensions are trusted, and run `/reload`. Avoid installing a second copy under a different source.
- **No adjacent pane:** run the command in Main inside the local Herdr desktop. `hc get "$HC_TERMINAL_ID"` and `herdr-app ls` should identify that same terminal and pane. The extension refuses to guess the focused pane. Check the new pane for a trust prompt or model error if status stays *opening*.
- **A link ended:** reloads, branch changes and pane closure disconnect the link. The old fork is still readable. Open a new role from Main; existing manually split panes are not adopted.
- **No note appeared:** normal replies are not messages to Main. Use `/role send main …` in the linked role and `/role inbox` in Main. Don’t retry on an uncertain receipt until you’ve checked the inbox.

## Implementation and verification

`index.ts` registers `/role`, its Pi hooks and the agent tool; `guide.mjs` supplies contextual help, completions and hints. `host.mjs` verifies the caller’s Herdr pane and forks the current Pi branch. `launch.mjs` starts Pi beside it in the same project. `wire.mjs` links the two local processes using a private single-use ticket. It is not a remote messaging service or a security boundary between untrusted users.

From a repository checkout run `npm test` for the guidance, observation-filtering, pending-tool and ticket checks. For a smoke test in a disposable Herdr workspace, open `/role Notes`, send a unique phrase in Main, and look for it in Notes. From Notes, use `/role send main Check the second booking.` Verify that Main’s draft remains intact, `/role inbox` shows exactly one note, and `/role stop Notes` disconnects without closing the pane.
