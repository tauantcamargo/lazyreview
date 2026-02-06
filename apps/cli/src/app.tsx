import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import { DiffView, VirtualList, VirtualListItem, getTheme, themes } from '@lazyreview/ui';
import { LazyReviewStorage } from '@lazyreview/storage';
import { processDiff } from './utils/diffWorker';
import {
  buildProviderBaseUrl,
  createAIClient,
  createProvider,
  defaultProviderHost,
  loadConfig,
  readToken,
  readAIKey,
  saveConfig,
  type ProviderType,
  type PullRequest,
} from '@lazyreview/core';

const SAMPLE_DIFF = `diff --git a/src/math.ts b/src/math.ts
index 1c0f3a4..4d2f2e1 100644
--- a/src/math.ts
+++ b/src/math.ts
@@ -1,8 +1,14 @@
 export function add(a: number, b: number) {
-  return a + b;
+  const result = a + b;
+  return result;
 }
 
 export function subtract(a: number, b: number) {
   return a - b;
 }
+
+export function multiply(a: number, b: number) {
+  return a * b;
+}

diff --git a/src/app.ts b/src/app.ts
index 98b1f09..a84b2c1 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -10,12 +10,20 @@ export function main() {
-  console.log('Hello');
+  console.log('Hello, LazyReview');
+
+  if (process.env.DEBUG) {
+    console.log('Debug mode enabled');
+  }
 }
`;

export type AppProps = {
  provider?: string;
  repo?: string;
};

function buildSamplePRs(count: number): VirtualListItem[] {
  const items: VirtualListItem[] = [];
  for (let i = 1; i <= count; i += 1) {
    items.push({
      id: String(i),
      title: `PR #${i} Improve performance for list rendering`,
      description: `lazyreview/repo-${(i % 7) + 1} • updated ${(i % 13) + 1}h ago`,
    });
  }
  return items;
}

function mapPullRequests(prs: PullRequest[]): VirtualListItem[] {
  return prs.map((pr) => ({
    id: pr.id,
    title: `#${pr.number} ${pr.title}`,
    description: `${pr.repo} • ${pr.author} • ${new Date(pr.updatedAt).toLocaleString()}`,
  }));
}

function parseRepo(input: string, provider: ProviderType): { owner: string; repo: string } {
  const parts = input.split('/');
  if (provider === 'azuredevops') {
    if (parts.length < 3) {
      throw new Error('Azure DevOps repo must be in org/project/repo format');
    }
    const org = parts[0] ?? '';
    const project = parts[1] ?? '';
    const repoName = parts[2] ?? '';
    return { owner: `${org}/${project}`, repo: repoName };
  }

  if (parts.length < 2) {
    throw new Error('Repo must be in owner/name format');
  }

  const owner = parts[0] ?? '';
  const repoName = parts[1] ?? '';
  return { owner, repo: repoName };
}

export function App({ provider, repo }: AppProps): JSX.Element {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 80;
  const height = stdout?.rows ?? 24;

  const [view, setView] = useState<'list' | 'diff' | 'settings' | 'ai'>('list');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const sampleItems = useMemo(() => buildSamplePRs(2000), []);
  const [items, setItems] = useState<VirtualListItem[]>(sampleItems);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [demoMode, setDemoMode] = useState(!repo);
  const [diffText, setDiffText] = useState(SAMPLE_DIFF);
  const [diffStatus, setDiffStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [diffError, setDiffError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiText, setAiText] = useState<string>('');
  const [aiMode, setAiMode] = useState<'summary' | 'review'>('summary');
  const [aiEditing, setAiEditing] = useState(false);
  const [aiDraft, setAiDraft] = useState('');
  const [providerContext, setProviderContext] = useState<{
    provider: ProviderType;
    token: string;
    baseUrl: string;
    repo: string;
  } | null>(null);
  const [config, setConfig] = useState(() => loadConfig());
  const theme = getTheme(config.ui?.theme);
  const themeItems = useMemo<VirtualListItem[]>(() => {
    return Object.keys(themes).map((name) => ({
      id: name,
      title: name,
      description: config.ui?.theme === name ? 'current' : '',
    }));
  }, [config.ui?.theme]);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
      return;
    }

    if (view === 'ai') {
      if (aiEditing) {
        if (key.escape) {
          setAiEditing(false);
          return;
        }
        if (key.return) {
          setAiDraft((prev) => `${prev}\n`);
          return;
        }
        if (key.backspace || key.delete) {
          setAiDraft((prev) => prev.slice(0, -1));
          return;
        }
        if (input) {
          setAiDraft((prev) => prev + input);
        }
        return;
      }

      if (input === 'q') {
        setView('diff');
        return;
      }
      if (input === 'e') {
        setAiEditing(true);
        setAiDraft(aiText);
        return;
      }
      if (input === 'p' && aiMode === 'review') {
        void postAiReview();
        return;
      }
    }

    if (view === 'diff' && input === 'q') {
      setView('list');
    }

    if (view === 'settings' && input === 'q') {
      setView('list');
    }

    if (view === 'list' && input === 't') {
      setView('settings');
    }

    if (view === 'diff' && input === 's') {
      void runAi('summary');
    }

    if (view === 'diff' && (input === 'A' || input === 'a')) {
      void runAi('review');
    }
  });

  const contentHeight = Math.max(8, height - 2);

  async function runAi(mode: 'summary' | 'review'): Promise<void> {
    setAiMode(mode);
    setAiStatus('loading');
    setAiError(null);
    setAiText('');
    setAiDraft('');
    setAiEditing(false);
    setView('ai');

    try {
      if (config.ai?.enabled === false) {
        throw new Error('AI is disabled in config');
      }
      const providerName = config.ai?.provider ?? 'openai';
      const key = await readAIKey(providerName);
      const client = createAIClient(config, key);
      const result = mode === 'summary' ? await client.summarizeDiff(diffText) : await client.reviewDiff(diffText);
      setAiText(result || 'No AI output.');
      setAiStatus('ready');
    } catch (err) {
      setAiStatus('error');
      setAiError(err instanceof Error ? err.message : String(err));
    }
  }

  async function postAiReview(): Promise<void> {
    if (!providerContext) {
      setAiError('No provider context available.');
      return;
    }
    try {
      const body = aiEditing ? aiDraft : aiText;
      const prNumber = pullRequests[selectedIndex]?.number;
      if (!prNumber) {
        setAiError('No pull request selected.');
        return;
      }
      const client = createProvider({
        type: providerContext.provider,
        token: providerContext.token,
        baseUrl: providerContext.baseUrl,
      });
      const { owner, repo } = parseRepo(providerContext.repo, providerContext.provider);
      await client.createReview(owner, repo, prNumber, {
        event: 'COMMENT',
        body,
      });
      setAiStatus('ready');
      setAiError(null);
      setView('diff');
    } catch (err) {
      setAiStatus('error');
      setAiError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    let active = true;
    async function loadData() {
      if (!repo) {
        setItems(sampleItems);
        setStatus('ready');
        setDemoMode(true);
        setPullRequests([]);
        setProviderContext(null);
        return;
      }

      setStatus('loading');
      setErrorMessage(null);
      setDemoMode(false);
      const resolvedProvider = (provider ?? config.defaultProvider ?? 'github') as ProviderType;
      const providerConfig = config.providers?.find((p) => p.type === resolvedProvider);
      const host = providerConfig?.host ?? defaultProviderHost(resolvedProvider);
      const envToken = providerConfig?.tokenEnv ? process.env[providerConfig.tokenEnv] : undefined;
      let token: string | undefined = (await readToken(resolvedProvider, host)) ?? envToken ?? process.env.LAZYREVIEW_TOKEN ?? undefined;
      if (!token && resolvedProvider === 'github' && host === 'github.com') {
        token = (await readToken(resolvedProvider, 'api.github.com')) ?? undefined;
      }
      if (!token && resolvedProvider === 'bitbucket' && host === 'bitbucket.org') {
        token = (await readToken(resolvedProvider, 'api.bitbucket.org')) ?? undefined;
      }

      if (!token) {
        setStatus('error');
        setErrorMessage(`Missing token for ${resolvedProvider}. Run lazyreview auth login.`);
        return;
      }

      const baseUrl = providerConfig?.baseUrl ?? buildProviderBaseUrl(resolvedProvider, host);
      if (active) {
        setProviderContext({ provider: resolvedProvider, token, baseUrl, repo });
      }

      try {
        const storage = LazyReviewStorage.open();
        try {
          const cacheKey = `prs:${resolvedProvider}:${repo}`;
          const cached = storage.getCache<PullRequest[]>(cacheKey);
          if (cached && active) {
            setPullRequests(cached.value);
            setItems(mapPullRequests(cached.value));
            setStatus('ready');
          }

          const client = createProvider({ type: resolvedProvider, token, baseUrl });
          const { owner, repo: repoName } = parseRepo(repo, resolvedProvider);
          const prs = await client.listPullRequests(owner, repoName, { limit: 50 });
          storage.setCache(cacheKey, prs, config.performance?.cacheTtl ?? 120);
          if (active) {
            setPullRequests(prs);
            setItems(mapPullRequests(prs));
            setStatus('ready');
          }
          if (active) {
            setProviderContext({ provider: resolvedProvider, token, baseUrl, repo });
          }
        } finally {
          storage.close();
        }
      } catch (err) {
        if (active) {
          setStatus('error');
          setErrorMessage(err instanceof Error ? err.message : String(err));
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [provider, repo]);

  return (
    <Box flexDirection="column" width={width} height={height}>
      <Box flexDirection="column" height={contentHeight}>
        {view === 'settings' ? (
          <VirtualList
            title="Themes"
            items={themeItems}
            width={width}
            height={contentHeight}
            isActive
            theme={theme}
            onSelect={(item) => {
              const nextConfig = {
                ...config,
                ui: {
                  ...config.ui,
                  theme: item.id,
                },
              };
              saveConfig(nextConfig);
              setConfig(nextConfig);
            }}
          />
        ) : view === 'ai' ? (
          <Box flexDirection="column" height={contentHeight}>
            <Text color="cyan">{aiMode === 'summary' ? 'AI Summary' : 'AI Review'}</Text>
            {aiStatus === 'loading' ? (
              <Text dimColor>Generating...</Text>
            ) : aiStatus === 'error' ? (
              <Text color="red">{aiError ?? 'AI request failed'}</Text>
            ) : aiEditing ? (
              <Text>{aiDraft || ' '}</Text>
            ) : (
              <Text>{aiText || ' '}</Text>
            )}
          </Box>
        ) : status === 'loading' ? (
          <Text color="cyan">Loading pull requests...</Text>
        ) : status === 'error' ? (
          <Box flexDirection="column">
            <Text color="red">Failed to load pull requests.</Text>
            {errorMessage ? <Text dimColor>{errorMessage}</Text> : null}
          </Box>
        ) : view === 'list' ? (
          <VirtualList
            title="Pull Requests"
            items={items}
            width={width}
            height={contentHeight}
            isActive={view === 'list'}
            theme={theme}
            onSelect={(_item, index) => {
              setSelectedIndex(index);
              setView('diff');
              const pr = pullRequests[index];
              if (!pr || !providerContext) {
                setDiffText(SAMPLE_DIFF);
                setDiffStatus('idle');
                setDiffError(null);
                return;
              }

              setDiffStatus('loading');
              setDiffError(null);
              const { provider: providerType, token, baseUrl, repo: repoRef } = providerContext;
              const client = createProvider({ type: providerType, token, baseUrl });
              const { owner, repo: repoName } = parseRepo(repoRef, providerType);
              client
                .getPullRequestDiff(owner, repoName, pr.number)
                .then(async (diff) => {
                  const processed = await processDiff(diff || SAMPLE_DIFF);
                  setDiffText(processed || SAMPLE_DIFF);
                  setDiffStatus('idle');
                })
                .catch((err) => {
                  setDiffText(SAMPLE_DIFF);
                  setDiffStatus('error');
                  setDiffError(err instanceof Error ? err.message : String(err));
                });
            }}
          />
        ) : (
          <DiffView
            title={`Diff Preview • ${items[selectedIndex]?.title ?? 'PR'}`}
            diffText={diffText}
            width={width}
            height={contentHeight}
            isActive
            theme={theme}
          />
        )}
      </Box>
      <Box height={2} flexDirection="column">
        {view === 'list' ? (
          <Text dimColor>
            j/k or arrows to move • / to filter • Enter to open diff • t themes • Ctrl+C to quit
          </Text>
        ) : view === 'settings' ? (
          <Text dimColor>j/k to move • Enter to apply • q to return</Text>
        ) : view === 'ai' ? (
          <Text dimColor>
            {aiMode === 'review' ? 'p post review • ' : ''}
            e edit • q back
          </Text>
        ) : (
          <Text dimColor>
            {diffStatus === 'loading' ? 'Loading diff… ' : diffStatus === 'error' ? 'Diff failed. ' : ''}
            j/k or arrows to scroll • g/G to jump • s summary • A review • q to go back • Ctrl+C to quit
          </Text>
        )}
        <Text dimColor>
          View: {view === 'list' ? 'PR List' : view === 'settings' ? 'Settings' : view === 'ai' ? 'AI' : 'Diff Preview'}
          {demoMode ? ' • Demo data' : ''}
        </Text>
        {diffError ? <Text dimColor>{diffError}</Text> : null}
      </Box>
    </Box>
  );
}
