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
- ⏳ Integration testing pending (needs UI integration in next bead)

**Coverage:**
- Token validation with GitHub API
- Error handling for 401, 403, 500, and network errors
- Demo mode fallback
- Manual re-validation via `validateToken()`
- Null/missing user fields handling

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

1. Wire `useGitHubAuth` into App component (bead lazyreview-10h)
2. Display authentication status in header
3. Add loading states for authentication process
