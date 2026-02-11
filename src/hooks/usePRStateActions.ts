import { useState, useCallback } from 'react'
import {
  useMergePR,
  useClosePullRequest,
  useReopenPullRequest,
} from './useGitHubMutations'
import type { MergeMethod } from './useGitHubMutations'

interface UsePRStateActionsOptions {
  readonly owner: string
  readonly repo: string
  readonly prNumber: number
  readonly setStatusMessage: (msg: string) => void
  readonly onMergeSuccess: () => void
  readonly onCloseSuccess?: () => void
}

export function usePRStateActions({
  owner,
  repo,
  prNumber,
  setStatusMessage,
  onMergeSuccess,
  onCloseSuccess,
}: UsePRStateActionsOptions) {
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [mergeError, setMergeError] = useState<string | null>(null)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)

  const mergePR = useMergePR()
  const closePR = useClosePullRequest()
  const reopenPR = useReopenPullRequest()

  const handleMergeSubmit = useCallback(
    (mergeMethod: MergeMethod, commitTitle?: string) => {
      setMergeError(null)
      mergePR.mutate(
        { owner, repo, prNumber, mergeMethod, commitTitle },
        {
          onSuccess: () => {
            setShowMergeModal(false)
            setStatusMessage('PR merged successfully')
            onMergeSuccess()
          },
          onError: (err) => setMergeError(String(err)),
        },
      )
    },
    [owner, repo, prNumber, mergePR, setStatusMessage, onMergeSuccess],
  )

  const openMergeModal = useCallback(() => {
    setMergeError(null)
    setShowMergeModal(true)
  }, [])

  const handleClosePR = useCallback(() => {
    closePR.mutate(
      { owner, repo, prNumber },
      {
        onSuccess: () => {
          setShowCloseConfirm(false)
          setStatusMessage('PR closed')
          onCloseSuccess?.()
        },
        onError: (err) => {
          setShowCloseConfirm(false)
          setStatusMessage(`Error closing PR: ${String(err)}`)
        },
      },
    )
  }, [owner, repo, prNumber, closePR, setStatusMessage, onCloseSuccess])

  const handleReopenPR = useCallback(() => {
    reopenPR.mutate(
      { owner, repo, prNumber },
      {
        onSuccess: () => setStatusMessage('PR reopened'),
        onError: (err) => setStatusMessage(`Error reopening PR: ${String(err)}`),
      },
    )
  }, [owner, repo, prNumber, reopenPR, setStatusMessage])

  return {
    showMergeModal,
    mergeError,
    mergePRPending: mergePR.isPending,
    handleMergeSubmit,
    openMergeModal,
    closeMergeModal: useCallback(() => setShowMergeModal(false), []),
    showCloseConfirm,
    openCloseConfirm: useCallback(() => setShowCloseConfirm(true), []),
    closeCloseConfirm: useCallback(() => setShowCloseConfirm(false), []),
    handleClosePR,
    handleReopenPR,
    closePRPending: closePR.isPending,
    reopenPRPending: reopenPR.isPending,
  } as const
}
