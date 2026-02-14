import React from 'react'
import { Box, Text } from 'ink'
import { useTheme } from '../../theme/index'
import { stripAnsi } from '../../utils/sanitize'
import {
  parseBlocks,
  parseInline,
  parseTaskList,
  parseTable,
} from './markdown-parser'

// Re-export parsing functions for external use and testing
export { parseBlocks, parseInline, parseTaskList, parseTable }

interface MarkdownTextProps {
  readonly content: string | null
  readonly maxWidth?: number
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
          case 'strikethrough':
            return (
              <Text key={i} color={theme.colors.muted} dimColor strikethrough>
                {seg.text}
              </Text>
            )
          case 'image':
            return (
              <Text key={i} color={theme.colors.muted} italic>
                {seg.text ? `[img: ${seg.text}]` : '[img]'}
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

function BlockRenderer({
  block,
}: {
  readonly block: ReturnType<typeof parseBlocks>[number]
}): React.ReactElement {
  const theme = useTheme()

  switch (block.type) {
    case 'heading': {
      const isH1 = block.level === 1
      const isH2 = block.level === 2
      return (
        <Text
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
        <Box paddingLeft={1}>
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
        <Box flexDirection="column" paddingLeft={1}>
          {block.lines.map((line, j) => {
            const indent = block.indentLevels?.[j] ?? 0
            return (
              <Box key={j} gap={1} paddingLeft={indent * 2}>
                <Text color={theme.colors.muted}>
                  {block.ordered ? `${j + 1}.` : '-'}
                </Text>
                <InlineContent text={line} />
              </Box>
            )
          })}
        </Box>
      )

    case 'tasklist': {
      const taskResult = parseTaskList(block.lines)
      return (
        <Box flexDirection="column" paddingLeft={1}>
          <Text color={theme.colors.info} bold>
            {`Tasks: ${taskResult.completed}/${taskResult.total} complete`}
          </Text>
          {taskResult.items.map((item, j) => (
            <Box key={j} gap={1}>
              <Text
                color={
                  item.checked ? theme.colors.success : theme.colors.muted
                }
              >
                {item.checked ? '[x]' : '[ ]'}
              </Text>
              <Text
                color={
                  item.checked ? theme.colors.muted : theme.colors.text
                }
                dimColor={item.checked}
              >
                {item.text}
              </Text>
            </Box>
          ))}
        </Box>
      )
    }

    case 'table': {
      const tableResult = parseTable(block.lines)
      return (
        <Box flexDirection="column" paddingLeft={1}>
          <Text color={theme.colors.secondary} bold>
            {tableResult.headers
              .map((h, ci) => h.padEnd(tableResult.columnWidths[ci] ?? 0))
              .join(' | ')}
          </Text>
          <Text color={theme.colors.border}>
            {tableResult.columnWidths.map((w) => '-'.repeat(w)).join('-+-')}
          </Text>
          {tableResult.rows.map((row, j) => (
            <Text key={j} color={theme.colors.text}>
              {row
                .map((cell, ci) =>
                  cell.padEnd(tableResult.columnWidths[ci] ?? 0),
                )
                .join(' | ')}
            </Text>
          ))}
        </Box>
      )
    }

    case 'hr':
      return (
        <Text color={theme.colors.border}>
          {'─'.repeat(40)}
        </Text>
      )

    case 'paragraph':
    default:
      return (
        <Box>
          <InlineContent text={block.lines.join(' ')} />
        </Box>
      )
  }
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

  const blocks = parseBlocks(stripAnsi(content))

  return (
    <Box flexDirection="column" gap={1}>
      {blocks.map((block, i) => (
        <BlockRenderer key={i} block={block} />
      ))}
    </Box>
  )
}
