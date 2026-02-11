import { Context, Layer } from 'effect'

export interface LoadingState {
  readonly isLoading: boolean
  readonly message: string | null
}

type Listener = () => void

export interface LoadingService {
  readonly start: (message: string) => void
  readonly stop: () => void
  readonly getState: () => LoadingState
  readonly subscribe: (listener: Listener) => () => void
}

export class Loading extends Context.Tag('Loading')<
  Loading,
  LoadingService
>() {}

function createLoadingService(): LoadingService {
  let state: LoadingState = { isLoading: false, message: null }
  const listeners = new Set<Listener>()

  function notify(): void {
    for (const listener of listeners) {
      listener()
    }
  }

  return {
    start: (message: string) => {
      state = { isLoading: true, message }
      notify()
    },

    stop: () => {
      state = { isLoading: false, message: null }
      notify()
    },

    getState: () => state,

    subscribe: (listener: Listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export const LoadingLive = Layer.sync(Loading, createLoadingService)
