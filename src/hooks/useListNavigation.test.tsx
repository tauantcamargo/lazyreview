import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from 'ink-testing-library'
import { Text, Box } from 'ink'
import { useListNavigation } from './useListNavigation'

interface TestProps {
  readonly itemCount: number
  readonly viewportHeight: number
  readonly isActive?: boolean
}

function TestComponent({ itemCount, viewportHeight, isActive }: TestProps): React.ReactElement {
  const { selectedIndex, scrollOffset } = useListNavigation({ itemCount, viewportHeight, isActive })
  return (
    <Box flexDirection="column">
      <Text>index:{selectedIndex}</Text>
      <Text>offset:{scrollOffset}</Text>
    </Box>
  )
}

function extractIndex(frame: string | undefined): number {
  const match = frame?.match(/index:(\d+)/)
  return match ? parseInt(match[1], 10) : -1
}

function delay(ms = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('useListNavigation hook', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts at index 0', () => {
    const { lastFrame } = render(<TestComponent itemCount={10} viewportHeight={20} />)
    expect(extractIndex(lastFrame())).toBe(0)
  })

  it('moves down with j key', async () => {
    vi.useRealTimers()
    const { lastFrame, stdin } = render(<TestComponent itemCount={10} viewportHeight={20} />)
    stdin.write('j')
    await delay()
    expect(extractIndex(lastFrame())).toBe(1)
  })

  it('moves up with k key', async () => {
    vi.useRealTimers()
    const { lastFrame, stdin } = render(<TestComponent itemCount={10} viewportHeight={20} />)
    stdin.write('j')
    await delay()
    stdin.write('j')
    await delay()
    stdin.write('k')
    await delay()
    expect(extractIndex(lastFrame())).toBe(1)
  })

  it('does not go below 0 with k', async () => {
    vi.useRealTimers()
    const { lastFrame, stdin } = render(<TestComponent itemCount={10} viewportHeight={20} />)
    stdin.write('k')
    await delay()
    expect(extractIndex(lastFrame())).toBe(0)
  })

  it('does not go above itemCount-1 with j', async () => {
    vi.useRealTimers()
    const { lastFrame, stdin } = render(<TestComponent itemCount={3} viewportHeight={20} />)
    stdin.write('j')
    await delay()
    stdin.write('j')
    await delay()
    stdin.write('j')
    await delay()
    stdin.write('j')
    await delay()
    expect(extractIndex(lastFrame())).toBe(2)
  })

  it('jumps to end with G', async () => {
    vi.useRealTimers()
    const { lastFrame, stdin } = render(<TestComponent itemCount={10} viewportHeight={20} />)
    stdin.write('G')
    await delay()
    expect(extractIndex(lastFrame())).toBe(9)
  })

  it('jumps to beginning with gg', async () => {
    vi.useRealTimers()
    const { lastFrame, stdin } = render(<TestComponent itemCount={10} viewportHeight={20} />)
    stdin.write('G')
    await delay()
    expect(extractIndex(lastFrame())).toBe(9)
    vi.useFakeTimers()
    stdin.write('g')
    vi.advanceTimersByTime(100)
    stdin.write('g')
    vi.useRealTimers()
    await delay()
    expect(extractIndex(lastFrame())).toBe(0)
  })

  it('does not jump with single g (waits for second g)', async () => {
    vi.useRealTimers()
    const { lastFrame, stdin } = render(<TestComponent itemCount={10} viewportHeight={20} />)
    stdin.write('j')
    await delay()
    stdin.write('j')
    await delay()
    stdin.write('j')
    await delay()
    expect(extractIndex(lastFrame())).toBe(3)
    stdin.write('g')
    await delay()
    // Single g should not change index (still waiting for second g)
    expect(extractIndex(lastFrame())).toBe(3)
  })

  it('resets gg detection after timeout', async () => {
    vi.useRealTimers()
    const { lastFrame, stdin } = render(<TestComponent itemCount={10} viewportHeight={20} />)
    stdin.write('j')
    await delay()
    stdin.write('j')
    await delay()
    stdin.write('j')
    await delay()
    expect(extractIndex(lastFrame())).toBe(3)
    stdin.write('g')
    // Wait for the 500ms gg timeout to expire
    await delay(600)
    stdin.write('g')
    await delay()
    // This should be treated as the first g of a new gg sequence, not jump
    expect(extractIndex(lastFrame())).toBe(3)
  })

  it('pages down with Ctrl+d', async () => {
    vi.useRealTimers()
    const { lastFrame, stdin } = render(<TestComponent itemCount={50} viewportHeight={20} />)
    // Ctrl+d should move down by half viewport (10)
    stdin.write('\x04') // Ctrl+d
    await delay()
    expect(extractIndex(lastFrame())).toBe(10)
  })

  it('pages up with Ctrl+u', async () => {
    vi.useRealTimers()
    const { lastFrame, stdin } = render(<TestComponent itemCount={50} viewportHeight={20} />)
    stdin.write('G')
    await delay()
    expect(extractIndex(lastFrame())).toBe(49)
    stdin.write('\x15') // Ctrl+u
    await delay()
    expect(extractIndex(lastFrame())).toBe(39)
  })

  it('Ctrl+d clamps to end', async () => {
    vi.useRealTimers()
    const { lastFrame, stdin } = render(<TestComponent itemCount={5} viewportHeight={20} />)
    stdin.write('\x04') // Ctrl+d - would go to 10 but clamp to 4
    await delay()
    expect(extractIndex(lastFrame())).toBe(4)
  })

  it('Ctrl+u clamps to start', async () => {
    vi.useRealTimers()
    const { lastFrame, stdin } = render(<TestComponent itemCount={50} viewportHeight={20} />)
    stdin.write('j')
    await delay()
    stdin.write('j')
    await delay()
    expect(extractIndex(lastFrame())).toBe(2)
    stdin.write('\x15') // Ctrl+u - would go below 0
    await delay()
    expect(extractIndex(lastFrame())).toBe(0)
  })

  it('does not respond when isActive is false', async () => {
    vi.useRealTimers()
    const { lastFrame, stdin } = render(<TestComponent itemCount={10} viewportHeight={20} isActive={false} />)
    stdin.write('j')
    await delay()
    expect(extractIndex(lastFrame())).toBe(0)
    stdin.write('G')
    await delay()
    expect(extractIndex(lastFrame())).toBe(0)
  })

  it('does not respond when itemCount is 0', async () => {
    vi.useRealTimers()
    const { lastFrame, stdin } = render(<TestComponent itemCount={0} viewportHeight={20} />)
    stdin.write('j')
    await delay()
    expect(extractIndex(lastFrame())).toBe(0)
    stdin.write('G')
    await delay()
    expect(extractIndex(lastFrame())).toBe(0)
  })

  it('moves down with arrow key', async () => {
    vi.useRealTimers()
    const { lastFrame, stdin } = render(<TestComponent itemCount={10} viewportHeight={20} />)
    stdin.write('\x1B[B') // Down arrow
    await delay()
    expect(extractIndex(lastFrame())).toBe(1)
  })

  it('moves up with arrow key', async () => {
    vi.useRealTimers()
    const { lastFrame, stdin } = render(<TestComponent itemCount={10} viewportHeight={20} />)
    stdin.write('j')
    await delay()
    stdin.write('j')
    await delay()
    stdin.write('\x1B[A') // Up arrow
    await delay()
    expect(extractIndex(lastFrame())).toBe(1)
  })

  it('gg state persists through j/k presses (early return keys)', async () => {
    vi.useRealTimers()
    const { lastFrame, stdin } = render(<TestComponent itemCount={10} viewportHeight={20} />)
    stdin.write('j')
    await delay()
    stdin.write('j')
    await delay()
    stdin.write('j')
    await delay()
    expect(extractIndex(lastFrame())).toBe(3)
    // Press g, then j (which returns early, does NOT reset gg state), then g
    stdin.write('g')
    await delay()
    stdin.write('j')
    await delay()
    expect(extractIndex(lastFrame())).toBe(4)
    // g + j + g within 500ms: gg triggers because j doesn't reset gPressedAt
    stdin.write('g')
    await delay()
    expect(extractIndex(lastFrame())).toBe(0)
  })

  it('multiple rapid j presses accumulate', async () => {
    vi.useRealTimers()
    const { lastFrame, stdin } = render(<TestComponent itemCount={20} viewportHeight={20} />)
    stdin.write('j')
    stdin.write('j')
    stdin.write('j')
    stdin.write('j')
    stdin.write('j')
    await delay()
    expect(extractIndex(lastFrame())).toBe(5)
  })

  it('G then k moves to second-to-last', async () => {
    vi.useRealTimers()
    const { lastFrame, stdin } = render(<TestComponent itemCount={10} viewportHeight={20} />)
    stdin.write('G')
    await delay()
    expect(extractIndex(lastFrame())).toBe(9)
    stdin.write('k')
    await delay()
    expect(extractIndex(lastFrame())).toBe(8)
  })
})
