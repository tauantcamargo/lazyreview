import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'

interface MarkdownTextProps {
  readonly content: string | null
  readonly maxWidth?: number
}

interface ParsedBlock {
  readonly type: 'heading' | 'code' | 'blockquote' | 'list' | 'paragraph' | 'hr'
  readonly level?: number
  readonly language?: string
  readonly lines: readonly string[]
  readonly ordered?: boolean
}

function parseBlocks(text: string): readonly ParsedBlock[] {
  const lines = text.split('\n')
  const blocks: ParsedBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]!

    // Fenced code block
    const codeMatch = line.match(/^```(\w*)/)
    if (codeMatch) {
      const language = codeMatch[1] || ''
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i]!.startsWith('```')) {
        codeLines.push(lines[i]!)
        i++
      }
      i++ // skip closing ```
      blocks.push({ type: 'code', language, lines: codeLines })
      continue
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/)
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1]!.length,
        lines: [headingMatch[2]!],
      })
      i++
      continue
    }

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line)) {
      blocks.push({ type: 'hr', lines: [] })
      i++
      continue
    }

    // Blockquote
    if (line.startsWith('>')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i]!.startsWith('>')) {
        quoteLines.push(lines[i]!.replace(/^>\s?/, ''))
        i++
      }
      blocks.push({ type: 'blockquote', lines: quoteLines })
      continue
    }

    // Unordered list
    if (/^\s*[-*+]\s/.test(line)) {
      const listLines: string[] = []
      while (i < lines.length && /^\s*[-*+]\s/.test(lines[i]!)) {
        listLines.push(lines[i]!.replace(/^\s*[-*+]\s/, ''))
        i++
      }
      blocks.push({ type: 'list', ordered: false, lines: listLines })
      continue
    }

    // Ordered list
    if (/^\s*\d+\.\s/.test(line)) {
      const listLines: string[] = []
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i]!)) {
        listLines.push(lines[i]!.replace(/^\s*\d+\.\s/, ''))
        i++
      }
      blocks.push({ type: 'list', ordered: true, lines: listLines })
      continue
    }

    // Empty line
    if (line.trim() === '') {
      i++
      continue
    }

    // Paragraph - collect consecutive non-empty lines
    const paraLines: string[] = []
    while (
      i < lines.length &&
      lines[i]!.trim() !== '' &&
      !lines[i]!.startsWith('#') &&
      !lines[i]!.startsWith('```') &&
      !lines[i]!.startsWith('>') &&
      !/^\s*[-*+]\s/.test(lines[i]!) &&
      !/^\s*\d+\.\s/.test(lines[i]!) &&
      !/^[-*_]{3,}\s*$/.test(lines[i]!)
    ) {
      paraLines.push(lines[i]!)
      i++
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', lines: paraLines })
    }
  }

  return blocks
}

interface InlineSegment {
  readonly type: 'text' | 'bold' | 'italic' | 'code' | 'link'
  readonly text: string
  readonly url?: string
}

function parseInline(text: string): readonly InlineSegment[] {
  const segments: InlineSegment[] = []
  let remaining = text

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/^`([^`]+)`/)
    if (codeMatch) {
      segments.push({ type: 'code', text: codeMatch[1]! })
      remaining = remaining.slice(codeMatch[0]!.length)
      continue
    }

    // Bold (** or __)
    const boldMatch = remaining.match(/^(\*\*|__)(.+?)\1/)
    if (boldMatch) {
      segments.push({ type: 'bold', text: boldMatch[2]! })
      remaining = remaining.slice(boldMatch[0]!.length)
      continue
    }

    // Italic (* or _) - be careful not to match ** or __
    const italicMatch = remaining.match(/^(\*|_)(?!\1)(.+?)\1/)
    if (italicMatch) {
      segments.push({ type: 'italic', text: italicMatch[2]! })
      remaining = remaining.slice(italicMatch[0]!.length)
      continue
    }

    // Link [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)]\(([^)]+)\)/)
    if (linkMatch) {
      segments.push({ type: 'link', text: linkMatch[1]!, url: linkMatch[2]! })
      remaining = remaining.slice(linkMatch[0]!.length)
      continue
    }

    // Plain text up to next special character
    const nextSpecial = remaining.search(/[`*_\[]/)
    if (nextSpecial === -1) {
      segments.push({ type: 'text', text: remaining })
      break
    }
    if (nextSpecial === 0) {
      // The special char didn't match a pattern, consume it as text
      segments.push({ type: 'text', text: remaining[0]! })
      remaining = remaining.slice(1)
    } else {
      segments.push({ type: 'text', text: remaining.slice(0, nextSpecial) })
      remaining = remaining.slice(nextSpecial)
    }
  }

  return segments
}

function InlineContent({ text }: { readonly text: string }): React.ReactElement {
  const theme = useTheme()
  const segments = parseInline(text)

  return (
    <Text wrap="wrap">
      {segments.map((seg, i) => {
        switch (seg.type) {
          case 'bold':
            return (
              <Text key={i} bold color={theme.colors.text}>
                {seg.text}
              </Text>
            )
          case 'italic':
            return (
              <Text key={i} italic color={theme.colors.text}>
                {seg.text}
              </Text>
            )
          case 'code':
            return (
              <Text key={i} color={theme.colors.accent} inverse>
                {` ${seg.text} `}
              </Text>
            )
          case 'link':
            return (
              <Text key={i} color={theme.colors.info} underline>
                {seg.text}
              </Text>
            )
          default:
            return (
              <Text key={i} color={theme.colors.text}>
                {seg.text}
              </Text>
            )
        }
      })}
    </Text>
  )
}

export function MarkdownText({ content }: MarkdownTextProps): React.ReactElement | null {
  const theme = useTheme()

  if (!content || content.trim() === '') {
    return (
      <Text color={theme.colors.muted} italic>
        No description provided.
      </Text>
    )
  }

  const blocks = parseBlocks(content)

  return (
    <Box flexDirection="column" gap={1}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'heading': {
            const isH1 = block.level === 1
            const isH2 = block.level === 2
            return (
              <Text
                key={i}
                bold
                color={isH1 || isH2 ? theme.colors.accent : theme.colors.secondary}
                underline={isH1}
              >
                {block.lines[0]}
              </Text>
            )
          }

          case 'code':
            return (
              <Box
                key={i}
                flexDirection="column"
                borderStyle="single"
                borderColor={theme.colors.border}
                paddingX={1}
              >
                {block.language && (
                  <Text color={theme.colors.muted} dimColor>
                    {block.language}
                  </Text>
                )}
                {block.lines.map((line, j) => (
                  <Text key={j} color={theme.colors.text}>
                    {line}
                  </Text>
                ))}
              </Box>
            )

          case 'blockquote':
            return (
              <Box key={i} paddingLeft={1}>
                <Text color={theme.colors.border}>{'| '}</Text>
                <Box flexDirection="column">
                  {block.lines.map((line, j) => (
                    <InlineContent key={j} text={line} />
                  ))}
                </Box>
              </Box>
            )

          case 'list':
            return (
              <Box key={i} flexDirection="column" paddingLeft={1}>
                {block.lines.map((line, j) => (
                  <Box key={j} gap={1}>
                    <Text color={theme.colors.muted}>
                      {block.ordered ? `${j + 1}.` : '-'}
                    </Text>
                    <InlineContent text={line} />
                  </Box>
                ))}
              </Box>
            )

          case 'hr':
            return (
              <Text key={i} color={theme.colors.border}>
                {'─'.repeat(40)}
              </Text>
            )

          case 'paragraph':
          default:
            return (
              <Box key={i}>
                <InlineContent text={block.lines.join(' ')} />
              </Box>
            )
        }
      })}
    </Box>
  )
}
