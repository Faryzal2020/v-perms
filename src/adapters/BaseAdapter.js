/**
 * Base adapter interface that defines the contract for database adapters
 * All methods must be implemented by concrete adapters
 */
class BaseAdapter {
    // ==================== User Operations ====================

    /**
     * Get all roles assigned to a user
     * @param {string} userId
     * @returns {Promise<Array>}
     */
    async getUserRoles(userId) {
        throw new Error('getUserRoles must be implemented');
    }

    /**
     * Assign a role to a user
     * @param {string} userId
     * @param {string} roleId
     * @returns {Promise<Object>}
     */
    async assignRoleToUser(userId, roleId) {
        throw new Error('assignRoleToUser must be implemented');
    }

    /**
     * Remove a role from a user
     * @param {string} userId
     * @param {string} roleId
     * @returns {Promise<boolean>}
     */
    async removeRoleFromUser(userId, roleId) {
        throw new Error('removeRoleFromUser must be implemented');
    }

    /**
     * Check if a user has a specific role
     * @param {string} userId
     * @param {string} roleId
     * @returns {Promise<boolean>}
     */
    async userHasRole(userId, roleId) {
        throw new Error('userHasRole must be implemented');
    }

    // ==================== Role Operations ====================

    /**
     * Create a new role
     * @param {Object} data - Role data { name, description?, priority?, isDefault? }
     * @returns {Promise<Object>}
     */
    async createRole(data) {
        throw new Error('createRole must be implemented');
    }

    /**
     * Get a role by ID
     * @param {string} roleId
     * @returns {Promise<Object|null>}
     */
    async getRole(roleId) {
        throw new Error('getRole must be implemented');
    }

    /**
     * Get a role by name
     * @param {string} name
     * @returns {Promise<Object|null>}
     */
    async getRoleByName(name) {
        throw new Error('getRoleByName must be implemented');
    }

    /**
     * Update a role
     * @param {string} roleId
     * @param {Object} data - Fields to update
     * @returns {Promise<Object>}
     */
    async updateRole(roleId, data) {
        throw new Error('updateRole must be implemented');
    }

    /**
     * Delete a role
     * @param {string} roleId
     * @returns {Promise<boolean>}
     */
    async deleteRole(roleId) {
        throw new Error('deleteRole must be implemented');
    }

    /**
     * Get all permissions assigned to a role
     * @param {string} roleId
     * @returns {Promise<Array>}
     */
    async getRolePermissions(roleId) {
        throw new Error('getRolePermissions must be implemented');
    }

    /**
     * Get roles that this role inherits from
     * @param {string} roleId
     * @returns {Promise<Array>}
     */
    async getRoleInheritance(roleId) {
        throw new Error('getRoleInheritance must be implemented');
    }

    /**
     * Set role inheritance
     * @param {string} roleId - Role that will inherit
     * @param {string} inheritsFromId - Role to inherit from
     * @param {number} priority
     * @returns {Promise<Object>}
     */
    async setRoleInheritance(roleId, inheritsFromId, priority) {
        throw new Error('setRoleInheritance must be implemented');
    }

    /**
     * Remove role inheritance
     * @param {string} roleId
     * @param {string} inheritsFromId
     * @returns {Promise<boolean>}
     */
    async removeRoleInheritance(roleId, inheritsFromId) {
        throw new Error('removeRoleInheritance must be implemented');
    }

    // ==================== Permission Operations ====================

    /**
     * Create a new permission
     * @param {Object} data - { key, description?, category? }
     * @returns {Promise<Object>}
     */
    async createPermission(data) {
        throw new Error('createPermission must be implemented');
    }

    /**
     * Get a permission by key
     * @param {string} permissionKey
     * @returns {Promise<Object|null>}
     */
    async getPermission(permissionKey) {
        throw new Error('getPermission must be implemented');
    }

    /**
     * Get a permission by ID
     * @param {string} permissionId
     * @returns {Promise<Object|null>}
     */
    async getPermissionById(permissionId) {
        throw new Error('getPermissionById must be implemented');
    }

    /**
     * Delete a permission by key
     * @param {string} permissionKey
     * @returns {Promise<boolean>}
     */
    async deletePermission(permissionKey) {
        throw new Error('deletePermission must be implemented');
    }

    /**
     * Assign a permission to a role
     * @param {string} permissionKey
     * @param {string} roleId
     * @param {boolean} granted
     * @returns {Promise<Object>}
     */
    async assignPermissionToRole(permissionKey, roleId, granted) {
        throw new Error('assignPermissionToRole must be implemented');
    }

    /**
     * Remove a permission from a role
     * @param {string} permissionKey
     * @param {string} roleId
     * @returns {Promise<boolean>}
     */
    async removePermissionFromRole(permissionKey, roleId) {
        throw new Error('removePermissionFromRole must be implemented');
    }

    /**
     * Assign a permission to a user (override)
     * @param {string} permissionKey
     * @param {string} userId
     * @param {boolean} granted
     * @returns {Promise<Object>}
     */
    async assignPermissionToUser(permissionKey, userId, granted) {
        throw new Error('assignPermissionToUser must be implemented');
    }

    /**
     * Remove a permission from a user
     * @param {string} permissionKey
     * @param {string} userId
     * @returns {Promise<boolean>}
     */
    async removePermissionFromUser(permissionKey, userId) {
        throw new Error('removePermissionFromUser must be implemented');
    }

    /**
     * Get all direct permissions assigned to a user
     * @param {string} userId
     * @returns {Promise<Array>}
     */
    async getUserDirectPermissions(userId) {
        throw new Error('getUserDirectPermissions must be implemented');
    }

    /**
     * Get specific role permission assignment
     * @param {string} roleId
     * @param {string} permissionKey
     * @returns {Promise<Object|null>} - { granted: boolean } or null
     */
    async getRolePermission(roleId, permissionKey) {
        throw new Error('getRolePermission must be implemented');
    }

    /**
     * Get specific user permission assignment
     * @param {string} userId
     * @param {string} permissionKey
     * @returns {Promise<Object|null>} - { granted: boolean } or null
     */
    async getUserPermission(userId, permissionKey) {
        throw new Error('getUserPermission must be implemented');
    }

    // ==================== Listing Operations ====================

    /**
     * List all permissions
     * @returns {Promise<Array>}
     */
    async listAllPermissions() {
        throw new Error('listAllPermissions must be implemented');
    }

    /**
     * List all roles
     * @returns {Promise<Array>}
     */
    async listAllRoles() {
        throw new Error('listAllRoles must be implemented');
    }
}

export default BaseAdapter;
