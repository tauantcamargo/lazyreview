import React, { useCallback, useRef, useState } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import { Match } from 'effect'
import {
  usePullRequest,
  usePRComments,
  usePRReviews,
  usePRCommits,
  useReviewThreads,
  useCurrentUser,
  useIssueComments,
  useCompareFiles,
} from '../hooks/useGitHub'
import { usePaginatedFiles } from '../hooks/usePaginatedFiles'
import {
  useConvertToDraft,
  useMarkReadyForReview,
  useSetLabels,
  useRepoLabels,
  useCollaborators,
  useUpdateAssignees,
} from '../hooks/useGitHub'
import type { CommitRange } from '../hooks/useCommitRange'
import { usePRDetailModals } from '../hooks/usePRDetailModals'
import { usePendingReview } from '../hooks/usePendingReview'
import { PRHeader } from '../components/pr/PRHeader'
import { PRTabs } from '../components/pr/PRTabs'
import { DescriptionTab } from '../components/pr/DescriptionTab'
import { FilesTab } from '../components/pr/FilesTab'
import { ConversationsTab } from '../components/pr/ConversationsTab'
import { CommitsTab } from '../components/pr/CommitsTab'
import { ChecksTab } from '../components/pr/ChecksTab'
import { ReviewModal } from '../components/pr/ReviewModal'
import { CommentModal } from '../components/pr/CommentModal'
import { MergeModal } from '../components/pr/MergeModal'
import { ReReviewModal, buildReviewerList } from '../components/pr/ReReviewModal'
import { LabelPickerModal } from '../components/pr/LabelPickerModal'
import { AssigneePickerModal } from '../components/pr/AssigneePickerModal'
import { ReactionPicker } from '../components/pr/ReactionPicker'
import { LoadingIndicator } from '../components/common/LoadingIndicator'
import { openInBrowser, copyToClipboard } from '../utils/terminal'
import { checkoutPR } from '../utils/git'
import { useConfig } from '../hooks/useConfig'
import { useStatusMessage } from '../hooks/useStatusMessage'
import { useReadState } from '../hooks/useReadState'
import { useManualRefresh } from '../hooks/useManualRefresh'
import { setScreenContext } from '../hooks/useScreenContext'
import { setSelectionContext } from '../hooks/useSelectionContext'
import { useReactionActions } from '../hooks/useReactionActions'
import { useTheme } from '../theme/index'
import { useAiSummary } from '../hooks/useAiSummary'
import { useAiConfig } from '../hooks/useAiConfig'
import type { PullRequest } from '../models/pull-request'
import type { InlineCommentContext } from '../models/inline-comment'

export type { InlineCommentContext }
export type { ReplyContext, ResolveContext } from '../components/pr/ConversationsTab'
export type { EditCommentContext, EditDescriptionContext, EditTitleContext } from '../hooks/usePRDetailModals'

interface PRDetailScreenProps {
  readonly pr: PullRequest
  readonly owner: string
  readonly repo: string
  readonly onBack: () => void
  readonly onNavigate?: (direction: 'next' | 'prev') => void
  readonly onNavigateToPR?: (prNumber: number) => void
  readonly prIndex?: number
  readonly prTotal?: number
  readonly allPRs?: readonly PullRequest[]
}

const PR_DETAIL_RESERVED_LINES = 12

export function PRDetailScreen({
  pr,
  owner,
  repo,
  onBack,
  onNavigate,
  onNavigateToPR,
  prIndex,
  prTotal,
  allPRs,
}: PRDetailScreenProps): React.ReactElement {
  const { stdout } = useStdout()
  const { config } = useConfig()
  const { setStatusMessage } = useStatusMessage()
  const { markAsRead } = useReadState()
  const theme = useTheme()
  const [currentTab, setCurrentTab] = useState(0)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [showDraftConfirm, setShowDraftConfirm] = useState(false)
  const [showLabelPicker, setShowLabelPicker] = useState(false)
  const [labelError, setLabelError] = useState<string | null>(null)
  const [showAssigneePicker, setShowAssigneePicker] = useState(false)
  const [assigneeError, setAssigneeError] = useState<string | null>(null)
  const [initialFile, setInitialFile] = useState<string | undefined>(undefined)
  const [commitRange, setCommitRange] = useState<CommitRange | null>(null)
  const [aiSummaryExpanded, setAiSummaryExpanded] = useState(false)
  const contentHeight = Math.max(1, (stdout?.rows ?? 24) - PR_DETAIL_RESERVED_LINES)

  // Mark PR as read when entering detail view
  React.useEffect(() => {
    markAsRead(pr.html_url, pr.updated_at)
  }, [pr.html_url, pr.updated_at, markAsRead])

  React.useEffect(() => {
    const tabContexts = [
      'pr-detail-description',
      'pr-detail-conversations',
      'pr-detail-commits',
      'pr-detail-files',
      'pr-detail-checks',
    ] as const
    setScreenContext(tabContexts[currentTab] ?? 'pr-detail-description')
  }, [currentTab])

  // Publish PR state context for status bar hints on description/commits/checks tabs.
  // Conversations and files tabs publish their own more specific context.
  // Uses `pr` prop directly because `activePR` (fullPR ?? pr) is declared later.
  React.useEffect(() => {
    if (currentTab === 0 || currentTab === 2 || currentTab === 4) {
      setSelectionContext({
        type: 'pr-detail',
        prState: pr.state,
        prMerged: pr.merged,
        prDraft: pr.draft,
      })
    }
  }, [currentTab, pr.state, pr.merged, pr.draft])

  // Track which tabs have been visited (once visited, data stays enabled for cache)
  const visitedTabsRef = useRef<ReadonlySet<number>>(new Set([0]))
  React.useEffect(() => {
    if (!visitedTabsRef.current.has(currentTab)) {
      visitedTabsRef.current = new Set([...visitedTabsRef.current, currentTab])
    }
  }, [currentTab])

  const hasVisited = (tab: number): boolean => visitedTabsRef.current.has(tab)

  // Tab data requirements:
  // 0 (Description): pr + reviews (always loaded)
  // 1 (Conversations): comments, reviews, reviewThreads, issueComments, currentUser
  // 2 (Commits): commits
  // 3 (Files): files, comments, reviewThreads, currentUser
  // 4 (Checks): handled internally by ChecksTab
  const needsComments = hasVisited(1) || hasVisited(3)
  const needsThreads = hasVisited(1) || hasVisited(3)
  const needsCommits = hasVisited(2)
  const needsFiles = hasVisited(3)
  const needsIssueComments = hasVisited(0) || hasVisited(1)

  // Fetch full PR data (search API doesn't include head.sha)
  const { data: fullPR } = usePullRequest(owner, repo, pr.number)
  const activePR = fullPR ?? pr

  // Lazy-load PR data based on visited tabs (with pagination for 300+ files)
  const {
    files,
    isLoading: filesLoading,
    hasMoreFiles,
    totalFileCount,
    loadNextPage: loadMoreFiles,
  } = usePaginatedFiles(owner, repo, pr.number, activePR.changed_files, {
    enabled: needsFiles,
  })
  const { data: comments = [], isLoading: commentsLoading } = usePRComments(owner, repo, pr.number, { enabled: needsComments })
  const { data: reviews = [], isLoading: reviewsLoading } = usePRReviews(owner, repo, pr.number)
  const { data: commits = [], isLoading: commitsLoading } = usePRCommits(owner, repo, pr.number, { enabled: needsCommits })
  const { data: reviewThreads } = useReviewThreads(owner, repo, pr.number, { enabled: needsThreads })
  const { data: issueComments = [] } = useIssueComments(owner, repo, pr.number, { enabled: needsIssueComments })
  const { data: currentUser } = useCurrentUser()

  // Fetch compare files when a commit range is active
  const { data: compareFiles = [] } = useCompareFiles(
    owner,
    repo,
    commitRange?.startSha ?? null,
    commitRange?.endSha ?? null,
    { enabled: commitRange !== null },
  )

  // Use compare files when range is active, otherwise use full PR files
  const activeFiles = commitRange !== null && compareFiles.length > 0 ? compareFiles : files

  // Only show loading for data the current tab needs
  const isCurrentTabLoading = (): boolean => {
    if (currentTab === 0) return reviewsLoading
    if (currentTab === 1) return commentsLoading || reviewsLoading
    if (currentTab === 2) return commitsLoading
    if (currentTab === 3) return filesLoading || commentsLoading
    return false
  }
  const isLoading = isCurrentTabLoading()

  const modals = usePRDetailModals({
    owner,
    repo,
    prNumber: pr.number,
    headSha: activePR.head.sha,
    setStatusMessage,
    onMergeSuccess: onBack,
    onCloseSuccess: onBack,
  })

  const pendingReview = usePendingReview({
    owner,
    repo,
    prNumber: pr.number,
    setStatusMessage,
  })

  // AI summary for Description tab
  const { aiConfig } = useAiConfig()
  const aiSummaryHook = useAiSummary(aiConfig)

  const handleToggleAiSummary = useCallback(() => {
    setAiSummaryExpanded((prev) => {
      const next = !prev
      // Auto-generate when first expanded and no summary yet
      if (next && !aiSummaryHook.summary && !aiSummaryHook.isGenerating) {
        aiSummaryHook.generateSummary({
          owner,
          repo,
          prNumber: pr.number,
          headSha: activePR.head.sha,
          title: activePR.title,
          description: activePR.body ?? '',
          commits: commits.map((c) => ({
            message: c.commit.message ?? '',
            sha: c.sha ?? '',
          })),
          files: files.map((f) => ({
            filename: f.filename,
            additions: f.additions ?? 0,
            deletions: f.deletions ?? 0,
          })),
        })
      }
      return next
    })
  }, [owner, repo, pr.number, activePR, commits, files, aiSummaryHook])

  const reactionActions = useReactionActions({
    owner,
    repo,
    prNumber: pr.number,
    setStatusMessage,
  })

  const convertToDraft = useConvertToDraft()
  const markReady = useMarkReadyForReview()
  const setLabelsMutation = useSetLabels()
  const { data: repoLabels = [], isLoading: labelsLoading } = useRepoLabels(
    owner,
    repo,
    { enabled: showLabelPicker },
  )
  const updateAssigneesMutation = useUpdateAssignees()
  const { data: collaborators = [], isLoading: collaboratorsLoading } = useCollaborators(
    owner,
    repo,
    { enabled: showAssigneePicker },
  )

  const handleReviewSubmit = useCallback(
    (body: string, event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT') => {
      if (pendingReview.isActive) {
        pendingReview.submitReview(body, event)
        modals.closeReviewModal()
      } else {
        modals.handleReviewSubmit(body, event)
      }
    },
    [pendingReview, modals],
  )

  const handleCommentSubmit = useCallback(
    (body: string) => {
      if (pendingReview.isActive && modals.inlineContext) {
        pendingReview.addPendingComment(
          {
            body,
            path: modals.inlineContext.path,
            line: modals.inlineContext.line,
            side: modals.inlineContext.side,
            startLine: modals.inlineContext.startLine,
            startSide: modals.inlineContext.startSide,
          },
          body,
        )
        modals.closeCommentModal()
      } else {
        modals.handleCommentSubmit(body)
      }
    },
    [pendingReview, modals],
  )

  const handleGoToFile = useCallback((path: string) => {
    setInitialFile(path)
    setCurrentTab(3) // Switch to Files tab
    setStatusMessage(`Jumped to ${path}`)
  }, [setStatusMessage])

  const anyModalOpen = modals.hasModal || showLabelPicker || showAssigneePicker || reactionActions.showReactionPicker

  useManualRefresh({
    isActive: !anyModalOpen,
  })

  useInput(
    (input, key) => {
      if (showDiscardConfirm) {
        if (input === 'y' || input === 'Y') {
          pendingReview.discardReview()
          setShowDiscardConfirm(false)
        } else {
          setShowDiscardConfirm(false)
        }
        return
      }

      if (showDraftConfirm) {
        if (input === 'y' || input === 'Y') {
          setShowDraftConfirm(false)
          const nodeId = activePR.node_id
          if (!nodeId) {
            setStatusMessage('Cannot toggle draft: missing node_id')
            return
          }
          if (activePR.draft) {
            markReady.mutate(
              { owner, repo, prNumber: pr.number, nodeId },
              {
                onSuccess: () => setStatusMessage('PR marked as ready for review'),
                onError: (err) => setStatusMessage(`Error: ${String(err)}`),
              },
            )
          } else {
            convertToDraft.mutate(
              { owner, repo, prNumber: pr.number, nodeId },
              {
                onSuccess: () => setStatusMessage('PR converted to draft'),
                onError: (err) => setStatusMessage(`Error: ${String(err)}`),
              },
            )
          }
        } else {
          setShowDraftConfirm(false)
        }
        return
      }

      if (modals.showCloseConfirm) {
        if (input === 'y' || input === 'Y') {
          modals.handleClosePR()
        } else {
          modals.closeCloseConfirm()
        }
        return
      }

      if (input === '1') {
        setCurrentTab(0)
      } else if (input === '2') {
        setCurrentTab(1)
      } else if (input === '3') {
        setCurrentTab(2)
      } else if (input === '4') {
        setCurrentTab(3)
      } else if (input === '5') {
        setCurrentTab(4)
      } else if (input === 'o') {
        openInBrowser(pr.html_url)
        setStatusMessage('Opened in browser')
      } else if (input === 'X') {
        if (activePR.state === 'open') {
          modals.openCloseConfirm()
        } else {
          modals.handleReopenPR()
        }
      } else if (input === 'S') {
        if (!pendingReview.isActive) {
          pendingReview.startReview()
        }
      } else if (input === 'R') {
        modals.openReviewModal()
      } else if (input === 'E') {
        modals.openReReviewModal()
      } else if (input === 'm') {
        modals.openMergeModal()
      } else if (input === 'y') {
        const url = pr.html_url
        if (copyToClipboard(url)) {
          setStatusMessage('Copied PR URL to clipboard')
        } else {
          setStatusMessage('Failed to copy to clipboard')
        }
      } else if (input === ']' && onNavigate) {
        onNavigate('next')
      } else if (input === '[' && onNavigate) {
        onNavigate('prev')
      } else if (input === 'W') {
        if (activePR.state === 'open') {
          setShowDraftConfirm(true)
        } else {
          setStatusMessage('Can only toggle draft on open PRs')
        }
      } else if (input === 'T') {
        modals.handleOpenEditTitle({ title: activePR.title })
      } else if (input === 'L') {
        setLabelError(null)
        setShowLabelPicker(true)
      } else if (input === 'A') {
        setAssigneeError(null)
        setShowAssigneePicker(true)
      } else if (input === 'G') {
        setStatusMessage('Checking out PR #' + pr.number + '...', 10000)
        checkoutPR(pr.number).then((result) => {
          setStatusMessage(
            result.message,
            result.success ? 3000 : 5000,
          )
        }).catch((error: unknown) => {
          setStatusMessage(
            `Checkout failed: ${error instanceof Error ? error.message : String(error)}`,
            5000,
          )
        })
      } else if (input === 'r' && key.ctrl && currentTab === 0 && aiSummaryExpanded) {
        aiSummaryHook.regenerateSummary()
      } else if (input === 'q' || key.escape) {
        if (pendingReview.isActive) {
          setShowDiscardConfirm(true)
        } else {
          onBack()
        }
      }
    },
    { isActive: !anyModalOpen },
  )

  const renderTabContent = (): React.ReactElement => {
    if (isLoading) {
      return <LoadingIndicator message="Loading PR details..." />
    }

    return Match.value(currentTab).pipe(
      Match.when(0, () => (
        <DescriptionTab
          pr={activePR}
          reviews={reviews}
          isActive={!anyModalOpen}
          onEditDescription={modals.handleOpenEditDescription}
          issueComments={issueComments}
          botUsernames={config?.botUsernames}
          aiSummary={{
            summary: aiSummaryHook.summary,
            isGenerating: aiSummaryHook.isGenerating,
            error: aiSummaryHook.error,
            isConfigured: aiSummaryHook.isConfigured,
            providerName: aiSummaryHook.providerName,
            isExpanded: aiSummaryExpanded,
          }}
          aiSummaryExpanded={aiSummaryExpanded}
          onToggleAiSummary={handleToggleAiSummary}
          allPRs={allPRs}
          onNavigateToPR={onNavigateToPR}
        />
      )),
      Match.when(1, () => (
        <ConversationsTab
          pr={activePR}
          comments={comments}
          reviews={reviews}
          reviewThreads={reviewThreads}
          issueComments={issueComments}
          isActive={!anyModalOpen}
          showResolved={modals.showResolved}
          currentUser={currentUser?.login}
          onComment={modals.handleOpenGeneralComment}
          onReply={modals.handleOpenReply}
          onToggleResolve={modals.handleToggleResolve}
          onToggleShowResolved={modals.handleToggleShowResolved}
          onEditComment={modals.handleOpenEditComment}
          onEditDescription={modals.handleOpenEditDescription}
          onGoToFile={handleGoToFile}
          supportsReactions={true}
          onAddReaction={reactionActions.handleOpenReactionPicker}
        />
      )),
      Match.when(2, () => (
        <CommitsTab
          commits={commits}
          isActive={!anyModalOpen}
          owner={owner}
          repo={repo}
          onRangeChange={setCommitRange}
        />
      )),
      Match.when(3, () => (
        <FilesTab
          files={activeFiles}
          commitRangeLabel={commitRange?.label}
          isActive={!anyModalOpen}
          prUrl={activePR.html_url}
          onInlineComment={modals.handleOpenInlineComment}
          comments={comments}
          reviewThreads={reviewThreads}
          currentUser={currentUser?.login}
          onReply={modals.handleOpenReply}
          onToggleResolve={modals.handleToggleResolve}
          onEditComment={modals.handleOpenEditComment}
          onAddReaction={reactionActions.handleOpenReactionPicker}
          initialFile={initialFile}
          onInitialFileConsumed={() => setInitialFile(undefined)}
          owner={owner}
          repo={repo}
          prNumber={pr.number}
          totalFileCount={totalFileCount}
          hasMoreFiles={hasMoreFiles}
          onLoadMoreFiles={loadMoreFiles}
          mergeable={activePR.mergeable}
          mergeableState={activePR.mergeable_state}
        />
      )),
      Match.when(4, () => (
        <ChecksTab
          owner={owner}
          repo={repo}
          sha={activePR.head.sha}
          isActive={!anyModalOpen}
        />
      )),
      Match.orElse(() => (
        <DescriptionTab
          pr={activePR}
          reviews={reviews}
          isActive={!anyModalOpen}
          onEditDescription={modals.handleOpenEditDescription}
          issueComments={issueComments}
          botUsernames={config?.botUsernames}
          aiSummary={{
            summary: aiSummaryHook.summary,
            isGenerating: aiSummaryHook.isGenerating,
            error: aiSummaryHook.error,
            isConfigured: aiSummaryHook.isConfigured,
            providerName: aiSummaryHook.providerName,
            isExpanded: aiSummaryExpanded,
          }}
          aiSummaryExpanded={aiSummaryExpanded}
          onToggleAiSummary={handleToggleAiSummary}
          allPRs={allPRs}
          onNavigateToPR={onNavigateToPR}
        />
      ))
    )
  }

  return (
    <Box flexDirection="column" flexGrow={1} minHeight={0}>
      <Box flexShrink={0} flexDirection="column">
        <PRHeader pr={activePR} prIndex={prIndex} prTotal={prTotal} />
        <PRTabs activeIndex={currentTab} onChange={setCurrentTab} />
      </Box>
      <Box
        flexShrink={0}
        height={contentHeight}
        minHeight={0}
        overflow="hidden"
        flexDirection="column"
        borderStyle="single"
        borderColor={theme.colors.border}
        paddingX={1}
      >
        {renderTabContent()}
      </Box>
      {pendingReview.isActive && (
        <Box paddingX={1}>
          <Text color={theme.colors.warning} bold>
            Review in progress ({pendingReview.pendingCount} pending comment{pendingReview.pendingCount !== 1 ? 's' : ''})
          </Text>
          <Text color={theme.colors.muted}> | R: submit | q: discard</Text>
        </Box>
      )}
      {showDiscardConfirm && (
        <Box paddingX={1} flexDirection="column">
          <Text color={theme.colors.warning} bold>
            Discard pending review with {pendingReview.pendingCount} comment{pendingReview.pendingCount !== 1 ? 's' : ''}? (y/n)
          </Text>
          {pendingReview.pendingComments.length > 0 && (
            <Box flexDirection="column" paddingLeft={2}>
              {pendingReview.pendingComments.map((c, i) => (
                <Text key={`${c.path}-${c.line}-${i}`} color={theme.colors.muted}>
                  {c.path}:{c.line}
                </Text>
              ))}
            </Box>
          )}
        </Box>
      )}
      {modals.showReviewModal && (
        <ReviewModal
          onSubmit={handleReviewSubmit}
          onClose={modals.closeReviewModal}
          isSubmitting={pendingReview.isActive ? pendingReview.isSubmitting : modals.submitReviewPending}
          error={pendingReview.isActive ? pendingReview.error : modals.reviewError}
        />
      )}
      {modals.showCommentModal && (
        <CommentModal
          title={pendingReview.isActive && modals.inlineContext ? 'Add Pending Comment' : modals.commentModalTitle}
          context={modals.commentModalContext}
          defaultValue={modals.commentModalDefaultValue}
          onSubmit={handleCommentSubmit}
          onClose={modals.closeCommentModal}
          isSubmitting={pendingReview.isActive ? pendingReview.isAdding : modals.commentSubmitPending}
          error={pendingReview.isActive ? pendingReview.error : modals.commentError}
        />
      )}
      {showDraftConfirm && (
        <Box paddingX={1}>
          <Text color={theme.colors.warning} bold>
            {activePR.draft
              ? `Mark PR #${pr.number} as ready for review? (y/n)`
              : `Convert PR #${pr.number} to draft? (y/n)`}
          </Text>
        </Box>
      )}
      {modals.showCloseConfirm && (
        <Box paddingX={1}>
          <Text color={theme.colors.warning} bold>
            Close PR #{pr.number}? This will not delete the branch. (y/n)
          </Text>
        </Box>
      )}
      {modals.showMergeModal && (
        <MergeModal
          pr={activePR}
          onSubmit={modals.handleMergeSubmit}
          onClose={modals.closeMergeModal}
          isSubmitting={modals.mergePRPending}
          error={modals.mergeError}
        />
      )}
      {modals.showReReviewModal && (
        <ReReviewModal
          reviewers={buildReviewerList(reviews, activePR.requested_reviewers)}
          onSubmit={modals.handleReReviewSubmit}
          onClose={modals.closeReReviewModal}
          isSubmitting={modals.requestReReviewPending}
          error={modals.reReviewError}
        />
      )}
      {showLabelPicker && (
        <LabelPickerModal
          repoLabels={repoLabels}
          currentLabels={activePR.labels.map((l) => l.name)}
          onSubmit={(labels) => {
            setLabelsMutation.mutate(
              { owner, repo, prNumber: pr.number, labels },
              {
                onSuccess: () => {
                  setShowLabelPicker(false)
                  setLabelError(null)
                  setStatusMessage('Labels updated')
                },
                onError: (err) => {
                  setLabelError(String(err))
                },
              },
            )
          }}
          onClose={() => {
            setShowLabelPicker(false)
            setLabelError(null)
          }}
          isSubmitting={setLabelsMutation.isPending}
          isLoading={labelsLoading}
          error={labelError}
        />
      )}
      {reactionActions.showReactionPicker && (
        <ReactionPicker
          onSelect={reactionActions.handleReactionSelect}
          onClose={reactionActions.closeReactionPicker}
          isSubmitting={reactionActions.reactionPending}
          error={reactionActions.reactionError}
        />
      )}
      {showAssigneePicker && (
        <AssigneePickerModal
          collaborators={collaborators}
          currentAssignees={activePR.assignees.map((a) => a.login)}
          onSubmit={(assignees) => {
            updateAssigneesMutation.mutate(
              { owner, repo, prNumber: pr.number, assignees: [...assignees] },
              {
                onSuccess: () => {
                  setShowAssigneePicker(false)
                  setAssigneeError(null)
                  setStatusMessage('Assignees updated')
                },
                onError: (err) => {
                  setAssigneeError(String(err))
                },
              },
            )
          }}
          onClose={() => {
            setShowAssigneePicker(false)
            setAssigneeError(null)
          }}
          isSubmitting={updateAssigneesMutation.isPending}
          isLoading={collaboratorsLoading}
          error={assigneeError}
        />
      )}
    </Box>
  )
}
