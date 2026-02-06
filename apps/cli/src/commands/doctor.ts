/**
 * Doctor Command
 *
 * Checks system health and diagnoses common issues.
 */

import { loadConfig, readToken, defaultProviderHost, type ProviderType } from '@lazyreview/core';
import { LazyReviewStorage } from '@lazyreview/storage';

interface CheckResult {
  name: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
  fix?: string;
}

const PROVIDERS: ProviderType[] = ['github', 'gitlab', 'bitbucket', 'azuredevops'];

async function checkNodeVersion(): Promise<CheckResult> {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0] ?? '0', 10);

  if (major >= 20) {
    return {
      name: 'Node.js Version',
      status: 'ok',
      message: `${version} (supported)`,
    };
  } else if (major >= 18) {
    return {
      name: 'Node.js Version',
      status: 'warn',
      message: `${version} (works, but Node 20+ recommended)`,
      fix: 'Consider upgrading to Node.js 20 LTS',
    };
  } else {
    return {
      name: 'Node.js Version',
      status: 'error',
      message: `${version} (unsupported)`,
      fix: 'Upgrade to Node.js 20 LTS or later',
    };
  }
}

async function checkConfig(): Promise<CheckResult> {
  try {
    const config = loadConfig();
    const issues: string[] = [];

    if (!config.defaultProvider) {
      issues.push('No default provider set');
    }

    if (!config.providers || config.providers.length === 0) {
      issues.push('No providers configured');
    }

    if (issues.length > 0) {
      return {
        name: 'Configuration',
        status: 'warn',
        message: issues.join(', '),
        fix: 'Run: lazyreview config edit',
      };
    }

    return {
      name: 'Configuration',
      status: 'ok',
      message: `Default provider: ${config.defaultProvider || 'github'}`,
    };
  } catch (error) {
    return {
      name: 'Configuration',
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to load config',
      fix: 'Check ~/.config/lazyreview/config.yaml for syntax errors',
    };
  }
}

async function checkAuth(): Promise<CheckResult> {
  const authenticated: string[] = [];
  const missing: string[] = [];

  for (const provider of PROVIDERS) {
    const host = defaultProviderHost(provider);
    const token = await readToken(provider, host);
    if (token) {
      authenticated.push(provider);
    } else {
      missing.push(provider);
    }
  }

  if (authenticated.length === 0) {
    return {
      name: 'Authentication',
      status: 'error',
      message: 'No providers authenticated',
      fix: 'Run: lazyreview auth login --provider github',
    };
  }

  if (missing.length > 0 && missing.length < PROVIDERS.length) {
    return {
      name: 'Authentication',
      status: 'ok',
      message: `Authenticated: ${authenticated.join(', ')}`,
    };
  }

  return {
    name: 'Authentication',
    status: 'ok',
    message: `All providers authenticated`,
  };
}

async function checkStorage(): Promise<CheckResult> {
  try {
    const storage = LazyReviewStorage.open();
    storage.close();
    return {
      name: 'Storage',
      status: 'ok',
      message: 'SQLite database accessible',
    };
  } catch (error) {
    return {
      name: 'Storage',
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to access storage',
      fix: 'Check if ~/.local/share/lazyreview/ is writable',
    };
  }
}

async function checkNetwork(): Promise<CheckResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('https://api.github.com/zen', {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.ok) {
      return {
        name: 'Network',
        status: 'ok',
        message: 'Internet connectivity verified',
      };
    } else {
      return {
        name: 'Network',
        status: 'warn',
        message: `API returned ${response.status}`,
        fix: 'Check your network connection or firewall settings',
      };
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        name: 'Network',
        status: 'warn',
        message: 'Network request timed out',
        fix: 'Check your internet connection',
      };
    }
    return {
      name: 'Network',
      status: 'warn',
      message: error instanceof Error ? error.message : 'Network check failed',
      fix: 'Check your internet connection',
    };
  }
}

function formatResult(result: CheckResult): string {
  const icons = {
    ok: '✓',
    warn: '⚠',
    error: '✗',
  };
  const colors = {
    ok: '\x1b[32m', // green
    warn: '\x1b[33m', // yellow
    error: '\x1b[31m', // red
  };
  const reset = '\x1b[0m';

  let line = `${colors[result.status]}${icons[result.status]}${reset} ${result.name}: ${result.message}`;
  if (result.fix) {
    line += `\n    Fix: ${result.fix}`;
  }
  return line;
}

export async function runDoctor(): Promise<void> {
  console.log('\nLazyReview Doctor');
  console.log('═════════════════\n');

  const checks = [
    checkNodeVersion(),
    checkConfig(),
    checkAuth(),
    checkStorage(),
    checkNetwork(),
  ];

  const results = await Promise.all(checks);
  let hasErrors = false;
  let hasWarnings = false;

  for (const result of results) {
    console.log(formatResult(result));
    if (result.status === 'error') hasErrors = true;
    if (result.status === 'warn') hasWarnings = true;
  }

  console.log();

  if (hasErrors) {
    console.log('\x1b[31m✗ Some checks failed. Please fix the issues above.\x1b[0m\n');
    process.exitCode = 1;
  } else if (hasWarnings) {
    console.log('\x1b[33m⚠ Some warnings detected. Review the suggestions above.\x1b[0m\n');
  } else {
    console.log('\x1b[32m✓ All checks passed. LazyReview is ready to use!\x1b[0m\n');
  }
}
