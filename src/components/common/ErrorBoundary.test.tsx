import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from 'ink-testing-library'
import { ErrorBoundary } from './ErrorBoundary'

function ThrowingChild({ shouldThrow }: { readonly shouldThrow: boolean }): React.ReactElement {
  if (shouldThrow) {
    throw new Error('Test error message')
  }
  return <>{`child rendered`}</>
}

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    const { lastFrame } = render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>,
    )
    expect(lastFrame()).toContain('child rendered')
  })

  it('renders error fallback when child throws', () => {
    // Suppress React error boundary console.error noise
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { lastFrame } = render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    )
    expect(lastFrame()).toContain('Something went wrong')
    expect(lastFrame()).toContain('Test error message')
    expect(lastFrame()).toContain('Press q to quit or R to retry')
    spy.mockRestore()
  })

  it('getDerivedStateFromError returns error state', () => {
    const error = new Error('derived test')
    const result = ErrorBoundary.getDerivedStateFromError(error)
    expect(result).toEqual({ error })
  })
})
