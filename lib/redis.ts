import "server-only";
import { Redis } from "@upstash/redis";

let redis: Redis | null = null;
export function getRedis() {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error("Upstash Redis no está configurado");
    redis = new Redis({ url, token });
  }
  return redis;
}
