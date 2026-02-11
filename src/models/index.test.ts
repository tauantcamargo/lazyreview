import { describe, it, expect } from 'vitest'
import {
  GitHubError,
  AuthError,
  ConfigError,
  NetworkError,
  User,
  PullRequest,
  Label,
  BranchRef,
  Comment,
  Review,
  FileChange,
  Commit,
  CommitDetails,
  CommitAuthor,
  CheckRun,
  CheckRunsResponse,
  CombinedStatus,
  StatusContext,
  summarizeChecks,
  parseDiffPatch,
} from './index'

describe('models/index re-exports', () => {
  it('exports error schemas', () => {
    expect(GitHubError).toBeDefined()
    expect(AuthError).toBeDefined()
    expect(ConfigError).toBeDefined()
    expect(NetworkError).toBeDefined()
  })

  it('exports user schema class', () => {
    expect(User).toBeDefined()
    expect(typeof User).toBe('function')
  })

  it('exports pull request schemas', () => {
    expect(PullRequest).toBeDefined()
    expect(Label).toBeDefined()
    expect(BranchRef).toBeDefined()
  })

  it('exports comment schema', () => {
    expect(Comment).toBeDefined()
  })

  it('exports review schema', () => {
    expect(Review).toBeDefined()
  })

  it('exports file change schema', () => {
    expect(FileChange).toBeDefined()
  })

  it('exports commit schemas', () => {
    expect(Commit).toBeDefined()
    expect(CommitDetails).toBeDefined()
    expect(CommitAuthor).toBeDefined()
  })

  it('exports check schemas and utilities', () => {
    expect(CheckRun).toBeDefined()
    expect(CheckRunsResponse).toBeDefined()
    expect(CombinedStatus).toBeDefined()
    expect(StatusContext).toBeDefined()
    expect(typeof summarizeChecks).toBe('function')
  })

  it('exports diff parser', () => {
    expect(typeof parseDiffPatch).toBe('function')
  })
})
