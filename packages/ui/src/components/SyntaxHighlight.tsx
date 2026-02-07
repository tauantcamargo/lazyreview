import React from 'react';
import { Box, Text } from 'ink';
import { getTheme, Theme } from '../theme';

export interface SyntaxHighlightProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  startLine?: number;
  highlightLines?: number[];
  theme?: Theme;
}

interface Token {
  type: 'keyword' | 'string' | 'comment' | 'number' | 'operator' | 'punctuation' | 'function' | 'variable' | 'type' | 'text';
  value: string;
}

/**
 * Simple syntax highlighting for code snippets
 */
export function SyntaxHighlight({
  code,
  language = 'text',
  showLineNumbers = true,
  startLine = 1,
  highlightLines = [],
  theme = getTheme(),
}: SyntaxHighlightProps): React.ReactElement {
  const lines = code.split('\n');
  const lineNumberWidth = String(startLine + lines.length - 1).length;

  return (
    <Box flexDirection="column">
      {lines.map((line, index) => {
        const lineNumber = startLine + index;
        const isHighlighted = highlightLines.includes(lineNumber);
        const tokens = tokenize(line, language);

        return (
          <Box key={index}>
            {showLineNumbers && (
              <Text color={theme.muted}>
                {String(lineNumber).padStart(lineNumberWidth, ' ')} │
              </Text>
            )}
            <Box backgroundColor={isHighlighted ? theme.listSelectedBackground : undefined}>
              {tokens.map((token, tokenIndex) => (
                <Text
                  key={tokenIndex}
                  color={getTokenColor(token.type, theme)}
                  bold={token.type === 'keyword'}
                >
                  {token.value}
                </Text>
              ))}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

/**
 * Get color for token type
 */
function getTokenColor(type: Token['type'], theme: Theme): string {
  switch (type) {
    case 'keyword':
      return '#bb9af7'; // purple
    case 'string':
      return theme.added;
    case 'comment':
      return theme.muted;
    case 'number':
      return '#ff9e64'; // orange
    case 'operator':
      return theme.accent;
    case 'punctuation':
      return theme.muted;
    case 'function':
      return '#7aa2f7'; // blue
    case 'variable':
      return '#f7768e'; // red
    case 'type':
      return '#2ac3de'; // cyan
    default:
      return theme.text;
  }
}

/**
 * Simple tokenizer for common languages
 */
function tokenize(line: string, language: string): Token[] {
  if (language === 'text' || !line) {
    return [{ type: 'text', value: line }];
  }

  const tokens: Token[] = [];
  let remaining = line;

  // Language-specific keywords
  const keywords = getKeywords(language);
  const typeKeywords = getTypeKeywords(language);

  while (remaining.length > 0) {
    // Check for comments
    const commentMatch = remaining.match(/^(\/\/.*|#.*|--.*)/);
    if (commentMatch) {
      tokens.push({ type: 'comment', value: commentMatch[0] });
      remaining = remaining.slice(commentMatch[0].length);
      continue;
    }

    // Check for strings
    const stringMatch = remaining.match(/^("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/);
    if (stringMatch) {
      tokens.push({ type: 'string', value: stringMatch[0] });
      remaining = remaining.slice(stringMatch[0].length);
      continue;
    }

    // Check for numbers
    const numberMatch = remaining.match(/^(0x[0-9a-fA-F]+|\d+\.?\d*(?:e[+-]?\d+)?)/);
    if (numberMatch) {
      tokens.push({ type: 'number', value: numberMatch[0] });
      remaining = remaining.slice(numberMatch[0].length);
      continue;
    }

    // Check for identifiers (keywords, functions, variables)
    const identMatch = remaining.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
    if (identMatch) {
      const ident = identMatch[0];
      let type: Token['type'] = 'variable';

      if (keywords.includes(ident)) {
        type = 'keyword';
      } else if (typeKeywords.includes(ident)) {
        type = 'type';
      } else if (remaining.slice(ident.length).match(/^\s*\(/)) {
        type = 'function';
      }

      tokens.push({ type, value: ident });
      remaining = remaining.slice(ident.length);
      continue;
    }

    // Check for operators
    const operatorMatch = remaining.match(/^(===|!==|==|!=|<=|>=|&&|\|\||=>|->|::|[+\-*/%<>=!&|^~?:])/);
    if (operatorMatch) {
      tokens.push({ type: 'operator', value: operatorMatch[0] });
      remaining = remaining.slice(operatorMatch[0].length);
      continue;
    }

    // Check for punctuation
    const punctMatch = remaining.match(/^([{}()\[\];,.])/);
    if (punctMatch) {
      tokens.push({ type: 'punctuation', value: punctMatch[0] });
      remaining = remaining.slice(punctMatch[0].length);
      continue;
    }

    // Default: take one character
    tokens.push({ type: 'text', value: remaining[0] ?? '' });
    remaining = remaining.slice(1);
  }

  return tokens;
}

/**
 * Get keywords for a language
 */
function getKeywords(language: string): string[] {
  switch (language) {
    case 'typescript':
    case 'ts':
    case 'tsx':
      return [
        'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
        'debugger', 'default', 'delete', 'do', 'else', 'enum', 'export', 'extends',
        'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'let',
        'new', 'return', 'static', 'super', 'switch', 'this', 'throw', 'try',
        'typeof', 'var', 'void', 'while', 'with', 'yield', 'from', 'as',
        'implements', 'interface', 'package', 'private', 'protected', 'public',
        'readonly', 'abstract', 'declare', 'namespace', 'type', 'module',
      ];
    case 'javascript':
    case 'js':
    case 'jsx':
      return [
        'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
        'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends',
        'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'let',
        'new', 'return', 'static', 'super', 'switch', 'this', 'throw', 'try',
        'typeof', 'var', 'void', 'while', 'with', 'yield', 'from', 'as',
      ];
    case 'go':
      return [
        'break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else',
        'fallthrough', 'for', 'func', 'go', 'goto', 'if', 'import', 'interface',
        'map', 'package', 'range', 'return', 'select', 'struct', 'switch', 'type',
        'var',
      ];
    case 'python':
    case 'py':
      return [
        'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
        'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from',
        'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not',
        'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield',
      ];
    case 'rust':
    case 'rs':
      return [
        'as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn',
        'else', 'enum', 'extern', 'false', 'fn', 'for', 'if', 'impl', 'in',
        'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return',
        'self', 'Self', 'static', 'struct', 'super', 'trait', 'true', 'type',
        'unsafe', 'use', 'where', 'while',
      ];
    default:
      return [];
  }
}

/**
 * Get type keywords for a language
 */
function getTypeKeywords(language: string): string[] {
  switch (language) {
    case 'typescript':
    case 'ts':
    case 'tsx':
      return [
        'string', 'number', 'boolean', 'null', 'undefined', 'void', 'never',
        'any', 'unknown', 'object', 'symbol', 'bigint', 'true', 'false',
        'Array', 'Object', 'String', 'Number', 'Boolean', 'Function',
        'Promise', 'Map', 'Set', 'Date', 'Error', 'RegExp',
      ];
    case 'javascript':
    case 'js':
    case 'jsx':
      return [
        'null', 'undefined', 'true', 'false', 'NaN', 'Infinity',
        'Array', 'Object', 'String', 'Number', 'Boolean', 'Function',
        'Promise', 'Map', 'Set', 'Date', 'Error', 'RegExp',
      ];
    case 'go':
      return [
        'bool', 'byte', 'complex64', 'complex128', 'error', 'float32',
        'float64', 'int', 'int8', 'int16', 'int32', 'int64', 'rune',
        'string', 'uint', 'uint8', 'uint16', 'uint32', 'uint64', 'uintptr',
        'true', 'false', 'iota', 'nil',
      ];
    case 'python':
    case 'py':
      return [
        'True', 'False', 'None', 'int', 'float', 'str', 'bool', 'list',
        'dict', 'tuple', 'set', 'bytes', 'type', 'object',
      ];
    case 'rust':
    case 'rs':
      return [
        'i8', 'i16', 'i32', 'i64', 'i128', 'isize', 'u8', 'u16', 'u32',
        'u64', 'u128', 'usize', 'f32', 'f64', 'bool', 'char', 'str',
        'String', 'Vec', 'Option', 'Result', 'Box', 'Rc', 'Arc',
      ];
    default:
      return [];
  }
}

export interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  showLineNumbers?: boolean;
  maxHeight?: number;
  theme?: Theme;
}

/**
 * Code block with title and border
 */
export function CodeBlock({
  code,
  language = 'text',
  title,
  showLineNumbers = true,
  maxHeight,
  theme = getTheme(),
}: CodeBlockProps): React.ReactElement {
  const lines = code.split('\n');
  const visibleLines = maxHeight ? lines.slice(0, maxHeight) : lines;
  const truncated = maxHeight && lines.length > maxHeight;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.muted}>
      {title && (
        <Box paddingX={1} borderBottom borderColor={theme.muted}>
          <Text color={theme.accent} bold>{title}</Text>
          {language !== 'text' && (
            <Text color={theme.muted}> ({language})</Text>
          )}
        </Box>
      )}
      <Box paddingX={1} flexDirection="column">
        <SyntaxHighlight
          code={visibleLines.join('\n')}
          language={language}
          showLineNumbers={showLineNumbers}
          theme={theme}
        />
        {truncated && (
          <Text color={theme.muted} italic>
            ... {lines.length - maxHeight} more lines
          </Text>
        )}
      </Box>
    </Box>
  );
}

export interface InlineCodeProps {
  children: string;
  theme?: Theme;
}

/**
 * Inline code span
 */
export function InlineCode({
  children,
  theme = getTheme(),
}: InlineCodeProps): React.ReactElement {
  return (
    <Text backgroundColor={theme.muted} color={theme.text}>
      {` ${children} `}
    </Text>
  );
}

export interface DiffCodeProps {
  oldCode: string;
  newCode: string;
  language?: string;
  showLineNumbers?: boolean;
  theme?: Theme;
}

/**
 * Side-by-side diff view with syntax highlighting
 */
export function DiffCode({
  oldCode,
  newCode,
  language = 'text',
  showLineNumbers = true,
  theme = getTheme(),
}: DiffCodeProps): React.ReactElement {
  const oldLines = oldCode.split('\n');
  const newLines = newCode.split('\n');
  const maxLines = Math.max(oldLines.length, newLines.length);

  return (
    <Box flexDirection="column">
      <Box gap={2}>
        <Box flexDirection="column" width="50%">
          <Text color={theme.removed} bold>- Old</Text>
          <SyntaxHighlight
            code={oldCode}
            language={language}
            showLineNumbers={showLineNumbers}
            theme={theme}
          />
        </Box>
        <Box flexDirection="column" width="50%">
          <Text color={theme.added} bold>+ New</Text>
          <SyntaxHighlight
            code={newCode}
            language={language}
            showLineNumbers={showLineNumbers}
            theme={theme}
          />
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Detect language from file extension
 */
export function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'go':
      return 'go';
    case 'py':
      return 'python';
    case 'rs':
      return 'rust';
    case 'rb':
      return 'ruby';
    case 'java':
      return 'java';
    case 'c':
    case 'h':
      return 'c';
    case 'cpp':
    case 'cc':
    case 'hpp':
      return 'cpp';
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return 'css';
    case 'html':
    case 'htm':
      return 'html';
    case 'json':
      return 'json';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'sh':
    case 'bash':
    case 'zsh':
      return 'bash';
    case 'sql':
      return 'sql';
    default:
      return 'text';
  }
}
