import { describe, it, expect } from 'vitest'
import { parseSseStream } from './sse'

/**
 * Helper: create a ReadableStream from a string.
 */
function stringToStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text))
      controller.close()
    },
  })
}

/**
 * Helper: create a ReadableStream that emits chunks one at a time.
 */
function chunksToStream(chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let index = 0
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]!))
        index++
      } else {
        controller.close()
      }
    },
  })
}

/**
 * Collect all events from an async iterable.
 */
async function collectEvents(
  iterable: AsyncIterable<{ readonly event?: string; readonly data: string }>,
): Promise<readonly { readonly event?: string; readonly data: string }[]> {
  const events: { readonly event?: string; readonly data: string }[] = []
  for await (const event of iterable) {
    events.push(event)
  }
  return events
}

describe('SSE Parser', () => {
  describe('parseSseStream', () => {
    it('should parse a single event', async () => {
      const stream = stringToStream('data: hello\n\n')
      const events = await collectEvents(parseSseStream(stream))

      expect(events).toEqual([{ event: undefined, data: 'hello' }])
    })

    it('should parse multiple events', async () => {
      const stream = stringToStream('data: first\n\ndata: second\n\n')
      const events = await collectEvents(parseSseStream(stream))

      expect(events).toEqual([
        { event: undefined, data: 'first' },
        { event: undefined, data: 'second' },
      ])
    })

    it('should parse events with event type', async () => {
      const stream = stringToStream('event: content_block_delta\ndata: {"text":"hi"}\n\n')
      const events = await collectEvents(parseSseStream(stream))

      expect(events).toEqual([
        { event: 'content_block_delta', data: '{"text":"hi"}' },
      ])
    })

    it('should handle [DONE] sentinel', async () => {
      const stream = stringToStream('data: {"chunk":1}\n\ndata: [DONE]\n\n')
      const events = await collectEvents(parseSseStream(stream))

      expect(events).toEqual([
        { event: undefined, data: '{"chunk":1}' },
        { event: undefined, data: '[DONE]' },
      ])
    })

    it('should handle chunked delivery', async () => {
      const stream = chunksToStream([
        'data: fir',
        'st\n\ndata: sec',
        'ond\n\n',
      ])
      const events = await collectEvents(parseSseStream(stream))

      expect(events).toEqual([
        { event: undefined, data: 'first' },
        { event: undefined, data: 'second' },
      ])
    })

    it('should skip empty lines between events', async () => {
      const stream = stringToStream('data: one\n\n\n\ndata: two\n\n')
      const events = await collectEvents(parseSseStream(stream))

      expect(events).toEqual([
        { event: undefined, data: 'one' },
        { event: undefined, data: 'two' },
      ])
    })

    it('should handle multi-line data', async () => {
      const stream = stringToStream('data: line1\ndata: line2\n\n')
      const events = await collectEvents(parseSseStream(stream))

      expect(events).toEqual([
        { event: undefined, data: 'line1\nline2' },
      ])
    })

    it('should flush remaining buffer on stream end', async () => {
      // Stream that ends without trailing double-newline
      const stream = stringToStream('data: final')
      const events = await collectEvents(parseSseStream(stream))

      expect(events).toEqual([{ event: undefined, data: 'final' }])
    })

    it('should return empty array for empty stream', async () => {
      const stream = stringToStream('')
      const events = await collectEvents(parseSseStream(stream))

      expect(events).toEqual([])
    })

    it('should ignore comment lines', async () => {
      const stream = stringToStream(': this is a comment\ndata: actual\n\n')
      const events = await collectEvents(parseSseStream(stream))

      expect(events).toEqual([{ event: undefined, data: 'actual' }])
    })

    it('should handle mixed event types', async () => {
      const stream = stringToStream(
        'event: message_start\ndata: {"type":"start"}\n\n' +
          'event: content_block_delta\ndata: {"text":"hello"}\n\n' +
          'event: message_stop\ndata: {}\n\n',
      )
      const events = await collectEvents(parseSseStream(stream))

      expect(events).toHaveLength(3)
      expect(events[0]?.event).toBe('message_start')
      expect(events[1]?.event).toBe('content_block_delta')
      expect(events[2]?.event).toBe('message_stop')
    })
  })
})
