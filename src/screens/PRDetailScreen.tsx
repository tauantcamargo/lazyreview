import React, { useState, useEffect } from 'react'
import { Box, Text, Pages, usePages, useKeymap } from 'tuir'
import type { KeyMap } from 'tuir'
import { useTheme } from '../theme/index'
import { useGitHub } from '../hooks/useGitHub'
import { PRHeader } from '../components/pr/PRHeader'
import { PRTabs } from '../components/pr/PRTabs'
import { FilesTab } from '../components/pr/FilesTab'
import { CommentsTab } from '../components/pr/CommentsTab'
import { LoadingIndicator } from '../components/common/LoadingIndicator'
import type { PullRequest } from '../models/pull-request'
import type { FileChange } from '../models/file-change'
import type { Comment } from '../models/comment'
import type { Review } from '../models/review'
import { timeAgo } from '../utils/date'

interface PRDetailScreenProps {
  readonly pr: PullRequest
  readonly owner: string
  readonly repo: string
  readonly onBack: () => void
}

const tabKeymap = {
  tab1: { input: '1' },
  tab2: { input: '2' },
  tab3: { input: '3' },
  back: { input: 'q' },
} satisfies KeyMap

function TimelineTab({
  reviews,
}: {
  readonly reviews: readonly Review[]
}): React.ReactElement {
  const theme = useTheme()

  if (reviews.length === 0) {
    return (
      <Box padding={1}>
        <Text color={theme.colors.muted}>No reviews yet</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" padding={1}>
      {reviews.map((review) => {
        const stateColor =
          review.state === 'APPROVED'
            ? theme.colors.success
            : review.state === 'CHANGES_REQUESTED'
              ? theme.colors.error
              : theme.colors.muted

        return (
          <Box key={review.id} gap={1}>
            <Text color={stateColor} bold>
              {review.state === 'APPROVED'
                ? 'V'
                : review.state === 'CHANGES_REQUESTED'
                  ? 'X'
                  : '*'}
            </Text>
            <Text color={theme.colors.secondary}>{review.user.login}</Text>
            <Text color={stateColor}>{review.state}</Text>
            {review.submitted_at && (
              <Text color={theme.colors.muted}>
                {timeAgo(review.submitted_at)}
              </Text>
            )}
          </Box>
        )
      })}
    </Box>
  )
}

export function PRDetailScreen({
  pr,
  owner,
  repo,
  onBack,
}: PRDetailScreenProps): React.ReactElement {
  const theme = useTheme()
  const { fetchFiles, fetchComments, fetchReviews } = useGitHub()
  const [files, setFiles] = useState<readonly FileChange[]>([])
  const [comments, setComments] = useState<readonly Comment[]>([])
  const [reviews, setReviews] = useState<readonly Review[]>([])
  const [loading, setLoading] = useState(true)

  const { pageView, control } = usePages(3)

  const { useEvent: useTabEvent } = useKeymap(tabKeymap)
  useTabEvent('tab1', () => control.goToPage(0))
  useTabEvent('tab2', () => control.goToPage(1))
  useTabEvent('tab3', () => control.goToPage(2))
  useTabEvent('back', onBack)

  useEffect(() => {
    let cancelled = false

    async function loadData(): Promise<void> {
      const [filesResult, commentsResult, reviewsResult] = await Promise.all([
        fetchFiles(owner, repo, pr.number),
        fetchComments(owner, repo, pr.number),
        fetchReviews(owner, repo, pr.number),
      ])

      if (cancelled) return

      setFiles(filesResult)
      setComments(commentsResult)
      setReviews(reviewsResult)
      setLoading(false)
    }

    loadData()

    return () => {
      cancelled = true
    }
  }, [owner, repo, pr.number, fetchFiles, fetchComments, fetchReviews])

  return (
    <Box flexDirection="column" flexGrow={1}>
      <PRHeader pr={pr} />
      <PRTabs activeIndex={control.currentPage} />
      <Box flexGrow={1}>
        {loading ? (
          <LoadingIndicator message="Loading PR details..." />
        ) : (
          <Pages pageView={pageView}>
            <FilesTab files={files} />
            <CommentsTab comments={comments} />
            <TimelineTab reviews={reviews} />
          </Pages>
        )}
      </Box>
    </Box>
  )
}
