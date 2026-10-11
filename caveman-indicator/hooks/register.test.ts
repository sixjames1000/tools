import { expect, test } from 'claude-code/testing'

import { label, modeFromPrompt, modeFromSkill } from './register.tsx'

test('prompts switch the mode on and off; /caveman status changes nothing', () => {
  expect(modeFromPrompt('/caveman')).toBe('caveman')
  expect(modeFromPrompt('/caveman ultra')).toBe('ultra')
  expect(modeFromPrompt('/caveman wenyan')).toBe('wenyan')
  expect(modeFromPrompt('/caveman status')).toBe(undefined)
  expect(modeFromPrompt('ok, stop caveman please')).toBe('off')
  expect(modeFromPrompt('Normal mode')).toBe('off')
  expect(modeFromPrompt('caveman mode off')).toBe('off')
  expect(modeFromPrompt('caveman off')).toBe('off')
  expect(modeFromPrompt('what is the caveman skill?')).toBe(undefined)
})

test('the caveman skills switch the mode as they expand', () => {
  expect(modeFromSkill('caveman', 'Respond terse like smart caveman.')).toBe('caveman')
  expect(modeFromSkill('caveman', 'Respond terse.\n\nARGUMENTS: ultra')).toBe('ultra')
  expect(modeFromSkill('caveman', 'Respond terse.\n\nARGUMENTS: status')).toBe(undefined)
  expect(modeFromSkill('ultracave', '')).toBe('ultra')
  expect(modeFromSkill('megacave', '')).toBe('wenyan')
  expect(modeFromSkill('commit', '')).toBe(undefined)
})

test('the footer labels', () => {
  expect(label('caveman')).toBe('caveman')
  expect(label('ultra')).toBe('caveman ultra')
  expect(label('off')).toBe('caveman off')
})

/** The footer's text as the test's stand-in drew it. */
const shown = (tree: { children?: readonly unknown[] }) => (tree.children ?? []).join('')

test('the footer shows the mode a prompt switched to', async ($, on) => {
  on('prompt.submit', ($, e) => ({ text: e.text }))
  // Stands for the engine's footer: draws the mode labels it is handed.
  on('ui.render', { component: 'SessionMode' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return h(Text, null, e.props.modes.join(' | '))
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const footer = await $.ui.mount({ plugin: 'caveman-indicator', surface, component: 'SessionMode', props: { modes: ['plan mode'] } })
    expect(shown(await footer.drawn())).toBe('plan mode | caveman off')

    await $.prompt.submit({ text: '/caveman ultra', asUser: true })
    expect(shown(await footer.drawn())).toBe('plan mode | caveman ultra')

    await $.prompt.submit({ text: 'stop caveman', asUser: true })
    expect(shown(await footer.drawn())).toBe('plan mode | caveman off')
    await footer.unmount()
  }
})
