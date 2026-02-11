import React, { useState, useCallback } from 'react'
import { Box, useInput, useStdout } from 'ink'
import { Match } from 'effect'
import {
  usePullRequest,
  usePRFiles,
  usePRComments,
  usePRReviews,
  usePRCommits,
  useReviewThreads,
  useSubmitReview,
  useCreateComment,
  useCreateReviewComment,
  useReplyToReviewComment,
  useResolveReviewThread,
  useUnresolveReviewThread,
  useRequestReReview,
  useMergePR,
} from '../hooks/useGitHub'
import type { ReviewEvent, MergeMethod } from '../hooks/useGitHub'
import { PRHeader } from '../components/pr/PRHeader'
import { PRTabs } from '../components/pr/PRTabs'
import { FilesTab } from '../components/pr/FilesTab'
import { ConversationsTab, type ReplyContext, type ResolveContext } from '../components/pr/ConversationsTab'
import { CommitsTab } from '../components/pr/CommitsTab'
import { ReviewModal } from '../components/pr/ReviewModal'
import { CommentModal } from '../components/pr/CommentModal'
import { MergeModal } from '../components/pr/MergeModal'
import { ReReviewModal, buildReviewerList } from '../components/pr/ReReviewModal'
import { LoadingIndicator } from '../components/common/LoadingIndicator'
import { openInBrowser } from '../utils/terminal'
import { useStatusMessage } from '../hooks/useStatusMessage'
import { useManualRefresh } from '../hooks/useManualRefresh'
import type { PullRequest } from '../models/pull-request'

export interface InlineCommentContext {
  readonly path: string
  readonly line: number
  readonly side: 'LEFT' | 'RIGHT'
  readonly startLine?: number
  readonly startSide?: 'LEFT' | 'RIGHT'
}

interface PRDetailScreenProps {
  readonly pr: PullRequest
  readonly owner: string
  readonly repo: string
  readonly onBack: () => void
}

const PR_DETAIL_RESERVED_LINES = 12

export function PRDetailScreen({
  pr,
  owner,
  repo,
  onBack,
}: PRDetailScreenProps): React.ReactElement {
  const { stdout } = useStdout()
  const { setStatusMessage } = useStatusMessage()
  const [currentTab, setCurrentTab] = useState(0)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [showCommentModal, setShowCommentModal] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [mergeError, setMergeError] = useState<string | null>(null)
  const [showReReviewModal, setShowReReviewModal] = useState(false)
  const [reReviewError, setReReviewError] = useState<string | null>(null)
  const [inlineContext, setInlineContext] = useState<InlineCommentContext | null>(null)
  const [replyContext, setReplyContext] = useState<ReplyContext | null>(null)
  const [showResolved, setShowResolved] = useState(true)
  const contentHeight = Math.max(1, (stdout?.rows ?? 24) - PR_DETAIL_RESERVED_LINES)

  const submitReview = useSubmitReview()
  const createComment = useCreateComment()
  const createReviewComment = useCreateReviewComment()
  const replyToReviewComment = useReplyToReviewComment()
  const resolveThread = useResolveReviewThread()
  const unresolveThread = useUnresolveReviewThread()
  const requestReReview = useRequestReReview()
  const mergePR = useMergePR()

  const hasModal = showReviewModal || showCommentModal || showMergeModal || showReReviewModal

  useManualRefresh({
    isActive: !hasModal,
  })

  // Fetch full PR data (search API doesn't include head.sha)
  const { data: fullPR } = usePullRequest(owner, repo, pr.number)
  const activePR = fullPR ?? pr

  // Fetch all PR data
  const { data: files = [], isLoading: filesLoading } = usePRFiles(owner, repo, pr.number)
  const { data: comments = [], isLoading: commentsLoading } = usePRComments(owner, repo, pr.number)
  const { data: reviews = [], isLoading: reviewsLoading } = usePRReviews(owner, repo, pr.number)
  const { data: commits = [], isLoading: commitsLoading } = usePRCommits(owner, repo, pr.number)
  const { data: reviewThreads } = useReviewThreads(owner, repo, pr.number)

  const isLoading = filesLoading || commentsLoading || reviewsLoading || commitsLoading

  const handleReviewSubmit = useCallback(
    (body: string, event: ReviewEvent) => {
      setReviewError(null)
      submitReview.mutate(
        { owner, repo, prNumber: pr.number, body, event },
        {
          onSuccess: () => {
            setShowReviewModal(false)
            setStatusMessage('Review submitted')
          },
          onError: (err) => {
            setReviewError(String(err))
          },
        },
      )
    },
    [owner, repo, pr.number, submitReview, setStatusMessage],
  )

  const handleOpenGeneralComment = useCallback(() => {
    setCommentError(null)
    setInlineContext(null)
    setReplyContext(null)
    setShowCommentModal(true)
  }, [])

  const handleOpenInlineComment = useCallback((context: InlineCommentContext) => {
    setCommentError(null)
    setInlineContext(context)
    setReplyContext(null)
    setShowCommentModal(true)
  }, [])

  const handleOpenReply = useCallback((context: ReplyContext) => {
    setCommentError(null)
    setInlineContext(null)
    setReplyContext(context)
    setShowCommentModal(true)
  }, [])

  const handleToggleResolve = useCallback(
    (context: ResolveContext) => {
      if (context.isResolved) {
        unresolveThread.mutate(
          { owner, repo, prNumber: pr.number, threadId: context.threadId },
          {
            onSuccess: () => setStatusMessage('Thread unresolved'),
            onError: (err) => setStatusMessage(`Error: ${String(err)}`),
          },
        )
      } else {
        resolveThread.mutate(
          { owner, repo, prNumber: pr.number, threadId: context.threadId },
          {
            onSuccess: () => setStatusMessage('Thread resolved'),
            onError: (err) => setStatusMessage(`Error: ${String(err)}`),
          },
        )
      }
    },
    [owner, repo, pr.number, resolveThread, unresolveThread, setStatusMessage],
  )

  const handleToggleShowResolved = useCallback(() => {
    setShowResolved((prev) => !prev)
  }, [])

  const handleReReviewSubmit = useCallback(
    (reviewers: readonly string[]) => {
      setReReviewError(null)
      requestReReview.mutate(
        { owner, repo, prNumber: pr.number, reviewers },
        {
          onSuccess: () => {
            setShowReReviewModal(false)
            setStatusMessage(`Re-review requested from ${reviewers.join(', ')}`)
          },
          onError: (err) => {
            setReReviewError(String(err))
          },
        },
      )
    },
    [owner, repo, pr.number, requestReReview, setStatusMessage],
  )

  const handleCommentSubmit = useCallback(
    (body: string) => {
      setCommentError(null)

      if (replyContext) {
        replyToReviewComment.mutate(
          {
            owner,
            repo,
            prNumber: pr.number,
            body,
            inReplyTo: replyContext.commentId,
          },
          {
            onSuccess: () => {
              setShowCommentModal(false)
              setReplyContext(null)
              setStatusMessage('Reply posted')
            },
            onError: (err) => {
              setCommentError(String(err))
            },
          },
        )
      } else if (inlineContext) {
        createReviewComment.mutate(
          {
            owner,
            repo,
            prNumber: pr.number,
            body,
            commitId: activePR.head.sha,
            path: inlineContext.path,
            line: inlineContext.line,
            side: inlineContext.side,
            startLine: inlineContext.startLine,
            startSide: inlineContext.startSide,
          },
          {
            onSuccess: () => {
              setShowCommentModal(false)
              setInlineContext(null)
              setStatusMessage('Comment posted')
            },
            onError: (err) => {
              setCommentError(String(err))
            },
          },
        )
      } else {
        createComment.mutate(
          { owner, repo, issueNumber: pr.number, body },
          {
            onSuccess: () => {
              setShowCommentModal(false)
              setStatusMessage('Comment posted')
            },
            onError: (err) => {
              setCommentError(String(err))
            },
          },
        )
      }
    },
    [owner, repo, pr.number, replyContext, inlineContext, createComment, createReviewComment, replyToReviewComment, setStatusMessage],
  )

  const handleMergeSubmit = useCallback(
    (mergeMethod: MergeMethod, commitTitle?: string) => {
      setMergeError(null)
      mergePR.mutate(
        { owner, repo, prNumber: pr.number, mergeMethod, commitTitle },
        {
          onSuccess: () => {
            setShowMergeModal(false)
            setStatusMessage('PR merged successfully')
            onBack()
          },
          onError: (err) => {
            setMergeError(String(err))
          },
        },
      )
    },
    [owner, repo, pr.number, mergePR, setStatusMessage, onBack],
  )

  useInput(
    (input, key) => {
      if (input === '1') {
        setCurrentTab(0)
      } else if (input === '2') {
        setCurrentTab(1)
      } else if (input === '3') {
        setCurrentTab(2)
      } else if (input === 'o') {
        openInBrowser(pr.html_url)
        setStatusMessage('Opened in browser')
      } else if (input === 'r' && currentTab !== 0) {
        setReviewError(null)
        setShowReviewModal(true)
      } else if (input === 'R') {
        setReviewError(null)
        setShowReviewModal(true)
      } else if (input === 'e') {
        setReReviewError(null)
        setShowReReviewModal(true)
      } else if (input === 'm') {
        setMergeError(null)
        setShowMergeModal(true)
      } else if (input === 'q' || key.escape) {
        onBack()
      }
    },
    { isActive: !hasModal },
  )

  const renderTabContent = (): React.ReactElement => {
    if (isLoading) {
      return <LoadingIndicator message="Loading PR details..." />
    }

    return Match.value(currentTab).pipe(
      Match.when(0, () => (
        <ConversationsTab
          pr={activePR}
          comments={comments}
          reviews={reviews}
          reviewThreads={reviewThreads}
          isActive={!hasModal}
          showResolved={showResolved}
          onComment={handleOpenGeneralComment}
          onReply={handleOpenReply}
          onToggleResolve={handleToggleResolve}
          onToggleShowResolved={handleToggleShowResolved}
        />
      )),
      Match.when(1, () => <CommitsTab commits={commits} isActive={!hasModal} />),
      Match.when(2, () => (
        <FilesTab
          files={files}
          isActive={!hasModal}
          onInlineComment={handleOpenInlineComment}
        />
      )),
      Match.orElse(() => (
        <ConversationsTab
          pr={activePR}
          comments={comments}
          reviews={reviews}
          reviewThreads={reviewThreads}
          isActive={!hasModal}
          showResolved={showResolved}
          onComment={handleOpenGeneralComment}
          onReply={handleOpenReply}
          onToggleResolve={handleToggleResolve}
          onToggleShowResolved={handleToggleShowResolved}
        />
      ))
    )
  }

  const commentModalTitle = replyContext
    ? `Reply to ${replyContext.user}`
    : inlineContext
      ? 'Add Inline Comment'
      : 'Add Comment'
  const commentModalContext = replyContext
    ? (replyContext.body ? replyContext.body.slice(0, 100) + (replyContext.body.length > 100 ? '...' : '') : undefined)
    : inlineContext
      ? `${inlineContext.path}:${inlineContext.line}`
      : undefined

  return (
    <Box flexDirection="column" flexGrow={1}>
      <PRHeader pr={activePR} owner={owner} repo={repo} />
      <PRTabs activeIndex={currentTab} onChange={setCurrentTab} />
      <Box height={contentHeight} overflow="hidden" flexDirection="column">
        {renderTabContent()}
      </Box>
      {showReviewModal && (
        <ReviewModal
          onSubmit={handleReviewSubmit}
          onClose={() => setShowReviewModal(false)}
          isSubmitting={submitReview.isPending}
          error={reviewError}
        />
      )}
      {showCommentModal && (
        <CommentModal
          title={commentModalTitle}
          context={commentModalContext}
          onSubmit={handleCommentSubmit}
          onClose={() => {
            setShowCommentModal(false)
            setInlineContext(null)
            setReplyContext(null)
          }}
          isSubmitting={createComment.isPending || createReviewComment.isPending || replyToReviewComment.isPending}
          error={commentError}
        />
      )}
      {showMergeModal && (
        <MergeModal
          pr={activePR}
          onSubmit={handleMergeSubmit}
          onClose={() => setShowMergeModal(false)}
          isSubmitting={mergePR.isPending}
          error={mergeError}
        />
      )}
      {showReReviewModal && (
        <ReReviewModal
          reviewers={buildReviewerList(reviews, activePR.requested_reviewers)}
          onSubmit={handleReReviewSubmit}
          onClose={() => setShowReReviewModal(false)}
          isSubmitting={requestReReview.isPending}
          error={reReviewError}
        />
      )}
    </Box>
  )
}
