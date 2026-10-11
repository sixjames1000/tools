/** The caveman skill's mode: off, or which voice is on. */
export type CavemanMode = 'off' | 'caveman' | 'ultra' | 'wenyan'

declare module 'claude-code' {
  interface PluginState {
    'caveman-indicator': { mode: CavemanMode }
  }
}
