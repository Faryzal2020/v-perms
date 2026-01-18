# @faryzal2020/v-perms

Minimal, flexible role-based permission system for JavaScript/Bun.js applications with Prisma.

## Features

- **Role-based access control (RBAC)** - Assign roles to users, permissions to roles
- **Role inheritance** - Roles can inherit permissions from other roles
- **User-specific overrides** - Direct user permissions take priority over role permissions
- **Wildcard permissions** - Grant access to multiple permissions at once (`endpoint.*`, `*`)
- **Ban/deny permissions** - Explicitly deny access even when wildcards would allow
- **Redis caching** - Optional distributed caching for high performance
- **Database agnostic** - Compatible with PostgreSQL, MySQL, SQLite via Prisma
- **Runtime flexible** - Works with both Bun.js and Node.js
- **Zero dependencies** - Only requires Prisma (peer dependency)

## Documentation

- 📖 [Getting Started Guide](./docs/GETTING_STARTED.md) - Step-by-step setup instructions
- 📚 [API Reference](./docs/API.md) - Complete API documentation
- 💡 [Common Patterns](./docs/PATTERNS.md) - Real-world examples and patterns
- ✅ [Best Practices](./docs/BEST_PRACTICES.md) - Production-ready guidelines
- 🔧 [Troubleshooting](./docs/TROUBLESHOOTING.md) - Common issues and solutions
- 🗄️ [Schema Integration](./examples/schema-usage.md) - Prisma schema setup guide
- 📝 [Changelog](./CHANGELOG.md) - Version history and updates

## Installation

```bash
npm install @faryzal2020/v-perms
# or
bun add @faryzal2020/v-perms
```

## Quick Start

### 1. Add Schema to Your Prisma Schema

Copy the models from `src/prisma/schema.prisma` into your existing Prisma schema file. See [examples/schema-usage.md](examples/schema-usage.md) for detailed instructions.

### 2. Run Migrations

```bash
npx prisma migrate dev --name add-permissions
```

### 3. Initialize in Your Code

```javascript
import { PrismaClient } from '@prisma/client';
import { createPermissionSystem } from '@faryzal2020/v-perms';

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

#### `banPermission(permissionKey, targetId, targetType)`

Explicitly deny a permission (sets `granted=false`).

```javascript
// Ban admin page access for specific user
await perms.banPermission('page.admin', userId, 'user');

// Admin has endpoint.* but ban delete specifically
await perms.assignPermission('endpoint.*', adminRoleId, 'role');
await perms.banPermission('endpoint.users.delete', adminRoleId, 'role');
```

#### `assignRole(roleIdOrName, userId)`

Assign role to user.

```javascript
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
// Admin inherits all member permissions
await perms.manager.setRoleInheritance(adminRole.id, memberRole.id, 1);
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

**Priority:** Deny (`granted=false`) takes precedence at the point it's checked (user level, then role level).

## Role Inheritance

Roles can inherit permissions from other roles.

```javascript
// Create role hierarchy
await perms.createRole('member', 'Basic user', 1);
await perms.createRole('moderator', 'Moderator', 5);
await perms.createRole('admin', 'Administrator', 10);

// Assign permissions
await perms.assignPermission('page.home', 'member', 'role');
await perms.assignPermission('page.profile', 'member', 'role');

// Moderator inherits member permissions + has more
await perms.manager.setRoleInheritance('moderator', 'member');
await perms.assignPermission('page.moderation', 'moderator', 'role');

// Admin inherits moderator (which inherits member)
await perms.manager.setRoleInheritance('admin', 'moderator');
await perms.assignPermission('page.admin', 'admin', 'role');
```

**Result:** Admin has permissions from member + moderator + admin

**Circular Inheritance:** The system prevents circular inheritance and will throw `CircularInheritanceError`.

## Redis Caching

For production environments with multiple instances, use Redis for distributed caching.

```javascript
import { createClient } from 'redis';

const redisClient = createClient({
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
import { errors } from '@faryzal2020/v-perms';

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
- `RoleAlreadyExistsError`
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
    try {
      await perms.createPermission(perm.key, perm.desc, perm.cat);
    } catch (error) {
      // Permission already exists, skip
    }
  }
}
```

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

## Support

For issues and questions, please use GitHub Issues.
