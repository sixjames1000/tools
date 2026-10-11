export type Ctx = {
  tokens: number
  /** How full the model's context window is, 0 to 100; null before the first reading. */
  windowPct: number | null
  fiveHourPct: number | null
}

/** The bar's colour slots, each a theme colour name or a hex value. */
export type Colours = {
  context: string
  warning: string
  alert: string
  warm: string
  cooling: string
  cold: string
  cached: string
  limit: string
}

/** The last turn's input, split by what the prompt cache served. */
export type TurnSplit = { cached: number; fresh: number }

declare module 'claude-code' {
  interface PluginState {
    'context-bar': {
      tick: number
      ctx: Ctx | null
      lastTurnEnd: number | null
      lastSplit: TurnSplit | null
      held: string | null
      heldTokens: number
      warnedFor: number | null
      notified: number
      colours: Colours
    }
  }
}
