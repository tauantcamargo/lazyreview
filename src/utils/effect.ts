import { Effect } from 'effect'
import { AppLayer } from '../services/index'

export function runEffect<A>(
  effect: Effect.Effect<A, unknown, unknown>,
): Promise<A> {
  const provided = effect.pipe(
    Effect.provide(AppLayer),
    Effect.catchAll((error) => Effect.die(error)),
  )
  // After providing AppLayer and converting errors to defects,
  // requirements are satisfied but TypeScript can't narrow `unknown`.
  return Effect.runPromise(provided as Effect.Effect<A, never, never>)
}
