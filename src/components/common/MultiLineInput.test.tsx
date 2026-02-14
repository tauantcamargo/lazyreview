import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from 'ink-testing-library'
import { MultiLineInput } from './MultiLineInput'

function delay(ms = 50): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Helper to create a wrapper component that manages isActive state
function TestWrapper({
  onChange,
  defaultValue,
  placeholder,
}: {
  readonly onChange: (v: string) => void
  readonly defaultValue?: string
  readonly placeholder?: string
}) {
  return (
    <MultiLineInput
      onChange={onChange}
      isActive={true}
      defaultValue={defaultValue}
      placeholder={placeholder}
    />
  )
}

describe('MultiLineInput undo/redo', () => {
  it('Ctrl+Z undoes last text change after debounce', async () => {
    const onChange = vi.fn()
    const { stdin } = render(<TestWrapper onChange={onChange} />)

    // Type 'a'
    stdin.write('a')
    await delay()
    // Wait past debounce window (300ms)
    await delay(350)
    // Type 'b'
    stdin.write('b')
    await delay()

    // Undo with Ctrl+Z
    stdin.write('\x1A')
    await delay()

    // The onChange should have been called with the state after 'a' (before 'b')
    const calls = onChange.mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall?.[0]).toBe('a')
  })

  it('Ctrl+Y redoes after undo', async () => {
    const onChange = vi.fn()
    const { stdin } = render(<TestWrapper onChange={onChange} />)

    // Type 'a'
    stdin.write('a')
    await delay()
    // Wait past debounce window
    await delay(350)
    // Type 'b'
    stdin.write('b')
    await delay()

    // Undo
    stdin.write('\x1A')
    await delay()
    // Redo
    stdin.write('\x19')
    await delay()

    const calls = onChange.mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall?.[0]).toBe('ab')
  })

  it('does not crash when undoing with no history', async () => {
    const onChange = vi.fn()
    const { stdin } = render(<TestWrapper onChange={onChange} />)

    // Undo with nothing to undo
    stdin.write('\x1A')
    await delay()

    // Should not throw, onChange should not be called for no-op
    expect(onChange).not.toHaveBeenCalled()
  })

  it('does not crash when redoing with no redo history', async () => {
    const onChange = vi.fn()
    const { stdin } = render(<TestWrapper onChange={onChange} />)

    // Type something
    stdin.write('x')
    await delay()

    // Redo with nothing to redo
    stdin.write('\x19')
    await delay()

    // Last call should still be from the 'x' input
    const calls = onChange.mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall?.[0]).toBe('x')
  })

  it('multiple undos restore through history', async () => {
    const onChange = vi.fn()
    const { stdin } = render(<TestWrapper onChange={onChange} />)

    // Type 'a'
    stdin.write('a')
    await delay(350)
    // Type 'b'
    stdin.write('b')
    await delay(350)
    // Type 'c'
    stdin.write('c')
    await delay()

    // Undo twice
    stdin.write('\x1A')
    await delay()
    stdin.write('\x1A')
    await delay()

    const calls = onChange.mock.calls
    const lastCall = calls[calls.length - 1]
    expect(lastCall?.[0]).toBe('a')
  })
})
