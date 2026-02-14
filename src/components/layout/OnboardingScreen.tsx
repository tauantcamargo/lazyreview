import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { useTheme } from '../../theme/index'
import { Modal } from '../common/Modal'

interface OnboardingStep {
  readonly title: string
  readonly lines: readonly string[]
}

const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    title: 'Welcome to LazyReview',
    lines: [
      'LazyReview is a terminal-based code review tool for GitHub,',
      'GitLab, Bitbucket, Azure DevOps, and Gitea/Forgejo PRs.',
      '',
      'Review PRs/MRs, browse diffs, leave comments, approve or',
      'request changes -- all without leaving your terminal.',
    ],
  },
  {
    title: 'Navigation',
    lines: [
      'j/k        Move up/down in lists',
      'h/l        Switch between sidebar and main panel',
      'Enter      Select / open',
      'q          Back / quit',
      '?          Open help',
      'Ctrl+B     Toggle sidebar',
    ],
  },
  {
    title: 'Review Workflow',
    lines: [
      'Select a PR from any list to open the detail view.',
      '',
      'Tabs: Description | Conversations | Commits | Files | Checks',
      '',
      'In the Files tab, press Enter to view diffs.',
      'Press d to toggle side-by-side diff mode.',
      'Press r to start a review, c to add comments.',
    ],
  },
  {
    title: 'Authentication',
    lines: [
      'LazyReview needs a token from your git hosting provider.',
      '',
      'GitHub: token with repo and read:user scopes',
      '  1. LAZYREVIEW_GITHUB_TOKEN env variable',
      '  2. Manually entered token (Settings > Set New Token)',
      '  3. GITHUB_TOKEN env variable',
      '  4. gh CLI (gh auth token)',
      '',
      'GitLab: token with api and read_user scopes',
      '  1. LAZYREVIEW_GITLAB_TOKEN env variable',
      '  2. Manually entered token (Settings > Set New Token)',
      '  3. GITLAB_TOKEN env variable',
      '  4. glab CLI (glab auth token)',
      '',
      'Bitbucket: app password with Repositories Read,',
      '           Pull requests Read/Write permissions',
      '  1. LAZYREVIEW_BITBUCKET_TOKEN env variable',
      '  2. Manually entered token (Settings > Set New Token)',
      '  3. BITBUCKET_TOKEN env variable',
      '',
      'Azure DevOps: PAT with Code Read & Write scope',
      '  1. LAZYREVIEW_AZURE_TOKEN env variable',
      '  2. Manually entered token (Settings > Set New Token)',
      '  3. AZURE_DEVOPS_TOKEN env variable',
      '',
      'Gitea/Forgejo: token with repo scope',
      '  1. LAZYREVIEW_GITEA_TOKEN env variable',
      '  2. Manually entered token (Settings > Set New Token)',
      '  3. GITEA_TOKEN env variable',
      '',
      "Provider is auto-detected from your git remote. You can also",
      "switch providers in Settings.",
    ],
  },
]

interface OnboardingScreenProps {
  readonly onComplete: () => void
}

export function OnboardingScreen({
  onComplete,
}: OnboardingScreenProps): React.ReactElement {
  const theme = useTheme()
  const [stepIndex, setStepIndex] = useState(0)

  const totalSteps = ONBOARDING_STEPS.length
  const currentStep = ONBOARDING_STEPS[stepIndex]
  const isLastStep = stepIndex === totalSteps - 1

  useInput((_input, key) => {
    if (key.escape) {
      onComplete()
      return
    }

    if (key.return || key.rightArrow) {
      if (isLastStep) {
        onComplete()
      } else {
        setStepIndex((prev) => Math.min(prev + 1, totalSteps - 1))
      }
      return
    }

    if (key.leftArrow) {
      setStepIndex((prev) => Math.max(prev - 1, 0))
    }
  })

  if (!currentStep) {
    onComplete()
    return <></>
  }

  return (
    <Modal>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.accent}
        backgroundColor={theme.colors.bg}
        paddingX={3}
        paddingY={1}
        gap={1}
        width={64}
      >
        <Text color={theme.colors.accent} bold>
          {currentStep.title}
        </Text>

        <Box flexDirection="column">
          {currentStep.lines.map((line, i) => (
            <Text key={i} color={line === '' ? undefined : theme.colors.text}>
              {line === '' ? ' ' : line}
            </Text>
          ))}
        </Box>

        <Box justifyContent="space-between" marginTop={1}>
          <Text color={theme.colors.muted}>
            Step {stepIndex + 1} of {totalSteps}
          </Text>
          <Box gap={2}>
            <Text color={theme.colors.muted} dimColor>
              Esc: skip
            </Text>
            {stepIndex > 0 && (
              <Text color={theme.colors.muted} dimColor>
                Left: back
              </Text>
            )}
            <Text color={theme.colors.info}>
              {isLastStep ? 'Enter: finish' : 'Enter: next'}
            </Text>
          </Box>
        </Box>

        <Box>
          {ONBOARDING_STEPS.map((_, i) => (
            <Text
              key={i}
              color={i === stepIndex ? theme.colors.accent : theme.colors.border}
            >
              {i === stepIndex ? ' ● ' : ' ○ '}
            </Text>
          ))}
        </Box>
      </Box>
    </Modal>
  )
}
