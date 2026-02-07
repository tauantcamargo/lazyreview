import React from 'react';
import { Box, Text } from 'ink';
import { Spinner as InkSpinner } from '@inkjs/ui';
import { getTheme, type Theme } from '../theme';

export interface LoadingSpinnerProps {
  /**
   * Status message to display next to the spinner
   */
  message?: string;

  /**
   * Spinner type from ink-ui
   */
  type?: 'dots' | 'line' | 'arc' | 'bounce';

  /**
   * Whether to center the spinner in the available space
   */
  centered?: boolean;

  /**
   * Custom theme
   */
  theme?: Theme;
}

/**
 * LoadingSpinner - Displays a spinner with an optional status message
 *
 * Uses @inkjs/ui Spinner component with customizable text and centering
 */
export function LoadingSpinner({
  message = 'Loading...',
  type = 'dots',
  centered = true,
  theme = getTheme(),
}: LoadingSpinnerProps): React.ReactElement {
  const spinnerContent = (
    <Box gap={1}>
      <InkSpinner type={type} />
      <Text color={theme.text}>{message}</Text>
    </Box>
  );

  if (centered) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" height="100%">
        {spinnerContent}
      </Box>
    );
  }

  return spinnerContent;
}

export interface SpinnerProps {
  /**
   * Spinner type
   */
  type?: 'dots' | 'line' | 'arc' | 'bounce';

  /**
   * Custom color
   */
  color?: string;
}

/**
 * Simple Spinner component that rotates
 */
export function Spinner({ type = 'dots', color }: SpinnerProps): React.ReactElement {
  const [frame, setFrame] = React.useState(0);

  const frames: Record<typeof type, string[]> = {
    dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    line: ['|', '/', '-', '\\'],
    arc: ['◜', '◠', '◝', '◞', '◡', '◟'],
    bounce: ['⠁', '⠂', '⠄', '⠂'],
  };

  React.useEffect(() => {
    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % frames[type].length);
    }, 80);

    return () => clearInterval(interval);
  }, [type]);

  return <Text color={color}>{frames[type][frame]}</Text>;
}
