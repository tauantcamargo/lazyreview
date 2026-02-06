import { useState, useCallback } from 'react';
import { spawn } from 'child_process';

export interface UseClipboardResult {
  copied: boolean;
  error: string | null;
  copy: (text: string) => Promise<void>;
  reset: () => void;
}

export interface UseClipboardOptions {
  copyFn?: (text: string) => Promise<void>;
  resetDelay?: number;
}

function getClipboardCommand(): { command: string; args: string[] } {
  const platform = process.platform;

  if (platform === 'darwin') {
    return { command: 'pbcopy', args: [] };
  } else if (platform === 'linux') {
    return { command: 'xclip', args: ['-selection', 'clipboard'] };
  } else if (platform === 'win32') {
    return { command: 'clip', args: [] };
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }
}

async function defaultCopyToClipboard(text: string): Promise<void> {
  const { command, args } = getClipboardCommand();

  return new Promise((resolve, reject) => {
    const proc = spawn(command, args);

    proc.on('error', (err) => {
      reject(new Error(`Failed to copy: ${err.message}`));
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Clipboard command exited with code ${code}`));
      }
    });

    proc.stdin.write(text);
    proc.stdin.end();
  });
}

export function useClipboard(options: UseClipboardOptions = {}): UseClipboardResult {
  const { copyFn = defaultCopyToClipboard, resetDelay = 2000 } = options;
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = useCallback(async (text: string): Promise<void> => {
    try {
      await copyFn(text);
      setCopied(true);
      setError(null);

      // Auto-reset after delay
      setTimeout(() => {
        setCopied(false);
      }, resetDelay);
    } catch (err) {
      setCopied(false);
      setError(err instanceof Error ? err.message : 'Failed to copy to clipboard');
    }
  }, [copyFn, resetDelay]);

  const reset = useCallback(() => {
    setCopied(false);
    setError(null);
  }, []);

  return {
    copied,
    error,
    copy,
    reset,
  };
}
