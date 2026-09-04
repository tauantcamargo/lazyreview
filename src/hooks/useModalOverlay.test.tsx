import React from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { render } from 'ink-testing-library'
import { Text } from 'ink'
import { setModalOverlay, useModalOverlayOutlet } from './useModalOverlay'

// We drive state through the exported setter (like useScreenContext.test.ts)
// so assertions aren't tied to React effect-flush timing. useModalOverlay
// itself is a thin useEffect wrapper around this same setter, exercised by
// PRListScreen in practice.

function Outlet(): React.ReactElement {
  const overlay = useModalOverlayOutlet()
  return <>{overlay ?? <Text>empty</Text>}</>
}

describe('useModalOverlay', () => {
  beforeEach(() => {
    setModalOverlay(null)
  })

  it('does not throw when registering or clearing content', () => {
    expect(() => setModalOverlay(<Text>overlay content</Text>)).not.toThrow()
    expect(() => setModalOverlay(null)).not.toThrow()
  })

  it('outlet renders nothing when no overlay is registered', () => {
    const { lastFrame } = render(<Outlet />)
    expect(lastFrame()).toContain('empty')
  })

  it('outlet renders whatever content is currently registered', () => {
    setModalOverlay(<Text>overlay content</Text>)
    const { lastFrame } = render(<Outlet />)
    expect(lastFrame()).toContain('overlay content')
  })

  it('outlet goes back to empty once the overlay is cleared', () => {
    setModalOverlay(<Text>overlay content</Text>)
    const { lastFrame, rerender } = render(<Outlet />)
    expect(lastFrame()).toContain('overlay content')

    setModalOverlay(null)
    rerender(<Outlet />)
    expect(lastFrame()).toContain('empty')
  })
})
