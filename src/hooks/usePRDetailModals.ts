import { useReviewActions } from './useReviewActions'
import { useCommentActions } from './useCommentActions'
import { usePRStateActions } from './usePRStateActions'

export type { EditCommentContext, EditDescriptionContext, EditTitleContext } from './useCommentActions'

interface UsePRDetailModalsOptions {
  readonly owner: string
  readonly repo: string
  readonly prNumber: number
  readonly headSha: string
  readonly setStatusMessage: (msg: string) => void
  readonly onMergeSuccess: () => void
  readonly onCloseSuccess?: () => void
}

export function usePRDetailModals({
  owner,
  repo,
  prNumber,
  headSha,
  setStatusMessage,
  onMergeSuccess,
  onCloseSuccess,
}: UsePRDetailModalsOptions) {
  const review = useReviewActions({ owner, repo, prNumber, setStatusMessage })
  const comments = useCommentActions({ owner, repo, prNumber, headSha, setStatusMessage })
  const prState = usePRStateActions({ owner, repo, prNumber, setStatusMessage, onMergeSuccess, onCloseSuccess })

  const hasModal =
    review.showReviewModal ||
    comments.showCommentModal ||
    prState.showMergeModal ||
    review.showReReviewModal ||
    prState.showCloseConfirm

  return {
    hasModal,
    // Review actions
    showReviewModal: review.showReviewModal,
    reviewError: review.reviewError,
    submitReviewPending: review.submitReviewPending,
    handleReviewSubmit: review.handleReviewSubmit,
    openReviewModal: review.openReviewModal,
    closeReviewModal: review.closeReviewModal,
    showReReviewModal: review.showReReviewModal,
    reReviewError: review.reReviewError,
    requestReReviewPending: review.requestReReviewPending,
    handleReReviewSubmit: review.handleReReviewSubmit,
    openReReviewModal: review.openReReviewModal,
    closeReReviewModal: review.closeReReviewModal,
    handleToggleResolve: review.handleToggleResolve,
    showResolved: review.showResolved,
    handleToggleShowResolved: review.handleToggleShowResolved,
    // Comment actions
    showCommentModal: comments.showCommentModal,
    commentError: comments.commentError,
    commentModalTitle: comments.commentModalTitle,
    commentModalContext: comments.commentModalContext,
    commentModalDefaultValue: comments.commentModalDefaultValue,
    commentSubmitPending: comments.commentSubmitPending,
    inlineContext: comments.inlineContext,
    editContext: comments.editContext,
    handleCommentSubmit: comments.handleCommentSubmit,
    handleOpenGeneralComment: comments.handleOpenGeneralComment,
    handleOpenInlineComment: comments.handleOpenInlineComment,
    handleOpenReply: comments.handleOpenReply,
    handleOpenEditComment: comments.handleOpenEditComment,
    handleOpenEditDescription: comments.handleOpenEditDescription,
    handleOpenEditTitle: comments.handleOpenEditTitle,
    closeCommentModal: comments.closeCommentModal,
    // PR state actions
    showMergeModal: prState.showMergeModal,
    mergeError: prState.mergeError,
    mergePRPending: prState.mergePRPending,
    handleMergeSubmit: prState.handleMergeSubmit,
    openMergeModal: prState.openMergeModal,
    closeMergeModal: prState.closeMergeModal,
    showCloseConfirm: prState.showCloseConfirm,
    openCloseConfirm: prState.openCloseConfirm,
    closeCloseConfirm: prState.closeCloseConfirm,
    handleClosePR: prState.handleClosePR,
    handleReopenPR: prState.handleReopenPR,
    closePRPending: prState.closePRPending,
    reopenPRPending: prState.reopenPRPending,
  }
}
