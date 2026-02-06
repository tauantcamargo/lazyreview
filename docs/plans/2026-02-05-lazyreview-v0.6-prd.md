# LazyReview v0.6 Product Requirements Document

**Version:** 0.6.0
**Author:** Product Owner
**Date:** 2026-02-05
**Status:** Draft

---

## Executive Summary

LazyReview v0.6 represents a major evolution of the terminal-based code review application, focusing on three key areas: completing Phase 10 polish and performance improvements, expanding AI-powered code review capabilities to support multiple providers, and delivering a comprehensive TUI overhaul with new views, better performance, and enhanced user experience.

This release aims to transform LazyReview from a functional GitHub-focused tool (v0.5.1) into a polished, multi-provider, AI-enhanced code review powerhouse that rivals desktop applications in capability while maintaining the speed and efficiency of a terminal interface.

### Key Deliverables

1. **Phase 10 Completion**: Self-update mechanism, improved error handling, optimized caching
2. **Multi-Provider AI Review**: Support for OpenAI, Anthropic Claude, and local models (Ollama)
3. **TUI Overhaul**: Virtual scrolling, new theme system, split diff view, analytics dashboard

---

## Goals & Success Metrics

### Primary Goals

| Goal | Description | Success Metric |
|------|-------------|----------------|
| Performance | Sub-100ms navigation on large PR lists (1000+ PRs) | P95 navigation latency < 100ms |
| AI Adoption | Increase AI-assisted reviews by users | 40% of reviews use AI suggestions |
| User Satisfaction | Improve overall user experience | NPS score > 50 |
| Reliability | Zero data loss, graceful degradation | 99.9% uptime, 0 data loss incidents |

### Secondary Goals

| Goal | Description | Success Metric |
|------|-------------|----------------|
| Multi-Provider AI | Support 3+ AI providers | OpenAI, Anthropic, Ollama working |
| Theme Adoption | Users customize their experience | 30% use non-default themes |
| Analytics Engagement | Teams use review analytics | 25% enable analytics dashboard |

---

## User Stories

### Phase 10 Completion

#### US-001: Self-Update Mechanism
**As a** LazyReview user
**I want to** update the application from within the TUI
**So that** I can stay on the latest version without manual downloads

**Acceptance Criteria:**
- [ ] User can check for updates with a keyboard shortcut (`U`)
- [ ] Update notification appears when new version available
- [ ] User can download and apply update with confirmation
- [ ] Rollback mechanism available if update fails
- [ ] Update respects system package manager when applicable

#### US-002: Actionable Error Messages
**As a** user encountering an error
**I want to** receive clear guidance on how to fix it
**So that** I can resolve issues without searching documentation

**Acceptance Criteria:**
- [ ] All errors include human-readable message
- [ ] Errors provide numbered list of suggested fixes
- [ ] Relevant documentation links included where applicable
- [ ] Errors distinguish between user-fixable and system issues
- [ ] Error codes provided for support reference

#### US-003: Optimized API Caching
**As a** power user reviewing many PRs
**I want to** have intelligent caching that reduces API calls
**So that** the application feels instant and I don't hit rate limits

**Acceptance Criteria:**
- [ ] Cache invalidation on meaningful events (new comment, status change)
- [ ] Background refresh keeps data fresh without blocking UI
- [ ] Cache persists across sessions (SQLite backing)
- [ ] User can force-refresh with `R` key
- [ ] Cache statistics visible in debug mode

### AI-Powered Code Review Expansion

#### US-004: Multi-Provider AI Support
**As a** user with different AI service subscriptions
**I want to** choose my preferred AI provider
**So that** I can use the model that best fits my needs and budget

**Acceptance Criteria:**
- [ ] Support for OpenAI (GPT-4, GPT-4-turbo, GPT-3.5-turbo)
- [ ] Support for Anthropic (Claude 3 Opus, Sonnet, Haiku)
- [ ] Support for local models via Ollama (Llama, Mistral, CodeLlama)
- [ ] Provider configuration in config.yaml
- [ ] Runtime provider switching without restart

#### US-005: Inline AI Suggestions
**As a** reviewer examining a diff
**I want to** see AI suggestions inline with the code
**So that** I can quickly identify issues without context switching

**Acceptance Criteria:**
- [ ] AI suggestions appear as collapsible annotations in diff view
- [ ] Suggestions categorized: bug, security, performance, style
- [ ] User can dismiss, accept, or expand suggestions
- [ ] Keyboard navigation between suggestions (`n`/`N`)
- [ ] Suggestions persist for the session

#### US-006: PR Auto-Summary
**As a** reviewer starting a new review
**I want to** see an AI-generated summary of changes
**So that** I understand the PR scope before diving into details

**Acceptance Criteria:**
- [ ] Summary generated when entering PR detail view
- [ ] Summary includes: purpose, key changes, risk assessment
- [ ] Summary respects file context (tests vs. production code)
- [ ] Option to regenerate with different detail level
- [ ] Summary cached to avoid repeated API calls

#### US-007: Configurable Review Strictness
**As a** team lead or individual reviewer
**I want to** configure AI review strictness levels
**So that** feedback matches our team's standards

**Acceptance Criteria:**
- [ ] Three strictness levels: relaxed, standard, strict
- [ ] Relaxed: Only critical bugs and security issues
- [ ] Standard: Bugs, security, significant performance issues
- [ ] Strict: All above plus style, naming, best practices
- [ ] Per-repository strictness configuration
- [ ] Default strictness in global config

#### US-008: Cost Estimation Before AI Review
**As a** cost-conscious user
**I want to** see estimated cost before running AI review
**So that** I can make informed decisions about API usage

**Acceptance Criteria:**
- [ ] Token count estimation before API call
- [ ] Cost estimate displayed (based on provider pricing)
- [ ] Cumulative session cost tracking
- [ ] Monthly cost tracking with configurable limits
- [ ] Warning when approaching cost thresholds

### TUI Performance

#### US-009: Virtual Scrolling for Large Lists
**As a** user working with large repositories
**I want to** smoothly scroll through thousands of PRs
**So that** the interface remains responsive

**Acceptance Criteria:**
- [ ] Only visible items rendered (viewport + buffer)
- [ ] Smooth scrolling at 60fps
- [ ] Memory usage constant regardless of list size
- [ ] Jump to top/bottom instant (`g`/`G`)
- [ ] Search/filter maintains virtual scroll behavior

#### US-010: Lazy Loading with Background Refresh
**As a** user navigating between views
**I want to** see instant transitions with data loading in background
**So that** I'm never blocked waiting for API responses

**Acceptance Criteria:**
- [ ] Skeleton/placeholder UI while loading
- [ ] Background goroutines fetch data asynchronously
- [ ] Priority queue for visible content loading
- [ ] Cancellation of obsolete requests on navigation
- [ ] Visual indicator for stale data pending refresh

### TUI Visual

#### US-011: Enhanced Theme System
**As a** user who cares about aesthetics
**I want to** customize the application appearance
**So that** it matches my terminal and preferences

**Acceptance Criteria:**
- [ ] Built-in themes: dark, light, lazygit, dracula, tokyo-night, gruvbox, catppuccin
- [ ] Custom theme definition via config file
- [ ] Theme preview without committing changes
- [ ] Automatic theme based on terminal background
- [ ] High contrast mode for accessibility

#### US-012: Unicode Status Indicators
**As a** user reviewing PR status
**I want to** see clear visual indicators for status
**So that** I can quickly assess PR health at a glance

**Acceptance Criteria:**
- [ ] Unicode glyphs for CI status (checkmark, X, spinner)
- [ ] Review status icons (approved, changes requested, pending)
- [ ] Draft/ready indicator
- [ ] Merge conflict indicator
- [ ] Configurable ASCII fallback for limited terminals

### TUI New Views

#### US-013: PR Analytics Dashboard
**As a** team lead or contributor
**I want to** see analytics about review activity
**So that** I can identify bottlenecks and improve processes

**Acceptance Criteria:**
- [ ] Average time to first review
- [ ] Average time to merge
- [ ] Review iterations per PR
- [ ] Comments per PR
- [ ] Personal review activity trends
- [ ] Team comparison (if permissions allow)

#### US-014: Review History View
**As a** user tracking my review contributions
**I want to** see my review history
**So that** I can track my participation and follow up on PRs

**Acceptance Criteria:**
- [ ] List of PRs I've reviewed
- [ ] Filter by: approved, changes requested, commented
- [ ] Time-based filtering (last week, month, quarter)
- [ ] Quick navigation to PR from history
- [ ] Export capability (markdown, JSON)

#### US-015: File Change Impact Visualization
**As a** reviewer assessing risk
**I want to** see visual representation of change impact
**So that** I can focus on high-risk areas

**Acceptance Criteria:**
- [ ] Heat map of changes (lines changed, files touched)
- [ ] Dependency graph showing affected modules
- [ ] Test coverage indication for changed files
- [ ] Historical churn data for changed files
- [ ] Complexity delta indicators

### TUI UX Improvements

#### US-016: Split Diff View (Side-by-Side)
**As a** reviewer comparing old and new code
**I want to** see side-by-side diff view
**So that** I can better understand changes in context

**Acceptance Criteria:**
- [ ] Toggle between unified and split view (`d`)
- [ ] Synchronized scrolling in split view
- [ ] Line alignment for added/removed pairs
- [ ] Syntax highlighting in both panes
- [ ] Adjustable split ratio

#### US-017: Quick Actions Menu (Fuzzy Finder)
**As a** power user seeking efficiency
**I want to** access any action via fuzzy search
**So that** I can work without memorizing all keybindings

**Acceptance Criteria:**
- [ ] Command palette triggered by `Ctrl+p`
- [ ] Fuzzy search across all available actions
- [ ] Recent actions at top
- [ ] Keybinding shown for each action
- [ ] Custom action aliases configurable

#### US-018: Keyboard Chord Support
**As a** vim-style user
**I want to** use multi-key combinations for advanced actions
**So that** I have more actions available without modifier keys

**Acceptance Criteria:**
- [ ] Support for sequences like `gg`, `gc`, `gr`
- [ ] Timeout for chord completion (configurable, default 500ms)
- [ ] Visual indicator showing pending chord
- [ ] Conflict resolution with single-key bindings
- [ ] Chords configurable in keybindings config

#### US-019: Breadcrumb Navigation
**As a** user deep in a PR view
**I want to** see my navigation path
**So that** I know where I am and can quickly return

**Acceptance Criteria:**
- [ ] Breadcrumb trail in header (Repos > owner/repo > PR #123 > Files)
- [ ] Click/select breadcrumb to navigate back
- [ ] Keyboard shortcut to go up one level (`backspace`)
- [ ] Abbreviated display when path is long
- [ ] Current location highlighted

---

## Feature Specifications

### Area 1: Phase 10 Completion

#### F-001: Self-Update Mechanism

**Implementation:**
- Use `github.com/rhysd/go-github-selfupdate` or custom implementation
- Check GitHub Releases API for new versions
- Compare semver for update availability
- Download platform-specific binary to temp location
- Atomic replace with backup of current binary

**Configuration:**
```yaml
updater:
  enabled: true
  check_interval: 24h  # How often to check
  channel: stable      # stable, beta, nightly
  auto_check: true     # Check on startup
```

**Technical Notes:**
- Support both direct binary and Homebrew installations
- Preserve config across updates
- Verify checksum before replacement

#### F-002: Enhanced Error System

**Implementation:**
- Extend existing `internal/errors/errors.go`
- Add error registry with codes (LR-001, LR-002, etc.)
- Create context-aware error suggestions
- Implement error formatting for TUI display

**Error Categories:**
1. Authentication (LR-1xx)
2. API/Network (LR-2xx)
3. Configuration (LR-3xx)
4. AI Provider (LR-4xx)
5. Internal (LR-9xx)

#### F-003: Optimized Caching Layer

**Implementation:**
- Extend `internal/services/cache.go` with persistence
- Add SQLite backing for cross-session cache
- Implement cache warming on startup
- Add smart invalidation based on webhooks/polling

**Cache Tiers:**
1. L1: In-memory (instant, current session)
2. L2: SQLite (fast, persisted)
3. L3: API (authoritative, rate-limited)

### Area 2: AI-Powered Code Review

#### F-004: Multi-Provider AI Architecture

**Implementation:**
- Extend `internal/ai/ai.go` Provider interface
- Add `internal/ai/anthropic.go` for Claude
- Add `internal/ai/ollama.go` for local models
- Create provider factory with runtime selection

**Provider Interface Enhancement:**
```go
type Provider interface {
    Review(ctx context.Context, req ReviewRequest) (ReviewResponse, error)
    Summarize(ctx context.Context, diff string) (string, error)
    EstimateCost(ctx context.Context, input string) (CostEstimate, error)
    Name() string
    Model() string
    IsAvailable(ctx context.Context) bool
}

type CostEstimate struct {
    InputTokens  int
    OutputTokens int
    EstimatedUSD float64
}
```

**Configuration:**
```yaml
ai:
  default_provider: openai
  strictness: standard  # relaxed, standard, strict
  monthly_limit_usd: 50.00
  providers:
    openai:
      api_key_env: OPENAI_API_KEY
      model: gpt-4-turbo
      base_url: ""  # Optional custom endpoint
    anthropic:
      api_key_env: ANTHROPIC_API_KEY
      model: claude-3-sonnet-20240229
    ollama:
      host: http://localhost:11434
      model: codellama:13b
```

#### F-005: Inline AI Suggestions

**Implementation:**
- Create `internal/gui/views/ai_suggestions.go`
- Overlay component that attaches to diff lines
- Async loading with cancellation
- Local storage for dismissed suggestions

**Suggestion Types:**
```go
type SuggestionType string

const (
    SuggestionBug         SuggestionType = "bug"
    SuggestionSecurity    SuggestionType = "security"
    SuggestionPerformance SuggestionType = "performance"
    SuggestionStyle       SuggestionType = "style"
    SuggestionBestPractice SuggestionType = "best_practice"
)

type AISuggestion struct {
    Type       SuggestionType
    Line       int
    FilePath   string
    Message    string
    Severity   string  // critical, high, medium, low
    Suggestion string  // Recommended fix
    Confidence float64 // 0.0-1.0
}
```

#### F-006: Strictness Levels

**Relaxed Mode Prompt Focus:**
- Critical bugs (nil pointer, data loss)
- Security vulnerabilities (injection, auth bypass)
- Breaking changes

**Standard Mode Prompt Focus (includes Relaxed):**
- Performance regressions
- Error handling gaps
- Test coverage concerns
- API contract violations

**Strict Mode Prompt Focus (includes Standard):**
- Code style violations
- Naming conventions
- Documentation completeness
- Best practice adherence
- Magic numbers/strings

### Area 3: TUI Overhaul

#### F-007: Virtual Scrolling

**Implementation:**
- Create `pkg/components/virtual_list.go`
- Buffer strategy: viewport + 2x buffer above/below
- Index-based item access (no full list iteration)
- Efficient binary search for scroll position

**Key Methods:**
```go
type VirtualList struct {
    items       []list.Item
    viewport    int           // Visible item count
    offset      int           // Current scroll offset
    buffer      int           // Items to pre-render
    totalHeight int           // Sum of all item heights
}

func (v *VirtualList) VisibleRange() (start, end int)
func (v *VirtualList) ScrollTo(index int)
func (v *VirtualList) ItemAtY(y int) int
```

#### F-008: Theme System Overhaul

**Implementation:**
- Extend `internal/gui/theme.go`
- Add theme file loader from `~/.config/lazyreview/themes/`
- Implement theme preview mode
- Add accessibility validation (contrast ratios)

**Theme Schema:**
```yaml
# ~/.config/lazyreview/themes/my-theme.yaml
name: my-theme
base: dark  # Inherit from base theme
colors:
  primary: "#7aa2f7"
  secondary: "#bb9af7"
  success: "#9ece6a"
  warning: "#e0af68"
  error: "#f7768e"
  background: "#1a1b26"
  foreground: "#c0caf5"
  muted: "#565f89"
  border: "#3b4261"
  diff:
    added: "#9ece6a"
    deleted: "#f7768e"
    modified: "#e0af68"
```

#### F-009: Split Diff View

**Implementation:**
- Create `pkg/components/split_diff.go`
- Two-pane layout with synchronized scroll
- Line pairing algorithm for added/deleted
- Horizontal scroll for long lines

**Split Diff Modes:**
1. Unified (current) - inline +/-
2. Split - side-by-side
3. Inline Context - shows surrounding code

#### F-010: Quick Actions Menu

**Implementation:**
- Create `internal/gui/views/command_palette.go`
- Fuzzy search using `sahilm/fuzzy`
- Action registry with metadata
- Recent actions persistence

**Action Definition:**
```go
type Action struct {
    ID          string
    Name        string
    Description string
    Keybinding  string
    Category    string
    Handler     func() tea.Cmd
    Available   func() bool  // Context-dependent availability
}
```

#### F-011: Analytics Dashboard

**Implementation:**
- Create `internal/gui/views/analytics.go`
- Data aggregation in `internal/services/analytics.go`
- Local SQLite storage for historical data
- Privacy-respecting (no external analytics)

**Metrics Collected:**
- Review timestamps (start, complete)
- Comment counts per review
- PR iterations (commits after review)
- Time-to-merge tracking
- Personal activity only (no team data without explicit permission)

---

## Technical Requirements

### Performance

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| Navigation latency | < 100ms P95 | Instrumentation metrics |
| Startup time | < 2s cold, < 500ms warm | Time to interactive |
| Memory usage | < 100MB baseline | Runtime profiling |
| Memory growth | < 10MB per 1000 PRs | Memory profiling |
| Frame rate | 60fps during scroll | Frame timing |

### Compatibility

| Platform | Minimum Version | Notes |
|----------|-----------------|-------|
| macOS | 11.0 (Big Sur) | ARM64 native |
| Linux | Ubuntu 20.04 / glibc 2.31 | x86_64, ARM64 |
| Windows | Windows 10 1903+ | WSL recommended |
| Terminal | 256 colors | True color optional |

### Security

- All API keys stored in OS keyring (never plaintext)
- AI prompts never include full source files (only diffs)
- No telemetry without explicit opt-in
- Token scopes validated on authentication
- HTTPS enforced for all API calls

### API Rate Limits

| Provider | Default Limit | Handling |
|----------|---------------|----------|
| GitHub | 5000/hour | Exponential backoff, caching |
| GitLab | 300/minute | Token bucket, request batching |
| OpenAI | Varies by tier | Cost-based throttling |
| Anthropic | Varies by tier | Cost-based throttling |
| Ollama | Local | No external limits |

---

## Dependencies & Risks

### New Dependencies

| Dependency | Purpose | License |
|------------|---------|---------|
| `anthropics/anthropic-sdk-go` | Claude API client | MIT |
| `ollama/ollama` | Local model client | MIT |
| `sahilm/fuzzy` | Fuzzy search | MIT |
| `rhysd/go-github-selfupdate` | Self-update | MIT |

### Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| AI API instability | Medium | High | Graceful fallback, local model option |
| Performance regression | Medium | High | Benchmark suite, CI performance tests |
| Breaking config changes | Low | Medium | Migration tooling, config versioning |
| Rate limit exhaustion | Medium | Medium | Smart caching, cost controls |
| Theme accessibility issues | Medium | Low | WCAG contrast validation, high-contrast mode |

---

## Timeline (Phases)

### Phase A: Foundation (2-3 weeks)
- Self-update mechanism implementation
- Error system enhancement
- Cache layer optimization
- Virtual scrolling component

### Phase B: AI Expansion (3-4 weeks)
- Anthropic provider implementation
- Ollama provider implementation
- Inline AI suggestions
- Cost estimation system
- Strictness configuration

### Phase C: TUI Overhaul - Performance (2 weeks)
- Virtual scrolling integration
- Lazy loading infrastructure
- Background refresh system
- Optimized re-rendering

### Phase D: TUI Overhaul - Visual (2-3 weeks)
- Theme system enhancement
- Split diff view
- Unicode indicators
- Accessibility improvements

### Phase E: TUI Overhaul - New Views (3-4 weeks)
- Analytics dashboard
- Review history view
- File impact visualization
- Command palette
- Breadcrumb navigation

### Phase F: Polish & Release (1-2 weeks)
- Integration testing
- Performance benchmarking
- Documentation updates
- Release preparation

**Total Estimated Timeline: 13-18 weeks**

---

## Appendix

### A. Configuration Schema Reference

See `docs/configuration.md` for complete configuration reference.

### B. Keybinding Reference

See `docs/keybindings.md` for complete keybinding reference.

### C. API Provider Setup Guides

- GitHub: docs/providers/github.md
- GitLab: docs/providers/gitlab.md
- Bitbucket: docs/providers/bitbucket.md
- Azure DevOps: docs/providers/azure-devops.md
- OpenAI: docs/ai/openai.md
- Anthropic: docs/ai/anthropic.md
- Ollama: docs/ai/ollama.md

---

**Document History:**
- 2026-02-05: Initial draft created
