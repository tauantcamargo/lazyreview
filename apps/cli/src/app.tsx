import React from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import {
  Layout,
  Sidebar,
  StatusBar,
  HelpPanel,
  CommandPalette,
  ToastContainer,
} from '@lazyreview/ui';
import {
  useAppStore,
  useCurrentView,
  useIsSidebarVisible,
  useIsCommandPaletteOpen,
  usePullRequests,
} from './stores/app-store.js';
import {
  PRListScreen,
  PRDetailScreen,
  DiffScreen,
  DashboardScreen,
  SettingsScreen,
  AIReviewScreen,
} from './screens/index.js';
import { useToast, useConfig } from './hooks/index.js';
import type { ViewType } from './stores/app-store.js';

export interface AppProps {
  width?: number;
  height?: number;
  provider?: string;
  repo?: string;
}

/**
 * Main Application Component
 * Coordinates all screens, layout, and global keyboard shortcuts
 */
export function App({ width = 80, height = 24 }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const currentView = useCurrentView();
  const isSidebarVisible = useIsSidebarVisible();
  const isCommandPaletteOpen = useIsCommandPaletteOpen();
  const pullRequests = usePullRequests();
  const { config, isVimMode } = useConfig();

  const setView = useAppStore((s) => s.setView);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const toggleHelp = useAppStore((s) => s.toggleHelp);
  const toggleCommandPalette = useAppStore((s) => s.toggleCommandPalette);
  const isHelpOpen = useAppStore((s) => s.isHelpOpen);
  const selectedRepo = useAppStore((s) => s.selectedRepo);

  const { toasts, removeToast } = useToast();

  // Global keyboard shortcuts
  useInput((input, key) => {
    // Quit application
    if (key.ctrl && input === 'c') {
      exit();
      return;
    }

    // Don't process shortcuts when command palette is open
    if (isCommandPaletteOpen) {
      if (key.escape) {
        toggleCommandPalette();
      }
      return;
    }

    // Don't process shortcuts when help is open
    if (isHelpOpen) {
      if (key.escape || input === '?' || input === 'q') {
        toggleHelp();
      }
      return;
    }

    // Toggle help
    if (input === '?') {
      toggleHelp();
      return;
    }

    // Toggle command palette
    if (key.ctrl && input === 'p') {
      toggleCommandPalette();
      return;
    }

    // Toggle sidebar
    if (input === 'b' || input === '\\') {
      toggleSidebar();
      return;
    }

    // View shortcuts
    if (input === '1') setView('list');
    else if (input === '2') setView('dashboard');
    else if (input === '3') setView('settings');
  });

  // Calculate layout dimensions
  const sidebarWidth = isSidebarVisible ? Math.min(25, Math.floor(width * 0.25)) : 0;
  const contentWidth = width - sidebarWidth - (isSidebarVisible ? 1 : 0);
  const contentHeight = height - 3; // Reserve space for status bar

  // Sidebar items
  const sidebarItems = React.useMemo(() => {
    const repos = new Map<string, number>();
    for (const pr of pullRequests) {
      const repoKey = `${pr.repository?.owner ?? 'unknown'}/${pr.repository?.name ?? 'unknown'}`;
      repos.set(repoKey, (repos.get(repoKey) ?? 0) + 1);
    }

    return [
      { id: 'all', label: `All (${pullRequests.length})`, icon: '◆' },
      ...Array.from(repos.entries()).map(([repo, count]) => ({
        id: repo,
        label: `${repo.split('/')[1]} (${count})`,
        icon: '▸',
      })),
    ];
  }, [pullRequests]);

  // Status bar content based on current view
  const getStatusBarContent = (): { left: string; right: string } => {
    const common = isVimMode ? 'j/k:scroll ' : '↑/↓:scroll ';

    switch (currentView) {
      case 'list':
        return {
          left: `${common}Enter:open /:search f:filter R:refresh`,
          right: `${pullRequests.length} PRs`,
        };
      case 'detail':
        return {
          left: `${common}Tab:tabs a:approve x:changes c:comment q:back`,
          right: selectedRepo ? `${selectedRepo.owner}/${selectedRepo.repo}` : '',
        };
      case 'files':
        return {
          left: `${common}n/N:hunks c:comment q:back`,
          right: '',
        };
      case 'dashboard':
        return {
          left: '1:Open 2:All 3:Closed q:back',
          right: '',
        };
      case 'settings':
        return {
          left: `${common}Enter:toggle Tab:section R:reset q:back`,
          right: `v${config.version}`,
        };
      case 'ai':
        return {
          left: `${common}r:re-run q:back`,
          right: 'AI Review',
        };
      default:
        return { left: '', right: '' };
    }
  };

  const statusContent = getStatusBarContent();

  return (
    <Box flexDirection="column" width={width} height={height}>
      {/* Main layout */}
      <Box flexDirection="row" flexGrow={1}>
        {/* Sidebar */}
        {isSidebarVisible && (
          <>
            <Box width={sidebarWidth} flexDirection="column">
              <Sidebar
                items={sidebarItems}
                selectedId={selectedRepo ? `${selectedRepo.owner}/${selectedRepo.repo}` : 'all'}
                onSelect={(id) => {
                  if (id === 'all') {
                    useAppStore.getState().selectRepo('', '', '');
                  } else {
                    const [owner, repo] = id.split('/');
                    useAppStore.getState().selectRepo(owner, repo, 'github');
                  }
                }}
                title="Repositories"
              />
            </Box>
            <Box width={1} borderStyle="single" borderLeft />
          </>
        )}

        {/* Main content */}
        <Box width={contentWidth} flexDirection="column">
          <CurrentScreen
            view={currentView}
            width={contentWidth}
            height={contentHeight}
          />
        </Box>
      </Box>

      {/* Status bar */}
      <StatusBar
        left={statusContent.left}
        right={statusContent.right}
        keybindings={[]}
      />

      {/* Overlays */}
      {isHelpOpen && (
        <HelpOverlay onClose={toggleHelp} width={width} height={height} />
      )}

      {isCommandPaletteOpen && (
        <CommandPaletteOverlay
          onClose={toggleCommandPalette}
          onExecute={(command) => {
            handleCommand(command, setView, exit);
            toggleCommandPalette();
          }}
          width={width}
        />
      )}

      {/* Toast notifications */}
      <ToastContainer
        toasts={toasts.map((t) => ({
          id: t.id,
          message: t.message,
          type: t.type,
          onDismiss: () => removeToast(t.id),
        }))}
        position="bottom-right"
      />
    </Box>
  );
}

// Screen router component
interface CurrentScreenProps {
  view: ViewType;
  width: number;
  height: number;
}

function CurrentScreen({ view, width, height }: CurrentScreenProps): React.ReactElement {
  switch (view) {
    case 'list':
      return <PRListScreen width={width} height={height} />;
    case 'detail':
      return <PRDetailScreen width={width} height={height} />;
    case 'files':
      return <DiffScreen width={width} height={height} />;
    case 'dashboard':
      return <DashboardScreen width={width} height={height} />;
    case 'settings':
      return <SettingsScreen width={width} height={height} />;
    case 'ai':
      return <AIReviewScreen width={width} height={height} />;
    default:
      return <PRListScreen width={width} height={height} />;
  }
}

// Help overlay component
interface HelpOverlayProps {
  onClose: () => void;
  width: number;
  height: number;
}

function HelpOverlay({ onClose, width, height }: HelpOverlayProps): React.ReactElement {
  const helpSections = [
    {
      title: 'Navigation',
      keybindings: [
        { key: 'j/k', description: 'Move down/up' },
        { key: 'h/l', description: 'Move left/right' },
        { key: 'gg', description: 'Go to top' },
        { key: 'G', description: 'Go to bottom' },
        { key: 'Ctrl+u/d', description: 'Page up/down' },
      ],
    },
    {
      title: 'Actions',
      keybindings: [
        { key: 'Enter', description: 'Select/confirm' },
        { key: 'a', description: 'Approve PR' },
        { key: 'x', description: 'Request changes' },
        { key: 'c', description: 'Add comment' },
        { key: 'm', description: 'Merge PR' },
      ],
    },
    {
      title: 'Views',
      keybindings: [
        { key: '1', description: 'PR List' },
        { key: '2', description: 'Dashboard' },
        { key: '3', description: 'Settings' },
        { key: 'b', description: 'Toggle sidebar' },
        { key: '?', description: 'Toggle help' },
      ],
    },
  ];

  return (
    <HelpPanel
      sections={helpSections}
      onClose={onClose}
    />
  );
}

// Command palette overlay component
interface CommandPaletteOverlayProps {
  onClose: () => void;
  onExecute: (command: string) => void;
  width: number;
}

function CommandPaletteOverlay({
  onClose,
  onExecute,
  width,
}: CommandPaletteOverlayProps): React.ReactElement {
  const commands = [
    { id: 'list', label: 'Go to PR List', shortcut: '1' },
    { id: 'dashboard', label: 'Go to Dashboard', shortcut: '2' },
    { id: 'settings', label: 'Open Settings', shortcut: '3' },
    { id: 'refresh', label: 'Refresh', shortcut: 'R' },
    { id: 'quit', label: 'Quit', shortcut: 'Ctrl+C' },
  ];

  return (
    <CommandPalette
      commands={commands}
      onSelect={onExecute}
      onClose={onClose}
      placeholder="Type a command..."
    />
  );
}

// Command handler
function handleCommand(
  command: string,
  setView: (view: ViewType) => void,
  exit: () => void
): void {
  switch (command) {
    case 'list':
      setView('list');
      break;
    case 'dashboard':
      setView('dashboard');
      break;
    case 'settings':
      setView('settings');
      break;
    case 'quit':
      exit();
      break;
    default:
      break;
  }
}

export default App;
