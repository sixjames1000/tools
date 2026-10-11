// Shows the caveman skill's mode in the footer's mode bar (the `SessionMode`
// labels beside "plan mode" and the like): "caveman", "caveman ultra",
// "caveman wenyan", or "caveman off".
//
// The skill keeps no state of its own that a mod can read, so the mode is
// followed from what turns it on and off:
// - the skill expanding (`/caveman`, the Skill tool): `caveman`, `ultracave`
//   (`/caveman ultra`) or `megacave` (`/caveman wenyan`);
// - the prompt: `/caveman [ultra|wenyan]` turns it on, "stop caveman" or
//   "normal mode" or "caveman (mode) off" turns it off. `/caveman status`
//   changes nothing.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { CavemanMode } from '../types'

const mode = atom({ plugin: 'caveman-indicator', key: 'mode' } as const, 'off')

/** The mode a prompt switches to, or undefined when it doesn't switch. */
export function modeFromPrompt(text: string): CavemanMode | undefined {
  const trimmed = text.trim()
  if (/\b(stop caveman|normal mode|caveman( mode)? off)\b/i.test(trimmed)) return 'off'
  const command = /^\/caveman(?:\s+(\w+))?\s*$/i.exec(trimmed)
  if (!command) return undefined
  const arg = command[1]?.toLowerCase()
  if (arg === undefined) return 'caveman'
  if (arg === 'ultra') return 'ultra'
  if (arg === 'wenyan') return 'wenyan'
  // `status`, or anything else, leaves the mode alone.
  return undefined
}

/** The mode a skill's expansion turns on, or undefined for other skills. */
export function modeFromSkill(skill: string, text: string): CavemanMode | undefined {
  if (skill === 'ultracave') return 'ultra'
  if (skill === 'megacave') return 'wenyan'
  if (skill !== 'caveman') return undefined
  // `/caveman ultra` and `/caveman wenyan` arrive as the caveman skill with an argument.
  const arg = /ARGUMENTS:\s*(\w+)/i.exec(text)?.[1]?.toLowerCase()
  if (arg === 'ultra') return 'ultra'
  if (arg === 'wenyan') return 'wenyan'
  if (arg === 'status') return undefined
  return 'caveman'
}

/** The footer label for a mode. */
export function label(m: CavemanMode): string {
  return m === 'caveman' ? 'caveman' : `caveman ${m}`
}

// The status line under the prompt as well as the mode bar: not every
// surface draws the mode bar (the desktop app's shows none while it is empty).
async function show($: EngineInterface): Promise<void> {
  $.ui.status(`🪨 ${label(await read($, mode))}`)
}

async function switchTo($: EngineInterface, m: CavemanMode): Promise<void> {
  await update($, mode, () => m)
  await show($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await show($)
    return started
  })

  on('prompt.submit', async ($, e, next) => {
    const switched = modeFromPrompt(e.text)
    if (switched !== undefined) await switchTo($, switched)
    return next(e)
  }).catch(($, e, next) => next(e))

  on('skill.prompt', async ($, e, next) => {
    const switched = modeFromSkill(e.skill, e.text)
    if (switched !== undefined) await switchTo($, switched)
    return next(e)
  })

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const current = await read($, mode)
    return next({ ...e, props: { ...e.props, modes: [...e.props.modes, label(current)] } })
  })
}
