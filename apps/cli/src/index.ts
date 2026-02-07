#!/usr/bin/env node
import { Command } from 'commander';
import { runTui } from './run';
import { listPullRequests } from './commands/prList';
import { enqueueAction, listQueue, syncQueue } from './commands/queue';
import { login, logout, status as authStatus } from './commands/auth';
import { configPath, editConfig, showConfig } from './commands/config';
import { aiLogin, aiLogout, aiStatus } from './commands/ai';
import { prApprove, prComment, prRequestChanges } from './commands/prActions';
import { showKeys } from './commands/keys';
import { runDoctor } from './commands/doctor';
import { enableDebug, debug } from './utils/debug';

// Get version from package.json
const VERSION = '0.1.0-alpha.1';

const program = new Command();

program
  .name('lazyreview')
  .description('A terminal UI for code review across multiple Git providers')
  .version(VERSION)
  .option('-d, --debug', 'Enable debug output')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.debug) {
      enableDebug();
      debug('Debug mode enabled');
      debug(`Version: ${VERSION}`);
      debug(`Node version: ${process.version}`);
      debug(`Platform: ${process.platform} ${process.arch}`);
    }
  });

program
  .command('start')
  .description('Start the LazyReview TUI')
  .option('-p, --provider <provider>', 'Provider type')
  .option('-r, --repo <owner/name>', 'Repository for initial PR list')
  .action(async (options: { provider?: string; repo?: string }) => {
    debug('Starting TUI', options);
    await runTui({ provider: options.provider, repo: options.repo });
  });

program
  .command('doctor')
  .description('Check system health and diagnose issues')
  .action(async () => {
    debug('Running doctor checks');
    await runDoctor();
  });

program
  .command('keys')
  .description('Show keyboard shortcuts')
  .option('--vim', 'Show vim-style keybindings (default)')
  .option('--standard', 'Show standard keybindings')
  .action((options: { vim?: boolean; standard?: boolean }) => {
    debug('Showing keybindings', options);
    showKeys(options);
  });

const prCommand = program.command('pr').description('Pull request commands');

prCommand
  .command('list')
  .description('List pull requests for a repository')
  .requiredOption('-r, --repo <owner/name>', 'Repository in owner/name format')
  .option('-p, --provider <provider>', 'Provider type (github, gitlab, bitbucket, azuredevops)')
  .option('-l, --limit <number>', 'Max number of PRs to fetch', '20')
  .option('-s, --state <state>', 'PR state (open, closed, all)')
  .option('--json', 'Output JSON', false)
  .action(
    async (options: {
      repo: string;
      provider?: string;
      limit: string;
      json: boolean;
      state?: 'open' | 'closed' | 'all';
    }) => {
      try {
        debug('Listing PRs', options);
        await listPullRequests({
          repo: options.repo,
          provider: options.provider,
          limit: Number(options.limit),
          json: options.json,
          state: options.state,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`lazyreview: ${message}`);
        process.exitCode = 1;
      }
    }
  );

prCommand
  .command('approve')
  .description('Approve a pull request')
  .requiredOption('-r, --repo <owner/name>', 'Repository in owner/name format')
  .requiredOption('-n, --number <number>', 'Pull request number')
  .option('-p, --provider <provider>', 'Provider type (github, gitlab, bitbucket, azuredevops)')
  .option('-b, --body <body>', 'Optional review body')
  .action(async (options: { repo: string; number: string; provider?: string; body?: string }) => {
    try {
      debug('Approving PR', options);
      await prApprove({
        repo: options.repo,
        number: Number(options.number),
        provider: options.provider,
        body: options.body,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`lazyreview: ${message}`);
      process.exitCode = 1;
    }
  });

prCommand
  .command('request-changes')
  .description('Request changes on a pull request')
  .requiredOption('-r, --repo <owner/name>', 'Repository in owner/name format')
  .requiredOption('-n, --number <number>', 'Pull request number')
  .option('-p, --provider <provider>', 'Provider type (github, gitlab, bitbucket, azuredevops)')
  .option('-b, --body <body>', 'Optional review body')
  .action(async (options: { repo: string; number: string; provider?: string; body?: string }) => {
    try {
      debug('Requesting changes', options);
      await prRequestChanges({
        repo: options.repo,
        number: Number(options.number),
        provider: options.provider,
        body: options.body,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`lazyreview: ${message}`);
      process.exitCode = 1;
    }
  });

prCommand
  .command('comment')
  .description('Add a comment to a pull request')
  .requiredOption('-r, --repo <owner/name>', 'Repository in owner/name format')
  .requiredOption('-n, --number <number>', 'Pull request number')
  .requiredOption('-b, --body <body>', 'Comment body')
  .option('-p, --provider <provider>', 'Provider type (github, gitlab, bitbucket, azuredevops)')
  .option('--path <path>', 'File path for inline comment')
  .option('--line <line>', 'Line number for inline comment')
  .option('--side <side>', 'Diff side (LEFT or RIGHT)')
  .action(
    async (options: {
      repo: string;
      number: string;
      provider?: string;
      body: string;
      path?: string;
      line?: string;
      side?: 'LEFT' | 'RIGHT';
    }) => {
      try {
        debug('Adding comment', options);
        await prComment({
          repo: options.repo,
          number: Number(options.number),
          provider: options.provider,
          body: options.body,
          path: options.path,
          line: options.line ? Number(options.line) : undefined,
          side: options.side,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`lazyreview: ${message}`);
        process.exitCode = 1;
      }
    }
  );

const queueCommand = program.command('queue').description('Offline queue commands');

queueCommand
  .command('list')
  .description('List queued offline actions')
  .option('-l, --limit <number>', 'Max number of actions to show', '50')
  .action((options: { limit: string }) => {
    debug('Listing queue', options);
    listQueue({ limit: Number(options.limit) });
  });

queueCommand
  .command('enqueue')
  .description('Queue a test action (for validation only)')
  .requiredOption('--type <type>', 'Action type (approve, comment, etc.)')
  .requiredOption('--provider <provider>', 'Provider type (github, gitlab, bitbucket, azuredevops)')
  .requiredOption('--host <host>', 'Provider host (e.g. api.github.com)')
  .requiredOption('--owner <owner>', 'Repository owner')
  .requiredOption('--repo <repo>', 'Repository name')
  .requiredOption('--pr <number>', 'Pull request number')
  .option('--payload <json>', 'JSON payload')
  .action(
    (options: {
      type: string;
      provider: string;
      host: string;
      owner: string;
      repo: string;
      pr: string;
      payload?: string;
    }) => {
      debug('Enqueuing action', options);
      enqueueAction({
        type: options.type,
        providerType: options.provider,
        host: options.host,
        owner: options.owner,
        repo: options.repo,
        prNumber: Number(options.pr),
        payload: options.payload,
      });
    }
  );

queueCommand
  .command('sync')
  .description('Replay queued offline actions')
  .option('-l, --limit <number>', 'Max number of actions to process', '50')
  .action(async (options: { limit: string }) => {
    try {
      debug('Syncing queue', options);
      await syncQueue({ limit: Number(options.limit) });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`lazyreview: ${message}`);
      process.exitCode = 1;
    }
  });

const authCommand = program.command('auth').description('Authentication commands');

authCommand
  .command('login')
  .description('Store provider token')
  .option('-p, --provider <provider>', 'Provider type (github, gitlab, bitbucket, azuredevops)')
  .option('--host <host>', 'Provider host override')
  .option('-t, --token <token>', 'Token (or set LAZYREVIEW_TOKEN)')
  .action(async (options: { provider?: string; host?: string; token?: string }) => {
    try {
      debug('Auth login', options);
      await login(options.provider, options.host, options.token);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`lazyreview: ${message}`);
      process.exitCode = 1;
    }
  });

authCommand
  .command('logout')
  .description('Remove stored provider token')
  .option('-p, --provider <provider>', 'Provider type (github, gitlab, bitbucket, azuredevops)')
  .option('--host <host>', 'Provider host override')
  .option('--all', 'Remove all stored credentials')
  .action(async (options: { provider?: string; host?: string; all?: boolean }) => {
    try {
      debug('Auth logout', options);
      await logout(options.provider, options.host);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`lazyreview: ${message}`);
      process.exitCode = 1;
    }
  });

authCommand
  .command('status')
  .description('Show auth status')
  .option('-p, --provider <provider>', 'Provider type (github, gitlab, bitbucket, azuredevops)')
  .option('--host <host>', 'Provider host override')
  .action(async (options: { provider?: string; host?: string }) => {
    try {
      debug('Auth status', options);
      await authStatus(options.provider, options.host);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`lazyreview: ${message}`);
      process.exitCode = 1;
    }
  });

const configCommand = program.command('config').description('Configuration commands');

configCommand
  .command('show')
  .description('Show current configuration')
  .action(() => {
    debug('Showing config');
    showConfig();
  });

configCommand
  .command('path')
  .description('Show config path')
  .action(() => {
    debug('Showing config path');
    configPath();
  });

configCommand
  .command('edit')
  .description('Edit config file')
  .action(() => {
    debug('Editing config');
    editConfig();
  });

const aiCommand = program.command('ai').description('AI provider commands');

aiCommand
  .command('login')
  .description('Store AI API key')
  .option('-p, --provider <provider>', 'AI provider (openai, anthropic, ollama)')
  .option('-k, --key <key>', 'API key (or set LAZYREVIEW_AI_API_KEY)')
  .action(async (options: { provider?: string; key?: string }) => {
    try {
      debug('AI login', options);
      await aiLogin(options.provider, options.key);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`lazyreview: ${message}`);
      process.exitCode = 1;
    }
  });

aiCommand
  .command('logout')
  .description('Remove stored AI API key')
  .option('-p, --provider <provider>', 'AI provider (openai, anthropic, ollama)')
  .action(async (options: { provider?: string }) => {
    try {
      debug('AI logout', options);
      await aiLogout(options.provider);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`lazyreview: ${message}`);
      process.exitCode = 1;
    }
  });

aiCommand
  .command('status')
  .description('Show AI provider status')
  .option('-p, --provider <provider>', 'AI provider (openai, anthropic, ollama)')
  .action(async (options: { provider?: string }) => {
    try {
      debug('AI status', options);
      await aiStatus(options.provider);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`lazyreview: ${message}`);
      process.exitCode = 1;
    }
  });

// Default action: start TUI
program.action(async () => {
  debug('Starting TUI (default action)');
  await runTui();
});

program.parseAsync(process.argv);
