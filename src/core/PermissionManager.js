import {
    RoleNotFoundError,
    PermissionNotFoundError,
} from './errors.js';

/**
 * High-level API for managing permissions, roles, and users
 */
class PermissionManager {
    constructor(adapter, checker, cacheManager, logger) {
        this.adapter = adapter;
        this.checker = checker;
        this.cache = cacheManager;
        this.logger = logger;
    }

    // ==================== Permission Operations ====================

    /**
     * Create a new permission
     * @param {string} key - Permission key (e.g., 'endpoint.users.list')
     * @param {string|null} description - Description of the permission
     * @param {string|null} category - Category for grouping
     * @returns {Promise<Object>}
     */
    async createPermission(key, description = null, category = null) {
        this.logger.debug('createPermission:', key, description, category);
        return await this.adapter.createPermission({ key, description, category });
    }

    /**
     * Delete a permission
     * @param {string} permissionKey
     * @returns {Promise<boolean>}
     */
    async deletePermission(permissionKey) {
        this.logger.debug('deletePermission:', permissionKey);
        return await this.adapter.deletePermission(permissionKey);
    }

    /**
     * List all permissions
     * @returns {Promise<Array>}
     */
    async listPermissions() {
        return await this.adapter.listAllPermissions();
    }

    /**
     * Get a permission by key
     * @param {string} permissionKey
     * @returns {Promise<Object|null>}
     */
    async getPermission(permissionKey) {
        return await this.adapter.getPermission(permissionKey);
    }

    // ==================== Role Operations ====================

    /**
     * Create a new role
     * @param {string} name - Unique role name
     * @param {string|null} description - Role description
     * @param {number} priority - Role priority (higher = more important)
     * @param {boolean} isDefault - Whether to auto-assign to new users
     * @returns {Promise<Object>}
     */
    async createRole(name, description = null, priority = 0, isDefault = false) {
        this.logger.debug('createRole:', name, description, priority, isDefault);
        return await this.adapter.createRole({ name, description, priority, isDefault });
    }

    /**
     * Delete a role
     * @param {string} roleIdOrName - Role ID or name
     * @returns {Promise<boolean>}
     */
    async deleteRole(roleIdOrName) {
        this.logger.debug('deleteRole:', roleIdOrName);
        const role = await this._resolveRole(roleIdOrName);
        if (!role) {
            throw new RoleNotFoundError(roleIdOrName);
        }

        // Invalidate cache for all users with this role
        await this.cache.invalidateRole(role.id);

        return await this.adapter.deleteRole(role.id);
    }

    /**
     * List all roles
     * @returns {Promise<Array>}
     */
    async listRoles() {
        return await this.adapter.listAllRoles();
    }

    /**
     * Get a role by ID or name
     * @param {string} roleIdOrName
     * @returns {Promise<Object|null>}
     */
    async getRole(roleIdOrName) {
        return await this._resolveRole(roleIdOrName);
    }

    /**
     * Update a role
     * @param {string} roleIdOrName
     * @param {Object} data - Fields to update
     * @returns {Promise<Object>}
     */
    async updateRole(roleIdOrName, data) {
        const role = await this._resolveRole(roleIdOrName);
        if (!role) {
            throw new RoleNotFoundError(roleIdOrName);
        }

        await this.cache.invalidateRole(role.id);
        return await this.adapter.updateRole(role.id, data);
    }

    // ==================== Assignment Operations ====================

    /**
     * Assign permission to role or user
     * @param {string} permissionKey - Permission key (supports wildcards)
     * @param {string} targetId - Role ID/name or User ID
     * @param {string} targetType - 'role' or 'user'
     * @returns {Promise<Object>}
     */
    async assignPermission(permissionKey, targetId, targetType = 'role') {
        this.logger.debug('assignPermission:', permissionKey, targetId, targetType);

        if (targetType === 'role') {
            const role = await this._resolveRole(targetId);
            if (!role) {
                throw new RoleNotFoundError(targetId);
            }

            await this.cache.invalidateRole(role.id);
            return await this.adapter.assignPermissionToRole(permissionKey, role.id, true);
        } else if (targetType === 'user') {
            await this.cache.invalidateUser(targetId);
            return await this.adapter.assignPermissionToUser(permissionKey, targetId, true);
        } else {
            throw new Error(`Invalid targetType: ${targetType}. Must be 'role' or 'user'.`);
        }
    }

    /**
     * Ban/deny permission (set granted=false)
     * @param {string} permissionKey
     * @param {string} targetId - Role ID/name or User ID
     * @param {string} targetType - 'role' or 'user'
     * @returns {Promise<Object>}
     */
    async banPermission(permissionKey, targetId, targetType = 'role') {
        this.logger.debug('banPermission:', permissionKey, targetId, targetType);

        if (targetType === 'role') {
            const role = await this._resolveRole(targetId);
            if (!role) {
                throw new RoleNotFoundError(targetId);
            }

            await this.cache.invalidateRole(role.id);
            return await this.adapter.assignPermissionToRole(permissionKey, role.id, false);
        } else if (targetType === 'user') {
            await this.cache.invalidateUser(targetId);
            return await this.adapter.assignPermissionToUser(permissionKey, targetId, false);
        } else {
            throw new Error(`Invalid targetType: ${targetType}. Must be 'role' or 'user'.`);
        }
    }

    /**
     * Remove permission assignment
     * @param {string} permissionKey
     * @param {string} targetId - Role ID/name or User ID
     * @param {string} targetType - 'role' or 'user'
     * @returns {Promise<boolean>}
     */
    async removePermission(permissionKey, targetId, targetType = 'role') {
        this.logger.debug('removePermission:', permissionKey, targetId, targetType);

        if (targetType === 'role') {
            const role = await this._resolveRole(targetId);
            if (!role) {
                throw new RoleNotFoundError(targetId);
            }

            await this.cache.invalidateRole(role.id);
            return await this.adapter.removePermissionFromRole(permissionKey, role.id);
        } else if (targetType === 'user') {
            await this.cache.invalidateUser(targetId);
            return await this.adapter.removePermissionFromUser(permissionKey, targetId);
        } else {
            throw new Error(`Invalid targetType: ${targetType}. Must be 'role' or 'user'.`);
        }
    }

    /**
     * Assign role to user
     * @param {string} roleIdOrName
     * @param {string} userId
     * @returns {Promise<Object>}
     */
    async assignRole(roleIdOrName, userId) {
        this.logger.debug('assignRole:', roleIdOrName, userId);

        const role = await this._resolveRole(roleIdOrName);
        if (!role) {
            throw new RoleNotFoundError(roleIdOrName);
        }

        await this.cache.invalidateUser(userId);
        return await this.adapter.assignRoleToUser(userId, role.id);
    }

    /**
     * Remove role from user
     * @param {string} roleIdOrName
     * @param {string} userId
     * @returns {Promise<boolean>}
     */
    async removeRole(roleIdOrName, userId) {
        this.logger.debug('removeRole:', roleIdOrName, userId);

        const role = await this._resolveRole(roleIdOrName);
        if (!role) {
            throw new RoleNotFoundError(roleIdOrName);
        }

        await this.cache.invalidateUser(userId);
        return await this.adapter.removeRoleFromUser(userId, role.id);
    }

    /**
     * Set role inheritance (roleId inherits from inheritFromRoleId)
     * @param {string} roleIdOrName
     * @param {string} inheritFromRoleIdOrName
     * @param {number} priority
     * @returns {Promise<Object>}
     */
    async setRoleInheritance(roleIdOrName, inheritFromRoleIdOrName, priority = 0) {
        this.logger.debug('setRoleInheritance:', roleIdOrName, inheritFromRoleIdOrName, priority);

        const role = await this._resolveRole(roleIdOrName);
        if (!role) {
            throw new RoleNotFoundError(roleIdOrName);
        }

        const inheritFromRole = await this._resolveRole(inheritFromRoleIdOrName);
        if (!inheritFromRole) {
            throw new RoleNotFoundError(inheritFromRoleIdOrName);
        }

        await this.cache.invalidateRole(role.id);
        return await this.adapter.setRoleInheritance(role.id, inheritFromRole.id, priority);
    }

    /**
     * Remove role inheritance
     * @param {string} roleIdOrName
     * @param {string} inheritFromRoleIdOrName
     * @returns {Promise<boolean>}
     */
    async removeRoleInheritance(roleIdOrName, inheritFromRoleIdOrName) {
        this.logger.debug('removeRoleInheritance:', roleIdOrName, inheritFromRoleIdOrName);

        const role = await this._resolveRole(roleIdOrName);
        if (!role) {
            throw new RoleNotFoundError(roleIdOrName);
        }

        const inheritFromRole = await this._resolveRole(inheritFromRoleIdOrName);
        if (!inheritFromRole) {
            throw new RoleNotFoundError(inheritFromRoleIdOrName);
        }

        await this.cache.invalidateRole(role.id);
        return await this.adapter.removeRoleInheritance(role.id, inheritFromRole.id);
    }

    // ==================== Check Operations ====================

    /**
     * Check if user/role has permission
     * @param {string} targetId - User ID or Role ID
     * @param {string} permissionKey
     * @param {string} targetType - 'user' or 'role'
     * @returns {Promise<boolean>}
     */
    async checkPermission(targetId, permissionKey, targetType = 'user') {
        if (targetType === 'user') {
            return await this.checker.checkPermission(targetId, permissionKey);
        } else if (targetType === 'role') {
            return await this.checker.checkRolePermission(targetId, permissionKey);
        } else {
            throw new Error(`Invalid targetType: ${targetType}. Must be 'user' or 'role'.`);
        }
    }

    // ==================== Query Operations ====================

    /**
     * Get all roles assigned to a user
     * @param {string} userId
     * @returns {Promise<Array>}
     */
    async getUserRoles(userId) {
        return await this.adapter.getUserRoles(userId);
    }

    /**
     * Get all permissions for a user (direct + role-based)
     * @param {string} userId
     * @returns {Promise<Object>} - { direct: [], fromRoles: [] }
     */
    async getUserPermissions(userId) {
        const directPermissions = await this.adapter.getUserDirectPermissions(userId);
        const roles = await this.adapter.getUserRoles(userId);

        const rolePermissions = [];
        for (const role of roles) {
            const permissions = await this.adapter.getRolePermissions(role.id);
            rolePermissions.push({
                role: role.name,
                roleId: role.id,
                permissions,
            });
        }

        return {
            direct: directPermissions,
            fromRoles: rolePermissions,
        };
    }

    /**
     * Get all permissions assigned to a role
     * @param {string} roleIdOrName
     * @returns {Promise<Array>}
     */
    async getRolePermissions(roleIdOrName) {
        const role = await this._resolveRole(roleIdOrName);
        if (!role) {
            throw new RoleNotFoundError(roleIdOrName);
        }
        return await this.adapter.getRolePermissions(role.id);
    }

    /**
     * Get roles that a role inherits from
     * @param {string} roleIdOrName
     * @returns {Promise<Array>}
     */
    async getRoleInheritance(roleIdOrName) {
        const role = await this._resolveRole(roleIdOrName);
        if (!role) {
            throw new RoleNotFoundError(roleIdOrName);
        }
        return await this.adapter.getRoleInheritance(role.id);
    }

    // ==================== Cache Operations ====================

    /**
     * Invalidate cache for a specific user
     * @param {string} userId
     */
    async invalidateUserCache(userId) {
        return await this.cache.invalidateUser(userId);
    }

    /**
     * Invalidate cache for a specific role
     * @param {string} roleId
     */
    async invalidateRoleCache(roleId) {
        return await this.cache.invalidateRole(roleId);
    }

    /**
     * Clear entire cache
     */
    async clearAllCache() {
        return await this.cache.clear();
    }

    // ==================== Helper Methods ====================

    /**
     * Resolve role by ID or name
     * @private
     */
    async _resolveRole(roleIdOrName) {
        // First try as ID
        let role = await this.adapter.getRole(roleIdOrName);
        if (role) return role;

        // Then try as name
        role = await this.adapter.getRoleByName(roleIdOrName);
        return role;
    }
}

export default PermissionManager;
