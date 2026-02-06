import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import {
  ConnectionStatus,
  SyncStatus,
  OnlineStatus,
  RateLimitStatus,
  CacheStatus,
  ProviderStatus,
  BuildStatus,
  HealthCheck,
  VersionInfo,
  QuotaStatus,
  StatusRow,
} from './StatusDisplay';
import { Text } from 'ink';

describe('ConnectionStatus', () => {
  it('shows connected status', () => {
    const { lastFrame } = render(<ConnectionStatus status="connected" />);

    expect(lastFrame()).toContain('●');
    expect(lastFrame()).toContain('Connected');
  });

  it('shows disconnected status', () => {
    const { lastFrame } = render(<ConnectionStatus status="disconnected" />);

    expect(lastFrame()).toContain('○');
    expect(lastFrame()).toContain('Disconnected');
  });

  it('shows connecting status', () => {
    const { lastFrame } = render(<ConnectionStatus status="connecting" />);

    expect(lastFrame()).toContain('Connecting');
  });

  it('shows error status', () => {
    const { lastFrame } = render(<ConnectionStatus status="error" />);

    expect(lastFrame()).toContain('Error');
  });

  it('shows custom label', () => {
    const { lastFrame } = render(
      <ConnectionStatus status="connected" label="GitHub" />
    );

    expect(lastFrame()).toContain('GitHub');
  });

  it('hides dot when disabled', () => {
    const { lastFrame } = render(
      <ConnectionStatus status="connected" showDot={false} />
    );

    expect(lastFrame()).not.toContain('●');
  });
});

describe('SyncStatus', () => {
  it('shows synced status', () => {
    const { lastFrame } = render(<SyncStatus status="synced" />);

    expect(lastFrame()).toContain('✓');
    expect(lastFrame()).toContain('Synced');
  });

  it('shows syncing status', () => {
    const { lastFrame } = render(<SyncStatus status="syncing" />);

    expect(lastFrame()).toContain('⟳');
    expect(lastFrame()).toContain('Syncing');
  });

  it('shows pending count', () => {
    const { lastFrame } = render(
      <SyncStatus status="pending" pendingCount={5} />
    );

    expect(lastFrame()).toContain('5 pending');
  });

  it('shows last synced time', () => {
    const { lastFrame } = render(
      <SyncStatus status="synced" lastSynced="2 min ago" />
    );

    expect(lastFrame()).toContain('2 min ago');
  });

  it('shows error status', () => {
    const { lastFrame } = render(<SyncStatus status="error" />);

    expect(lastFrame()).toContain('✗');
    expect(lastFrame()).toContain('Sync Error');
  });
});

describe('OnlineStatus', () => {
  it('shows online status', () => {
    const { lastFrame } = render(<OnlineStatus online={true} />);

    expect(lastFrame()).toContain('●');
    expect(lastFrame()).toContain('Online');
  });

  it('shows offline status', () => {
    const { lastFrame } = render(<OnlineStatus online={false} />);

    expect(lastFrame()).toContain('○');
    expect(lastFrame()).toContain('Offline');
  });

  it('hides label when disabled', () => {
    const { lastFrame } = render(
      <OnlineStatus online={true} showLabel={false} />
    );

    expect(lastFrame()).toContain('●');
    expect(lastFrame()).not.toContain('Online');
  });
});

describe('RateLimitStatus', () => {
  it('shows rate limit counts', () => {
    const { lastFrame } = render(
      <RateLimitStatus remaining={4500} limit={5000} />
    );

    expect(lastFrame()).toContain('4500/5000');
  });

  it('shows reset time', () => {
    const { lastFrame } = render(
      <RateLimitStatus remaining={100} limit={5000} resetTime="in 30 min" />
    );

    expect(lastFrame()).toContain('resets in 30 min');
  });

  it('shows label', () => {
    const { lastFrame } = render(
      <RateLimitStatus remaining={100} limit={5000} />
    );

    expect(lastFrame()).toContain('Rate Limit:');
  });
});

describe('CacheStatus', () => {
  it('shows cached item count', () => {
    const { lastFrame } = render(<CacheStatus cached={150} />);

    expect(lastFrame()).toContain('150 items');
  });

  it('shows cache size', () => {
    const { lastFrame } = render(
      <CacheStatus cached={150} size="2.5 MB" />
    );

    expect(lastFrame()).toContain('2.5 MB');
  });

  it('shows hit rate', () => {
    const { lastFrame } = render(
      <CacheStatus cached={150} hitRate={85.5} />
    );

    expect(lastFrame()).toContain('85.5%');
  });
});

describe('ProviderStatus', () => {
  it('shows provider name', () => {
    const { lastFrame } = render(
      <ProviderStatus provider="GitHub" connected={true} />
    );

    expect(lastFrame()).toContain('GitHub');
    expect(lastFrame()).toContain('✓');
  });

  it('shows disconnected status', () => {
    const { lastFrame } = render(
      <ProviderStatus provider="GitLab" connected={false} />
    );

    expect(lastFrame()).toContain('GitLab');
    expect(lastFrame()).toContain('○');
  });

  it('shows user when connected', () => {
    const { lastFrame } = render(
      <ProviderStatus provider="GitHub" connected={true} user="johndoe" />
    );

    expect(lastFrame()).toContain('@johndoe');
  });

  it('shows icon when provided', () => {
    const { lastFrame } = render(
      <ProviderStatus provider="GitHub" connected={true} icon="🐙" />
    );

    expect(lastFrame()).toContain('🐙');
  });
});

describe('BuildStatus', () => {
  it('shows success status', () => {
    const { lastFrame } = render(<BuildStatus status="success" />);

    expect(lastFrame()).toContain('✓');
    expect(lastFrame()).toContain('success');
  });

  it('shows failure status', () => {
    const { lastFrame } = render(<BuildStatus status="failure" />);

    expect(lastFrame()).toContain('✗');
    expect(lastFrame()).toContain('failure');
  });

  it('shows running status', () => {
    const { lastFrame } = render(<BuildStatus status="running" />);

    expect(lastFrame()).toContain('⟳');
    expect(lastFrame()).toContain('running');
  });

  it('shows custom label', () => {
    const { lastFrame } = render(
      <BuildStatus status="success" label="CI Passed" />
    );

    expect(lastFrame()).toContain('CI Passed');
  });
});

describe('HealthCheck', () => {
  const checks = [
    { name: 'API', status: 'healthy' as const },
    { name: 'Database', status: 'unhealthy' as const, message: 'Connection timeout' },
    { name: 'Cache', status: 'checking' as const },
  ];

  it('shows all checks', () => {
    const { lastFrame } = render(<HealthCheck checks={checks} />);

    expect(lastFrame()).toContain('API');
    expect(lastFrame()).toContain('Database');
    expect(lastFrame()).toContain('Cache');
  });

  it('shows status icons', () => {
    const { lastFrame } = render(<HealthCheck checks={checks} />);

    expect(lastFrame()).toContain('✓');
    expect(lastFrame()).toContain('✗');
  });

  it('shows error message', () => {
    const { lastFrame } = render(<HealthCheck checks={checks} />);

    expect(lastFrame()).toContain('Connection timeout');
  });
});

describe('VersionInfo', () => {
  it('shows version', () => {
    const { lastFrame } = render(<VersionInfo version="1.0.0" />);

    expect(lastFrame()).toContain('v1.0.0');
  });

  it('shows update available', () => {
    const { lastFrame } = render(
      <VersionInfo
        version="1.0.0"
        update={{ available: true, version: '1.1.0' }}
      />
    );

    expect(lastFrame()).toContain('1.1.0 available');
    expect(lastFrame()).toContain('↑');
  });

  it('hides update when not available', () => {
    const { lastFrame } = render(
      <VersionInfo
        version="1.0.0"
        update={{ available: false }}
      />
    );

    expect(lastFrame()).not.toContain('available');
  });
});

describe('QuotaStatus', () => {
  it('shows usage', () => {
    const { lastFrame } = render(
      <QuotaStatus used={50} total={100} />
    );

    expect(lastFrame()).toContain('50/100');
    expect(lastFrame()).toContain('50%');
  });

  it('shows custom label', () => {
    const { lastFrame } = render(
      <QuotaStatus used={50} total={100} label="Storage" />
    );

    expect(lastFrame()).toContain('Storage:');
  });

  it('shows unit', () => {
    const { lastFrame } = render(
      <QuotaStatus used={5} total={10} unit="GB" />
    );

    expect(lastFrame()).toContain('5GB/10GB');
  });
});

describe('StatusRow', () => {
  it('renders label and value', () => {
    const { lastFrame } = render(
      <StatusRow label="Status" value="Active" />
    );

    expect(lastFrame()).toContain('Status:');
    expect(lastFrame()).toContain('Active');
  });

  it('renders icon when provided', () => {
    const { lastFrame } = render(
      <StatusRow label="Status" value="Active" icon="●" />
    );

    expect(lastFrame()).toContain('●');
  });

  it('renders ReactNode value', () => {
    const { lastFrame } = render(
      <StatusRow label="Status" value={<Text bold>Custom</Text>} />
    );

    expect(lastFrame()).toContain('Custom');
  });
});
