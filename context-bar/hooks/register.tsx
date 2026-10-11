import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Colours, Ctx, TurnSplit } from '../types'

const tick = atom({ plugin: 'context-bar', key: 'tick' } as const, 0)
const ctxAtom = atom({ plugin: 'context-bar', key: 'ctx' } as const, null)
const lastTurnEnd = atom({ plugin: 'context-bar', key: 'lastTurnEnd' } as const, null)
const lastSplit = atom({ plugin: 'context-bar', key: 'lastSplit' } as const, null)
const held = atom({ plugin: 'context-bar', key: 'held' } as const, null)
const heldTokens = atom({ plugin: 'context-bar', key: 'heldTokens' } as const, 0)
const warnedFor = atom({ plugin: 'context-bar', key: 'warnedFor' } as const, null)
const notified = atom({ plugin: 'context-bar', key: 'notified' } as const, 0)

/** The bar's colours as first shipped; the Colours pane changes them, kept across sessions. */
const DEFAULT_COLOURS: Colours = {
  context: 'claude',
  warning: 'warning',
  alert: 'error',
  warm: '#3fb950',
  cooling: '#d29922',
  cold: '#f85149',
  cached: '#58a6ff',
  limit: '#bc8cff',
}
const colours = atom({ plugin: 'context-bar', key: 'colours' } as const, DEFAULT_COLOURS)
/** Where the chosen colours are kept between sessions ($.store). */
const COLOURS_STORE = 'colours'
const COLOURS_PANE = 'context-bar-colours'

/** What each slot colours, in the pane's order. */
const SLOTS: ReadonlyArray<[keyof Colours, string]> = [
  ['context', 'Context size'],
  ['warning', 'Context past warning'],
  ['alert', 'Context past alert'],
  ['warm', 'Cache warm'],
  ['cooling', 'Cache cooling'],
  ['cold', 'Cache cold'],
  ['cached', 'Cached tokens'],
  ['limit', '5-hour limit'],
]

/** The colours a slot can take: the app's own theme colours, then a palette. */
const SWATCHES: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'claude', label: 'Theme accent' },
  { value: 'warning', label: 'Theme warning' },
  { value: 'error', label: 'Theme error' },
  { value: 'success', label: 'Theme success' },
  { value: '#8b949e', label: 'Grey' },
  { value: '#c9d1d9', label: 'Silver' },
  { value: '#3fb950', label: 'Green' },
  { value: '#56d4bc', label: 'Mint' },
  { value: '#39c5cf', label: 'Teal' },
  { value: '#58a6ff', label: 'Blue' },
  { value: '#7c8cff', label: 'Indigo' },
  { value: '#bc8cff', label: 'Purple' },
  { value: '#f778ba', label: 'Pink' },
  { value: '#f85149', label: 'Red' },
  { value: '#f0883e', label: 'Orange' },
  { value: '#d29922', label: 'Amber' },
  { value: '#e3b341', label: 'Yellow' },
]

/** Saved colours over the defaults; anything missing or not a string keeps its default. */
const parseColours = (saved: unknown): Colours => {
  const out = { ...DEFAULT_COLOURS }
  if (typeof saved === 'object' && saved !== null) {
    for (const [slot] of SLOTS) {
      const value = (saved as Record<string, unknown>)[slot]
      if (typeof value === 'string' && value !== '') out[slot] = value
    }
  }
  return out
}

const COOLING_MIN = 5

const num = (value: unknown, fallback: number) =>
  typeof value === 'number' && value > 0 ? value : fallback

const kfmt = (tokens: number) =>
  tokens >= 1_000_000
    ? `${(tokens / 1_000_000).toFixed(1)}M`
    : tokens >= 1000
      ? `${Math.round(tokens / 1000)}k`
      : `${tokens}`

const dur = (minutes: number) => {
  const m = Math.floor(minutes)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h${String(m % 60).padStart(2, '0')}`
  return `${Math.floor(h / 24)}d${h % 24}h`
}

/** Before the first turn there is no cache to colour. */
const NO_CACHE = '#8b949e'

async function setColour($: EngineInterface, slot: keyof Colours, value: string): Promise<void> {
  await update($, colours, c => ({ ...c, [slot]: value }))
  await $.store.set(COLOURS_STORE, await read($, colours))
}

async function resetColours($: EngineInterface): Promise<void> {
  await update($, colours, () => DEFAULT_COLOURS)
  await $.store.set(COLOURS_STORE, DEFAULT_COLOURS)
}

const contextTokens = async ($: EngineInterface) => {
  try {
    const { context } = await $.session.usage()
    if (context.tokens !== undefined) return context.tokens
    const sized = await $.session.usage({ breakdown: 'summary' })
    return sized.context.breakdown?.totalTokens ?? 0
  } catch {
    return 0
  }
}

export const register: Register = (on, options) => {
  const ttl = num(options.cacheTtlMinutes, 60)
  const holdMin = num(options.holdMinTokensK, 100) * 1000
  const warnAt = num(options.warnAtK, 300) * 1000
  const alertAt = num(options.alertAtK, 500) * 1000
  const handoffCommand =
    typeof options.handoffCommand === 'string' && options.handoffCommand !== ''
      ? options.handoffCommand
      : '/anthropic-skills:handoff'

  on('session.start', async ($, e, next) => {
    const chosen = parseColours(await $.store.get(COLOURS_STORE))
    await update($, colours, () => chosen)
    await $.command.register({
      name: 'context-colours',
      description: 'Choose the colours of the context bar above the prompt',
    })
    const saved = Number(await $.store.get(`lastTurnEnd:${e.cwd}`))
    if (Number.isFinite(saved) && saved > 0 && (await read($, lastTurnEnd)) === null) {
      await update($, lastTurnEnd, () => saved)
    }
    const now = await $.clock.now()
    await update($, tick, () => now)
    $.clock.every(30_000, async () => {
      const at = await $.clock.now()
      await update($, tick, () => at)
    })

    return next(e)
  })

  on('command.run', { command: 'model' }, async ($, e, next) => {
    const ctx = await read($, ctxAtom)
    if (e.args.trim() !== '' && ctx !== null && ctx.tokens >= holdMin) {
      $.ui.toast(
        `Changing model rewrites the cache: about ${kfmt(ctx.tokens)} tokens on the next turn.`,
        { timeoutMs: 6000 },
      )
    }

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const five = e.rateLimits.find(r => /five|5h/i.test(r.kind)) ?? e.rateLimits[0]
    const snap: Ctx = {
      tokens: e.context.tokens ?? 0,
      windowPct:
        e.context.percent !== undefined
          ? Math.round(e.context.percent)
          : e.context.window > 0
            ? Math.round(((e.context.tokens ?? 0) / e.context.window) * 100)
            : null,
      fiveHourPct: five === undefined ? null : Math.round(five.percentUsed),
    }
    await update($, ctxAtom, () => snap)

    const tier = snap.tokens >= alertAt ? alertAt : snap.tokens >= warnAt ? warnAt : 0
    const seen = await read($, notified)
    if (tier > seen) {
      $.ui.toast(
        tier === alertAt
          ? `Context passed ${kfmt(alertAt)}. Hand off before the next big task.`
          : `Context passed ${kfmt(warnAt)}. Each turn now re-reads it.`,
        { timeoutMs: 7000 },
      )
    }
    if (tier !== seen) await update($, notified, () => tier)

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)

    const now = await $.clock.now()
    await update($, lastTurnEnd, () => now)
    await update($, tick, () => now)
    await update($, held, () => null)
    await update($, warnedFor, () => null)

    const usage = e.usage
    if (usage !== undefined) {
      const split: TurnSplit = {
        cached: usage.cache_read_input_tokens,
        fresh: usage.input_tokens + usage.cache_creation_input_tokens,
      }
      await update($, lastSplit, () => split)
    }

    try {
      await $.store.set(`lastTurnEnd:${await $.session.cwd()}`, now)
    } catch {
      // the store is a nicety: a resumed session just starts without a reading
    }

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind !== 'composer' && e.origin.kind !== 'bridge') return next(e)

    const last = await read($, lastTurnEnd)
    if (last === null) return next(e)

    const now = await $.clock.now()
    const idle = (now - last) / 60_000
    if (idle < ttl) return next(e)
    if ((await read($, warnedFor)) === last) return next(e)

    const tokens = await contextTokens($)
    if (tokens < holdMin) return next(e)

    await update($, warnedFor, () => last)
    await update($, held, () => e.text)
    await update($, heldTokens, () => tokens)
    await update($, tick, () => now)

    const draft = e.text
    $.clock.after(150, () => {
      void $.prompt.fill({ text: draft, mode: 'replace' })
    })

    return {
      drop: `Cache is cold (idle ${dur(idle)}): about ${kfmt(tokens)} tokens will be rewritten. Send again to continue, or hand off first.`,
    }
  })

  on('command.run', { command: 'context-colours' }, async $ => {
    await $.ui.open({ id: COLOURS_PANE, title: 'Context bar colours' })
    return { text: 'Context bar colours opened.' }
  })

  on('ui.render', { component: 'Pane', requestId: COLOURS_PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Button, Text } = els
    // The mobile app draws no Select yet.
    if (!('Select' in els)) return <Text dimColor>Choose the bar's colours from the desktop app or a terminal.</Text>
    const { Select } = els
    const chosen = await read($, colours)
    return (
      <Box flexDirection="column" gap={1}>
        <Text dimColor>Pick a colour for each part of the bar. It changes at once and is kept for every session.</Text>
        {SLOTS.map(([slot, label]) => {
          const known = SWATCHES.some(s => s.value === chosen[slot])
          const options = known ? SWATCHES : [{ value: chosen[slot], label: chosen[slot] }, ...SWATCHES]
          return (
            <Box key={`row-${slot}`} alignItems="center" gap={1}>
              <Text color={chosen[slot]} bold>
                ■
              </Text>
              <Select
                key={`colour-${slot}`}
                label={label}
                options={options}
                value={chosen[slot]}
                onSelect={(value: string) => void setColour($, slot, value)}
              />
            </Box>
          )
        })}
        <Box>
          <Button key="reset" label="Reset to defaults" onPress={() => void resetColours($)} />
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const ctx = await read($, ctxAtom)
    const heldText = await read($, held)
    if (ctx === null && heldText === null) return next(e)

    const now = await read($, tick)
    const last = await read($, lastTurnEnd)
    const split = await read($, lastSplit)
    const rewrite = await read($, heldTokens)
    const c = await read($, colours)
    const els = $.ui.resolve(e)
    const { Box, Button, Text } = els

    const tokens = ctx?.tokens ?? 0
    const idle = last === null ? null : Math.max(0, (now - last) / 60_000)
    const left = idle === null ? null : ttl - idle
    const state: 'none' | 'warm' | 'cooling' | 'cold' =
      left === null ? 'none' : left <= 0 ? 'cold' : left <= COOLING_MIN ? 'cooling' : 'warm'

    const ctxTone = tokens >= alertAt ? c.alert : tokens >= warnAt ? c.warning : c.context

    // What the next turn will re-read: cold means all of it is paid fresh.
    const cached =
      state === 'cold' ? 0 : split !== null ? Math.min(split.cached, tokens || split.cached) : 0
    const fresh = state === 'cold' ? tokens : Math.max(0, tokens - cached)
    const hitPct = cached + fresh === 0 ? 0 : Math.round((cached / (cached + fresh)) * 100)
    const fill = state === 'none' ? NO_CACHE : c[state]

    const dot = state === 'warm' ? '●' : state === 'cooling' ? '◐' : '○'
    const cacheLabel =
      state === 'none'
        ? 'cache · first turn'
        : state === 'cold'
          ? `cold · idle ${dur(idle ?? 0)}`
          : `${state} · ${dur(left ?? 0)} left`

    const sep = <Text dimColor> │ </Text>

    const sendAnyway = async () => {
      await update($, held, () => null)
      if (heldText !== null) void $.prompt.submit({ text: heldText })
    }

    const handOff = async (surface: typeof e.surface) => {
      if (heldText !== null) await $.ui.copy({ text: heldText, surface })
      await update($, held, () => null)
      await $.prompt.fill({ text: handoffCommand, mode: 'replace' })
      $.ui.toast('Hand off command is in the prompt. Your held draft is on the clipboard.', {
        timeoutMs: 6000,
      })
    }

    return (
      <Box flexDirection="column">
        {heldText !== null && (
          <Box gap={1}>
            <Text color="warning" bold>
              ⚠ cold cache
            </Text>
            <Text>sending rewrites {kfmt(rewrite)}</Text>
            <Button key="send" label="Send anyway" hotkey="s" onPress={() => void sendAnyway()} />
            <Button
              key="handoff"
              label="Hand off first"
              hotkey="h"
              onPress={press => void handOff(press.surface)}
            />
          </Box>
        )}
        <Box alignItems="center">
          <Text color={ctxTone} bold>
            ◆ {kfmt(tokens)}
          </Text>
          {ctx?.windowPct != null && <Text dimColor> │ </Text>}
          {ctx?.windowPct != null && (
            <Text color={ctxTone} bold>
              {ctx.windowPct}%
            </Text>
          )}
          <Text dimColor> context</Text>
          {sep}
          <Text color={fill} bold>
            {hitPct}%
          </Text>
          <Text dimColor> · </Text>
          {state === 'cold' ? (
            <Text color={c.cold}>{kfmt(fresh)} to rewrite</Text>
          ) : (
            <Text>
              <Text color={c.cached}>{kfmt(cached)}</Text>
              <Text dimColor> cached</Text>
            </Text>
          )}
          {sep}
          <Text color={fill}>
            {dot} {cacheLabel}
          </Text>
          {ctx?.fiveHourPct != null && sep}
          {ctx?.fiveHourPct != null && (
            <Text>
              <Text dimColor>5h </Text>
              <Text color={c.limit}>{ctx.fiveHourPct}%</Text>
            </Text>
          )}
          <Text> </Text>
          <Button
            key="colours"
            label="🎨"
            plain
            onPress={() => void $.ui.open({ id: COLOURS_PANE, title: 'Context bar colours' })}
          />
        </Box>
      </Box>
    )
  })
}
