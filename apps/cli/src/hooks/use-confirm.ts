import { useState, useCallback } from 'react';

export interface ConfirmState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export interface UseConfirmResult {
  state: ConfirmState;
  isOpen: boolean;
  open: (options: Omit<ConfirmState, 'isOpen'>) => void;
  close: () => void;
  confirm: () => void;
  cancel: () => void;
  handleKey: (key: string) => boolean;
}

const initialState: ConfirmState = {
  isOpen: false,
  title: '',
  message: '',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  destructive: false,
};

export function useConfirm(
  onConfirm?: () => void,
  onCancel?: () => void
): UseConfirmResult {
  const [state, setState] = useState<ConfirmState>(initialState);

  const open = useCallback((options: Omit<ConfirmState, 'isOpen'>): void => {
    setState({
      ...initialState,
      isOpen: true,
      ...options,
    });
  }, []);

  const close = useCallback((): void => {
    setState(initialState);
  }, []);

  const confirm = useCallback((): void => {
    close();
    onConfirm?.();
  }, [close, onConfirm]);

  const cancel = useCallback((): void => {
    close();
    onCancel?.();
  }, [close, onCancel]);

  const handleKey = useCallback(
    (key: string): boolean => {
      if (!state.isOpen) return false;

      if (key === 'y' || key === 'Y') {
        confirm();
        return true;
      }

      if (key === 'n' || key === 'N' || key === 'escape') {
        cancel();
        return true;
      }

      return false;
    },
    [state.isOpen, confirm, cancel]
  );

  return {
    state,
    isOpen: state.isOpen,
    open,
    close,
    confirm,
    cancel,
    handleKey,
  };
}
