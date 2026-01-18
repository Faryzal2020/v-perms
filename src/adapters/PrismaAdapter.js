import BaseAdapter from './BaseAdapter.js';
import {
    RoleNotFoundError,
    PermissionNotFoundError,
    RoleAlreadyAssignedError,
    PermissionAlreadyExistsError,
    RoleAlreadyExistsError,
    CircularInheritanceError,
} from '../core/errors.js';

/**
 * Prisma database adapter implementation
 */
class PrismaAdapter extends BaseAdapter {
    constructor(prismaClient, logger) {
        super();
        this.prisma = prismaClient;
        this.logger = logger;
    }

    // ==================== User Operations ====================

    async getUserRoles(userId) {
        this.logger.debug('getUserRoles:', userId);

        const userRoles = await this.prisma.userRole.findMany({
            where: { userId },
            include: { role: true },
        });

        return userRoles.map(ur => ur.role);
    }

    async assignRoleToUser(userId, roleId) {
        this.logger.debug('assignRoleToUser:', userId, roleId);

        // Check if role exists
        const role = await this.getRole(roleId);
        if (!role) {
            throw new RoleNotFoundError(roleId);
        }

        // Check if already assigned
        const existing = await this.prisma.userRole.findUnique({
            where: {
                userId_roleId: { userId, roleId },
            },
        });

        if (existing) {
            throw new RoleAlreadyAssignedError(userId, roleId);
        }

        return await this.prisma.userRole.create({
            data: { userId, roleId },
            include: { role: true },
        });
    }

    async removeRoleFromUser(userId, roleId) {
        this.logger.debug('removeRoleFromUser:', userId, roleId);

        try {
            await this.prisma.userRole.delete({
                where: {
                    userId_roleId: { userId, roleId },
                },
            });
            return true;
        } catch (error) {
            if (error.code === 'P2025') {
                // Record not found
                return false;
            }
            throw error;
        }
    }

    async userHasRole(userId, roleId) {
        this.logger.debug('userHasRole:', userId, roleId);

        const userRole = await this.prisma.userRole.findUnique({
            where: {
                userId_roleId: { userId, roleId },
            },
        });

        return !!userRole;
    }

    // ==================== Role Operations ====================

    async createRole(data) {
        this.logger.debug('createRole:', data);

        // Check if role already exists
        const existing = await this.getRoleByName(data.name);
        if (existing) {
            throw new RoleAlreadyExistsError(data.name);
        }

        return await this.prisma.role.create({
            data: {
                name: data.name,
                description: data.description || null,
                priority: data.priority || 0,
                isDefault: data.isDefault || false,
            },
        });
    }

    async getRole(roleId) {
        this.logger.debug('getRole:', roleId);

        return await this.prisma.role.findUnique({
            where: { id: roleId },
        });
    }

    async getRoleByName(name) {
        this.logger.debug('getRoleByName:', name);

        return await this.prisma.role.findUnique({
            where: { name },
        });
    }

    async updateRole(roleId, data) {
        this.logger.debug('updateRole:', roleId, data);

        return await this.prisma.role.update({
            where: { id: roleId },
            data,
        });
    }

    async deleteRole(roleId) {
        this.logger.debug('deleteRole:', roleId);

        try {
            await this.prisma.role.delete({
                where: { id: roleId },
            });
            return true;
        } catch (error) {
            if (error.code === 'P2025') {
                return false;
            }
            throw error;
        }
    }

    async getRolePermissions(roleId) {
        this.logger.debug('getRolePermissions:', roleId);

        const rolePermissions = await this.prisma.rolePermission.findMany({
            where: { roleId },
            include: { permission: true },
        });

        return rolePermissions.map(rp => ({
            ...rp.permission,
            granted: rp.granted,
        }));
    }

    async getRoleInheritance(roleId) {
        this.logger.debug('getRoleInheritance:', roleId);

        return await this.prisma.roleInheritance.findMany({
            where: { roleId },
            include: { inheritsFrom: true },
            orderBy: { priority: 'desc' },
        });
    }

    async setRoleInheritance(roleId, inheritsFromId, priority = 0) {
        this.logger.debug('setRoleInheritance:', roleId, inheritsFromId, priority);

        // Prevent self-inheritance
        if (roleId === inheritsFromId) {
            throw new CircularInheritanceError(roleId, inheritsFromId);
        }

        // Check for circular inheritance
        const hasCircular = await this._checkCircularInheritance(roleId, inheritsFromId);
        if (hasCircular) {
            throw new CircularInheritanceError(roleId, inheritsFromId);
        }

        // Upsert the inheritance
        return await this.prisma.roleInheritance.upsert({
            where: {
                roleId_inheritsFromId: { roleId, inheritsFromId },
            },
            create: { roleId, inheritsFromId, priority },
            update: { priority },
        });
    }

    async removeRoleInheritance(roleId, inheritsFromId) {
        this.logger.debug('removeRoleInheritance:', roleId, inheritsFromId);

        try {
            await this.prisma.roleInheritance.delete({
                where: {
                    roleId_inheritsFromId: { roleId, inheritsFromId },
                },
            });
            return true;
        } catch (error) {
            if (error.code === 'P2025') {
                return false;
            }
            throw error;
        }
    }

    /**
     * Check for circular inheritance
     * @private
     */
    async _checkCircularInheritance(roleId, inheritsFromId, visited = new Set()) {
        if (visited.has(inheritsFromId)) {
            return false; // Already checked this path
        }

        visited.add(inheritsFromId);

        // Get what the inheritsFromId role inherits
        const inheritances = await this.prisma.roleInheritance.findMany({
            where: { roleId: inheritsFromId },
        });

        for (const inheritance of inheritances) {
            // If the role we're trying to add inherits back to the original role, circular!
            if (inheritance.inheritsFromId === roleId) {
                return true;
            }

            // Recursively check
            const hasCircular = await this._checkCircularInheritance(roleId, inheritance.inheritsFromId, visited);
            if (hasCircular) {
                return true;
            }
        }

        return false;
    }

    // ==================== Permission Operations ====================

    async createPermission(data) {
        this.logger.debug('createPermission:', data);

        // Check if permission already exists
        const existing = await this.getPermission(data.key);
        if (existing) {
            throw new PermissionAlreadyExistsError(data.key);
        }

        return await this.prisma.permission.create({
            data: {
                key: data.key,
                description: data.description || null,
                category: data.category || null,
            },
        });
    }

    async getPermission(permissionKey) {
        this.logger.debug('getPermission:', permissionKey);

        return await this.prisma.permission.findUnique({
            where: { key: permissionKey },
        });
    }

    async getPermissionById(permissionId) {
        this.logger.debug('getPermissionById:', permissionId);

        return await this.prisma.permission.findUnique({
            where: { id: permissionId },
        });
    }

    async deletePermission(permissionKey) {
        this.logger.debug('deletePermission:', permissionKey);

        const permission = await this.getPermission(permissionKey);
        if (!permission) {
            return false;
        }

        try {
            await this.prisma.permission.delete({
                where: { key: permissionKey },
            });
            return true;
        } catch (error) {
            if (error.code === 'P2025') {
                return false;
            }
            throw error;
        }
    }

    async assignPermissionToRole(permissionKey, roleId, granted = true) {
        this.logger.debug('assignPermissionToRole:', permissionKey, roleId, granted);

        // Get or create permission
        let permission = await this.getPermission(permissionKey);
        if (!permission) {
            // Create wildcard or regular permission
            permission = await this.createPermission({ key: permissionKey });
        }

        // Check if role exists
        const role = await this.getRole(roleId);
        if (!role) {
            throw new RoleNotFoundError(roleId);
        }

        // Upsert the role permission
        return await this.prisma.rolePermission.upsert({
            where: {
                roleId_permissionId: { roleId, permissionId: permission.id },
            },
            create: { roleId, permissionId: permission.id, granted },
            update: { granted },
            include: { permission: true },
        });
    }

    async removePermissionFromRole(permissionKey, roleId) {
        this.logger.debug('removePermissionFromRole:', permissionKey, roleId);

        const permission = await this.getPermission(permissionKey);
        if (!permission) {
            return false;
        }

        try {
            await this.prisma.rolePermission.delete({
                where: {
                    roleId_permissionId: { roleId, permissionId: permission.id },
                },
            });
            return true;
        } catch (error) {
            if (error.code === 'P2025') {
                return false;
            }
            throw error;
        }
    }

    async assignPermissionToUser(permissionKey, userId, granted = true) {
        this.logger.debug('assignPermissionToUser:', permissionKey, userId, granted);

        // Get or create permission
        let permission = await this.getPermission(permissionKey);
        if (!permission) {
            permission = await this.createPermission({ key: permissionKey });
        }

        // Upsert the user permission
        return await this.prisma.userPermission.upsert({
            where: {
                userId_permissionId: { userId, permissionId: permission.id },
            },
            create: { userId, permissionId: permission.id, granted },
            update: { granted },
            include: { permission: true },
        });
    }

    async removePermissionFromUser(permissionKey, userId) {
        this.logger.debug('removePermissionFromUser:', permissionKey, userId);

        const permission = await this.getPermission(permissionKey);
        if (!permission) {
            return false;
        }

        try {
            await this.prisma.userPermission.delete({
                where: {
                    userId_permissionId: { userId, permissionId: permission.id },
                },
            });
            return true;
        } catch (error) {
            if (error.code === 'P2025') {
                return false;
            }
            throw error;
        }
    }

    async getUserDirectPermissions(userId) {
        this.logger.debug('getUserDirectPermissions:', userId);

        const userPermissions = await this.prisma.userPermission.findMany({
            where: { userId },
            include: { permission: true },
        });

        return userPermissions.map(up => ({
            ...up.permission,
            granted: up.granted,
        }));
    }

    async getRolePermission(roleId, permissionKey) {
        this.logger.debug('getRolePermission:', roleId, permissionKey);

        const permission = await this.getPermission(permissionKey);
        if (!permission) {
            return null;
        }

        const rolePermission = await this.prisma.rolePermission.findUnique({
            where: {
                roleId_permissionId: { roleId, permissionId: permission.id },
            },
        });

        if (!rolePermission) {
            return null;
        }

        return { granted: rolePermission.granted };
    }

    async getUserPermission(userId, permissionKey) {
        this.logger.debug('getUserPermission:', userId, permissionKey);

        const permission = await this.getPermission(permissionKey);
        if (!permission) {
            return null;
        }

        const userPermission = await this.prisma.userPermission.findUnique({
            where: {
                userId_permissionId: { userId, permissionId: permission.id },
            },
        });

        if (!userPermission) {
            return null;
        }

        return { granted: userPermission.granted };
    }

    // ==================== Listing Operations ====================

    async listAllPermissions() {
        this.logger.debug('listAllPermissions');

        return await this.prisma.permission.findMany({
            orderBy: { key: 'asc' },
        });
    }

    async listAllRoles() {
        this.logger.debug('listAllRoles');

        return await this.prisma.role.findMany({
            orderBy: { priority: 'desc' },
        });
    }
}

export default PrismaAdapter;
