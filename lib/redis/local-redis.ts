/**
 * Re-export from Memcached cache client.
 * This file maintains backward compatibility — existing imports of
 * `redis` from "@/lib/redis/local-redis" continue to work.
 */
export { cache as redis } from "@/lib/cache/memcached-client"
