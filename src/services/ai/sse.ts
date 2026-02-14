/**
 * Shared SSE (Server-Sent Events) stream parser.
 *
 * Parses a ReadableStream of bytes into SSE events.
 * Used by Anthropic, OpenAI, and Ollama adapters for streaming responses.
 */

export interface SseEvent {
  readonly event?: string
  readonly data: string
}

/**
 * Parse a ReadableStream<Uint8Array> into an async iterable of SSE events.
 *
 * Handles:
 * - Multi-line `data:` fields
 * - `event:` fields
 * - Empty lines as event delimiters
 * - `[DONE]` sentinel (yields event but does not stop iteration)
 */
export async function* parseSseStream(
  stream: ReadableStream<Uint8Array>,
): AsyncIterable<SseEvent> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        // Flush any remaining buffered event
        if (buffer.trim().length > 0) {
          const event = parseEventBlock(buffer)
          if (event !== null) {
            yield event
          }
        }
        break
      }

      buffer += decoder.decode(value, { stream: true })

      // Split on double newlines (event boundaries)
      const parts = buffer.split('\n\n')

      // The last part might be incomplete, keep it in the buffer
      buffer = parts[parts.length - 1] ?? ''

      // Process all complete event blocks
      for (let i = 0; i < parts.length - 1; i++) {
        const block = parts[i]
        if (block === undefined || block.trim().length === 0) {
          continue
        }
        const event = parseEventBlock(block)
        if (event !== null) {
          yield event
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Parse a single SSE event block (lines between double-newlines).
 */
function parseEventBlock(block: string): SseEvent | null {
  const lines = block.split('\n')
  let eventType: string | undefined
  const dataLines: string[] = []

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
    // Ignore id:, retry:, and comment lines (starting with :)
  }

  if (dataLines.length === 0) {
    return null
  }

  return {
    event: eventType,
    data: dataLines.join('\n'),
  }
}
