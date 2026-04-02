import { Queue } from 'bullmq'
import IORedis from 'ioredis'

// Lazily initialised — avoids Redis connection attempts during Next.js build
let _redisConnection: IORedis | null = null
let _shareEmailQueue: Queue | null = null

export function getRedisConnection(): IORedis {
  if (!_redisConnection) {
    _redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      enableOfflineQueue: false,
    })
  }
  return _redisConnection
}

export const QUEUE_NAMES = {
  SHARE_EMAIL: 'share-email',
  OTP_SEND: 'otp-send',
  BATCH_COMPLETE: 'batch-complete',
} as const

export function getShareEmailQueue(): Queue {
  if (!_shareEmailQueue) {
    _shareEmailQueue = new Queue(QUEUE_NAMES.SHARE_EMAIL, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    })
  }
  return _shareEmailQueue
}

// Keep named export for legacy imports
export const redisConnection = {
  get instance() { return getRedisConnection() },
}

export async function enqueueShareEmails(
  shareLinkIds: string[],
  batchId: string
): Promise<void> {
  const queue = getShareEmailQueue()
  const jobs = shareLinkIds.map(shareLinkId => ({
    name: 'send-share-email',
    data: { shareLinkId, batchId },
    opts: { jobId: `share-${shareLinkId}` },
  }))
  await queue.addBulk(jobs)
}
