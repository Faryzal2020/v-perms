/**
 * Cache manager for Redis-based caching of permission checks
 */
class CacheManager {
    constructor(redisClient, options = {}) {
        this.redis = redisClient;
        this.options = {
            enabled: true,
            ttl: 300, // 5 minutes in seconds
            prefix: 'v-perms:',
            ...options,
        };
    }

    /**
     * Build a cache key from type and parts
     * @private
     */
    _buildKey(type, ...parts) {
        return `${this.options.prefix}${type}:${parts.join(':')}`;
    }

    /**
     * Get value from cache
     * @param {string} type - Cache type (e.g., 'user', 'role')
     * @param {...string} parts - Key parts
     * @returns {Promise<any|null>}
     */
    async get(type, ...parts) {
        if (!this.options.enabled || !this.redis) return null;

        try {
            const key = this._buildKey(type, ...parts);
            const value = await this.redis.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            // Fail silently on cache errors
            return null;
        }
    }

    /**
     * Set value in cache
     * @param {string} type - Cache type
     * @param {any} value - Value to cache
     * @param {...string} parts - Key parts
     */
    async set(type, value, ...parts) {
        if (!this.options.enabled || !this.redis) return;

        try {
            const key = this._buildKey(type, ...parts);
            await this.redis.setEx(key, this.options.ttl, JSON.stringify(value));
        } catch (error) {
            // Fail silently on cache errors
        }
    }

    /**
     * Delete specific cache entry
     * @param {string} type - Cache type
     * @param {...string} parts - Key parts
     */
    async delete(type, ...parts) {
        if (!this.redis) return;

        try {
            const key = this._buildKey(type, ...parts);
            await this.redis.del(key);
        } catch (error) {
            // Fail silently
        }
    }

    /**
     * Invalidate all cache entries for a user
     * @param {string} userId
     */
    async invalidateUser(userId) {
        if (!this.redis) return;

        try {
            const pattern = this._buildKey('user', userId, '*');
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
                await this.redis.del(...keys);
            }
        } catch (error) {
            // Fail silently
        }
    }

    /**
     * Invalidate all cache entries for a role
     * @param {string} roleId
     */
    async invalidateRole(roleId) {
        if (!this.redis) return;

        try {
            const pattern = this._buildKey('role', roleId, '*');
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
                await this.redis.del(...keys);
            }
        } catch (error) {
            // Fail silently
        }
    }

    /**
     * Clear entire permission cache
     */
    async clear() {
        if (!this.redis) return;

        try {
            const pattern = `${this.options.prefix}*`;
            const keys = await this.redis.keys(pattern);
            if (keys.length > 0) {
                await this.redis.del(...keys);
            }
        } catch (error) {
            // Fail silently
        }
    }

    /**
     * Check if caching is enabled and available
     * @returns {boolean}
     */
    isEnabled() {
        return this.options.enabled && this.redis !== null;
    }

    /**
     * Enable caching
     */
    enable() {
        this.options.enabled = true;
    }

    /**
     * Disable caching
     */
    disable() {
        this.options.enabled = false;
    }
}

export default CacheManager;
