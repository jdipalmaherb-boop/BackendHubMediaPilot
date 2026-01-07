import IORedis from 'ioredis';
import { env } from '../env';

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis | null {
  if (connection) {
    return connection;
  }

  try {
    const redisUrl = env.REDIS_URL || 'redis://localhost:6379';
    connection = new IORedis(redisUrl, { 
      maxRetriesPerRequest: null,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });

    // Handle connection errors gracefully
    connection.on('error', (error) => {
      console.warn('Redis connection error:', error.message);
    });

    connection.on('connect', () => {
      console.log('Redis connected successfully');
    });

    return connection;
  } catch (error) {
    console.warn('Failed to create Redis connection:', error.message);
    return null;
  }
}

export function closeRedisConnection(): Promise<void> {
  if (connection) {
    return connection.quit();
  }
  return Promise.resolve();
}
