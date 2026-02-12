import React, { useCallback, useState } from 'react'
import { Box, Text, useInput, useStdout } from 'ink'
import { Match } from 'effect'
import {
  usePullRequest,
  usePRFiles,
  usePRComments,
  usePRReviews,
  usePRCommits,
  useReviewThreads,
  useCurrentUser,
  useIssueComments,
} from '../hooks/useGitHub'
import { usePRDetailModals } from '../hooks/usePRDetailModals'
import { usePendingReview } from '../hooks/usePendingReview'
import { PRHeader } from '../components/pr/PRHeader'
import { PRTabs } from '../components/pr/PRTabs'
import { DescriptionTab } from '../components/pr/DescriptionTab'
import { FilesTab } from '../components/pr/FilesTab'
import { ConversationsTab } from '../components/pr/ConversationsTab'
import { CommitsTab } from '../components/pr/CommitsTab'
import { ReviewModal } from '../components/pr/ReviewModal'
import { CommentModal } from '../components/pr/CommentModal'
import { MergeModal } from '../components/pr/MergeModal'
import { ReReviewModal, buildReviewerList } from '../components/pr/ReReviewModal'
import { LoadingIndicator } from '../components/common/LoadingIndicator'
import { openInBrowser, copyToClipboard } from '../utils/terminal'
import { checkoutPR } from '../utils/git'
import { useStatusMessage } from '../hooks/useStatusMessage'
import { useReadState } from '../hooks/useReadState'
import { useManualRefresh } from '../hooks/useManualRefresh'
import { setScreenContext } from '../hooks/useScreenContext'
import { useTheme } from '../theme/index'
import type { PullRequest } from '../models/pull-request'
import type { InlineCommentContext } from '../models/inline-comment'

export type { InlineCommentContext }
export type { ReplyContext, ResolveContext } from '../components/pr/ConversationsTab'
export type { EditCommentContext, EditDescriptionContext } from '../hooks/usePRDetailModals'

interface PRDetailScreenProps {
  readonly pr: PullRequest
  readonly owner: string
  readonly repo: string
  readonly onBack: () => void
  readonly onNavigate?: (direction: 'next' | 'prev') => void
  readonly prIndex?: number
  readonly prTotal?: number
}

const PR_DETAIL_RESERVED_LINES = 18

export function PRDetailScreen({
  pr,
  owner,
  repo,
  onBack,
  onNavigate,
  prIndex,
  prTotal,
}: PRDetailScreenProps): React.ReactElement {
  const { stdout } = useStdout()
  const { setStatusMessage } = useStatusMessage()
  const { markAsRead } = useReadState()
  const theme = useTheme()
  const [currentTab, setCurrentTab] = useState(0)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
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
    ] as const
    setScreenContext(tabContexts[currentTab] ?? 'pr-detail-description')
  }, [currentTab])

  // Fetch full PR data (search API doesn't include head.sha)
  const { data: fullPR } = usePullRequest(owner, repo, pr.number)
  const activePR = fullPR ?? pr

  // Fetch all PR data
  const { data: files = [], isLoading: filesLoading } = usePRFiles(owner, repo, pr.number)
  const { data: comments = [], isLoading: commentsLoading } = usePRComments(owner, repo, pr.number)
  const { data: reviews = [], isLoading: reviewsLoading } = usePRReviews(owner, repo, pr.number)
  const { data: commits = [], isLoading: commitsLoading } = usePRCommits(owner, repo, pr.number)
  const { data: reviewThreads } = useReviewThreads(owner, repo, pr.number)
  const { data: issueComments = [] } = useIssueComments(owner, repo, pr.number)
  const { data: currentUser } = useCurrentUser()

  const isLoading = filesLoading || commentsLoading || reviewsLoading || commitsLoading

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

  useManualRefresh({
    isActive: !modals.hasModal,
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
      } else if (input === 'q' || key.escape) {
        if (pendingReview.isActive) {
          setShowDiscardConfirm(true)
        } else {
          onBack()
        }
      }
    },
    { isActive: !modals.hasModal },
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
          isActive={!modals.hasModal}
          onEditDescription={modals.handleOpenEditDescription}
        />
      )),
      Match.when(1, () => (
        <ConversationsTab
          pr={activePR}
          comments={comments}
          reviews={reviews}
          reviewThreads={reviewThreads}
          issueComments={issueComments}
          isActive={!modals.hasModal}
          showResolved={modals.showResolved}
          currentUser={currentUser?.login}
          onComment={modals.handleOpenGeneralComment}
          onReply={modals.handleOpenReply}
          onToggleResolve={modals.handleToggleResolve}
          onToggleShowResolved={modals.handleToggleShowResolved}
          onEditComment={modals.handleOpenEditComment}
          onEditDescription={modals.handleOpenEditDescription}
        />
      )),
      Match.when(2, () => <CommitsTab commits={commits} isActive={!modals.hasModal} />),
      Match.when(3, () => (
        <FilesTab
          files={files}
          isActive={!modals.hasModal}
          prUrl={activePR.html_url}
          onInlineComment={modals.handleOpenInlineComment}
          comments={comments}
          reviewThreads={reviewThreads}
          currentUser={currentUser?.login}
          onReply={modals.handleOpenReply}
          onToggleResolve={modals.handleToggleResolve}
          onEditComment={modals.handleOpenEditComment}
        />
      )),
      Match.orElse(() => (
        <DescriptionTab
          pr={activePR}
          reviews={reviews}
          isActive={!modals.hasModal}
          onEditDescription={modals.handleOpenEditDescription}
        />
      ))
    )
  }

  return (
    <Box flexDirection="column" flexGrow={1} minHeight={0}>
      <Box flexShrink={0} flexDirection="column">
        <PRHeader pr={activePR} owner={owner} repo={repo} prIndex={prIndex} prTotal={prTotal} />
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
        <Box paddingX={1}>
          <Text color={theme.colors.warning} bold>
            Discard pending review with {pendingReview.pendingCount} comment{pendingReview.pendingCount !== 1 ? 's' : ''}? (y/n)
          </Text>
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
    </Box>
  )
}
