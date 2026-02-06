import React from 'react';
import { Box, Text } from 'ink';
import { defaultTheme, type Theme } from '../theme';

export interface ModalProps {
  title?: string;
  children: React.ReactNode;
  width?: number;
  height?: number;
  isOpen?: boolean;
  showBorder?: boolean;
  onClose?: () => void;
  theme?: Theme;
}

export function Modal({
  title,
  children,
  width = 60,
  height,
  isOpen = true,
  showBorder = true,
  theme = defaultTheme,
}: ModalProps): JSX.Element | null {
  if (!isOpen) {
    return null;
  }

  return (
    <Box
      flexDirection="column"
      width={width}
      height={height}
      borderStyle={showBorder ? 'round' : undefined}
      borderColor={theme.border}
    >
      {title && (
        <Box paddingX={1} marginBottom={1}>
          <Text color={theme.accent} bold>
            {title}
          </Text>
        </Box>
      )}
      <Box flexDirection="column" paddingX={1}>
        {children}
      </Box>
    </Box>
  );
}

export interface ModalActionsProps {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  theme?: Theme;
}

export function ModalActions({
  children,
  align = 'right',
  theme = defaultTheme,
}: ModalActionsProps): JSX.Element {
  return (
    <Box
      marginTop={1}
      paddingTop={1}
      borderStyle="single"
      borderTop
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      borderColor={theme.border}
      justifyContent={
        align === 'left'
          ? 'flex-start'
          : align === 'center'
          ? 'center'
          : 'flex-end'
      }
    >
      {children}
    </Box>
  );
}

export interface ModalButtonProps {
  label: string;
  shortcut?: string;
  primary?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  theme?: Theme;
}

export function ModalButton({
  label,
  shortcut,
  primary = false,
  destructive = false,
  disabled = false,
  theme = defaultTheme,
}: ModalButtonProps): JSX.Element {
  let color = theme.muted;
  if (disabled) {
    color = theme.border;
  } else if (destructive) {
    color = theme.error;
  } else if (primary) {
    color = theme.accent;
  }

  return (
    <Box marginLeft={1}>
      {shortcut && (
        <Text color={disabled ? theme.border : theme.muted}>[{shortcut}] </Text>
      )}
      <Text color={color} bold={primary && !disabled} dimColor={disabled}>
        {label}
      </Text>
    </Box>
  );
}

export interface AlertModalProps {
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  confirmLabel?: string;
  confirmShortcut?: string;
  width?: number;
  onConfirm?: () => void;
  theme?: Theme;
}

export function AlertModal({
  title,
  message,
  type = 'info',
  confirmLabel = 'OK',
  confirmShortcut = 'Enter',
  width = 50,
  theme = defaultTheme,
}: AlertModalProps): JSX.Element {
  const iconMap = {
    info: 'ℹ',
    warning: '⚠',
    error: '✗',
    success: '✓',
  };

  const colorMap = {
    info: theme.info,
    warning: theme.warning,
    error: theme.error,
    success: theme.success,
  };

  return (
    <Modal title={title} width={width} theme={theme}>
      <Box>
        <Text color={colorMap[type]}>{iconMap[type]} </Text>
        <Text color={theme.text}>{message}</Text>
      </Box>
      <ModalActions theme={theme}>
        <ModalButton
          label={confirmLabel}
          shortcut={confirmShortcut}
          primary
          theme={theme}
        />
      </ModalActions>
    </Modal>
  );
}

export interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmShortcut?: string;
  cancelLabel?: string;
  cancelShortcut?: string;
  destructive?: boolean;
  width?: number;
  onConfirm?: () => void;
  onCancel?: () => void;
  theme?: Theme;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  confirmShortcut = 'y',
  cancelLabel = 'Cancel',
  cancelShortcut = 'n',
  destructive = false,
  width = 50,
  theme = defaultTheme,
}: ConfirmModalProps): JSX.Element {
  return (
    <Modal title={title} width={width} theme={theme}>
      <Text color={theme.text}>{message}</Text>
      <ModalActions theme={theme}>
        <ModalButton
          label={cancelLabel}
          shortcut={cancelShortcut}
          theme={theme}
        />
        <ModalButton
          label={confirmLabel}
          shortcut={confirmShortcut}
          primary={!destructive}
          destructive={destructive}
          theme={theme}
        />
      </ModalActions>
    </Modal>
  );
}

export interface PromptModalProps {
  title: string;
  message?: string;
  placeholder?: string;
  value: string;
  submitLabel?: string;
  submitShortcut?: string;
  cancelLabel?: string;
  cancelShortcut?: string;
  width?: number;
  onSubmit?: () => void;
  onCancel?: () => void;
  theme?: Theme;
}

export function PromptModal({
  title,
  message,
  placeholder = 'Enter text...',
  value,
  submitLabel = 'Submit',
  submitShortcut = 'Enter',
  cancelLabel = 'Cancel',
  cancelShortcut = 'Esc',
  width = 50,
  theme = defaultTheme,
}: PromptModalProps): JSX.Element {
  return (
    <Modal title={title} width={width} theme={theme}>
      {message && (
        <Box marginBottom={1}>
          <Text color={theme.text}>{message}</Text>
        </Box>
      )}
      <Box
        borderStyle="single"
        borderColor={theme.accent}
        paddingX={1}
      >
        <Text color={value ? theme.text : theme.muted}>
          {value || placeholder}
        </Text>
        <Text color={theme.accent}>▏</Text>
      </Box>
      <ModalActions theme={theme}>
        <ModalButton
          label={cancelLabel}
          shortcut={cancelShortcut}
          theme={theme}
        />
        <ModalButton
          label={submitLabel}
          shortcut={submitShortcut}
          primary
          theme={theme}
        />
      </ModalActions>
    </Modal>
  );
}
