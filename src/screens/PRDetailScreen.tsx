import React, { useState } from 'react'
import { Box, useInput } from 'ink'
import { Match } from 'effect'
import { usePRFiles, usePRComments, usePRReviews, usePRCommits } from '../hooks/useGitHub'
import { PRHeader } from '../components/pr/PRHeader'
import { PRTabs } from '../components/pr/PRTabs'
import { FilesTab } from '../components/pr/FilesTab'
import { ConversationsTab } from '../components/pr/ConversationsTab'
import { CommitsTab } from '../components/pr/CommitsTab'
import { LoadingIndicator } from '../components/common/LoadingIndicator'
import type { PullRequest } from '../models/pull-request'

interface PRDetailScreenProps {
  readonly pr: PullRequest
  readonly owner: string
  readonly repo: string
  readonly onBack: () => void
}

export function PRDetailScreen({
  pr,
  owner,
  repo,
  onBack,
}: PRDetailScreenProps): React.ReactElement {
  const [currentTab, setCurrentTab] = useState(0)

  // Fetch all PR data
  const { data: files = [], isLoading: filesLoading } = usePRFiles(owner, repo, pr.number)
  const { data: comments = [], isLoading: commentsLoading } = usePRComments(owner, repo, pr.number)
  const { data: reviews = [], isLoading: reviewsLoading } = usePRReviews(owner, repo, pr.number)
  const { data: commits = [], isLoading: commitsLoading } = usePRCommits(owner, repo, pr.number)

  const isLoading = filesLoading || commentsLoading || reviewsLoading || commitsLoading

  useInput((input, key) => {
    if (input === '1') {
      setCurrentTab(0)
    } else if (input === '2') {
      setCurrentTab(1)
    } else if (input === '3') {
      setCurrentTab(2)
    } else if (input === 'q' || key.escape) {
      onBack()
    }
  })

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
          isActive={true}
        />
      )),
      Match.when(1, () => <CommitsTab commits={commits} isActive={true} />),
      Match.when(2, () => <FilesTab files={files} isActive={true} />),
      Match.orElse(() => (
        <ConversationsTab
          pr={pr}
          comments={comments}
          reviews={reviews}
          isActive={true}
        />
      ))
    )
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <PRHeader pr={pr} />
      <PRTabs activeIndex={currentTab} />
      <Box flexGrow={1}>{renderTabContent()}</Box>
    </Box>
  )
}
