import { generateWildcardPatterns } from '../utils/wildcard.js';

/**
 * Core permission checking logic with caching and wildcard support
 */
class PermissionChecker {
    constructor(adapter, cacheManager, logger) {
        this.adapter = adapter;
        this.cache = cacheManager;
        this.logger = logger;
    }

    /**
     * Check if a user has a specific permission
     * @param {string} userId
     * @param {string} permissionKey
     * @returns {Promise<boolean>}
     */
    async checkPermission(userId, permissionKey) {
        this.logger.debug('checkPermission:', userId, permissionKey);

        // Check cache first
        const cached = await this.cache.get('user', userId, permissionKey);
        if (cached !== null) {
            this.logger.debug('Cache hit:', cached);
            return cached;
        }

        const result = await this._checkPermissionUncached(userId, permissionKey);

        // Cache result
        await this.cache.set('user', result, userId, permissionKey);

        return result;
    }

    /**
     * Check if a role has a specific permission
     * @param {string} roleId
     * @param {string} permissionKey
     * @returns {Promise<boolean>}
     */
    async checkRolePermission(roleId, permissionKey) {
        this.logger.debug('checkRolePermission:', roleId, permissionKey);

        // Check cache first
        const cached = await this.cache.get('role', roleId, permissionKey);
        if (cached !== null) {
            return cached;
        }

        const result = await this._checkRolePermissionUncached(roleId, permissionKey);

        // Cache result
        await this.cache.set('role', result, roleId, permissionKey);

        return result;
    }

    /**
     * Check permission without using cache
     * @private
     */
    async _checkPermissionUncached(userId, permissionKey) {
        // 1. Check user-specific permissions (highest priority)
        const userPerm = await this.adapter.getUserPermission(userId, permissionKey);
        if (userPerm !== null) {
            this.logger.debug('User direct permission:', userPerm.granted);
            return userPerm.granted;
        }

        // Check user wildcards
        const wildcardPatterns = generateWildcardPatterns(permissionKey);
        for (const pattern of wildcardPatterns) {
            const userWildcard = await this.adapter.getUserPermission(userId, pattern);
            if (userWildcard !== null) {
                this.logger.debug('User wildcard match:', pattern, userWildcard.granted);
                return userWildcard.granted;
            }
        }

        // 2. Get all roles with inheritance
        const allRoles = await this._getUserRolesWithInheritance(userId);
        this.logger.debug('User roles (with inheritance):', allRoles.map(r => r.name));

        // 3. Check each role's permissions (by priority)
        for (const role of allRoles) {
            const rolePerm = await this.adapter.getRolePermission(role.id, permissionKey);
            if (rolePerm !== null) {
                this.logger.debug('Role direct permission:', role.name, rolePerm.granted);
                return rolePerm.granted;
            }

            // Check role wildcards
            for (const pattern of wildcardPatterns) {
                const roleWildcard = await this.adapter.getRolePermission(role.id, pattern);
                if (roleWildcard !== null) {
                    this.logger.debug('Role wildcard match:', role.name, pattern, roleWildcard.granted);
                    return roleWildcard.granted;
                }
            }
        }

        // 4. Default deny
        this.logger.debug('No permission found, default deny');
        return false;
    }

    /**
     * Check role permission without using cache
     * @private
     */
    async _checkRolePermissionUncached(roleId, permissionKey) {
        // Check direct permission
        const rolePerm = await this.adapter.getRolePermission(roleId, permissionKey);
        if (rolePerm !== null) {
            return rolePerm.granted;
        }

        // Check wildcards
        const wildcardPatterns = generateWildcardPatterns(permissionKey);
        for (const pattern of wildcardPatterns) {
            const roleWildcard = await this.adapter.getRolePermission(roleId, pattern);
            if (roleWildcard !== null) {
                return roleWildcard.granted;
            }
        }

        // Check inherited roles
        const inheritedRoles = await this._getRoleInheritanceRecursive(roleId);
        for (const inheritedRole of inheritedRoles) {
            const inheritedPerm = await this.adapter.getRolePermission(inheritedRole.id, permissionKey);
            if (inheritedPerm !== null) {
                return inheritedPerm.granted;
            }

            for (const pattern of wildcardPatterns) {
                const inheritedWildcard = await this.adapter.getRolePermission(inheritedRole.id, pattern);
                if (inheritedWildcard !== null) {
                    return inheritedWildcard.granted;
                }
            }
        }

        return false;
    }

    /**
     * Get all roles for a user including inherited roles
     * @private
     */
    async _getUserRolesWithInheritance(userId) {
        const directRoles = await this.adapter.getUserRoles(userId);
        const allRoles = new Map();

        const collectRoles = async (roleId, visited = new Set()) => {
            if (visited.has(roleId)) return;
            visited.add(roleId);

            const role = await this.adapter.getRole(roleId);
            if (!role) return;

            allRoles.set(role.id, role);

            const inheritedRoles = await this.adapter.getRoleInheritance(roleId);
            for (const inherited of inheritedRoles) {
                await collectRoles(inherited.inheritsFromId, visited);
            }
        };

        for (const role of directRoles) {
            await collectRoles(role.id);
        }

        // Sort by priority (highest first)
        return Array.from(allRoles.values()).sort((a, b) => b.priority - a.priority);
    }

    /**
     * Get all inherited roles recursively
     * @private
     */
    async _getRoleInheritanceRecursive(roleId, visited = new Set()) {
        if (visited.has(roleId)) return [];
        visited.add(roleId);

        const inheritedRoles = await this.adapter.getRoleInheritance(roleId);
        const allInherited = [];

        for (const inherited of inheritedRoles) {
            const role = await this.adapter.getRole(inherited.inheritsFromId);
            if (role) {
                allInherited.push(role);
                const deeper = await this._getRoleInheritanceRecursive(inherited.inheritsFromId, visited);
                allInherited.push(...deeper);
            }
        }

        return allInherited;
    }
}

export default PermissionChecker;
