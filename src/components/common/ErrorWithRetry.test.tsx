import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from 'ink-testing-library'
import { ErrorWithRetry } from './ErrorWithRetry'
import { ThemeProvider } from '../../theme/index'

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

describe('ErrorWithRetry', () => {
  it('renders error message', () => {
    const { lastFrame } = renderWithTheme(
      <ErrorWithRetry message="Something went wrong" onRetry={() => {}} />,
    )
    expect(lastFrame()).toContain('Error: Something went wrong')
  })

  it('renders retry hint', () => {
    const { lastFrame } = renderWithTheme(
      <ErrorWithRetry message="Network error" onRetry={() => {}} />,
    )
    expect(lastFrame()).toContain('r')
    expect(lastFrame()).toContain('retry')
  })

  it('calls onRetry when r is pressed', () => {
    const onRetry = vi.fn()
    const { stdin } = renderWithTheme(
      <ErrorWithRetry message="Failed" onRetry={onRetry} />,
    )
    stdin.write('r')
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('does not call onRetry when isActive is false', () => {
    const onRetry = vi.fn()
    const { stdin } = renderWithTheme(
      <ErrorWithRetry message="Failed" onRetry={onRetry} isActive={false} />,
    )
    stdin.write('r')
    expect(onRetry).not.toHaveBeenCalled()
  })

  it('does not call onRetry for other keys', () => {
    const onRetry = vi.fn()
    const { stdin } = renderWithTheme(
      <ErrorWithRetry message="Failed" onRetry={onRetry} />,
    )
    stdin.write('x')
    stdin.write('q')
    stdin.write('R')
    expect(onRetry).not.toHaveBeenCalled()
  })
})
