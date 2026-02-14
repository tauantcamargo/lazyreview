import React, { useState, useCallback, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { usePullRequests, usePullRequest } from '../hooks/useGitHub'
import type { PRStateFilter } from '../hooks/useGitHub'
import { useCreatePullRequest } from '../hooks/useGitHubMutations'
import { useKeybindings } from '../hooks/useKeybindings'
import { useStatusMessage } from '../hooks/useStatusMessage'
import { PRListScreen } from './PRListScreen'
import { CreatePRModal } from '../components/pr/CreatePRModal'
import { EmptyState } from '../components/common/EmptyState'
import { getCurrentBranch, getDefaultBranch, hasRemoteTracking } from '../utils/git'
import type { PullRequest } from '../models/pull-request'

interface ThisRepoScreenProps {
  readonly owner: string | null
  readonly repo: string | null
  readonly onSelect: (pr: PullRequest, list?: readonly PullRequest[], index?: number) => void
}

interface BranchInfo {
  readonly currentBranch: string | null
  readonly defaultBranch: string
  readonly hasTracking: boolean
}

export function ThisRepoScreen({ owner, repo, onSelect }: ThisRepoScreenProps): React.ReactElement {
  const [stateFilter, setStateFilter] = useState<PRStateFilter>('open')
  const [showCreatePR, setShowCreatePR] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [branchInfo, setBranchInfo] = useState<BranchInfo | null>(null)
  const [navigateToPR, setNavigateToPR] = useState<number | null>(null)
  const { setStatusMessage } = useStatusMessage()
  const { matchesAction } = useKeybindings('prList')

  const { data: prs = [], isLoading, error } = usePullRequests(
    owner ?? '',
    repo ?? '',
    { state: stateFilter === 'all' ? 'all' : stateFilter === 'closed' ? 'closed' : 'open' },
  )

  const createPR = useCreatePullRequest()

  // Fetch the newly created PR to navigate to it
  const { data: newPRData } = usePullRequest(
    owner ?? '',
    repo ?? '',
    navigateToPR ?? 0,
  )

  // Navigate to the new PR once data is loaded
  useEffect(() => {
    if (navigateToPR && newPRData) {
      onSelect(newPRData)
      setNavigateToPR(null)
      setShowCreatePR(false)
    }
  }, [navigateToPR, newPRData, onSelect])

  // Load branch info when create PR modal is opened
  useEffect(() => {
    if (showCreatePR && !branchInfo) {
      Promise.all([
        getCurrentBranch(),
        getDefaultBranch(),
        hasRemoteTracking(),
      ]).then(([currentBranch, defaultBranch, hasTracking]) => {
        setBranchInfo({ currentBranch, defaultBranch, hasTracking })
      })
    }
  }, [showCreatePR, branchInfo])

  const handleOpenCreatePR = useCallback(() => {
    setCreateError(null)
    setBranchInfo(null)
    setShowCreatePR(true)
  }, [])

  const handleCloseCreatePR = useCallback(() => {
    setShowCreatePR(false)
    setCreateError(null)
    setBranchInfo(null)
  }, [])

  const handleSubmitCreatePR = useCallback(
    (params: {
      readonly title: string
      readonly body: string
      readonly baseBranch: string
      readonly headBranch: string
      readonly draft: boolean
    }) => {
      if (!owner || !repo) return

      createPR.mutate(
        {
          owner,
          repo,
          title: params.title,
          body: params.body,
          baseBranch: params.baseBranch,
          headBranch: params.headBranch,
          draft: params.draft,
        },
        {
          onSuccess: (result) => {
            setStatusMessage(`PR #${result.number} created successfully`)
            setNavigateToPR(result.number)
          },
          onError: (err) => {
            const message = err instanceof Error ? err.message : String(err)
            setCreateError(message)
          },
        },
      )
    },
    [owner, repo, createPR, setStatusMessage],
  )

  useInput(
    (input, key) => {
      if (matchesAction(input, key, 'createPR')) {
        handleOpenCreatePR()
      }
    },
    { isActive: !showCreatePR },
  )

  if (!owner || !repo) {
    return <EmptyState message="Not in a git repository or remote not detected" />
  }

  // Determine error state for create PR modal
  const modalError = (() => {
    if (createError) return createError
    if (branchInfo && !branchInfo.currentBranch) {
      return 'Cannot create PR: not on a named branch (detached HEAD)'
    }
    if (branchInfo && branchInfo.currentBranch === branchInfo.defaultBranch) {
      return 'Cannot create PR: already on the default branch'
    }
    return null
  })()

  return (
    <Box flexDirection="column" flexGrow={1}>
      <PRListScreen
        title={`${owner}/${repo}`}
        prs={prs}
        isLoading={isLoading}
        error={error}
        emptyMessage={`No ${stateFilter === 'all' ? '' : stateFilter + ' '}PRs in ${owner}/${repo}`}
        loadingMessage={`Loading PRs for ${owner}/${repo}...`}
        queryKeys={[['prs', owner, repo]]}
        stateFilter={stateFilter}
        onStateChange={setStateFilter}
        onSelect={onSelect}
        owner={owner}
        repo={repo}
      />
      {showCreatePR && branchInfo && branchInfo.currentBranch && (
        <CreatePRModal
          headBranch={branchInfo.currentBranch}
          defaultBaseBranch={branchInfo.defaultBranch}
          supportsDraft={true}
          onSubmit={handleSubmitCreatePR}
          onClose={handleCloseCreatePR}
          isSubmitting={createPR.isPending}
          error={modalError}
        />
      )}
      {showCreatePR && branchInfo && !branchInfo.currentBranch && (
        <CreatePRModal
          headBranch=""
          defaultBaseBranch={branchInfo.defaultBranch}
          supportsDraft={true}
          onSubmit={handleSubmitCreatePR}
          onClose={handleCloseCreatePR}
          isSubmitting={false}
          error="Cannot create PR: not on a named branch (detached HEAD)"
        />
      )}
      {showCreatePR && !branchInfo && (
        <Box padding={1}>
          <Text>Loading branch information...</Text>
        </Box>
      )}
    </Box>
  )
}
