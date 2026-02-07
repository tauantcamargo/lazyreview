import React from 'react';
import { render } from 'ink';
import { App, type AppProps } from './app';
import { QueryProvider } from './providers/QueryProvider';
import { useAppStore } from './stores/app-store';

export async function runTui(props: AppProps = {}): Promise<void> {
  // Check if stdin supports raw mode (required for Ink's input handling)
  const isInteractive = process.stdin.isTTY;

  if (!isInteractive) {
    console.error('Error: LazyReview TUI requires an interactive terminal.');
    console.error('Please run this command directly in a terminal, not through a pipe or script.');
    process.exit(1);
  }

  // Initialize demo mode before rendering if no repo is provided
  if (!props.repo) {
    useAppStore.getState().initDemoMode();
  } else {
    const [owner, repoName] = props.repo.split('/');
    if (owner && repoName) {
      useAppStore.getState().selectRepo(owner, repoName, props.provider || 'github');
    }
  }

  // Get terminal dimensions - use full screen
  const width = process.stdout.columns || 80;
  const height = process.stdout.rows || 24;

  // Enable alternate screen buffer (prevents scrollback, like lazygit)
  // ESC[?1049h enters alternate screen, ESC[?1049l exits
  process.stdout.write('\x1b[?1049h');

  // Clear screen
  process.stdout.write('\x1b[2J');

  // Hide cursor
  process.stdout.write('\x1b[?25l');

  // Restore terminal on exit
  const cleanup = () => {
    // Show cursor
    process.stdout.write('\x1b[?25h');
    // Exit alternate screen
    process.stdout.write('\x1b[?1049l');
  };

  process.on('exit', cleanup);
  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  const { unmount } = render(
    <QueryProvider>
      <App {...props} width={width} height={height} />
    </QueryProvider>,
    {
      // patchConsole: false prevents Ink from hijacking console methods
      patchConsole: false,
      exitOnCtrlC: true,
    }
  );

  // When app exits, cleanup
  return new Promise<void>((resolve) => {
    process.stdin.on('data', (data) => {
      // Listen for quit signal from app
      if (data.toString() === 'QUIT') {
        unmount();
        cleanup();
        resolve();
      }
    });
  });
}
