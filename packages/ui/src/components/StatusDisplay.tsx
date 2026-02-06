import React, { ReactNode } from 'react';
import { Box, Text } from 'ink';
import { getTheme, Theme } from '../theme';

export interface ConnectionStatusProps {
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  label?: string;
  showDot?: boolean;
  theme?: Theme;
}

/**
 * Connection status indicator
 */
export function ConnectionStatus({
  status,
  label,
  showDot = true,
  theme = getTheme(),
}: ConnectionStatusProps): React.ReactElement {
  const config: Record<string, { color: string; icon: string; text: string }> = {
    connected: { color: theme.added, icon: '●', text: 'Connected' },
    disconnected: { color: theme.muted, icon: '○', text: 'Disconnected' },
    connecting: { color: theme.accent, icon: '◐', text: 'Connecting' },
    error: { color: theme.removed, icon: '●', text: 'Error' },
  };

  const { color, icon, text } = config[status] ?? config.disconnected;

  return (
    <Box gap={1}>
      {showDot && <Text color={color}>{icon}</Text>}
      <Text color={color}>{label ?? text}</Text>
    </Box>
  );
}

export interface SyncStatusProps {
  status: 'synced' | 'syncing' | 'pending' | 'error';
  lastSynced?: string;
  pendingCount?: number;
  theme?: Theme;
}

/**
 * Sync status indicator
 */
export function SyncStatus({
  status,
  lastSynced,
  pendingCount,
  theme = getTheme(),
}: SyncStatusProps): React.ReactElement {
  const config: Record<string, { color: string; icon: string; text: string }> = {
    synced: { color: theme.added, icon: '✓', text: 'Synced' },
    syncing: { color: theme.accent, icon: '⟳', text: 'Syncing' },
    pending: { color: '#e0af68', icon: '○', text: 'Pending' },
    error: { color: theme.removed, icon: '✗', text: 'Sync Error' },
  };

  const { color, icon, text } = config[status] ?? config.synced;

  return (
    <Box gap={1}>
      <Text color={color}>{icon}</Text>
      <Text color={color}>{text}</Text>
      {pendingCount !== undefined && pendingCount > 0 && (
        <Text color={theme.muted}>({pendingCount} pending)</Text>
      )}
      {lastSynced && status === 'synced' && (
        <Text color={theme.muted}>({lastSynced})</Text>
      )}
    </Box>
  );
}

export interface OnlineStatusProps {
  online: boolean;
  showLabel?: boolean;
  theme?: Theme;
}

/**
 * Online/offline status indicator
 */
export function OnlineStatus({
  online,
  showLabel = true,
  theme = getTheme(),
}: OnlineStatusProps): React.ReactElement {
  const color = online ? theme.added : theme.muted;
  const icon = online ? '●' : '○';
  const label = online ? 'Online' : 'Offline';

  return (
    <Box gap={1}>
      <Text color={color}>{icon}</Text>
      {showLabel && <Text color={color}>{label}</Text>}
    </Box>
  );
}

export interface RateLimitStatusProps {
  remaining: number;
  limit: number;
  resetTime?: string;
  theme?: Theme;
}

/**
 * API rate limit status
 */
export function RateLimitStatus({
  remaining,
  limit,
  resetTime,
  theme = getTheme(),
}: RateLimitStatusProps): React.ReactElement {
  const percentage = (remaining / limit) * 100;
  const color = percentage > 50 ? theme.added
    : percentage > 20 ? '#e0af68'
    : theme.removed;

  return (
    <Box gap={1}>
      <Text color={theme.muted}>Rate Limit:</Text>
      <Text color={color}>{remaining}/{limit}</Text>
      {resetTime && (
        <Text color={theme.muted}>(resets {resetTime})</Text>
      )}
    </Box>
  );
}

export interface CacheStatusProps {
  cached: number;
  size?: string;
  hitRate?: number;
  theme?: Theme;
}

/**
 * Cache status indicator
 */
export function CacheStatus({
  cached,
  size,
  hitRate,
  theme = getTheme(),
}: CacheStatusProps): React.ReactElement {
  return (
    <Box gap={2}>
      <Box gap={1}>
        <Text color={theme.muted}>Cache:</Text>
        <Text color={theme.accent}>{cached} items</Text>
      </Box>
      {size && (
        <Box gap={1}>
          <Text color={theme.muted}>Size:</Text>
          <Text color={theme.text}>{size}</Text>
        </Box>
      )}
      {hitRate !== undefined && (
        <Box gap={1}>
          <Text color={theme.muted}>Hit:</Text>
          <Text color={hitRate > 80 ? theme.added : theme.text}>
            {hitRate.toFixed(1)}%
          </Text>
        </Box>
      )}
    </Box>
  );
}

export interface ProviderStatusProps {
  provider: string;
  connected: boolean;
  user?: string;
  icon?: string;
  theme?: Theme;
}

/**
 * Git provider connection status
 */
export function ProviderStatus({
  provider,
  connected,
  user,
  icon,
  theme = getTheme(),
}: ProviderStatusProps): React.ReactElement {
  const statusColor = connected ? theme.added : theme.muted;
  const statusIcon = connected ? '✓' : '○';

  return (
    <Box gap={1}>
      {icon && <Text>{icon}</Text>}
      <Text color={theme.accent} bold>{provider}</Text>
      <Text color={statusColor}>{statusIcon}</Text>
      {user && connected && (
        <Text color={theme.muted}>(@{user})</Text>
      )}
    </Box>
  );
}

export interface BuildStatusProps {
  status: 'success' | 'failure' | 'pending' | 'running' | 'cancelled' | 'skipped';
  label?: string;
  theme?: Theme;
}

/**
 * CI/CD build status
 */
export function BuildStatus({
  status,
  label,
  theme = getTheme(),
}: BuildStatusProps): React.ReactElement {
  const config: Record<string, { color: string; icon: string }> = {
    success: { color: theme.added, icon: '✓' },
    failure: { color: theme.removed, icon: '✗' },
    pending: { color: '#e0af68', icon: '○' },
    running: { color: theme.accent, icon: '⟳' },
    cancelled: { color: theme.muted, icon: '⊘' },
    skipped: { color: theme.muted, icon: '⊘' },
  };

  const { color, icon } = config[status] ?? config.pending;

  return (
    <Box gap={1}>
      <Text color={color}>{icon}</Text>
      <Text color={color}>{label ?? status}</Text>
    </Box>
  );
}

export interface HealthCheckProps {
  checks: Array<{
    name: string;
    status: 'healthy' | 'unhealthy' | 'checking';
    message?: string;
  }>;
  theme?: Theme;
}

/**
 * System health check display
 */
export function HealthCheck({
  checks,
  theme = getTheme(),
}: HealthCheckProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      {checks.map((check, index) => {
        const color = check.status === 'healthy' ? theme.added
          : check.status === 'unhealthy' ? theme.removed
          : theme.accent;
        const icon = check.status === 'healthy' ? '✓'
          : check.status === 'unhealthy' ? '✗'
          : '○';

        return (
          <Box key={index} gap={1}>
            <Text color={color}>{icon}</Text>
            <Text color={theme.text}>{check.name}</Text>
            {check.message && (
              <Text color={theme.muted}>- {check.message}</Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

export interface VersionInfoProps {
  version: string;
  update?: {
    available: boolean;
    version?: string;
  };
  theme?: Theme;
}

/**
 * Version and update status
 */
export function VersionInfo({
  version,
  update,
  theme = getTheme(),
}: VersionInfoProps): React.ReactElement {
  return (
    <Box gap={2}>
      <Text color={theme.muted}>v{version}</Text>
      {update?.available && (
        <Box gap={1}>
          <Text color={theme.accent}>↑</Text>
          <Text color={theme.accent}>{update.version} available</Text>
        </Box>
      )}
    </Box>
  );
}

export interface QuotaStatusProps {
  used: number;
  total: number;
  label?: string;
  unit?: string;
  theme?: Theme;
}

/**
 * Usage quota status
 */
export function QuotaStatus({
  used,
  total,
  label = 'Usage',
  unit = '',
  theme = getTheme(),
}: QuotaStatusProps): React.ReactElement {
  const percentage = (used / total) * 100;
  const color = percentage < 75 ? theme.added
    : percentage < 90 ? '#e0af68'
    : theme.removed;

  return (
    <Box gap={1}>
      <Text color={theme.muted}>{label}:</Text>
      <Text color={color}>
        {used}{unit}/{total}{unit}
      </Text>
      <Text color={theme.muted}>({percentage.toFixed(0)}%)</Text>
    </Box>
  );
}

export interface StatusRowProps {
  label: string;
  value: ReactNode;
  icon?: string;
  color?: string;
  theme?: Theme;
}

/**
 * Generic status row
 */
export function StatusRow({
  label,
  value,
  icon,
  color,
  theme = getTheme(),
}: StatusRowProps): React.ReactElement {
  return (
    <Box gap={1}>
      {icon && <Text color={color ?? theme.muted}>{icon}</Text>}
      <Text color={theme.muted}>{label}:</Text>
      {typeof value === 'string' ? (
        <Text color={color ?? theme.text}>{value}</Text>
      ) : (
        value
      )}
    </Box>
  );
}
