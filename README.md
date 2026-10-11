# tools

Claude Code mods, published as a plugin marketplace so they can be installed on any computer.

| Mod | What it does |
| --- | --- |
| `context-bar` | Shows how much of the context window is in use. |
| `caveman-indicator` | Shows when caveman mode is on. |

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
```

To add a new mod, also add an entry for it to `.claude-plugin/marketplace.json`. After pushing, update the mod on each computer from `/plugin`.
