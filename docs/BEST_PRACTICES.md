# Best Practices

Production-ready guidelines for using v-perms effectively and securely.

## Security Best Practices

### 1. Never Trust Client-Side Permission Checks

❌ **Bad:**
```javascript
// Client sends which permissions they have
app.post('/api/admin/action', (req, res) => {
  if (req.body.isAdmin) {  // NEVER DO THIS
    // Perform admin action
  }
});
```

✅ **Good:**
```javascript
// Always check permissions server-side
app.post('/api/admin/action', authenticate, async (req, res) => {
  const hasPermission = await perms.can(req.user.id, 'admin.action');
  if (!hasPermission) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // Perform admin action
});
```

### 2. Use Specific Permissions

❌ **Bad:**
```javascript
await perms.createPermission('admin', 'Admin access');
```

✅ **Good:**
```javascript
await perms.createPermission('users.delete', 'Delete users', 'users');
await perms.createPermission('posts.publish', 'Publish posts', 'posts');
await perms.createPermission('settings.edit', 'Edit settings', 'settings');
```

### 3. Limit Wildcard Usage

❌ **Bad:**
```javascript
// Giving wildcard to too many roles
await perms.assignPermission('*', 'moderator', 'role');
await perms.assignPermission('*', 'editor', 'role');
```

✅ **Good:**
```javascript
// Only superadmin gets wildcard
await perms.assignPermission('*', 'superadmin', 'role');

// Others get specific wildcards
await perms.assignPermission('posts.*', 'editor', 'role');
await perms.assignPermission('users.view', 'moderator', 'role');
```

### 4. Validate User Input

```javascript
async function assignRoleToUser(roleId, userId, adminId) {
  // Validate inputs
  if (!roleId || !userId) {
    throw new Error('Invalid parameters');
  }

  // Check if admin has permission
  const canAssign = await perms.can(adminId, 'users.assign-role');
  if (!canAssign) {
    throw new Error('Forbidden');
  }

  // Prevent privilege escalation
  const adminRoles = await perms.manager.getUserRoles(adminId);
  const targetRole = await perms.manager.getRole(roleId);
  
  const maxAdminPriority = Math.max(...adminRoles.map(r => r.priority));
  
  if (targetRole.priority >= maxAdminPriority) {
    throw new Error('Cannot assign role with equal or higher priority');
  }

  await perms.assignRole(roleId, userId);
}
```

---

## Performance Best Practices

### 1. Enable Redis Caching in Production

```javascript
import { createClient } from 'redis';

const redis = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500),
  },
});

await redis.connect();

const perms = createPermissionSystem(prisma, {
  redis,
  enableCache: true,
  cacheTTL: 300, // 5 minutes
});
```

### 2. Invalidate Cache Appropriately

```javascript
// After assigning permission to role
await perms.assignPermission('posts.edit', roleId, 'role');
await perms.invalidateRoleCache(roleId);

// After assigning role to user
await perms.assignRole(roleId, userId);
await perms.invalidateUserCache(userId);

// After bulk updates
await bulkUpdatePermissions();
await perms.clearCache();
```

### 3. Batch Permission Checks

❌ **Bad:**
```javascript
// Sequential checks
for (const action of actions) {
  const canDo = await perms.can(userId, action);
  results.push({ action, allowed: canDo });
}
```

✅ **Good:**
```javascript
// Parallel checks
const results = await Promise.all(
  actions.map(async (action) => ({
    action,
    allowed: await perms.can(userId, action),
  }))
);
```

### 4. Use Database Indexes

Ensure your Prisma schema has proper indexes:

```prisma
model Permission {
  id          String   @id @default(cuid())
  key         String   @unique
  category    String?
  
  @@index([category])  // ✅ Index for category queries
  @@map("permissions")
}

model UserRole {
  userId     String
  roleId     String
  
  @@id([userId, roleId])  // ✅ Composite primary key
  @@index([userId])       // ✅ Index for user lookups
  @@map("user_roles")
}
```

---

## Code Organization

### 1. Centralize Permission System

```javascript
// lib/permissions.js
import { PrismaClient } from '@prisma/client';
import { createPermissionSystem } from '@faryzal2020/v-perms';
import { redis } from './redis.js';

const prisma = new PrismaClient();

export const perms = createPermissionSystem(prisma, {
  redis,
  enableCache: process.env.NODE_ENV === 'production',
  cacheTTL: 300,
  debug: process.env.NODE_ENV === 'development',
});

export default perms;
```

### 2. Create Reusable Middleware

```javascript
// middleware/permissions.js
import perms from '../lib/permissions.js';

export function requirePermission(permission) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const hasPermission = await perms.can(req.user.id, permission);
      
      if (!hasPermission) {
        return res.status(403).json({ 
          error: 'Forbidden',
          required: permission 
        });
      }
      
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

export function requireAnyPermission(...permissions) {
  // Implementation
}

export function requireAllPermissions(...permissions) {
  // Implementation
}
```

### 3. Define Permission Constants

```javascript
// constants/permissions.js
export const PERMISSIONS = {
  // Users
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_EDIT: 'users.edit',
  USERS_DELETE: 'users.delete',
  
  // Posts
  POSTS_VIEW: 'posts.view',
  POSTS_CREATE: 'posts.create',
  POSTS_EDIT: 'posts.edit',
  POSTS_DELETE: 'posts.delete',
  POSTS_PUBLISH: 'posts.publish',
  
  // Admin
  ADMIN_ALL: '*',
};

// Usage
import { PERMISSIONS } from './constants/permissions.js';

app.delete('/api/users/:id',
  authenticate,
  requirePermission(PERMISSIONS.USERS_DELETE),
  deleteUserHandler
);
```

---

## Database Best Practices

### 1. Use Transactions for Related Operations

```javascript
async function createRoleWithPermissions(roleName, permissionKeys) {
  return await prisma.$transaction(async (tx) => {
    // Create role
    const role = await tx.role.create({
      data: {
        name: roleName,
        description: `${roleName} role`,
      },
    });

    // Assign permissions
    for (const key of permissionKeys) {
      const permission = await tx.permission.findUnique({
        where: { key },
      });

      if (permission) {
        await tx.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id,
          },
        });
      }
    }

    return role;
  });
}
```

### 2. Handle Cascading Deletes

The schema already includes `onDelete: Cascade`, but be aware:

```javascript
// Deleting a role will automatically:
// - Remove all UserRole entries
// - Remove all RolePermission entries
// - Remove all RoleInheritance entries

await perms.deleteRole(roleId);
// No need to manually clean up related records
```

### 3. Soft Deletes for Audit Trail

Consider adding soft deletes for important entities:

```prisma
model Role {
  id          String    @id @default(cuid())
  name        String    @unique
  deletedAt   DateTime?  // Soft delete
  
  // ... other fields
}
```

```javascript
// Soft delete implementation
async function softDeleteRole(roleId) {
  await prisma.role.update({
    where: { id: roleId },
    data: { deletedAt: new Date() },
  });
}

// Filter out soft-deleted roles
const activeRoles = await prisma.role.findMany({
  where: { deletedAt: null },
});
```

---

## Error Handling

### 1. Handle Permission Errors Gracefully

```javascript
import { errors } from '@faryzal2020/v-perms';

async function assignRoleHandler(req, res) {
  try {
    await perms.assignRole(req.body.roleId, req.body.userId);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof errors.RoleNotFoundError) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    if (error instanceof errors.UserNotFoundError) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (error instanceof errors.RoleAlreadyAssignedError) {
      return res.status(400).json({ error: 'Role already assigned' });
    }
    
    console.error('Unexpected error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
```

### 2. Log Permission Failures

```javascript
async function checkPermissionWithLogging(userId, permission) {
  const hasPermission = await perms.can(userId, permission);
  
  if (!hasPermission) {
    console.warn('Permission denied:', {
      userId,
      permission,
      timestamp: new Date(),
    });
  }
  
  return hasPermission;
}
```

---

## Testing Best Practices

### 1. Test Permission Logic

```javascript
import { describe, test, expect, beforeAll } from 'bun:test';
import { PrismaClient } from '@prisma/client';
import { createPermissionSystem } from '@faryzal2020/v-perms';

describe('Permission System', () => {
  let prisma;
  let perms;
  let testUser;
  let testRole;

  beforeAll(async () => {
    prisma = new PrismaClient();
    perms = createPermissionSystem(prisma);

    // Create test data
    testUser = await prisma.user.create({
      data: { email: 'test@example.com', password: 'hash' },
    });

    testRole = await perms.createRole('test-role', 'Test role', 1);
  });

  test('should deny permission by default', async () => {
    const result = await perms.can(testUser.id, 'posts.delete');
    expect(result).toBe(false);
  });

  test('should grant permission after assignment', async () => {
    await perms.createPermission('posts.delete', 'Delete posts');
    await perms.assignPermission('posts.delete', testRole.id, 'role');
    await perms.assignRole(testRole.id, testUser.id);

    const result = await perms.can(testUser.id, 'posts.delete');
    expect(result).toBe(true);
  });

  test('should respect wildcard permissions', async () => {
    await perms.assignPermission('posts.*', testRole.id, 'role');

    const canEdit = await perms.can(testUser.id, 'posts.edit');
    const canView = await perms.can(testUser.id, 'posts.view');

    expect(canEdit).toBe(true);
    expect(canView).toBe(true);
  });
});
```

### 2. Test Role Inheritance

```javascript
test('should inherit permissions from parent role', async () => {
  const memberRole = await perms.createRole('member', 'Member', 1);
  const adminRole = await perms.createRole('admin', 'Admin', 10);

  await perms.createPermission('posts.view', 'View posts');
  await perms.assignPermission('posts.view', memberRole.id, 'role');

  await perms.manager.setRoleInheritance(adminRole.id, memberRole.id);
  await perms.assignRole(adminRole.id, testUser.id);

  const canView = await perms.can(testUser.id, 'posts.view');
  expect(canView).toBe(true);
});
```

---

## Deployment Best Practices

### 1. Environment Configuration

```javascript
// config/permissions.js
export const permissionConfig = {
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  cache: {
    enabled: process.env.NODE_ENV === 'production',
    ttl: parseInt(process.env.CACHE_TTL || '300'),
  },
  debug: process.env.NODE_ENV === 'development',
};
```

### 2. Health Checks

```javascript
app.get('/health/permissions', async (req, res) => {
  try {
    // Check if permission system is working
    const roles = await perms.manager.listRoles();
    
    // Check Redis connection if enabled
    let cacheStatus = 'disabled';
    if (perms.cache && perms.cache.redis) {
      try {
        await perms.cache.redis.ping();
        cacheStatus = 'connected';
      } catch (error) {
        cacheStatus = 'disconnected';
      }
    }

    res.json({
      status: 'healthy',
      roles: roles.length,
      cache: cacheStatus,
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});
```

### 3. Monitoring

```javascript
// Track permission check performance
async function monitoredPermissionCheck(userId, permission) {
  const start = Date.now();
  
  try {
    const result = await perms.can(userId, permission);
    const duration = Date.now() - start;
    
    // Send metrics to monitoring service
    metrics.histogram('permission_check_duration', duration, {
      permission,
      result: result ? 'granted' : 'denied',
    });
    
    return result;
  } catch (error) {
    metrics.increment('permission_check_errors', {
      permission,
      error: error.constructor.name,
    });
    throw error;
  }
}
```

---

## Migration Best Practices

### 1. Migrate Existing Permissions

```javascript
async function migrateOldPermissions() {
  // Map old permission format to new
  const oldPermissions = await oldDb.query('SELECT * FROM old_permissions');
  
  for (const old of oldPermissions) {
    const newKey = `${old.category}.${old.action}`;
    
    try {
      await perms.createPermission(newKey, old.description, old.category);
    } catch (error) {
      // Permission already exists, skip
    }
  }
}
```

### 2. Gradual Rollout

```javascript
// Feature flag for new permission system
const USE_NEW_PERMS = process.env.USE_NEW_PERMS === 'true';

async function checkPermission(userId, permission) {
  if (USE_NEW_PERMS) {
    return await perms.can(userId, permission);
  } else {
    return await oldPermissionSystem.check(userId, permission);
  }
}
```

---

## Documentation Best Practices

### 1. Document Your Permissions

Create a permissions registry:

```javascript
// docs/permissions.md
/**
 * # Permission Registry
 * 
 * ## Users
 * - `users.view` - View user list and profiles
 * - `users.create` - Create new users
 * - `users.edit` - Edit user information
 * - `users.delete` - Delete users
 * 
 * ## Posts
 * - `posts.view` - View posts
 * - `posts.create` - Create new posts
 * - `posts.edit` - Edit any post
 * - `posts.delete` - Delete any post
 * - `posts.publish` - Publish posts
 */
```

### 2. Document Role Hierarchies

```javascript
/**
 * # Role Hierarchy
 * 
 * superadmin (priority: 100)
 *   └─ admin (priority: 10)
 *       └─ moderator (priority: 5)
 *           └─ member (priority: 1)
 * 
 * Permissions:
 * - superadmin: * (all permissions)
 * - admin: Inherits moderator + admin.*
 * - moderator: Inherits member + posts.*, users.view
 * - member: posts.view, posts.create
 */
```
