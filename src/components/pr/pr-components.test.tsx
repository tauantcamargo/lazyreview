import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from 'ink-testing-library'
import { ThemeProvider, defaultTheme } from '../../theme/index'
import { EmptyState } from '../common/EmptyState'
import { Divider } from '../common/Divider'
import { PaginationBar } from '../common/PaginationBar'
import { MarkdownText } from '../common/MarkdownText'

function themed(el: React.ReactElement) {
  return <ThemeProvider theme={defaultTheme}>{el}</ThemeProvider>
}

describe('EmptyState', () => {
  it('renders message', () => {
    const { lastFrame } = render(themed(<EmptyState message="Nothing here" />))
    expect(lastFrame()).toContain('Nothing here')
  })

  it('renders hint when provided', () => {
    const { lastFrame } = render(
      themed(<EmptyState message="Empty" hint="Try something" />),
    )
    expect(lastFrame()).toContain('Try something')
  })

  it('renders custom icon', () => {
    const { lastFrame } = render(
      themed(<EmptyState icon="!" message="Alert" />),
    )
    expect(lastFrame()).toContain('!')
  })
})

describe('Divider', () => {
  it('renders a line', () => {
    const { lastFrame } = render(themed(<Divider />))
    const frame = lastFrame() ?? ''
    expect(frame.length).toBeGreaterThan(0)
  })

  it('renders with title', () => {
    const { lastFrame } = render(themed(<Divider title="Section" />))
    expect(lastFrame()).toContain('Section')
  })
})

describe('PaginationBar', () => {
  it('renders item count for single page', () => {
    const { lastFrame } = render(
      themed(
        <PaginationBar
          currentPage={1}
          totalPages={1}
          totalItems={5}
          startIndex={0}
          endIndex={5}
          hasNextPage={false}
          hasPrevPage={false}
        />,
      ),
    )
    expect(lastFrame()).toContain('5 items')
  })

  it('renders pagination controls for multiple pages', () => {
    const { lastFrame } = render(
      themed(
        <PaginationBar
          currentPage={2}
          totalPages={3}
          totalItems={50}
          startIndex={18}
          endIndex={36}
          hasNextPage={true}
          hasPrevPage={true}
        />,
      ),
    )
    const frame = lastFrame() ?? ''
    expect(frame).toContain('19-36 of 50')
    expect(frame).toContain('Page 2/3')
  })
})

describe('MarkdownText', () => {
  it('renders paragraph text', () => {
    const { lastFrame } = render(themed(<MarkdownText content="Hello world" />))
    expect(lastFrame()).toContain('Hello world')
  })

  it('renders empty state for null content', () => {
    const { lastFrame } = render(themed(<MarkdownText content={null} />))
    expect(lastFrame()).toContain('No description provided')
  })

  it('renders headings', () => {
    const { lastFrame } = render(themed(<MarkdownText content="# Title" />))
    expect(lastFrame()).toContain('Title')
  })
})
