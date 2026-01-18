import PrismaAdapter from './adapters/PrismaAdapter.js';
import PermissionChecker from './core/PermissionChecker.js';
import PermissionManager from './core/PermissionManager.js';
import CacheManager from './core/CacheManager.js';
import Logger from './utils/logger.js';
import * as errors from './core/errors.js';

/**
 * Create permission system instance
 * @param {PrismaClient} prismaClient - Prisma client instance
 * @param {object} options - Configuration options
 * @param {object} options.redis - Redis client instance (optional)
 * @param {boolean} options.enableCache - Enable caching (default: true)
 * @param {number} options.cacheTTL - Cache TTL in seconds (default: 300)
 * @param {boolean} options.debug - Enable debug logging (default: false)
 * @returns {Object} Permission system instance
 */
function createPermissionSystem(prismaClient, options = {}) {
    const {
        redis = null,
        enableCache = true,
        cacheTTL = 300,
        debug = false,
    } = options;

    const logger = new Logger(debug);
    const cacheManager = new CacheManager(redis, { enabled: enableCache, ttl: cacheTTL });
    const adapter = new PrismaAdapter(prismaClient, logger);
    const checker = new PermissionChecker(adapter, cacheManager, logger);
    const manager = new PermissionManager(adapter, checker, cacheManager, logger);

    return {
        // Core components
        manager,
        checker,
        adapter,
        cache: cacheManager,
        logger,

        // Convenience methods for permission checking
        can: (userId, permission) => checker.checkPermission(userId, permission),
        canRole: (roleId, permission) => checker.checkRolePermission(roleId, permission),

        // Direct access to commonly used manager methods
        createPermission: (...args) => manager.createPermission(...args),
        deletePermission: (...args) => manager.deletePermission(...args),
        createRole: (...args) => manager.createRole(...args),
        deleteRole: (...args) => manager.deleteRole(...args),
        assignPermission: (...args) => manager.assignPermission(...args),
        removePermission: (...args) => manager.removePermission(...args),
        assignRole: (...args) => manager.assignRole(...args),
        removeRole: (...args) => manager.removeRole(...args),
        banPermission: (...args) => manager.banPermission(...args),
        checkPermission: (...args) => manager.checkPermission(...args),

        // Cache control
        invalidateUserCache: (userId) => cacheManager.invalidateUser(userId),
        invalidateRoleCache: (roleId) => cacheManager.invalidateRole(roleId),
        clearCache: () => cacheManager.clear(),
    };
}

export {
    createPermissionSystem,
    PrismaAdapter,
    PermissionChecker,
    PermissionManager,
    CacheManager,
    Logger,
    errors,
};

export default createPermissionSystem;
