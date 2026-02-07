import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface LoadingState {
  /**
   * Whether any loading operation is in progress
   */
  isLoading: boolean;

  /**
   * Current status message
   */
  message: string | null;

  /**
   * Loading operation type (for tracking multiple operations)
   */
  operation: string | null;
}

export interface LoadingContextValue extends LoadingState {
  /**
   * Start a loading operation with a message
   */
  startLoading: (message: string, operation?: string) => void;

  /**
   * Stop the current loading operation
   */
  stopLoading: () => void;

  /**
   * Update the loading message without stopping/starting
   */
  updateMessage: (message: string) => void;
}

const LoadingContext = createContext<LoadingContextValue | undefined>(undefined);

export interface LoadingProviderProps {
  children: ReactNode;
}

/**
 * LoadingProvider - Provides loading state management throughout the app
 *
 * Manages global loading state with status messages for async operations
 */
export function LoadingProvider({ children }: LoadingProviderProps): React.ReactElement {
  const [state, setState] = useState<LoadingState>({
    isLoading: false,
    message: null,
    operation: null,
  });

  const startLoading = useCallback((message: string, operation?: string) => {
    setState({
      isLoading: true,
      message,
      operation: operation || null,
    });
  }, []);

  const stopLoading = useCallback(() => {
    setState({
      isLoading: false,
      message: null,
      operation: null,
    });
  }, []);

  const updateMessage = useCallback((message: string) => {
    setState((prev) => ({
      ...prev,
      message,
    }));
  }, []);

  const value: LoadingContextValue = {
    ...state,
    startLoading,
    stopLoading,
    updateMessage,
  };

  return <LoadingContext.Provider value={value}>{children}</LoadingContext.Provider>;
}

/**
 * Hook to access loading context
 *
 * @throws Error if used outside LoadingProvider
 */
export function useLoading(): LoadingContextValue {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within LoadingProvider');
  }
  return context;
}

/**
 * Hook for managing loading state of async operations
 *
 * Returns loading state and helpers for wrapping async operations
 */
export function useLoadingOperation(operationName: string) {
  const { startLoading, stopLoading, updateMessage, isLoading, operation } = useLoading();

  const isCurrentOperation = operation === operationName;

  const withLoading = useCallback(
    async <T,>(fn: () => Promise<T>, message: string): Promise<T> => {
      try {
        startLoading(message, operationName);
        const result = await fn();
        return result;
      } finally {
        stopLoading();
      }
    },
    [startLoading, stopLoading, operationName]
  );

  return {
    isLoading: isLoading && isCurrentOperation,
    withLoading,
    updateMessage,
  };
}
