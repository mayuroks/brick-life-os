/**
 * Per-channel FIFO queue. Guarantees messages in one channel are processed
 * serially so replies don't interleave (edge case: burst traffic).
 */
export class ChannelQueue {
  constructor() {
    this.chains = new Map();
  }

  /**
   * Enqueue a job for a channel. Runs after any pending job for that channel.
   * @param {string} channelId
   * @param {(value:void)=>Promise<any>} fn
   */
  enqueue(channelId, fn) {
    const prev = this.chains.get(channelId) || Promise.resolve();
    const next = prev.catch(() => {}).then(fn);
    this.chains.set(channelId, next.catch(() => {}));
    return next;
  }
}
