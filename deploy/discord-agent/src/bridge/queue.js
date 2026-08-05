/**
 * Global single-slot FIFO queue. Exactly one job runs at a time across ALL
 * channels, so no more than one agent turn is ever in flight (no OOM on the
 * memory-constrained free-tier host). Excess jobs wait in an in-memory array and
 * drain in arrival order; no job is dropped.
 */
export class ChannelQueue {
  constructor() {
    this.jobs = [];
    this.busy = false;
  }

  /**
   * Enqueue a job. The job runs after any currently-running and pending jobs.
   * @param {string} channelId - source channel (used only for routing/logging).
   * @param {(value:void)=>Promise<any>} fn
   * @returns {Promise<any>} resolution of the job, in arrival order.
   */
  enqueue(channelId, fn) {
    let resolveJob;
    let rejectJob;
    const done = new Promise((res, rej) => {
      resolveJob = res;
      rejectJob = rej;
    });
    this.jobs.push({ run: fn, resolve: resolveJob, reject: rejectJob });
    this.pump();
    return done;
  }

  pump() {
    if (this.busy) return;
    const entry = this.jobs.shift();
    if (!entry) return;
    this.busy = true;
    Promise.resolve()
      .then(entry.run)
      .then(entry.resolve, entry.reject)
      .catch(() => {})
      .finally(() => {
        this.busy = false;
        if (this.jobs.length) this.pump();
      });
  }
}
