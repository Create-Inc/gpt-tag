import { ChatCompletionChunk } from "openai/resources/chat/completions.mjs";

class FakeStream<Item> implements AsyncIterable<Item> {
  controller: AbortController;

  constructor(
    private iterator: () => AsyncIterator<Item>,
    controller: AbortController
  ) {
    this.controller = controller;
  }

  [Symbol.asyncIterator](): AsyncIterator<Item> {
    return this.iterator();
  }

  /**
   * Splits the stream into two streams which can be
   * independently read from at different speeds.
   */
  tee(): [FakeStream<Item>, FakeStream<Item>] {
    const left: Array<Promise<IteratorResult<Item>>> = [];
    const right: Array<Promise<IteratorResult<Item>>> = [];
    const iterator = this.iterator();

    const teeIterator = (
      queue: Array<Promise<IteratorResult<Item>>>
    ): AsyncIterator<Item> => {
      return {
        next: () => {
          if (queue.length === 0) {
            const result = iterator.next();
            left.push(result);
            right.push(result);
          }
          return queue.shift()!;
        },
      };
    };

    return [
      new FakeStream(() => teeIterator(left), this.controller),
      new FakeStream(() => teeIterator(right), this.controller),
    ];
  }

  /**
   * Converts this stream to a newline-separated ReadableFakeStream of
   * JSON stringified values in the stream
   * which can be turned back into a FakeStream with `Stream.fromReadableStream()`.
   */
  toReadableStream(): ReadableStream {
    const self = this;
    let iter: AsyncIterator<Item>;
    const encoder = new TextEncoder();

    return new ReadableStream({
      async start() {
        iter = self[Symbol.asyncIterator]();
      },
      async pull(ctrl) {
        try {
          const { value, done } = await iter.next();
          if (done) return ctrl.close();

          const bytes = encoder.encode(JSON.stringify(value) + "\n");

          ctrl.enqueue(bytes);
        } catch (err) {
          ctrl.error(err);
        }
      },
      async cancel() {
        await iter.return?.();
      },
    });
  }
}

/**
 * Returns an OpenAI stream suitable for testing.
 *
 * @example
 * ```ts
 * openAI.chat.completions.create = jest
 *   .fn()
 *   .mockResolvedValue(getTestStreamFromResponse('hello world'));
 * ```
 */
export const getTestStreamFromResponse = (
  finalResponse: string,
  options?: {
    /**
     * Number of characters to return per chunk.
     */
    chunkSize?: number;
    /**
     * AbortController to use for the stream.
     */
    abortController?: AbortController;
    /**
     * Delay between chunks in milliseconds.
     */
    delayMs?: number;
  }
): FakeStream<ChatCompletionChunk> => {
  const { chunkSize = 4 } = options || {};
  let i = 0;
  const stream = new FakeStream(
    () => ({
      next: async () => {
        if (options?.delayMs) {
          await new Promise((resolve) => setTimeout(resolve, options.delayMs));
        }
        if (i < finalResponse.length) {
          const content = finalResponse.slice(i, i + chunkSize);
          i += chunkSize;
          return {
            done: false,
            value: {
              id: 'fake-id',
              created: 1633288680,
              model: 'fake_model',
              object: 'chat.completion.chunk' as const,
              choices: [
                {
                  delta: { content },
                  finish_reason: 'stop' as const,
                  index: 0,
                },
              ],
            },
          };
        }
        return {
          done: true,
          value: '',
        };
      },
    }),
    options?.abortController || new AbortController()
  );
  return stream;
};
