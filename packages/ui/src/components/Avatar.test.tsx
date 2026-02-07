import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { Avatar, AvatarGroup, UserBadge, ReviewerList, AuthorInfo } from './Avatar';

describe('Avatar', () => {
  it('shows initials from first and last name', () => {
    const { lastFrame } = render(<Avatar name="John Doe" />);

    expect(lastFrame()).toContain('JD');
  });

  it('shows single initial for single name', () => {
    const { lastFrame } = render(<Avatar name="Alice" />);

    expect(lastFrame()).toContain('A');
  });

  it('handles empty name', () => {
    const { lastFrame } = render(<Avatar name="" />);

    expect(lastFrame()).toContain('?');
  });

  it('handles multi-word names', () => {
    const { lastFrame } = render(<Avatar name="John Michael Doe" />);

    // Should use first and last
    expect(lastFrame()).toContain('JD');
  });

  it('shows dot when initials disabled', () => {
    const { lastFrame } = render(
      <Avatar name="John Doe" showInitials={false} />
    );

    expect(lastFrame()).toContain('●');
    expect(lastFrame()).not.toContain('JD');
  });
});

describe('AvatarGroup', () => {
  const users = [
    { name: 'Alice' },
    { name: 'Bob' },
    { name: 'Charlie' },
    { name: 'Diana' },
    { name: 'Eve' },
    { name: 'Frank' },
  ];

  it('renders multiple avatars', () => {
    const { lastFrame } = render(<AvatarGroup users={users} max={6} />);

    expect(lastFrame()).toContain('A');
    expect(lastFrame()).toContain('B');
    expect(lastFrame()).toContain('C');
  });

  it('shows overflow indicator', () => {
    const { lastFrame } = render(<AvatarGroup users={users} max={3} />);

    expect(lastFrame()).toContain('+3');
  });

  it('limits visible avatars', () => {
    const { lastFrame } = render(<AvatarGroup users={users} max={2} />);

    // Should show first 2 plus overflow
    expect(lastFrame()).toContain('+4');
  });

  it('shows no overflow when within limit', () => {
    const { lastFrame } = render(<AvatarGroup users={users.slice(0, 3)} max={5} />);

    expect(lastFrame()).not.toContain('+');
  });
});

describe('UserBadge', () => {
  it('renders username with @ symbol', () => {
    const { lastFrame } = render(<UserBadge username="johndoe" />);

    expect(lastFrame()).toContain('@johndoe');
  });

  it('shows avatar by default', () => {
    const { lastFrame } = render(<UserBadge username="alice" name="Alice" />);

    expect(lastFrame()).toContain('A');
    expect(lastFrame()).toContain('@alice');
  });

  it('hides avatar when disabled', () => {
    const { lastFrame } = render(
      <UserBadge username="alice" name="Alice" showAvatar={false} />
    );

    expect(lastFrame()).toContain('@alice');
    // Avatar initial should not be prominent
  });
});

describe('ReviewerList', () => {
  const reviewers = [
    { username: 'alice', state: 'approved' as const },
    { username: 'bob', state: 'changes_requested' as const },
    { username: 'charlie', state: 'commented' as const },
    { username: 'diana', state: 'pending' as const },
  ];

  it('renders all reviewers', () => {
    const { lastFrame } = render(<ReviewerList reviewers={reviewers} />);

    expect(lastFrame()).toContain('@alice');
    expect(lastFrame()).toContain('@bob');
    expect(lastFrame()).toContain('@charlie');
    expect(lastFrame()).toContain('@diana');
  });

  it('shows approved indicator', () => {
    const { lastFrame } = render(
      <ReviewerList reviewers={[{ username: 'alice', state: 'approved' }]} />
    );

    expect(lastFrame()).toContain('✓');
  });

  it('shows changes requested indicator', () => {
    const { lastFrame } = render(
      <ReviewerList reviewers={[{ username: 'bob', state: 'changes_requested' }]} />
    );

    expect(lastFrame()).toContain('✗');
  });

  it('shows commented indicator', () => {
    const { lastFrame } = render(
      <ReviewerList reviewers={[{ username: 'charlie', state: 'commented' }]} />
    );

    expect(lastFrame()).toContain('💬');
  });

  it('shows pending indicator', () => {
    const { lastFrame } = render(
      <ReviewerList reviewers={[{ username: 'diana', state: 'pending' }]} />
    );

    expect(lastFrame()).toContain('○');
  });
});

describe('AuthorInfo', () => {
  it('renders username', () => {
    const { lastFrame } = render(<AuthorInfo username="johndoe" />);

    expect(lastFrame()).toContain('@johndoe');
  });

  it('renders timestamp', () => {
    const { lastFrame } = render(
      <AuthorInfo username="alice" timestamp="2 hours ago" />
    );

    expect(lastFrame()).toContain('2 hours ago');
  });

  it('renders action', () => {
    const { lastFrame } = render(
      <AuthorInfo username="bob" action="commented" />
    );

    expect(lastFrame()).toContain('commented');
  });

  it('uses name for avatar when provided', () => {
    const { lastFrame } = render(
      <AuthorInfo username="jd" name="John Doe" />
    );

    expect(lastFrame()).toContain('J');
    expect(lastFrame()).toContain('@jd');
  });

  it('renders full info', () => {
    const { lastFrame } = render(
      <AuthorInfo
        username="alice"
        name="Alice Smith"
        action="approved"
        timestamp="1 day ago"
      />
    );

    expect(lastFrame()).toContain('A');
    expect(lastFrame()).toContain('@alice');
    expect(lastFrame()).toContain('approved');
    expect(lastFrame()).toContain('1 day ago');
  });
});
