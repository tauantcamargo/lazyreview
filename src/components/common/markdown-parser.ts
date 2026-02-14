export interface ParsedBlock {
  readonly type:
    | 'heading'
    | 'code'
    | 'blockquote'
    | 'list'
    | 'paragraph'
    | 'hr'
    | 'tasklist'
    | 'table'
  readonly level?: number
  readonly language?: string
  readonly lines: readonly string[]
  readonly ordered?: boolean
  readonly indentLevels?: readonly number[]
}

export interface InlineSegment {
  readonly type:
    | 'text'
    | 'bold'
    | 'italic'
    | 'code'
    | 'link'
    | 'strikethrough'
    | 'image'
  readonly text: string
  readonly url?: string
}

export interface TaskItem {
  readonly checked: boolean
  readonly text: string
}

export interface TaskListResult {
  readonly completed: number
  readonly total: number
  readonly items: readonly TaskItem[]
}

export interface TableResult {
  readonly headers: readonly string[]
  readonly rows: readonly (readonly string[])[]
  readonly columnWidths: readonly number[]
}

function isTableSeparator(line: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(line.trim())
}

function isTableStart(allLines: readonly string[], index: number): boolean {
  return (
    allLines[index]!.includes('|') &&
    index + 1 < allLines.length &&
    isTableSeparator(allLines[index + 1]!)
  )
}

function computeIndentLevel(line: string): number {
  const indentMatch = line.match(/^(\s*)/)
  const indent = indentMatch ? indentMatch[1]!.length : 0
  return Math.floor(indent / 2)
}

export function parseBlocks(text: string): readonly ParsedBlock[] {
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

    // Table detection: line starts with | and next line is a separator row
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1]!)
    ) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i]!.includes('|')) {
        tableLines.push(lines[i]!)
        i++
      }
      blocks.push({ type: 'table', lines: tableLines })
      continue
    }

    // Task list (must be checked before regular unordered list)
    if (/^\s*[-*+]\s\[[ xX]]\s/.test(line)) {
      const taskLines: string[] = []
      while (
        i < lines.length &&
        /^\s*[-*+]\s\[[ xX]]\s/.test(lines[i]!)
      ) {
        taskLines.push(lines[i]!.replace(/^\s*[-*+]\s/, ''))
        i++
      }
      blocks.push({ type: 'tasklist', lines: taskLines })
      continue
    }

    // Unordered list (with nested list support)
    if (/^\s*[-*+]\s/.test(line)) {
      const listLines: string[] = []
      const indentLevels: number[] = []
      while (i < lines.length && /^\s*[-*+]\s/.test(lines[i]!)) {
        indentLevels.push(computeIndentLevel(lines[i]!))
        listLines.push(lines[i]!.replace(/^\s*[-*+]\s/, ''))
        i++
      }
      blocks.push({
        type: 'list',
        ordered: false,
        lines: listLines,
        indentLevels,
      })
      continue
    }

    // Ordered list (with nested list support)
    if (/^\s*\d+\.\s/.test(line)) {
      const listLines: string[] = []
      const indentLevels: number[] = []
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i]!)) {
        indentLevels.push(computeIndentLevel(lines[i]!))
        listLines.push(lines[i]!.replace(/^\s*\d+\.\s/, ''))
        i++
      }
      blocks.push({
        type: 'list',
        ordered: true,
        lines: listLines,
        indentLevels,
      })
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
      !/^[-*_]{3,}\s*$/.test(lines[i]!) &&
      !isTableStart(lines, i)
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

export function parseTaskList(lines: readonly string[]): TaskListResult {
  const items = lines.map((line) => {
    const checked = /^\[x]/i.test(line)
    const text = line.replace(/^\[[ xX]]\s?/, '')
    return { checked, text }
  })
  const completed = items.filter((item) => item.checked).length
  return { completed, total: items.length, items }
}

export function parseTable(lines: readonly string[]): TableResult {
  if (lines.length === 0) {
    return { headers: [], rows: [], columnWidths: [] }
  }

  const parseCells = (line: string): readonly string[] =>
    line
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0)

  const headers = parseCells(lines[0]!)
  // Skip separator row (index 1), parse data rows
  const rows = lines.slice(2).map(parseCells)

  const columnWidths = headers.map((header, colIdx) => {
    const dataWidths = rows.map((row) => (row[colIdx] ?? '').length)
    return Math.max(header.length, ...dataWidths)
  })

  return { headers, rows, columnWidths }
}

export function parseInline(text: string): readonly InlineSegment[] {
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

    // Strikethrough (~~text~~) - check before bold
    const strikeMatch = remaining.match(/^~~(.+?)~~/)
    if (strikeMatch) {
      segments.push({ type: 'strikethrough', text: strikeMatch[1]! })
      remaining = remaining.slice(strikeMatch[0]!.length)
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

    // Image ![alt](url) - check before link
    const imageMatch = remaining.match(/^!\[([^\]]*)]\(([^)]+)\)/)
    if (imageMatch) {
      segments.push({
        type: 'image',
        text: imageMatch[1]!,
        url: imageMatch[2]!,
      })
      remaining = remaining.slice(imageMatch[0]!.length)
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
    const nextSpecial = remaining.search(/[`*_\[!~]/)
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
