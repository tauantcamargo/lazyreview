import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render } from 'ink-testing-library'
import { ThemeProvider, defaultTheme } from '../../theme/index'
import { ThreeWayDiffView } from './ThreeWayDiffView'

function themed(el: React.ReactElement) {
  return <ThemeProvider theme={defaultTheme}>{el}</ThemeProvider>
}

function makeTwoWayContent(): string {
  return [
    'line before',
    '<<<<<<< HEAD',
    'our change',
    '=======',
    'their change',
    '>>>>>>> feature-branch',
    'line after',
  ].join('\n')
}

function makeMultiConflictContent(): string {
  return [
    'top',
    '<<<<<<< HEAD',
    'ours 1',
    '=======',
    'theirs 1',
    '>>>>>>> branch',
    'middle',
    '<<<<<<< HEAD',
    'ours 2',
    '=======',
    'theirs 2',
    '>>>>>>> branch',
    'bottom',
  ].join('\n')
}

function makeThreeWayContent(): string {
  return [
    'before',
    '<<<<<<< HEAD',
    'our version',
    '||||||| base',
    'original line',
    '=======',
    'their version',
    '>>>>>>> feature',
    'after',
  ].join('\n')
}

describe('ThreeWayDiffView', () => {
  it('renders three column headers', () => {
    const { lastFrame } = render(
      themed(
        <ThreeWayDiffView
          content={makeTwoWayContent()}
          filename="test.ts"
          isActive={true}
          onBack={vi.fn()}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('Ours')
    expect(frame).toContain('Base')
    expect(frame).toContain('Theirs')
  })

  it('shows conflict count in header', () => {
    const { lastFrame } = render(
      themed(
        <ThreeWayDiffView
          content={makeMultiConflictContent()}
          filename="test.ts"
          isActive={true}
          onBack={vi.fn()}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('Conflict 1/2')
  })

  it('displays common lines', () => {
    const { lastFrame } = render(
      themed(
        <ThreeWayDiffView
          content={makeTwoWayContent()}
          filename="test.ts"
          isActive={true}
          onBack={vi.fn()}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('line before')
    expect(frame).toContain('line after')
  })

  it('displays ours content in conflict region', () => {
    const { lastFrame } = render(
      themed(
        <ThreeWayDiffView
          content={makeTwoWayContent()}
          filename="test.ts"
          isActive={true}
          onBack={vi.fn()}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('our change')
  })

  it('displays theirs content in conflict region', () => {
    const { lastFrame } = render(
      themed(
        <ThreeWayDiffView
          content={makeTwoWayContent()}
          filename="test.ts"
          isActive={true}
          onBack={vi.fn()}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('their change')
  })

  it('displays base content for three-way conflicts', () => {
    const { lastFrame } = render(
      themed(
        <ThreeWayDiffView
          content={makeThreeWayContent()}
          filename="test.ts"
          isActive={true}
          onBack={vi.fn()}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('original line')
  })

  it('shows filename in header', () => {
    const { lastFrame } = render(
      themed(
        <ThreeWayDiffView
          content={makeTwoWayContent()}
          filename="src/utils/helper.ts"
          isActive={true}
          onBack={vi.fn()}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('helper.ts')
  })

  it('handles content with no conflicts', () => {
    const content = 'line 1\nline 2\nline 3'
    const { lastFrame } = render(
      themed(
        <ThreeWayDiffView
          content={content}
          filename="test.ts"
          isActive={true}
          onBack={vi.fn()}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('No conflicts')
  })

  it('handles empty content', () => {
    const { lastFrame } = render(
      themed(
        <ThreeWayDiffView
          content=""
          filename="test.ts"
          isActive={true}
          onBack={vi.fn()}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('No conflicts')
  })

  it('renders escape hint text', () => {
    const { lastFrame } = render(
      themed(
        <ThreeWayDiffView
          content={makeTwoWayContent()}
          filename="test.ts"
          isActive={true}
          onBack={vi.fn()}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('Esc')
  })

  it('calls onBack when Escape is pressed', () => {
    const onBack = vi.fn()
    const { stdin } = render(
      themed(
        <ThreeWayDiffView
          content={makeTwoWayContent()}
          filename="test.ts"
          isActive={true}
          onBack={onBack}
        />,
      ),
    )
    stdin.write('\u001B')
    expect(onBack).toHaveBeenCalledOnce()
  })
})
