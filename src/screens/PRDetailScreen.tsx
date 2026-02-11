import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
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
  const { fetchFiles, fetchComments, fetchReviews } = useGitHub()
  const [files, setFiles] = useState<readonly FileChange[]>([])
  const [comments, setComments] = useState<readonly Comment[]>([])
  const [reviews, setReviews] = useState<readonly Review[]>([])
  const [loading, setLoading] = useState(true)
  const [currentTab, setCurrentTab] = useState(0)

  useInput((input, key) => {
    if (input === '1') {
      setCurrentTab(0)
    } else if (input === '2') {
      setCurrentTab(1)
    } else if (input === '3') {
      setCurrentTab(2)
    } else if (input === 'q' || key.escape) {
      onBack()
    } else if (key.tab) {
      setCurrentTab((prev) => (prev + 1) % 3)
    }
  })

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

  const renderTabContent = (): React.ReactElement => {
    if (loading) {
      return <LoadingIndicator message="Loading PR details..." />
    }

    switch (currentTab) {
      case 0:
        return <FilesTab files={files} />
      case 1:
        return <CommentsTab comments={comments} />
      case 2:
        return <TimelineTab reviews={reviews} />
      default:
        return <FilesTab files={files} />
    }
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <PRHeader pr={pr} />
      <PRTabs activeIndex={currentTab} />
      <Box flexGrow={1}>{renderTabContent()}</Box>
    </Box>
  )
}
