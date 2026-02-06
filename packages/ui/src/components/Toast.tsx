import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import type { Theme } from '../theme';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  theme?: Theme;
  onDismiss?: () => void;
}

function getToastStyle(type: ToastType, theme?: Theme): { icon: string; color: string } {
  switch (type) {
    case 'success':
      return { icon: '✓', color: theme?.added ?? 'green' };
    case 'warning':
      return { icon: '⚠', color: theme?.muted ?? 'yellow' };
    case 'error':
      return { icon: '✗', color: theme?.removed ?? 'red' };
    case 'info':
    default:
      return { icon: 'ℹ', color: theme?.accent ?? 'cyan' };
  }
}

export function Toast({
  message,
  type = 'info',
  duration = 3000,
  theme,
  onDismiss,
}: ToastProps): JSX.Element | null {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        onDismiss?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss]);

  if (!visible) {
    return null;
  }

  const style = getToastStyle(type, theme);

  return (
    <Box
      borderStyle="round"
      borderColor={style.color}
      paddingX={1}
    >
      <Text color={style.color}>{style.icon}</Text>
      <Text> {message}</Text>
    </Box>
  );
}

// Toast manager for multiple toasts
export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

export interface ToastContainerProps {
  toasts: ToastItem[];
  position?: 'top' | 'bottom';
  theme?: Theme;
  onDismiss?: (id: string) => void;
}

export function ToastContainer({
  toasts,
  position = 'bottom',
  theme,
  onDismiss,
}: ToastContainerProps): JSX.Element {
  return (
    <Box
      flexDirection="column"
      position="absolute"
      marginTop={position === 'top' ? 1 : undefined}
      marginBottom={position === 'bottom' ? 1 : undefined}
    >
      {toasts.map((toast) => (
        <Box key={toast.id} marginBottom={1}>
          <Toast
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            theme={theme}
            onDismiss={() => onDismiss?.(toast.id)}
          />
        </Box>
      ))}
    </Box>
  );
}
