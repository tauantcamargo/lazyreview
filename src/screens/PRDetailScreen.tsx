import React, { useState, useCallback } from 'react'
import { Box, useInput, useStdout } from 'ink'
import { Match } from 'effect'
import {
  usePRFiles,
  usePRComments,
  usePRReviews,
  usePRCommits,
  useSubmitReview,
  useCreateComment,
  useCreateReviewComment,
} from '../hooks/useGitHub'
import type { ReviewEvent } from '../hooks/useGitHub'
import { PRHeader } from '../components/pr/PRHeader'
import { PRTabs } from '../components/pr/PRTabs'
import { FilesTab } from '../components/pr/FilesTab'
import { ConversationsTab } from '../components/pr/ConversationsTab'
import { CommitsTab } from '../components/pr/CommitsTab'
import { ReviewModal } from '../components/pr/ReviewModal'
import { CommentModal } from '../components/pr/CommentModal'
import { LoadingIndicator } from '../components/common/LoadingIndicator'
import { openInBrowser } from '../utils/terminal'
import { useStatusMessage } from '../hooks/useStatusMessage'
import type { PullRequest } from '../models/pull-request'

export interface InlineCommentContext {
  readonly path: string
  readonly line: number
  readonly side: 'LEFT' | 'RIGHT'
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
  const [inlineContext, setInlineContext] = useState<InlineCommentContext | null>(null)
  const contentHeight = Math.max(1, (stdout?.rows ?? 24) - PR_DETAIL_RESERVED_LINES)

  const submitReview = useSubmitReview()
  const createComment = useCreateComment()
  const createReviewComment = useCreateReviewComment()

  const hasModal = showReviewModal || showCommentModal

  // Fetch all PR data
  const { data: files = [], isLoading: filesLoading } = usePRFiles(owner, repo, pr.number)
  const { data: comments = [], isLoading: commentsLoading } = usePRComments(owner, repo, pr.number)
  const { data: reviews = [], isLoading: reviewsLoading } = usePRReviews(owner, repo, pr.number)
  const { data: commits = [], isLoading: commitsLoading } = usePRCommits(owner, repo, pr.number)

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
    setShowCommentModal(true)
  }, [])

  const handleOpenInlineComment = useCallback((context: InlineCommentContext) => {
    setCommentError(null)
    setInlineContext(context)
    setShowCommentModal(true)
  }, [])

  const handleCommentSubmit = useCallback(
    (body: string) => {
      setCommentError(null)

      if (inlineContext) {
        createReviewComment.mutate(
          {
            owner,
            repo,
            prNumber: pr.number,
            body,
            commitId: pr.head.sha,
            path: inlineContext.path,
            line: inlineContext.line,
            side: inlineContext.side,
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
    [owner, repo, pr.number, inlineContext, createComment, createReviewComment, setStatusMessage],
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
      } else if (input === 'r') {
        setReviewError(null)
        setShowReviewModal(true)
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
          pr={pr}
          comments={comments}
          reviews={reviews}
          isActive={!hasModal}
          onComment={handleOpenGeneralComment}
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
          pr={pr}
          comments={comments}
          reviews={reviews}
          isActive={!hasModal}
          onComment={handleOpenGeneralComment}
        />
      ))
    )
  }

  const commentModalTitle = inlineContext
    ? 'Add Inline Comment'
    : 'Add Comment'
  const commentModalContext = inlineContext
    ? `${inlineContext.path}:${inlineContext.line}`
    : undefined

  return (
    <Box flexDirection="column" flexGrow={1}>
      <PRHeader pr={pr} owner={owner} repo={repo} />
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
          }}
          isSubmitting={createComment.isPending || createReviewComment.isPending}
          error={commentError}
        />
      )}
    </Box>
  )
}
