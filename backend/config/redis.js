import EventEmitter from "events";

class RedisClientWrapper extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.isConnected = false;
    this.initAttempts = 0;
    this.init();
  }

  async init() {
    const redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL;
    
    if (!redisUrl && process.env.NODE_ENV === "production") {
      console.warn("⚠️ REDIS_URL not configured. Redis caching running in memory bypass mode.");
      return;
    }

    try {
      // Dynamic import to allow seamless fallback if ioredis package isn't present
      const { default: Redis } = await import("ioredis");
      
      const targetUrl = redisUrl || "redis://127.0.0.1:6379";
      
      this.client = new Redis(targetUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          if (times > 5) {
            console.warn("⚠️ Redis retry cap reached. Disabling Redis temporarily.");
            return null; // stop retrying temporarily
          }
          return Math.min(times * 500, 3000);
        },
        enableOfflineQueue: false, // Don't block requests if Redis is down
        connectTimeout: 5000,
      });

      this.client.on("connect", () => {
        this.isConnected = true;
        console.log("⚡ Redis connection established successfully.");
      });

      this.client.on("error", (err) => {
        if (this.isConnected) {
          console.warn("⚠️ Redis connection error:", err.message);
        }
        this.isConnected = false;
      });

      this.client.on("close", () => {
        this.isConnected = false;
      });

    } catch (e) {
      console.warn("⚠️ Redis client initialized in fallback mode (ioredis module not active).");
    }
  }

  async get(key) {
    if (!this.isConnected || !this.client) return null;
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.warn(`Redis GET error for key ${key}:`, err.message);
      return null;
    }
  }

  async set(key, value, ttlSeconds = 10) {
    if (!this.isConnected || !this.client) return false;
    try {
      const stringified = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await this.client.set(key, stringified, "EX", ttlSeconds);
      } else {
        await this.client.set(key, stringified);
      }
      return true;
    } catch (err) {
      console.warn(`Redis SET error for key ${key}:`, err.message);
      return false;
    }
  }

  async del(...keys) {
    if (!this.isConnected || !this.client || keys.length === 0) return false;
    try {
      await this.client.del(...keys);
      return true;
    } catch (err) {
      console.warn("Redis DEL error:", err.message);
      return false;
    }
  }

  async delByPattern(pattern) {
    if (!this.isConnected || !this.client) return false;
    try {
      const stream = this.client.scanStream({ match: pattern, count: 100 });
      stream.on("data", async (keys) => {
        if (keys.length > 0) {
          const pipeline = this.client.pipeline();
          keys.forEach((key) => pipeline.del(key));
          await pipeline.exec();
        }
      });
      return true;
    } catch (err) {
      console.warn("Redis delByPattern error:", err.message);
      return false;
    }
  }
}

export const redisWrapper = new RedisClientWrapper();
export default redisWrapper;
