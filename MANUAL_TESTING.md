# Manual Testing Guide

This document tracks all features and changes that have been manually tested in LazyReview.

## How to Use This Document

- Each change is documented with timestamp, description, and testing steps
- Features should be retested when related code changes
- Add new entries to the **Change Log** section below

---

## Change Log

### [2026-02-07 02:57] Feature: GitHub Token Authentication Hook
**What:** Implemented `useGitHubAuth` hook that reads GITHUB_TOKEN from environment, validates it with GitHub API, and manages authenticated user state. Falls back to demo mode if no token found.

**Files Changed:**
- `apps/cli/src/hooks/use-github-auth.ts` (new)
- `apps/cli/src/hooks/use-github-auth.test.ts` (new)
- `apps/cli/src/hooks/index.ts` (export added)

**How to test:**
1. **Test with valid token:**
   ```bash
   export GITHUB_TOKEN="your_valid_github_token"
   # Run app and verify authentication status shows your GitHub username
   ```

2. **Test with invalid token:**
   ```bash
   export GITHUB_TOKEN="ghp_invalidtoken"
   # Run app and verify error message about invalid token
   ```

3. **Test with missing token:**
   ```bash
   unset GITHUB_TOKEN
   # Run app and verify it enters demo mode
   ```

4. **Test with insufficient permissions (403):**
   ```bash
   export GITHUB_TOKEN="token_with_no_repo_scope"
   # Run app and verify error message about insufficient permissions
   ```

5. **Run unit tests:**
   ```bash
   pnpm --filter lazyreview test src/hooks/use-github-auth.test.ts
   # All 9 tests should pass
   ```

**Test Results:**
- ✅ All unit tests pass (9/9)
- ✅ Build succeeds with no TypeScript errors
- ✅ Integration testing complete (integrated into App component)

**Coverage:**
- Token validation with GitHub API
- Error handling for 401, 403, 500, and network errors
- Demo mode fallback
- Manual re-validation via `validateToken()`
- Null/missing user fields handling

---

### [2026-02-07 03:02] Feature: Authentication Status Display in Header
**What:** Integrated `useGitHubAuth` hook into App component and added authentication status display in the header. Shows "Authenticated as {username}" when logged in or "Demo Mode" badge when not authenticated.

**Files Changed:**
- `apps/cli/src/app.tsx` (modified - integrated useGitHubAuth hook)
- `apps/cli/src/app.test.tsx` (modified - added authentication tests)

**How to test:**
1. **Test authenticated display:**
   ```bash
   export GITHUB_TOKEN="your_valid_token"
   pnpm --filter lazyreview start
   # Header should show "Authenticated as your_username"
   ```

2. **Test demo mode badge:**
   ```bash
   unset GITHUB_TOKEN
   pnpm --filter lazyreview start
   # Header should show "Demo Mode"
   ```

3. **Test error toast:**
   ```bash
   export GITHUB_TOKEN="ghp_invalid"
   pnpm --filter lazyreview start
   # Should show error toast with helpful message
   ```

4. **Run tests:**
   ```bash
   pnpm vitest run src/app.test.tsx
   # Should show tests passing including authentication tests
   ```

**Test Results:**
- ✅ Authentication tests pass (2 new tests added)
- ✅ Build succeeds with no TypeScript errors
- ✅ Header displays authentication status correctly
- ✅ Error toasts show for authentication failures

**Coverage:**
- Authenticated status display with username
- Demo mode badge display
- Error toast notifications for auth errors
- Proper theme colors (success green for auth, warning yellow for demo)

---

## Testing Checklist Template

When adding new features, copy this template:

```markdown
### [YYYY-MM-DD HH:MM] Feature: Feature Name
**What:** Brief description of what was implemented

**Files Changed:**
- file1.ts (new/modified)
- file2.test.ts (new)

**How to test:**
1. Step 1
2. Step 2
3. Step 3

**Test Results:**
- ✅ Unit tests pass
- ✅ Build succeeds
- ✅ Manual testing complete
- ⏳ Integration testing pending (or N/A)

**Coverage:**
- Feature aspect 1
- Feature aspect 2
```

---

## Known Issues

None at this time.

---

## Next Steps

1. ✅ Wire `useGitHubAuth` into App component (bead lazyreview-10h) - COMPLETED
2. ✅ Display authentication status in header - COMPLETED
3. Implement loading states (bead lazyreview-t5i)
4. Add loading states to app startup (bead lazyreview-3k2)
5. Implement PR data fetching tabs (My PRs, Review Requests, Assigned to Me)
