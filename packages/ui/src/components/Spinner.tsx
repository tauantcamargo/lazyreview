import React, { useEffect, useState } from 'react';
import { Text } from 'ink';
import type { Theme } from '../theme';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export interface SpinnerProps {
  label?: string;
  theme?: Theme;
}

export function Spinner({ label, theme }: SpinnerProps): JSX.Element {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(timer);
  }, []);

  const spinnerChar = SPINNER_FRAMES[frame];
  const color = theme?.accent ?? 'cyan';

  return (
    <Text>
      <Text color={color}>{spinnerChar}</Text>
      {label && <Text color={theme?.muted ?? 'gray'}> {label}</Text>}
    </Text>
  );
}
