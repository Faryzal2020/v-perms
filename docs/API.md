# v-perms API Reference

Complete API documentation for all methods and classes.

## Table of Contents

- [Factory Function](#factory-function)
- [Permission Manager](#permission-manager)
- [Permission Checker](#permission-checker)
- [Cache Manager](#cache-manager)
- [Errors](#errors)

---

## Factory Function

### `createPermissionSystem(prismaClient, options)`

Creates and initializes the permission system.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `prismaClient` | PrismaClient | ✅ | - | Initialized Prisma client instance |
| `options` | Object | ❌ | `{}` | Configuration options |
| `options.redis` | RedisClient | ❌ | `null` | Redis client for caching |
| `options.enableCache` | Boolean | ❌ | `true` | Enable/disable caching |
| `options.cacheTTL` | Number | ❌ | `300` | Cache TTL in seconds |
| `options.debug` | Boolean | ❌ | `false` | Enable debug logging |

**Returns:** `PermissionSystem` - Object with all permission methods

**Example:**

```javascript
import { PrismaClient } from '@prisma/client';
import { createPermissionSystem } from '@faryzal2020/v-perms';
import { createClient } from 'redis';

const prisma = new PrismaClient();
const redis = createClient({ url: 'redis://localhost:6379' });
await redis.connect();

const perms = createPermissionSystem(prisma, {
  redis,
  enableCache: true,
  cacheTTL: 600,
  debug: true,
});
```

---

## Permission Manager

The `manager` object provides CRUD operations for permissions, roles, and assignments.

### Permission Operations

#### `createPermission(key, description?, category?)`

Creates a new permission.

**Parameters:**
- `key` (string, required): Unique permission key (e.g., `"users.delete"`)
- `description` (string, optional): Human-readable description
- `category` (string, optional): Category for grouping

**Returns:** `Promise<Permission>`

**Throws:** `PermissionAlreadyExistsError` if permission exists

**Example:**

```javascript
await perms.createPermission(
  'posts.publish',
  'Publish blog posts',
  'posts'
);
```

#### `deletePermission(permissionKey)`

Deletes a permission and all its assignments.

**Parameters:**
- `permissionKey` (string): Permission key to delete

**Returns:** `Promise<boolean>` - `true` if deleted, `false` if not found

**Example:**

```javascript
await perms.deletePermission('posts.publish');
```

#### `manager.listPermissions()`

Lists all permissions in the system.

**Returns:** `Promise<Permission[]>`

**Example:**

```javascript
const permissions = await perms.manager.listPermissions();
permissions.forEach(p => {
  console.log(`${p.key} - ${p.description}`);
});
```

#### `manager.getPermission(permissionKey)`

Gets a specific permission by key.

**Parameters:**
- `permissionKey` (string): Permission key

**Returns:** `Promise<Permission | null>`

**Example:**

```javascript
const perm = await perms.manager.getPermission('users.delete');
if (perm) {
  console.log(perm.description);
}
```

### Role Operations

#### `createRole(name, description?, priority?, isDefault?)`

Creates a new role.

**Parameters:**
- `name` (string, required): Unique role name
- `description` (string, optional): Role description
- `priority` (number, optional, default: 0): Role priority (higher = checked first)
- `isDefault` (boolean, optional, default: false): Auto-assign to new users

**Returns:** `Promise<Role>`

**Throws:** `RoleAlreadyExistsError` if role exists

**Example:**

```javascript
const editorRole = await perms.createRole(
  'editor',
  'Content editor',
  5,
  false
);
```

#### `deleteRole(roleIdOrName)`

Deletes a role and all its assignments.

**Parameters:**
- `roleIdOrName` (string): Role ID or name

**Returns:** `Promise<boolean>`

**Throws:** `RoleNotFoundError` if role doesn't exist

**Example:**

```javascript
await perms.deleteRole('editor');
```

#### `manager.getRole(roleIdOrName)`

Gets a role by ID or name.

**Parameters:**
- `roleIdOrName` (string): Role ID or name

**Returns:** `Promise<Role | null>`

**Example:**

```javascript
const role = await perms.manager.getRole('admin');
console.log(role.priority); // 10
```

#### `manager.updateRole(roleIdOrName, data)`

Updates role properties.

**Parameters:**
- `roleIdOrName` (string): Role ID or name
- `data` (object): Fields to update (`description`, `priority`, `isDefault`)

**Returns:** `Promise<Role>`

**Example:**

```javascript
await perms.manager.updateRole('editor', {
  priority: 7,
  description: 'Senior content editor'
});
```

#### `manager.listRoles()`

Lists all roles.

**Returns:** `Promise<Role[]>` - Sorted by priority (descending)

**Example:**

```javascript
const roles = await perms.manager.listRoles();
```

### Assignment Operations

#### `assignPermission(permissionKey, targetId, targetType?)`

Assigns a permission to a role or user.

**Parameters:**
- `permissionKey` (string): Permission key (supports wildcards)
- `targetId` (string): Role ID/name or User ID
- `targetType` (string, optional, default: `'role'`): `'role'` or `'user'`

**Returns:** `Promise<Assignment>`

**Example:**

```javascript
// Assign to role
await perms.assignPermission('posts.*', 'editor', 'role');

// Assign to specific user
await perms.assignPermission('posts.delete', userId, 'user');

// Wildcard assignment
await perms.assignPermission('*', 'admin', 'role');
```

#### `banPermission(permissionKey, targetId, targetType?)`

Explicitly denies a permission (sets `granted=false`).

**Parameters:**
- `permissionKey` (string): Permission key
- `targetId` (string): Role ID/name or User ID
- `targetType` (string, optional, default: `'role'`): `'role'` or `'user'`

**Returns:** `Promise<Assignment>`

**Example:**

```javascript
// Admin has posts.* but ban delete
await perms.assignPermission('posts.*', 'admin', 'role');
await perms.banPermission('posts.delete', 'admin', 'role');

// Ban specific user
await perms.banPermission('posts.publish', userId, 'user');
```

#### `manager.removePermission(permissionKey, targetId, targetType?)`

Removes a permission assignment.

**Parameters:**
- `permissionKey` (string): Permission key
- `targetId` (string): Role ID/name or User ID
- `targetType` (string, optional, default: `'role'`): `'role'` or `'user'`

**Returns:** `Promise<boolean>`

**Example:**

```javascript
await perms.manager.removePermission('posts.delete', 'editor', 'role');
```

#### `assignRole(roleIdOrName, userId)`

Assigns a role to a user.

**Parameters:**
- `roleIdOrName` (string): Role ID or name
- `userId` (string): User ID

**Returns:** `Promise<UserRole>`

**Throws:** 
- `RoleNotFoundError` if role doesn't exist
- `RoleAlreadyAssignedError` if already assigned

**Example:**

```javascript
await perms.assignRole('editor', userId);
```

#### `manager.removeRole(roleIdOrName, userId)`

Removes a role from a user.

**Parameters:**
- `roleIdOrName` (string): Role ID or name
- `userId` (string): User ID

**Returns:** `Promise<boolean>`

**Example:**

```javascript
await perms.manager.removeRole('editor', userId);
```

#### `manager.setRoleInheritance(roleId, inheritFromRoleId, priority?)`

Sets up role inheritance.

**Parameters:**
- `roleId` (string): Role that will inherit
- `inheritFromRoleId` (string): Role to inherit from
- `priority` (number, optional, default: 0): Inheritance priority

**Returns:** `Promise<RoleInheritance>`

**Throws:** `CircularInheritanceError` if circular dependency detected

**Example:**

```javascript
// Admin inherits from moderator
await perms.manager.setRoleInheritance('admin', 'moderator', 1);
```

#### `manager.removeRoleInheritance(roleId, inheritFromRoleId)`

Removes role inheritance.

**Parameters:**
- `roleId` (string): Role ID
- `inheritFromRoleId` (string): Inherited role ID

**Returns:** `Promise<boolean>`

**Example:**

```javascript
await perms.manager.removeRoleInheritance('admin', 'moderator');
```

### Check Operations

#### `can(userId, permissionKey)`

**Main method** - Checks if a user has a specific permission.

**Parameters:**
- `userId` (string): User ID
- `permissionKey` (string): Permission key to check

**Returns:** `Promise<boolean>`

**Resolution Order:**
1. User-specific permissions (highest priority)
2. User-specific wildcard permissions
3. Direct role permissions (by role priority)
4. Role wildcard permissions
5. Inherited role permissions
6. Inherited role wildcard permissions
7. Default deny

**Example:**

```javascript
const canDelete = await perms.can(userId, 'users.delete');

if (canDelete) {
  // Allow deletion
} else {
  // Deny access
}
```

#### `canRole(roleId, permissionKey)`

Checks if a role has a specific permission.

**Parameters:**
- `roleId` (string): Role ID
- `permissionKey` (string): Permission key

**Returns:** `Promise<boolean>`

**Example:**

```javascript
const roleCanPublish = await perms.canRole(editorRoleId, 'posts.publish');
```

#### `checkPermission(targetId, permissionKey, targetType?)`

Generic permission check for user or role.

**Parameters:**
- `targetId` (string): User ID or Role ID
- `permissionKey` (string): Permission key
- `targetType` (string, optional, default: `'user'`): `'user'` or `'role'`

**Returns:** `Promise<boolean>`

**Example:**

```javascript
await perms.checkPermission(userId, 'posts.edit', 'user');
await perms.checkPermission(roleId, 'posts.edit', 'role');
```

### Query Operations

#### `manager.getUserRoles(userId)`

Gets all roles assigned to a user.

**Parameters:**
- `userId` (string): User ID

**Returns:** `Promise<Role[]>`

**Example:**

```javascript
const roles = await perms.manager.getUserRoles(userId);
roles.forEach(role => {
  console.log(`${role.name} (priority: ${role.priority})`);
});
```

#### `manager.getUserPermissions(userId)`

Gets all permissions for a user (direct + from roles).

**Parameters:**
- `userId` (string): User ID

**Returns:** `Promise<{ direct: Permission[], fromRoles: RolePermission[] }>`

**Example:**

```javascript
const { direct, fromRoles } = await perms.manager.getUserPermissions(userId);

console.log('Direct permissions:', direct.length);
fromRoles.forEach(rp => {
  console.log(`From ${rp.role}:`, rp.permissions.length);
});
```

#### `manager.getRolePermissions(roleIdOrName)`

Gets all permissions assigned to a role.

**Parameters:**
- `roleIdOrName` (string): Role ID or name

**Returns:** `Promise<Permission[]>`

**Example:**

```javascript
const permissions = await perms.manager.getRolePermissions('editor');
```

#### `manager.getRoleInheritance(roleIdOrName)`

Gets roles that a role inherits from.

**Parameters:**
- `roleIdOrName` (string): Role ID or name

**Returns:** `Promise<RoleInheritance[]>`

**Example:**

```javascript
const inherited = await perms.manager.getRoleInheritance('admin');
inherited.forEach(i => {
  console.log(`Inherits from: ${i.inheritsFrom.name}`);
});
```

### Cache Operations

#### `invalidateUserCache(userId)`

Clears all cached permission checks for a user.

**Parameters:**
- `userId` (string): User ID

**Returns:** `Promise<void>`

**When to use:** After assigning/removing roles or permissions to/from a user

**Example:**

```javascript
await perms.assignRole('editor', userId);
await perms.invalidateUserCache(userId);
```

#### `invalidateRoleCache(roleId)`

Clears all cached permission checks for a role.

**Parameters:**
- `roleId` (string): Role ID

**Returns:** `Promise<void>`

**When to use:** After assigning/removing permissions to/from a role

**Example:**

```javascript
await perms.assignPermission('posts.*', roleId, 'role');
await perms.invalidateRoleCache(roleId);
```

#### `clearCache()`

Clears entire permission cache.

**Returns:** `Promise<void>`

**When to use:** After bulk updates or system maintenance

**Example:**

```javascript
await perms.clearCache();
```

---

## Errors

All custom errors extend `PermissionError` and include:
- `message`: Error description
- `code`: Error code string
- `details`: Object with contextual information

### Error Types

#### `PermissionError`

Base error class for all permission-related errors.

**Properties:**
- `name`: `'PermissionError'`
- `code`: Error code
- `details`: Error details object

#### `UserNotFoundError`

Thrown when a user ID doesn't exist.

**Details:** `{ userId: string }`

#### `RoleNotFoundError`

Thrown when a role ID/name doesn't exist.

**Details:** `{ roleId: string }`

#### `PermissionNotFoundError`

Thrown when a permission key doesn't exist.

**Details:** `{ permissionKey: string }`

#### `RoleAlreadyAssignedError`

Thrown when trying to assign a role that's already assigned.

**Details:** `{ userId: string, roleId: string }`

#### `PermissionAlreadyExistsError`

Thrown when trying to create a permission that already exists.

**Details:** `{ permissionKey: string }`

#### `RoleAlreadyExistsError`

Thrown when trying to create a role that already exists.

**Details:** `{ roleName: string }`

#### `CircularInheritanceError`

Thrown when role inheritance would create a circular dependency.

**Details:** `{ roleId: string, inheritsFromId: string }`

### Error Handling Example

```javascript
import { errors } from '@faryzal2020/v-perms';

try {
  await perms.assignRole('nonexistent', userId);
} catch (error) {
  if (error instanceof errors.RoleNotFoundError) {
    console.error('Role not found:', error.details.roleId);
  } else if (error instanceof errors.RoleAlreadyAssignedError) {
    console.log('User already has this role');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

---

## Type Definitions

### Permission

```typescript
interface Permission {
  id: string;
  key: string;
  description: string | null;
  category: string | null;
  createdAt: Date;
}
```

### Role

```typescript
interface Role {
  id: string;
  name: string;
  description: string | null;
  priority: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### UserRole

```typescript
interface UserRole {
  userId: string;
  roleId: string;
  assignedAt: Date;
}
```

### RolePermission

```typescript
interface RolePermission {
  roleId: string;
  permissionId: string;
  granted: boolean;
  assignedAt: Date;
}
```

### UserPermission

```typescript
interface UserPermission {
  userId: string;
  permissionId: string;
  granted: boolean;
  assignedAt: Date;
}
```

### RoleInheritance

```typescript
interface RoleInheritance {
  roleId: string;
  inheritsFromId: string;
  priority: number;
  createdAt: Date;
}
```
