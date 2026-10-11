import { expect, test } from 'claude-code/testing'

const PANE = { plugin: 'context-bar', component: 'Pane', requestId: 'context-bar-colours', props: {} } as const

test('the colours pane offers a colour for each part of the bar, and a pick is kept', async ($, on) => {
  // Stands for the store the colours are kept in between sessions.
  const store = new Map<string, unknown>()
  on('store.set', ($, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('store.get', ($, e) => ({ value: store.get(e.key) }))

  for (const surface of ['terminal', 'desktop'] as const) {
    const pane = await $.ui.mount({ ...PANE, surface })
    expect(await pane.findAll({ type: 'Select' })).toHaveLength(8)

    await pane.select({ key: 'colour-warm', value: '#8b949e' })
    expect(store.get('colours')).toMatchObject({ warm: '#8b949e' })

    await pane.press({ key: 'reset' })
    expect(store.get('colours')).toMatchObject({ warm: '#3fb950' })
    await pane.unmount()
  }
})
