# v-perms Implementation Plan v1.0.0

## Package Overview
**Name**: `@faryzal2020/v-perms`  
**Version**: 1.0.0  
**Description**: Minimal, flexible role-based permission system for JavaScript/Bun.js applications with Prisma  
**License**: MIT  
**Target Runtime**: Bun.js (native priority), Node.js (secondary compatibility)

---

## Project Structure

```
v-perms/
├── src/
│   ├── core/
│   │   ├── PermissionChecker.js      # Permission checking logic
│   │   ├── PermissionManager.js      # CRUD operations
│   │   ├── CacheManager.js           # Redis caching implementation
│   │   └── errors.js                 # Custom error classes
│   ├── adapters/
│   │   ├── BaseAdapter.js            # Abstract adapter interface
│   │   ├── PrismaAdapter.js          # Prisma implementation
│   │   └── index.js
│   ├── utils/
│   │   ├── logger.js                 # Debug logging utility
│   │   └── wildcard.js               # Wildcard matching logic
│   ├── prisma/
│   │   └── schema.prisma             # Prisma schema template
│   └── index.js                      # Main entry point
├── examples/
│   └── schema-usage.md               # How to integrate schema
├── package.json
├── README.md
└── .gitignore
```

---

## 1. Prisma Schema (`src/prisma/schema.prisma`)

### Requirements:
- Compatible with PostgreSQL, MySQL, SQLite
- Generic naming (no hardcoded assumptions)
- User table is referenced but not defined (users integrate with their own User model)
- All relations use `onDelete: Cascade` for cleanup

### Schema Definition:

```prisma
// This schema is designed to be copied into your existing Prisma schema
// Compatible with PostgreSQL, MySQL, and SQLite

model Role {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  priority    Int      @default(0)
  isDefault   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  userRoles        UserRole[]
  rolePermissions  RolePermission[]
  inheritedRoles   RoleInheritance[] @relation("ParentRole")
  inheritsFrom     RoleInheritance[] @relation("ChildRole")

  @@map("roles")
}

model Permission {
  id          String   @id @default(cuid())
  key         String   @unique
  description String?
  category    String?
  createdAt   DateTime @default(now())

  rolePermissions RolePermission[]
  userPermissions UserPermission[]

  @@index([category])
  @@map("permissions")
}

model UserRole {
  userId     String
  roleId     String
  assignedAt DateTime @default(now())

  // Note: Replace 'User' with your actual User model name
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([userId, roleId])
  @@map("user_roles")
}

model RolePermission {
  roleId       String
  permissionId String
  granted      Boolean  @default(true)
  assignedAt   DateTime @default(now())

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
  @@map("role_permissions")
}

model UserPermission {
  userId       String
  permissionId String
  granted      Boolean  @default(true)
  assignedAt   DateTime @default(now())

  // Note: Replace 'User' with your actual User model name
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([userId, permissionId])
  @@map("user_permissions")
}

model RoleInheritance {
  roleId         String
  inheritsFromId String
  priority       Int      @default(0)
  createdAt      DateTime @default(now())

  role         Role @relation("ParentRole", fields: [roleId], references: [id], onDelete: Cascade)
  inheritsFrom Role @relation("ChildRole", fields: [inheritsFromId], references: [id], onDelete: Cascade)

  @@id([roleId, inheritsFromId])
  @@map("role_inheritance")
}
```

---

## 2. Custom Error Classes (`src/core/errors.js`)

### Purpose:
Provide clear, descriptive errors instead of just returning `false`

### Error Types:

```javascript
class PermissionError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'PermissionError';
    this.code = code;
    this.details = details;
  }
}

class UserNotFoundError extends PermissionError {
  constructor(userId) {
    super(`User not found: ${userId}`, 'USER_NOT_FOUND', { userId });
  }
}

class RoleNotFoundError extends PermissionError {
  constructor(roleId) {
    super(`Role not found: ${roleId}`, 'ROLE_NOT_FOUND', { roleId });
  }
}

class PermissionNotFoundError extends PermissionError {
  constructor(permissionKey) {
    super(`Permission not found: ${permissionKey}`, 'PERMISSION_NOT_FOUND', { permissionKey });
  }
}

class RoleAlreadyAssignedError extends PermissionError {
  constructor(userId, roleId) {
    super(`Role already assigned to user`, 'ROLE_ALREADY_ASSIGNED', { userId, roleId });
  }
}

class PermissionAlreadyExistsError extends PermissionError {
  constructor(permissionKey) {
    super(`Permission already exists: ${permissionKey}`, 'PERMISSION_EXISTS', { permissionKey });
  }
}

class CircularInheritanceError extends PermissionError {
  constructor(roleId, inheritsFromId) {
    super(`Circular inheritance detected`, 'CIRCULAR_INHERITANCE', { roleId, inheritsFromId });
  }
}

module.exports = {
  PermissionError,
  UserNotFoundError,
  RoleNotFoundError,
  PermissionNotFoundError,
  RoleAlreadyAssignedError,
  PermissionAlreadyExistsError,
  CircularInheritanceError,
};
```

---

## 3. Logger Utility (`src/utils/logger.js`)

### Purpose:
Debug logging with off-by-default flag

```javascript
class Logger {
  constructor(enabled = false) {
    this.enabled = enabled;
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  debug(...args) {
    if (this.enabled) {
      console.log('[v-perms:debug]', ...args);
    }
  }

  info(...args) {
    if (this.enabled) {
      console.info('[v-perms:info]', ...args);
    }
  }

  warn(...args) {
    if (this.enabled) {
      console.warn('[v-perms:warn]', ...args);
    }
  }

  error(...args) {
    if (this.enabled) {
      console.error('[v-perms:error]', ...args);
    }
  }
}

module.exports = Logger;
```

---

## 4. Wildcard Utility (`src/utils/wildcard.js`)

### Purpose:
Match permission keys against wildcard patterns

```javascript
/**
 * Check if a permission key matches a wildcard pattern
 * @param {string} pattern - Pattern like "endpoint.*" or "*"
 * @param {string} permissionKey - Actual permission like "endpoint.admin.users"
 * @returns {boolean}
 */
function matchesWildcard(pattern, permissionKey) {
  if (pattern === '*') return true;
  if (pattern === permissionKey) return true;
  
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2);
    return permissionKey === prefix || permissionKey.startsWith(prefix + '.');
  }
  
  return false;
}

/**
 * Generate all possible wildcard patterns for a permission key
 * @param {string} permissionKey - Like "endpoint.admin.users.delete"
 * @returns {string[]} - ["endpoint.admin.users.*", "endpoint.admin.*", "endpoint.*", "*"]
 */
function generateWildcardPatterns(permissionKey) {
  const parts = permissionKey.split('.');
  const patterns = ['*'];
  
  for (let i = parts.length - 1; i > 0; i--) {
    patterns.push([...parts.slice(0, i), '*'].join('.'));
  }
  
  return patterns;
}

module.exports = {
  matchesWildcard,
  generateWildcardPatterns,
};
```

---

## 5. Base Adapter Interface (`src/adapters/BaseAdapter.js`)

### Purpose:
Define the contract that database adapters must implement

```javascript
class BaseAdapter {
  // User operations
  async getUserRoles(userId) {
    throw new Error('getUserRoles must be implemented');
  }

  async assignRoleToUser(userId, roleId) {
    throw new Error('assignRoleToUser must be implemented');
  }

  async removeRoleFromUser(userId, roleId) {
    throw new Error('removeRoleFromUser must be implemented');
  }

  async userHasRole(userId, roleId) {
    throw new Error('userHasRole must be implemented');
  }

  // Role operations
  async createRole(data) {
    throw new Error('createRole must be implemented');
  }

  async getRole(roleId) {
    throw new Error('getRole must be implemented');
  }

  async getRoleByName(name) {
    throw new Error('getRoleByName must be implemented');
  }

  async deleteRole(roleId) {
    throw new Error('deleteRole must be implemented');
  }

  async getRolePermissions(roleId) {
    throw new Error('getRolePermissions must be implemented');
  }

  async getRoleInheritance(roleId) {
    throw new Error('getRoleInheritance must be implemented');
  }

  async setRoleInheritance(roleId, inheritsFromId, priority) {
    throw new Error('setRoleInheritance must be implemented');
  }

  async removeRoleInheritance(roleId, inheritsFromId) {
    throw new Error('removeRoleInheritance must be implemented');
  }

  // Permission operations
  async createPermission(data) {
    throw new Error('createPermission must be implemented');
  }

  async getPermission(permissionKey) {
    throw new Error('getPermission must be implemented');
  }

  async deletePermission(permissionKey) {
    throw new Error('deletePermission must be implemented');
  }

  async assignPermissionToRole(permissionKey, roleId, granted) {
    throw new Error('assignPermissionToRole must be implemented');
  }

  async removePermissionFromRole(permissionKey, roleId) {
    throw new Error('removePermissionFromRole must be implemented');
  }

  async assignPermissionToUser(permissionKey, userId, granted) {
    throw new Error('assignPermissionToUser must be implemented');
  }

  async removePermissionFromUser(permissionKey, userId) {
    throw new Error('removePermissionFromUser must be implemented');
  }

  async getUserDirectPermissions(userId) {
    throw new Error('getUserDirectPermissions must be implemented');
  }

  async getRolePermission(roleId, permissionKey) {
    throw new Error('getRolePermission must be implemented');
  }

  async getUserPermission(userId, permissionKey) {
    throw new Error('getUserPermission must be implemented');
  }

  // Listing operations
  async listAllPermissions() {
    throw new Error('listAllPermissions must be implemented');
  }

  async listAllRoles() {
    throw new Error('listAllRoles must be implemented');
  }
}

module.exports = BaseAdapter;
```

---

## 6. Prisma Adapter (`src/adapters/PrismaAdapter.js`)

### Purpose:
Implement BaseAdapter using Prisma Client

### Implementation Notes:
- All methods should handle Prisma errors and throw appropriate custom errors
- Use transactions where necessary for data consistency
- Include debug logging for all database operations

### Key Methods Structure:
```javascript
const BaseAdapter = require('./BaseAdapter');
const {
  UserNotFoundError,
  RoleNotFoundError,
  PermissionNotFoundError,
  RoleAlreadyAssignedError,
  PermissionAlreadyExistsError,
  CircularInheritanceError,
} = require('../core/errors');

class PrismaAdapter extends BaseAdapter {
  constructor(prismaClient, logger) {
    super();
    this.prisma = prismaClient;
    this.logger = logger;
  }

  async getUserRoles(userId) {
    this.logger.debug('getUserRoles:', userId);
    // Implementation with error handling
  }

  // ... implement all BaseAdapter methods
  
  async _checkCircularInheritance(roleId, inheritsFromId, visited = new Set()) {
    // Helper to prevent circular inheritance
  }
}

module.exports = PrismaAdapter;
```

---

## 7. Cache Manager (`src/core/CacheManager.js`)

### Purpose:
Handle Redis caching for permission checks

### Features:
- Redis connection management
- Key namespacing
- TTL configuration
- Cache invalidation methods

```javascript
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

  _buildKey(type, ...parts) {
    return `${this.options.prefix}${type}:${parts.join(':')}`;
  }

  async get(type, ...parts) {
    if (!this.options.enabled || !this.redis) return null;
    const key = this._buildKey(type, ...parts);
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  async set(type, value, ...parts) {
    if (!this.options.enabled || !this.redis) return;
    const key = this._buildKey(type, ...parts);
    await this.redis.setex(key, this.options.ttl, JSON.stringify(value));
  }

  async delete(type, ...parts) {
    if (!this.redis) return;
    const key = this._buildKey(type, ...parts);
    await this.redis.del(key);
  }

  async invalidateUser(userId) {
    if (!this.redis) return;
    const pattern = this._buildKey('user', userId, '*');
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async invalidateRole(roleId) {
    if (!this.redis) return;
    const pattern = this._buildKey('role', roleId, '*');
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  async clear() {
    if (!this.redis) return;
    const pattern = `${this.options.prefix}*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}

module.exports = CacheManager;
```

---

## 8. Permission Checker (`src/core/PermissionChecker.js`)

### Purpose:
Core permission checking logic with caching and wildcard support

### Algorithm:
1. Check cache first
2. Check user-specific permissions (highest priority)
3. Check user's direct roles
4. Check inherited roles (recursive)
5. Check wildcard permissions
6. Handle "ban" permissions (granted: false)
7. Default deny
8. Cache result

```javascript
const { generateWildcardPatterns } = require('../utils/wildcard');

class PermissionChecker {
  constructor(adapter, cacheManager, logger) {
    this.adapter = adapter;
    this.cache = cacheManager;
    this.logger = logger;
  }

  async checkPermission(userId, permissionKey) {
    this.logger.debug('checkPermission:', userId, permissionKey);

    // Check cache
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

  async checkRolePermission(roleId, permissionKey) {
    this.logger.debug('checkRolePermission:', roleId, permissionKey);

    // Check cache
    const cached = await this.cache.get('role', roleId, permissionKey);
    if (cached !== null) {
      return cached;
    }

    const result = await this._checkRolePermissionUncached(roleId, permissionKey);
    
    // Cache result
    await this.cache.set('role', result, roleId, permissionKey);
    
    return result;
  }

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

    return Array.from(allRoles.values()).sort((a, b) => b.priority - a.priority);
  }

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

module.exports = PermissionChecker;
```

---

## 9. Permission Manager (`src/core/PermissionManager.js`)

### Purpose:
High-level API for managing permissions, roles, and users

### Public API Methods:

```javascript
class PermissionManager {
  constructor(adapter, checker, cacheManager, logger) {
    this.adapter = adapter;
    this.checker = checker;
    this.cache = cacheManager;
    this.logger = logger;
  }

  // ==================== Permission Operations ====================
  
  async createPermission(key, description = null, category = null) {}
  
  async deletePermission(permissionKey) {}
  
  async listPermissions() {}

  // ==================== Role Operations ====================
  
  async createRole(name, description = null, priority = 0, isDefault = false) {}
  
  async deleteRole(roleIdOrName) {}
  
  async listRoles() {}
  
  async getRole(roleIdOrName) {}

  // ==================== Assignment Operations ====================
  
  /**
   * Assign permission to role or user
   * @param {string} permissionKey 
   * @param {string} targetId - roleId or userId
   * @param {string} targetType - 'role' or 'user'
   */
  async assignPermission(permissionKey, targetId, targetType = 'role') {}
  
  /**
   * Ban/deny permission (set granted=false)
   */
  async banPermission(permissionKey, targetId, targetType = 'role') {}
  
  async removePermission(permissionKey, targetId, targetType = 'role') {}
  
  /**
   * Assign role to user
   */
  async assignRole(roleIdOrName, userId) {}
  
  async removeRole(roleIdOrName, userId) {}
  
  /**
   * Set role inheritance (roleId inherits from inheritFromRoleId)
   */
  async setRoleInheritance(roleIdOrName, inheritFromRoleIdOrName, priority = 0) {}
  
  async removeRoleInheritance(roleIdOrName, inheritFromRoleIdOrName) {}

  // ==================== Check Operations ====================
  
  /**
   * Check if user/role has permission
   * @param {string} targetId - userId or roleId
   * @param {string} permissionKey 
   * @param {string} targetType - 'user' or 'role'
   */
  async checkPermission(targetId, permissionKey, targetType = 'user') {}

  // ==================== Query Operations ====================
  
  async getUserRoles(userId) {}
  
  async getUserPermissions(userId) {}
  
  async getRolePermissions(roleIdOrName) {}
  
  async getRoleInheritance(roleIdOrName) {}

  // ==================== Cache Operations ====================
  
  async invalidateUserCache(userId) {}
  
  async invalidateRoleCache(roleId) {}
  
  async clearAllCache() {}
}

module.exports = PermissionManager;
```

---

## 10. Main Entry Point (`src/index.js`)

### Purpose:
Export all public APIs and provide factory function

```javascript
const PrismaAdapter = require('./adapters/PrismaAdapter');
const PermissionChecker = require('./core/PermissionChecker');
const PermissionManager = require('./core/PermissionManager');
const CacheManager = require('./core/CacheManager');
const Logger = require('./utils/logger');
const errors = require('./core/errors');

/**
 * Create permission system instance
 * @param {PrismaClient} prismaClient - Prisma client instance
 * @param {object} options - Configuration options
 * @param {object} options.redis - Redis client instance (optional)
 * @param {boolean} options.enableCache - Enable caching (default: true)
 * @param {number} options.cacheTTL - Cache TTL in seconds (default: 300)
 * @param {boolean} options.debug - Enable debug logging (default: false)
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
    manager,
    checker,
    adapter,
    cache: cacheManager,
    logger,
    
    // Convenience methods
    can: (userId, permission) => checker.checkPermission(userId, permission),
    canRole: (roleId, permission) => checker.checkRolePermission(roleId, permission),
    
    // Direct access to manager methods
    createPermission: (...args) => manager.createPermission(...args),
    createRole: (...args) => manager.createRole(...args),
    assignPermission: (...args) => manager.assignPermission(...args),
    assignRole: (...args) => manager.assignRole(...args),
    banPermission: (...args) => manager.banPermission(...args),
    checkPermission: (...args) => manager.checkPermission(...args),
    
    // Cache control
    invalidateUserCache: (userId) => cacheManager.invalidateUser(userId),
    invalidateRoleCache: (roleId) => cacheManager.invalidateRole(roleId),
    clearCache: () => cacheManager.clear(),
  };
}

module.exports = {
  createPermissionSystem,
  PrismaAdapter,
  PermissionChecker,
  PermissionManager,
  CacheManager,
  Logger,
  errors,
};
```

---

## 11. Package.json

```json
{
  "name": "@faryzal2020/v-perms",
  "version": "1.0.0",
  "description": "Minimal, flexible role-based permission system for JavaScript/Bun.js applications with Prisma",
  "main": "src/index.js",
  "type": "module",
  "files": [
    "src",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "prepublishOnly": "echo 'Ready to publish'"
  },
  "keywords": [
    "permissions",
    "authorization",
    "rbac",
    "roles",
    "access-control",
    "prisma",
    "bun",
    "nodejs"
  ],
  "author": "faryzal2020",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/faryzal2020/v-perms"
  },
  "peerDependencies": {
    "@prisma/client": "^5.0.0"
  },
  "optionalDependencies": {
    "redis": "^4.0.0"
  },
  "engines": {
    "node": ">=18.0.0",
    "bun": ">=1.0.0"
  }
}
```

---

## 12. README.md Structure

```markdown
# @faryzal2020/v-perms

Minimal, flexible role-based permission system for JavaScript/Bun.js applications with Prisma.

## Features
- Role-based access control (RBAC)
- Role inheritance (roles can inherit from other roles)
- User-specific permission overrides
- Wildcard permissions (`endpoint.*`, `*`)
- Ban/deny permissions
- Redis caching support
- Compatible with PostgreSQL, MySQL, SQLite
- Bun.js native support with Node.js compatibility
- Zero dependencies (except Prisma)

## Installation

```bash
npm install @faryzal2020/v-perms
# or
bun add @faryzal2020/v-perms
```

## Quick Start

### 1. Add Schema to Your Prisma Schema

[Copy the schema from src/prisma/schema.prisma and paste into your prisma/schema.prisma]

### 2. Run Migrations

```bash
npx prisma migrate dev --name add-permissions
```

### 3. Initialize in Your Code

```javascript
const { PrismaClient } = require('@prisma/client');
const { createPermissionSystem } = require('@faryzal2020/v-perms');

const prisma = new PrismaClient();
const perms = createPermissionSystem(prisma, {
  debug: true, // Enable debug logging
  enableCache: true,
  cacheTTL: 300, // 5 minutes
  redis: redisClient, // optional
});
```

### 4. Create Permissions and Roles

```javascript
// Create permissions
await perms.createPermission('page.admin', 'Access admin pages', 'page');
await perms.createPermission('endpoint.users.list', 'List users', 'endpoint');
await perms.createPermission('endpoint.users.delete', 'Delete users', 'endpoint');

// Create roles
await perms.createRole('member', 'Basic user role', 1, true); // isDefault=true
await perms.createRole('admin', 'Administrator', 10);

// Assign permissions to roles
await perms.assignPermission('page.admin', 'admin', 'role');
await perms.assignPermission('endpoint.*', 'admin', 'role'); // Wildcard

// Set role inheritance (admin inherits member permissions)
const memberRole = await perms.manager.getRole('member');
const adminRole = await perms.manager.getRole('admin');
await perms.manager.setRoleInheritance(adminRole.id, memberRole.id);
```

### 5. Assign Roles to Users

```javascript
const adminRole = await perms.manager.getRole('admin');
await perms.assignRole(adminRole.id, userId);
```

### 6. Check Permissions

```javascript
// Check user permission
const canAccess = await perms.can(userId, 'page.admin');

// Check role permission
const roleCanAccess = await perms.canRole(roleId, 'endpoint.users.delete');
```

## API Reference

### Factory Function

#### `createPermissionSystem(prismaClient, options)`

Creates a permission system instance.

**Parameters:**
- `prismaClient` (PrismaClient): Prisma client instance
- `options` (object):
  - `redis` (RedisClient): Redis client for caching (optional)
  - `enableCache` (boolean): Enable caching (default: `true`)
  - `cacheTTL` (number): Cache TTL in seconds (default: `300`)
  - `debug` (boolean): Enable debug logging (default: `false`)

**Returns:** Permission system instance with methods

### Permission Operations

#### `createPermission(key, description?, category?)`

Create a new permission.

```javascript
await perms.createPermission('endpoint.posts.create', 'Create posts', 'endpoint');
```

#### `deletePermission(permissionKey)`

Delete a permission.

```javascript
await perms.deletePermission('endpoint.posts.create');
```

#### `manager.listPermissions()`

List all permissions.

```javascript
const permissions = await perms.manager.listPermissions();
```

### Role Operations

#### `createRole(name, description?, priority?, isDefault?)`

Create a new role.

```javascript
await perms.createRole('moderator', 'Moderator role', 5, false);
```

**Parameters:**
- `name` (string): Unique role name
- `description` (string): Role description
- `priority` (number): Role priority (higher = more important, default: `0`)
- `isDefault` (boolean): Auto-assign to new users (default: `false`)

#### `deleteRole(roleIdOrName)`

Delete a role.

```javascript
await perms.manager.deleteRole('moderator');
```

#### `manager.getRole(roleIdOrName)`

Get role by ID or name.

```javascript
const role = await perms.manager.getRole('admin');
```

#### `manager.listRoles()`

List all roles.

```javascript
const roles = await perms.manager.listRoles();
```

### Assignment Operations

#### `assignPermission(permissionKey, targetId, targetType)`

Assign permission to role or user.

```javascript
// Assign to role
await perms.assignPermission('page.admin', roleId, 'role');

// Assign to user (user-specific override)
await perms.assignPermission('feature.export', userId, 'user');

// Wildcard assignment
await perms.assignPermission('endpoint.*', roleId, 'role');
```

**Parameters:**
- `permissionKey` (string): Permission key (supports wildcards)
- `targetId` (string): Role ID or User ID
- `targetType` (string): `'role'` or `'user'` (default: `'role'`)

#### `banPermission(permissionKey, targetId, targetType)`

Explicitly deny a permission (sets `granted=false`).

```javascript
// Ban admin page access for specific user
await perms.banPermission('page.admin', userId, 'user');

// Admin has endpoint.* but ban delete specifically
await perms.assignPermission('endpoint.*', adminRoleId, 'role');
await perms.banPermission('endpoint.users.delete', adminRoleId, 'role');
```

#### `manager.removePermission(permissionKey, targetId, targetType)`

Remove permission assignment.

```javascript
await perms.manager.removePermission('page.admin', roleId, 'role');
```

#### `assignRole(roleIdOrName, userId)`

Assign role to user.

```javascript
const adminRole = await perms.manager.getRole('admin');
await perms.assignRole(adminRole.id, userId);

// Or by name
await perms.assignRole('admin', userId);
```

#### `manager.removeRole(roleIdOrName, userId)`

Remove role from user.

```javascript
await perms.manager.removeRole('admin', userId);
```

#### `manager.setRoleInheritance(roleId, inheritFromRoleId, priority?)`

Set role inheritance.

```javascript
const adminRole = await perms.manager.getRole('admin');
const memberRole = await perms.manager.getRole('member');

// Admin inherits all member permissions
await perms.manager.setRoleInheritance(adminRole.id, memberRole.id, 1);
```

**Parameters:**
- `roleId` (string): Role that will inherit
- `inheritFromRoleId` (string): Role to inherit from
- `priority` (number): Inheritance priority (default: `0`)

#### `manager.removeRoleInheritance(roleId, inheritFromRoleId)`

Remove role inheritance.

```javascript
await perms.manager.removeRoleInheritance(adminRole.id, memberRole.id);
```

### Check Operations

#### `can(userId, permissionKey)`

Check if user has permission. This is the main method you'll use.

```javascript
const hasAccess = await perms.can(userId, 'endpoint.users.delete');

if (hasAccess) {
  // Allow action
} else {
  // Deny action
}
```

**Returns:** `true` if permission granted, `false` if denied

**Resolution Order:**
1. User-specific permissions (highest priority)
2. User-specific wildcard permissions
3. Direct role permissions (by role priority)
4. Role wildcard permissions
5. Inherited role permissions
6. Inherited role wildcard permissions
7. Default deny

#### `canRole(roleId, permissionKey)`

Check if role has permission.

```javascript
const roleHasAccess = await perms.canRole(roleId, 'page.admin');
```

#### `checkPermission(targetId, permissionKey, targetType)`

Generic permission check.

```javascript
// Check user
await perms.checkPermission(userId, 'page.admin', 'user');

// Check role
await perms.checkPermission(roleId, 'page.admin', 'role');
```

### Query Operations

#### `manager.getUserRoles(userId)`

Get all roles assigned to user.

```javascript
const roles = await perms.manager.getUserRoles(userId);
// Returns: [{ id, name, priority, ... }, ...]
```

#### `manager.getUserPermissions(userId)`

Get all permissions for user (including from roles and inheritance).

```javascript
const permissions = await perms.manager.getUserPermissions(userId);
```

#### `manager.getRolePermissions(roleIdOrName)`

Get all permissions assigned to role.

```javascript
const permissions = await perms.manager.getRolePermissions('admin');
```

#### `manager.getRoleInheritance(roleIdOrName)`

Get roles that this role inherits from.

```javascript
const inheritedRoles = await perms.manager.getRoleInheritance('admin');
```

### Cache Operations

#### `invalidateUserCache(userId)`

Clear cache for specific user.

```javascript
await perms.invalidateUserCache(userId);
```

#### `invalidateRoleCache(roleId)`

Clear cache for specific role.

```javascript
await perms.invalidateRoleCache(roleId);
```

#### `clearCache()`

Clear entire permission cache.

```javascript
await perms.clearCache();
```

## Wildcard Permissions

Wildcard permissions allow you to grant access to multiple permissions at once.

```javascript
// Grant access to all endpoint permissions
await perms.assignPermission('endpoint.*', roleId, 'role');

// Now user has access to:
// - endpoint.users.list
// - endpoint.users.create
// - endpoint.posts.delete
// etc.

// Grant all permissions (god mode)
await perms.assignPermission('*', superadminRoleId, 'role');
```

### Wildcard Matching Rules

- `*` matches everything
- `endpoint.*` matches `endpoint.users`, `endpoint.posts.create`, etc.
- `endpoint.users.*` matches `endpoint.users.list`, `endpoint.users.delete`, etc.
- Wildcards don't match partial segments: `endpoint.*` does NOT match `endpoint` itself

## Ban/Deny Permissions

You can explicitly deny permissions, which is useful for exceptions.

```javascript
// Admin has all endpoint access
await perms.assignPermission('endpoint.*', adminRoleId, 'role');

// But ban delete operations
await perms.banPermission('endpoint.users.delete', adminRoleId, 'role');
await perms.banPermission('endpoint.posts.delete', adminRoleId, 'role');

// User-specific ban (override role permissions)
await perms.banPermission('endpoint.sensitive', userId, 'user');
```

**Priority:** Deny (`granted=false`) takes precedence over allow at the same level (user or role).

## Role Inheritance

Roles can inherit permissions from other roles.

```javascript
// Create role hierarchy
await perms.createRole('member', 'Basic user', 1);
await perms.createRole('moderator', 'Moderator', 5);
await perms.createRole('admin', 'Administrator', 10);

// Assign basic permissions to member
await perms.assignPermission('page.home', memberRole.id, 'role');
await perms.assignPermission('page.profile', memberRole.id, 'role');

// Moderator inherits member permissions + has more
await perms.manager.setRoleInheritance(moderatorRole.id, memberRole.id);
await perms.assignPermission('page.moderation', moderatorRole.id, 'role');

// Admin inherits moderator (which inherits member)
await perms.manager.setRoleInheritance(adminRole.id, moderatorRole.id);
await perms.assignPermission('page.admin', adminRole.id, 'role');
```

**Result:** Admin has permissions from member + moderator + admin

**Circular Inheritance:** The system prevents circular inheritance and will throw `CircularInheritanceError`.

## Permission Resolution Examples

### Example 1: Basic Check

```javascript
// User has "admin" role
// Admin role has "page.admin" permission
await perms.can(userId, 'page.admin'); // true
await perms.can(userId, 'page.secret'); // false
```

### Example 2: Wildcard

```javascript
// User has "admin" role
// Admin role has "endpoint.*" permission
await perms.can(userId, 'endpoint.users.list'); // true
await perms.can(userId, 'endpoint.posts.create'); // true
await perms.can(userId, 'page.admin'); // false (different category)
```

### Example 3: User Override

```javascript
// User has "member" role
// Member has "page.home" permission
// User has specific ban on "page.home"
await perms.assignRole(memberRole.id, userId);
await perms.banPermission('page.home', userId, 'user');

await perms.can(userId, 'page.home'); // false (user override takes priority)
```

### Example 4: Role Inheritance

```javascript
// Member role has "page.home"
// Admin role inherits from member
// Admin role has "page.admin"
await perms.can(adminUserId, 'page.home'); // true (inherited from member)
await perms.can(adminUserId, 'page.admin'); // true (direct permission)
```

### Example 5: Ban with Wildcard

```javascript
// Admin has "endpoint.*"
// Admin has ban on "endpoint.users.delete"
await perms.assignPermission('endpoint.*', adminRole.id, 'role');
await perms.banPermission('endpoint.users.delete', adminRole.id, 'role');

await perms.can(adminUserId, 'endpoint.users.list'); // true
await perms.can(adminUserId, 'endpoint.users.delete'); // false (banned)
```

## Redis Caching

For production environments with multiple instances, use Redis for distributed caching.

```javascript
const Redis = require('redis');
const redisClient = Redis.createClient({
  url: 'redis://localhost:6379'
});
await redisClient.connect();

const perms = createPermissionSystem(prisma, {
  redis: redisClient,
  enableCache: true,
  cacheTTL: 300, // 5 minutes
});
```

**Cache Keys Format:**
- User permissions: `v-perms:user:{userId}:{permissionKey}`
- Role permissions: `v-perms:role:{roleId}:{permissionKey}`

**When to Invalidate Cache:**
- After assigning/removing permissions: `invalidateUserCache(userId)` or `invalidateRoleCache(roleId)`
- After role changes: `invalidateRoleCache(roleId)`
- After role inheritance changes: invalidate both roles

## Error Handling

The package throws descriptive errors instead of returning `false`.

```javascript
const { errors } = require('@faryzal2020/v-perms');

try {
  await perms.assignRole('nonexistent-role', userId);
} catch (error) {
  if (error instanceof errors.RoleNotFoundError) {
    console.error('Role not found:', error.details.roleId);
  }
}
```

**Error Types:**
- `UserNotFoundError`
- `RoleNotFoundError`
- `PermissionNotFoundError`
- `RoleAlreadyAssignedError`
- `PermissionAlreadyExistsError`
- `CircularInheritanceError`

## Debug Logging

Enable debug logging to see what's happening under the hood.

```javascript
const perms = createPermissionSystem(prisma, {
  debug: true,
});

// Or enable later
perms.logger.enable();

// Disable
perms.logger.disable();
```

**Log Output:**
```
[v-perms:debug] checkPermission: user-123 endpoint.users.list
[v-perms:debug] Cache miss
[v-perms:debug] User roles (with inheritance): ['admin', 'member']
[v-perms:debug] Role wildcard match: admin endpoint.* true
```

## Common Patterns

### Seed Initial Permissions

```javascript
async function seedPermissions() {
  const permissions = [
    { key: 'page.home', desc: 'Home page', cat: 'page' },
    { key: 'page.admin', desc: 'Admin dashboard', cat: 'page' },
    { key: 'endpoint.users.list', desc: 'List users', cat: 'endpoint' },
    { key: 'endpoint.users.create', desc: 'Create user', cat: 'endpoint' },
    { key: 'endpoint.users.delete', desc: 'Delete user', cat: 'endpoint' },
  ];

  for (const perm of permissions) {
    await perms.createPermission(perm.key, perm.desc, perm.cat);
  }
}
```

### Seed Initial Roles

```javascript
async function seedRoles() {
  // Create member role
  await perms.createRole('member', 'Basic user', 1, true);
  const memberRole = await perms.manager.getRole('member');
  await perms.assignPermission('page.home', memberRole.id, 'role');
  await perms.assignPermission('page.profile', memberRole.id, 'role');

  // Create admin role
  await perms.createRole('admin', 'Administrator', 10);
  const adminRole = await perms.manager.getRole('admin');
  await perms.manager.setRoleInheritance(adminRole.id, memberRole.id);
  await perms.assignPermission('page.admin', adminRole.id, 'role');
  await perms.assignPermission('endpoint.*', adminRole.id, 'role');
}
```

### Middleware (Express Example)

```javascript
function requirePermission(permission) {
  return async (req, res, next) => {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const hasPermission = await perms.can(userId, permission);
      
      if (!hasPermission) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// Usage
app.get('/api/users', 
  authenticate, 
  requirePermission('endpoint.users.list'),
  async (req, res) => {
    // Handler
  }
);
```

### Assign Default Role on User Registration

```javascript
async function registerUser(userData) {
  const user = await prisma.user.create({
    data: userData,
  });

  // Get default role
  const defaultRole = await prisma.role.findFirst({
    where: { isDefault: true },
  });

  if (defaultRole) {
    await perms.assignRole(defaultRole.id, user.id);
  }

  return user;
}
```

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

## Support

For issues and questions, please use GitHub Issues.
```

---

## 13. Example: Schema Usage (`examples/schema-usage.md`)

```markdown
# Schema Integration Guide

## Step 1: Copy Schema Models

Copy the following models into your existing `prisma/schema.prisma` file.

**Important:** Replace `User` in the relations with your actual User model name if it's different.

```prisma
// ... your existing schema ...

model Role {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  priority    Int      @default(0)
  isDefault   Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  userRoles        UserRole[]
  rolePermissions  RolePermission[]
  inheritedRoles   RoleInheritance[] @relation("ParentRole")
  inheritsFrom     RoleInheritance[] @relation("ChildRole")

  @@map("roles")
}

model Permission {
  id          String   @id @default(cuid())
  key         String   @unique
  description String?
  category    String?
  createdAt   DateTime @default(now())

  rolePermissions RolePermission[]
  userPermissions UserPermission[]

  @@index([category])
  @@map("permissions")
}

model UserRole {
  userId     String
  roleId     String
  assignedAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role Role @relation(fields: [roleId], references: [id], onDelete: Cascade)

  @@id([userId, roleId])
  @@map("user_roles")
}

model RolePermission {
  roleId       String
  permissionId String
  granted      Boolean  @default(true)
  assignedAt   DateTime @default(now())

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
  @@map("role_permissions")
}

model UserPermission {
  userId       String
  permissionId String
  granted      Boolean  @default(true)
  assignedAt   DateTime @default(now())

  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([userId, permissionId])
  @@map("user_permissions")
}

model RoleInheritance {
  roleId         String
  inheritsFromId String
  priority       Int      @default(0)
  createdAt      DateTime @default(now())

  role         Role @relation("ParentRole", fields: [roleId], references: [id], onDelete: Cascade)
  inheritsFrom Role @relation("ChildRole", fields: [inheritsFromId], references: [id], onDelete: Cascade)

  @@id([roleId, inheritsFromId])
  @@map("role_inheritance")
}
```

## Step 2: Update Your User Model

Add these relations to your existing User model:

```prisma
model User {
  id    String @id @default(cuid())
  // ... your existing fields ...
  
  // Add these relations
  userRoles       UserRole[]
  userPermissions UserPermission[]
}
```

## Step 3: Run Migration

```bash
npx prisma migrate dev --name add_permission_system
```

## Database-Specific Notes

### PostgreSQL
Works out of the box. Recommended for production.

### MySQL
Change `@default(cuid())` to `@default(uuid())` if you prefer UUID format.

### SQLite
Works but not recommended for production with Redis caching (better for development/testing).

## Common Customizations

### Using UUID Instead of CUID

Replace all `@default(cuid())` with `@default(uuid())`:

```prisma
id String @id @default(uuid())
```

### Using Auto-Increment IDs

Replace String IDs with Int:

```prisma
id Int @id @default(autoincrement())
```

### Custom Table Names

Change `@@map()` directives to your preferred table names:

```prisma
@@map("my_roles")
@@map("my_permissions")
// etc.
```

### Adding Timestamps to Junction Tables

Add to UserRole, RolePermission, etc:

```prisma
model UserRole {
  // ... existing fields ...
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```
```

---

## 14. .gitignore

```
node_modules/
.env
*.log
.DS_Store
dist/
```

---

## 15. LICENSE (MIT)

```
MIT License

Copyright (c) 2024 faryzal2020

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Create project structure
- [ ] Initialize package.json
- [ ] Create .gitignore
- [ ] Add LICENSE file
- [ ] Create Prisma schema template

### Phase 2: Utilities & Errors
- [ ] Implement error classes (src/core/errors.js)
- [ ] Implement Logger utility (src/utils/logger.js)
- [ ] Implement wildcard utility (src/utils/wildcard.js)

### Phase 3: Adapters
- [ ] Implement BaseAdapter interface (src/adapters/BaseAdapter.js)
- [ ] Implement PrismaAdapter (src/adapters/PrismaAdapter.js)
  - [ ] User operations methods
  - [ ] Role operations methods
  - [ ] Permission operations methods
  - [ ] Listing operations methods
  - [ ] Circular inheritance check helper

### Phase 4: Core Logic
- [ ] Implement CacheManager (src/core/CacheManager.js)
  - [ ] Redis connection handling
  - [ ] Cache get/set/delete methods
  - [ ] Invalidation methods
- [ ] Implement PermissionChecker (src/core/PermissionChecker.js)
  - [ ] User permission checking with caching
  - [ ] Role permission checking
  - [ ] Role inheritance resolution
  - [ ] Wildcard support
  - [ ] Ban permission handling

### Phase 5: High-Level API
- [ ] Implement PermissionManager (src/core/PermissionManager.js)
  - [ ] Permission CRUD operations
  - [ ] Role CRUD operations
  - [ ] Assignment operations (permissions to roles/users)
  - [ ] Ban permission operations
  - [ ] Role assignment to users
  - [ ] Role inheritance management
  - [ ] Query operations
  - [ ] Cache invalidation wrappers

### Phase 6: Main Export
- [ ] Implement main entry point (src/index.js)
  - [ ] Factory function
  - [ ] Convenience method exports
  - [ ] Export all modules

### Phase 7: Documentation
- [ ] Write comprehensive README.md
  - [ ] Installation instructions
  - [ ] Quick start guide
  - [ ] Full API reference
  - [ ] Examples for common patterns
  - [ ] Error handling documentation
- [ ] Write schema integration guide (examples/schema-usage.md)

### Phase 8: Testing Preparation
- [ ] Review all error handling
- [ ] Add JSDoc comments to all public methods
- [ ] Verify Bun.js compatibility
- [ ] Verify Node.js compatibility
- [ ] Test with PostgreSQL locally
- [ ] Test with MySQL locally
- [ ] Test with SQLite locally

### Phase 9: Publishing
- [ ] Create GitHub repository
- [ ] Push code to GitHub
- [ ] Test installation from git (npm install git+https://...)
- [ ] Publish to npm registry (npm publish --access public)
- [ ] Verify package installation
- [ ] Tag release (v1.0.0)

---

## Technical Notes for Implementation

### Bun.js Compatibility
- Use standard JavaScript (no Node.js-specific APIs unless necessary)
- Test `require()` and `module.exports` work in Bun
- Redis client should work with both runtimes
- Prisma Client works natively in Bun

### Error Handling Best Practices
- Always throw descriptive errors with context
- Use custom error classes for different error types
- Include relevant details in error.details object
- Log errors with logger before throwing (if debug enabled)

### Caching Strategy
- Cache key format: `v-perms:{type}:{...parts}`
- Always check cache before database queries
- Invalidate cache when permissions/roles change
- Use Redis SETEX for automatic expiration
- Handle Redis connection failures gracefully (fall back to no cache)

### Performance Considerations
- Use Prisma's `include` to reduce query count
- Cache role inheritance chains
- Implement batch operations where possible
- Use database indexes on frequently queried fields

### Security Considerations
- Always use parameterized queries (Prisma handles this)
- Validate all user inputs
- Never expose internal error details to clients
- Use onDelete: Cascade to prevent orphaned records

---

## Post-Implementation Testing Strategy

### Unit Testing (Manual - in separate test project)
1. Test each function with valid inputs
2. Test each function with invalid inputs
3. Test edge cases (empty strings, null values, etc.)
4. Test circular inheritance prevention
5. Test cache hit/miss scenarios
6. Test wildcard matching
7. Test ban permission priority

### Integration Testing
1. Create test backend (Express + Prisma)
2. Create test frontend (simple UI to manage permissions)
3. Test full flow: create user → assign role → check permission
4. Test role inheritance chains
5. Test user-specific overrides
6. Test Redis caching
7. Test with all three databases (PostgreSQL, MySQL, SQLite)

### Performance Testing
1. Test with 1000+ permissions
2. Test with 100+ roles
3. Test with deep inheritance chains (5+ levels)
4. Test cache performance improvement
5. Test concurrent permission checks

---

## Future Enhancements (Post v1.0.0)

### v1.1.0
- Resource-based permissions (e.g., can edit post #123)
- Temporary permissions (expiration dates)
- Permission conditions (e.g., can delete if owner)

### v1.2.0
- UI components for permission management (React)
- GraphQL API adapter
- MongoDB adapter

### v2.0.0
- Attribute-based access control (ABAC)
- Policy language support
- Audit logging

---

## Questions or Issues During Implementation

Document any questions, blockers, or decisions made during implementation here:

1. Question/Issue:
   Solution:

2. Question/Issue:
   Solution:

---

**End of Implementation Plan**