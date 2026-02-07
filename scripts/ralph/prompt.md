# Ralph Agent Task

Implement features from user stories until all are complete.

## Workflow Per Iteration

1. Read `scripts/ralph/log.md` to understand what previous iterations completed.

2. Search `docs/user-stories/` for features with `"passes": false`.

3. If no features remain with `"passes": false`:
   - Output: <promise>FINISHED</promise>

4. Pick ONE feature - the highest priority non-passing feature based on dependencies and logical order.

5. Implement the feature:
   - Add or update tests when appropriate
   - Prefer small, focused changes
   - Keep performance guardrails in mind (virtualization, worker threads for heavy work)

6. Verify the feature:
   - Run `npm run user-stories:verify`
   - Run `npm run build`
   - Run `npm run bench` when the story is performance-related

7. If verification fails, debug and fix. Repeat until passing.

8. Once verified:
   - Update the user story's `passes` property to `true`
   - Append to `scripts/ralph/log.md` (keep it short but helpful)
   - Commit with a descriptive message

9. The iteration ends here. The next iteration will pick up the next feature.

## Completion

When ALL user stories have `"passes": true`, output:

<promise>FINISHED</promise>
