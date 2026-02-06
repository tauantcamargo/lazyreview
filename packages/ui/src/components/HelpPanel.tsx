import React from 'react';
import { Box, Text } from 'ink';
import type { Theme } from '../theme';

export interface KeyBinding {
  key: string;
  description: string;
  chord?: boolean;
}

export interface HelpSection {
  title: string;
  bindings: KeyBinding[];
}

export interface HelpPanelProps {
  sections: HelpSection[];
  width: number;
  height: number;
  theme?: Theme;
  onClose?: () => void;
}

export function HelpPanel({
  sections,
  width,
  height,
  theme,
}: HelpPanelProps): JSX.Element {
  const accentColor = theme?.accent ?? 'cyan';
  const mutedColor = theme?.muted ?? 'gray';
  const keyColor = theme?.added ?? 'green';

  const maxKeyWidth = Math.max(
    ...sections.flatMap((s) => s.bindings.map((b) => b.key.length)),
    8
  );

  const availableHeight = height - 4;
  let currentLine = 0;

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle="round"
      borderColor={accentColor}
      paddingX={1}
    >
      <Box justifyContent="center" marginBottom={1}>
        <Text color={accentColor} bold>
          Keyboard Shortcuts
        </Text>
      </Box>

      {sections.map((section) => {
        if (currentLine >= availableHeight) return null;

        const sectionElements: JSX.Element[] = [];
        currentLine++;

        sectionElements.push(
          <Box key={`title-${section.title}`} marginTop={1}>
            <Text color={mutedColor} bold>
              {section.title}
            </Text>
          </Box>
        );

        for (const binding of section.bindings) {
          if (currentLine >= availableHeight) break;
          currentLine++;

          sectionElements.push(
            <Box key={`${section.title}-${binding.key}`} paddingLeft={1}>
              <Text color={keyColor}>
                {binding.key.padEnd(maxKeyWidth)}
              </Text>
              <Text color={mutedColor}> </Text>
              <Text>{binding.description}</Text>
              {binding.chord && (
                <Text color={mutedColor} italic>
                  {' '}
                  (chord)
                </Text>
              )}
            </Box>
          );
        }

        return (
          <Box key={section.title} flexDirection="column">
            {sectionElements}
          </Box>
        );
      })}

      <Box marginTop={1} justifyContent="center">
        <Text color={mutedColor}>Press ? to close</Text>
      </Box>
    </Box>
  );
}
