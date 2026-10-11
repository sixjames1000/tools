# tools

Claude Code mods, published as a plugin marketplace so they can be installed on any computer.

| Mod | What it does |
| --- | --- |
| `context-bar` | A bar above the prompt: context used and its share of the window, what the next turn re-reads from cache, cache warm/cold with time left, and the 5-hour limit. Holds a prompt before an expensive cold-cache rewrite. The 🎨 button (or `/context-colours`) picks its colours. |
| `caveman-indicator` | Shows the caveman skill's mode (`caveman off`, `caveman`, `caveman ultra`, `caveman wenyan`) in the status line under the prompt. |

## Install

In a terminal Claude Code session, run:

```
/plugin install context-bar --marketplace sixjames1000/tools
/plugin install caveman-indicator --marketplace sixjames1000/tools
```

Answer `y` to add the marketplace, then pick the **user** scope so the mod loads in every session on that computer. The desktop app's local Code tab picks up mods installed this way too.

## Adding or updating a mod

Each mod is a folder at the root of this repo:

```
<mod>/
├── .claude-plugin/plugin.json   # "name" must match the entry in .claude-plugin/marketplace.json
├── hooks/hooks.json             # { "modules": ["./register.tsx"] }
├── hooks/register.tsx           # the hooks module
└── types/index.d.ts             # only if the mod keeps values in $.state
```

A mod built in a Claude Code session lives in `~/.claude/dev-mods/<session-id>/<mod>/` on the computer it was made on. Copy that folder's contents over the mod's folder here, then check it:

```
claude plugin validate <mod>
claude plugin test <mod>
```

To add a new mod, also add an entry for it to `.claude-plugin/marketplace.json`. After pushing, update the mod on each computer from `/plugin`.

On the computer where this repo is cloned as `~/.claude/mods`, the mods are installed from the clone itself (`claude plugin marketplace add ~/.claude/mods`): edit a mod there and run `/reload-plugins` to try it before pushing.
