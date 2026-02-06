import React, { ReactNode } from 'react';
import { Box, Text } from 'ink';
import { getTheme, Theme } from '../theme';

export interface MarkdownProps {
  content: string;
  maxWidth?: number;
  theme?: Theme;
}

interface MarkdownNode {
  type: 'heading' | 'paragraph' | 'code' | 'codeblock' | 'list' | 'listitem' | 'blockquote' | 'hr' | 'link' | 'bold' | 'italic' | 'text' | 'checkbox';
  level?: number;
  content?: string;
  children?: MarkdownNode[];
  checked?: boolean;
  language?: string;
  url?: string;
}

/**
 * Simple markdown renderer for terminal
 */
export function Markdown({
  content,
  maxWidth,
  theme = getTheme(),
}: MarkdownProps): React.ReactElement {
  const nodes = parseMarkdown(content);

  return (
    <Box flexDirection="column" width={maxWidth}>
      {nodes.map((node, index) => (
        <MarkdownElement key={index} node={node} theme={theme} />
      ))}
    </Box>
  );
}

interface MarkdownElementProps {
  node: MarkdownNode;
  theme: Theme;
}

function MarkdownElement({ node, theme }: MarkdownElementProps): React.ReactElement {
  switch (node.type) {
    case 'heading':
      return (
        <Box marginY={node.level === 1 ? 1 : 0}>
          <Text bold color={node.level === 1 ? theme.accent : theme.text}>
            {'#'.repeat(node.level ?? 1)} {node.content}
          </Text>
        </Box>
      );

    case 'paragraph':
      return (
        <Box marginBottom={1}>
          {node.children ? (
            <Text>
              {node.children.map((child, i) => (
                <InlineElement key={i} node={child} theme={theme} />
              ))}
            </Text>
          ) : (
            <Text>{node.content}</Text>
          )}
        </Box>
      );

    case 'codeblock':
      return (
        <Box
          flexDirection="column"
          marginY={1}
          paddingX={1}
          borderStyle="single"
          borderColor={theme.muted}
        >
          {node.language && (
            <Text color={theme.muted} italic>{node.language}</Text>
          )}
          <Text color={theme.accent}>{node.content}</Text>
        </Box>
      );

    case 'list':
      return (
        <Box flexDirection="column" marginBottom={1} marginLeft={1}>
          {node.children?.map((item, i) => (
            <MarkdownElement key={i} node={item} theme={theme} />
          ))}
        </Box>
      );

    case 'listitem':
      return (
        <Box>
          <Text color={theme.muted}>• </Text>
          {node.children ? (
            <Text>
              {node.children.map((child, i) => (
                <InlineElement key={i} node={child} theme={theme} />
              ))}
            </Text>
          ) : (
            <Text>{node.content}</Text>
          )}
        </Box>
      );

    case 'checkbox':
      return (
        <Box>
          <Text color={node.checked ? theme.added : theme.muted}>
            {node.checked ? '☑' : '☐'}{' '}
          </Text>
          {node.children ? (
            <Text>
              {node.children.map((child, i) => (
                <InlineElement key={i} node={child} theme={theme} />
              ))}
            </Text>
          ) : (
            <Text>{node.content}</Text>
          )}
        </Box>
      );

    case 'blockquote':
      return (
        <Box marginY={1} marginLeft={1}>
          <Text color={theme.muted}>│ </Text>
          <Text color={theme.muted} italic>{node.content}</Text>
        </Box>
      );

    case 'hr':
      return (
        <Box marginY={1}>
          <Text color={theme.muted}>{'─'.repeat(40)}</Text>
        </Box>
      );

    default:
      return <Text>{node.content}</Text>;
  }
}

interface InlineElementProps {
  node: MarkdownNode;
  theme: Theme;
}

function InlineElement({ node, theme }: InlineElementProps): React.ReactElement {
  switch (node.type) {
    case 'bold':
      return <Text bold>{node.content}</Text>;

    case 'italic':
      return <Text italic>{node.content}</Text>;

    case 'code':
      return (
        <Text backgroundColor={theme.muted} color={theme.text}>
          {` ${node.content} `}
        </Text>
      );

    case 'link':
      return (
        <Text color={theme.accent} underline>
          {node.content}
        </Text>
      );

    default:
      return <Text>{node.content}</Text>;
  }
}

/**
 * Parse markdown content into nodes
 */
function parseMarkdown(content: string): MarkdownNode[] {
  const lines = content.split('\n');
  const nodes: MarkdownNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    // Empty line
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      nodes.push({
        type: 'heading',
        level: headingMatch[1]?.length ?? 1,
        content: headingMatch[2] ?? '',
      });
      i++;
      continue;
    }

    // Code block
    if (line.startsWith('```')) {
      const language = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;

      while (i < lines.length && !(lines[i] ?? '').startsWith('```')) {
        codeLines.push(lines[i] ?? '');
        i++;
      }

      nodes.push({
        type: 'codeblock',
        language: language || undefined,
        content: codeLines.join('\n'),
      });
      i++; // Skip closing ```
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(line.trim())) {
      nodes.push({ type: 'hr' });
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      nodes.push({
        type: 'blockquote',
        content: line.slice(1).trim(),
      });
      i++;
      continue;
    }

    // Checkbox list item
    const checkboxMatch = line.match(/^[-*]\s+\[([ x])\]\s+(.+)$/i);
    if (checkboxMatch) {
      nodes.push({
        type: 'checkbox',
        checked: checkboxMatch[1]?.toLowerCase() === 'x',
        children: parseInline(checkboxMatch[2] ?? ''),
      });
      i++;
      continue;
    }

    // Unordered list item
    const listMatch = line.match(/^[-*]\s+(.+)$/);
    if (listMatch) {
      const items: MarkdownNode[] = [];

      while (i < lines.length) {
        const itemLine = lines[i] ?? '';
        const itemMatch = itemLine.match(/^[-*]\s+(.+)$/);
        const checkMatch = itemLine.match(/^[-*]\s+\[([ x])\]\s+(.+)$/i);

        if (checkMatch) {
          items.push({
            type: 'checkbox',
            checked: checkMatch[1]?.toLowerCase() === 'x',
            children: parseInline(checkMatch[2] ?? ''),
          });
          i++;
        } else if (itemMatch) {
          items.push({
            type: 'listitem',
            children: parseInline(itemMatch[1] ?? ''),
          });
          i++;
        } else {
          break;
        }
      }

      nodes.push({
        type: 'list',
        children: items,
      });
      continue;
    }

    // Numbered list item
    const numberedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch) {
      const items: MarkdownNode[] = [];
      let number = 1;

      while (i < lines.length) {
        const itemLine = lines[i] ?? '';
        const itemMatch = itemLine.match(/^\d+\.\s+(.+)$/);

        if (itemMatch) {
          items.push({
            type: 'listitem',
            children: parseInline(itemMatch[1] ?? ''),
          });
          i++;
          number++;
        } else {
          break;
        }
      }

      nodes.push({
        type: 'list',
        children: items,
      });
      continue;
    }

    // Regular paragraph
    nodes.push({
      type: 'paragraph',
      children: parseInline(line),
    });
    i++;
  }

  return nodes;
}

/**
 * Parse inline markdown elements
 */
function parseInline(text: string): MarkdownNode[] {
  const nodes: MarkdownNode[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Bold (**text** or __text__)
    const boldMatch = remaining.match(/^(\*\*|__)(.+?)\1/);
    if (boldMatch) {
      nodes.push({ type: 'bold', content: boldMatch[2] ?? '' });
      remaining = remaining.slice((boldMatch[0] ?? '').length);
      continue;
    }

    // Italic (*text* or _text_)
    const italicMatch = remaining.match(/^(\*|_)(.+?)\1/);
    if (italicMatch) {
      nodes.push({ type: 'italic', content: italicMatch[2] ?? '' });
      remaining = remaining.slice((italicMatch[0] ?? '').length);
      continue;
    }

    // Inline code (`code`)
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      nodes.push({ type: 'code', content: codeMatch[1] ?? '' });
      remaining = remaining.slice((codeMatch[0] ?? '').length);
      continue;
    }

    // Link [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      nodes.push({
        type: 'link',
        content: linkMatch[1] ?? '',
        url: linkMatch[2] ?? '',
      });
      remaining = remaining.slice((linkMatch[0] ?? '').length);
      continue;
    }

    // Plain text - take until next special character
    const textMatch = remaining.match(/^[^*_`\[]+/);
    if (textMatch) {
      nodes.push({ type: 'text', content: textMatch[0] ?? '' });
      remaining = remaining.slice((textMatch[0] ?? '').length);
      continue;
    }

    // Single special character that didn't match a pattern
    nodes.push({ type: 'text', content: remaining[0] ?? '' });
    remaining = remaining.slice(1);
  }

  return nodes;
}

export interface MarkdownPreviewProps {
  content: string;
  title?: string;
  maxHeight?: number;
  theme?: Theme;
}

/**
 * Markdown preview with title and scroll
 */
export function MarkdownPreview({
  content,
  title,
  maxHeight,
  theme = getTheme(),
}: MarkdownPreviewProps): React.ReactElement {
  const lines = content.split('\n');
  const truncated = maxHeight && lines.length > maxHeight;
  const visibleContent = maxHeight
    ? lines.slice(0, maxHeight).join('\n')
    : content;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.muted}>
      {title && (
        <Box paddingX={1} borderBottom borderColor={theme.muted}>
          <Text color={theme.accent} bold>{title}</Text>
        </Box>
      )}
      <Box paddingX={1} flexDirection="column">
        <Markdown content={visibleContent} theme={theme} />
        {truncated && (
          <Text color={theme.muted} italic>
            ... {lines.length - maxHeight} more lines
          </Text>
        )}
      </Box>
    </Box>
  );
}

export interface PRDescriptionProps {
  description: string;
  maxHeight?: number;
  theme?: Theme;
}

/**
 * PR description with markdown rendering
 */
export function PRDescription({
  description,
  maxHeight = 20,
  theme = getTheme(),
}: PRDescriptionProps): React.ReactElement {
  if (!description.trim()) {
    return (
      <Text color={theme.muted} italic>No description provided</Text>
    );
  }

  return (
    <MarkdownPreview
      content={description}
      title="Description"
      maxHeight={maxHeight}
      theme={theme}
    />
  );
}

export interface CommentBodyProps {
  body: string;
  author?: string;
  timestamp?: string;
  theme?: Theme;
}

/**
 * Comment body with markdown rendering
 */
export function CommentBody({
  body,
  author,
  timestamp,
  theme = getTheme(),
}: CommentBodyProps): React.ReactElement {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor={theme.muted}>
      {(author || timestamp) && (
        <Box paddingX={1} gap={1} borderBottom borderColor={theme.muted}>
          {author && <Text color={theme.accent}>@{author}</Text>}
          {timestamp && <Text color={theme.muted}>{timestamp}</Text>}
        </Box>
      )}
      <Box paddingX={1}>
        <Markdown content={body} theme={theme} />
      </Box>
    </Box>
  );
}
