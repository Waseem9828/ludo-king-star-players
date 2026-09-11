import redisWrapper from "../config/redis.js";

class TaskQueue {
  constructor(name) {
    this.name = name;
    this.queue = null;
    this.init();
  }

  async init() {
    if (redisWrapper.isConnected && redisWrapper.client) {
      try {
        const { Queue } = await import("bullmq");
        const connection = redisWrapper.client;
        this.queue = new Queue(this.name, { connection });
        console.log(`⚡ BullMQ Queue [${this.name}] initialized.`);
      } catch (e) {
        // BullMQ fallback to async setImmediate
      }
    }
  }

  async add(jobName, data, opts = {}) {
    if (this.queue) {
      try {
        return await this.queue.add(jobName, data, opts);
      } catch (err) {
        console.warn(`BullMQ add job error on [${this.name}]:`, err.message);
      }
    }

    // Fallback: Non-blocking asynchronous execution in same node process
    setImmediate(async () => {
      try {
        if (this.handler) {
          await this.handler({ name: jobName, data });
        }
      } catch (err) {
        console.error(`Fallback task execution failed [${this.name}]:`, err.message);
      }
    });
  }

  process(handler) {
    this.handler = handler;
    if (redisWrapper.isConnected && redisWrapper.client) {
      try {
        import("bullmq").then(({ Worker }) => {
          new Worker(this.name, async (job) => {
            await handler(job);
          }, { connection: redisWrapper.client });
        }).catch(() => {});
      } catch (e) {
        // Ignored
      }
    }
  }
}

export const matchCleanupQueue = new TaskQueue("match-cleanup");
export const otpQueue = new TaskQueue("otp-delivery");
export const notificationQueue = new TaskQueue("notification-dispatch");
