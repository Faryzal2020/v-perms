# Common Patterns and Examples

Real-world examples and patterns for using v-perms in your application.

## Table of Contents

- [Express.js Integration](#expressjs-integration)
- [Hono Integration](#hono-integration)
- [User Registration](#user-registration)
- [Permission Hierarchies](#permission-hierarchies)
- [Dynamic Permissions](#dynamic-permissions)
- [Multi-Tenancy](#multi-tenancy)
- [Audit Logging](#audit-logging)

---

## Express.js Integration

### Basic Middleware

```javascript
import express from 'express';
import perms from './lib/permissions.js';

const app = express();

// Authentication middleware (example)
function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  // Verify token and set req.user
  req.user = { id: 'user-id-from-token' };
  next();
}

// Permission middleware
function requirePermission(permission) {
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
      console.error('Permission check failed:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// Usage
app.get('/api/users', 
  authenticate,
  requirePermission('users.list'),
  async (req, res) => {
    // Your handler
  }
);

app.delete('/api/users/:id',
  authenticate,
  requirePermission('users.delete'),
  async (req, res) => {
    // Your handler
  }
);
```

### Multiple Permission Check

```javascript
function requireAnyPermission(...permissions) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const checks = await Promise.all(
        permissions.map(p => perms.can(req.user.id, p))
      );
      
      const hasAny = checks.some(result => result === true);
      
      if (!hasAny) {
        return res.status(403).json({ 
          error: 'Forbidden',
          required: `One of: ${permissions.join(', ')}` 
        });
      }
      
      next();
    } catch (error) {
      console.error('Permission check failed:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// Usage
app.post('/api/posts/:id/publish',
  authenticate,
  requireAnyPermission('posts.publish', 'posts.admin'),
  publishPostHandler
);
```

### All Permissions Check

```javascript
function requireAllPermissions(...permissions) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const checks = await Promise.all(
        permissions.map(p => perms.can(req.user.id, p))
      );
      
      const hasAll = checks.every(result => result === true);
      
      if (!hasAll) {
        return res.status(403).json({ 
          error: 'Forbidden',
          required: `All of: ${permissions.join(', ')}` 
        });
      }
      
      next();
    } catch (error) {
      console.error('Permission check failed:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}
```

---

## Hono Integration

### Basic Middleware

```javascript
import { Hono } from 'hono';
import perms from './lib/permissions.js';

const app = new Hono();

// Permission middleware
function requirePermission(permission) {
  return async (c, next) => {
    const user = c.get('user');
    
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    try {
      const hasPermission = await perms.can(user.id, permission);
      
      if (!hasPermission) {
        return c.json({ 
          error: 'Forbidden',
          required: permission 
        }, 403);
      }
      
      await next();
    } catch (error) {
      console.error('Permission check failed:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  };
}

// Usage
app.get('/api/users', 
  requirePermission('users.list'),
  async (c) => {
    // Your handler
  }
);
```

---

## User Registration

### Auto-Assign Default Role

```javascript
async function registerUser(email, password, name) {
  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      password: await hashPassword(password),
      name,
    },
  });

  // Assign default role
  const defaultRole = await prisma.role.findFirst({
    where: { isDefault: true },
  });

  if (defaultRole) {
    await perms.assignRole(defaultRole.id, user.id);
  }

  return user;
}
```

### Assign Role Based on Email Domain

```javascript
async function registerUser(email, password, name) {
  const user = await prisma.user.create({
    data: { email, password: await hashPassword(password), name },
  });

  // Assign role based on email domain
  const domain = email.split('@')[1];
  let roleName = 'member'; // default

  if (domain === 'company.com') {
    roleName = 'employee';
  } else if (domain === 'admin.company.com') {
    roleName = 'admin';
  }

  const role = await perms.manager.getRole(roleName);
  if (role) {
    await perms.assignRole(role.id, user.id);
  }

  return user;
}
```

---

## Permission Hierarchies

### Content Management System

```javascript
async function setupCMSPermissions() {
  // Create permissions
  const permissions = [
    // Posts
    { key: 'posts.view', desc: 'View posts', cat: 'posts' },
    { key: 'posts.create', desc: 'Create posts', cat: 'posts' },
    { key: 'posts.edit', desc: 'Edit posts', cat: 'posts' },
    { key: 'posts.delete', desc: 'Delete posts', cat: 'posts' },
    { key: 'posts.publish', desc: 'Publish posts', cat: 'posts' },
    
    // Users
    { key: 'users.view', desc: 'View users', cat: 'users' },
    { key: 'users.create', desc: 'Create users', cat: 'users' },
    { key: 'users.edit', desc: 'Edit users', cat: 'users' },
    { key: 'users.delete', desc: 'Delete users', cat: 'users' },
    
    // Settings
    { key: 'settings.view', desc: 'View settings', cat: 'settings' },
    { key: 'settings.edit', desc: 'Edit settings', cat: 'settings' },
  ];

  for (const perm of permissions) {
    await perms.createPermission(perm.key, perm.desc, perm.cat);
  }

  // Create roles
  const viewer = await perms.createRole('viewer', 'Can view content', 1, true);
  const author = await perms.createRole('author', 'Can create content', 3);
  const editor = await perms.createRole('editor', 'Can edit and publish', 5);
  const admin = await perms.createRole('admin', 'Full access', 10);

  // Viewer permissions
  await perms.assignPermission('posts.view', viewer.id, 'role');

  // Author inherits viewer + can create
  await perms.manager.setRoleInheritance(author.id, viewer.id);
  await perms.assignPermission('posts.create', author.id, 'role');

  // Editor inherits author + can edit/publish
  await perms.manager.setRoleInheritance(editor.id, author.id);
  await perms.assignPermission('posts.edit', editor.id, 'role');
  await perms.assignPermission('posts.publish', editor.id, 'role');

  // Admin inherits editor + has all permissions
  await perms.manager.setRoleInheritance(admin.id, editor.id);
  await perms.assignPermission('*', admin.id, 'role');
}
```

---

## Dynamic Permissions

### Resource-Based Permissions

```javascript
// Check if user can edit a specific post
async function canEditPost(userId, postId) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
  });

  if (!post) return false;

  // Owner can always edit
  if (post.authorId === userId) {
    return true;
  }

  // Check general edit permission
  return await perms.can(userId, 'posts.edit');
}

// Usage in route
app.put('/api/posts/:id', authenticate, async (req, res) => {
  const canEdit = await canEditPost(req.user.id, req.params.id);
  
  if (!canEdit) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // Update post
});
```

### Time-Based Permissions

```javascript
async function canAccessFeature(userId, feature) {
  // Check base permission
  const hasPermission = await perms.can(userId, feature);
  if (!hasPermission) return false;

  // Check if user's subscription is active
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });

  if (!user.subscription) return false;
  
  const now = new Date();
  return user.subscription.expiresAt > now;
}
```

---

## Multi-Tenancy

### Tenant-Specific Permissions

```javascript
// Add tenant context to permission checks
async function canAccessTenant(userId, tenantId, permission) {
  // Check if user belongs to tenant
  const membership = await prisma.tenantMember.findUnique({
    where: {
      userId_tenantId: { userId, tenantId },
    },
    include: { role: true },
  });

  if (!membership) return false;

  // Check permission within tenant context
  return await perms.canRole(membership.role.id, permission);
}

// Usage
app.get('/api/tenants/:tenantId/users', authenticate, async (req, res) => {
  const canView = await canAccessTenant(
    req.user.id,
    req.params.tenantId,
    'users.view'
  );

  if (!canView) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // List users in tenant
});
```

---

## Audit Logging

### Log Permission Checks

```javascript
async function checkAndLogPermission(userId, permission, resource = null) {
  const hasPermission = await perms.can(userId, permission);

  // Log the check
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'PERMISSION_CHECK',
      permission,
      resource,
      granted: hasPermission,
      timestamp: new Date(),
    },
  });

  return hasPermission;
}

// Usage
app.delete('/api/users/:id', authenticate, async (req, res) => {
  const canDelete = await checkAndLogPermission(
    req.user.id,
    'users.delete',
    req.params.id
  );

  if (!canDelete) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Delete user
});
```

### Log Permission Changes

```javascript
async function assignRoleWithAudit(roleId, userId, adminId) {
  await perms.assignRole(roleId, userId);

  // Log the change
  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: 'ROLE_ASSIGNED',
      targetUserId: userId,
      roleId,
      timestamp: new Date(),
    },
  });

  // Invalidate cache
  await perms.invalidateUserCache(userId);
}
```

---

## Advanced Patterns

### Permission Groups

```javascript
const PERMISSION_GROUPS = {
  CONTENT_MANAGER: [
    'posts.view',
    'posts.create',
    'posts.edit',
    'posts.publish',
  ],
  USER_MANAGER: [
    'users.view',
    'users.create',
    'users.edit',
  ],
};

async function assignPermissionGroup(roleId, groupName) {
  const permissions = PERMISSION_GROUPS[groupName];
  
  if (!permissions) {
    throw new Error(`Unknown permission group: ${groupName}`);
  }

  for (const permission of permissions) {
    await perms.assignPermission(permission, roleId, 'role');
  }

  await perms.invalidateRoleCache(roleId);
}

// Usage
await assignPermissionGroup(editorRoleId, 'CONTENT_MANAGER');
```

### Conditional Permissions

```javascript
async function canPerformAction(userId, action, context = {}) {
  const basePermission = await perms.can(userId, action);
  if (!basePermission) return false;

  // Additional checks based on context
  switch (action) {
    case 'posts.delete':
      // Can only delete own posts unless admin
      if (context.postAuthorId !== userId) {
        return await perms.can(userId, 'posts.admin');
      }
      return true;

    case 'users.edit':
      // Can't edit users with higher role priority
      const targetUser = await prisma.user.findUnique({
        where: { id: context.targetUserId },
        include: { userRoles: { include: { role: true } } },
      });
      
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        include: { userRoles: { include: { role: true } } },
      });

      const maxTargetPriority = Math.max(
        ...targetUser.userRoles.map(ur => ur.role.priority)
      );
      const maxCurrentPriority = Math.max(
        ...currentUser.userRoles.map(ur => ur.role.priority)
      );

      return maxCurrentPriority > maxTargetPriority;

    default:
      return true;
  }
}
```

---

## Testing Patterns

### Mock Permission System

```javascript
// test/helpers/mockPerms.js
export function createMockPerms(permissions = {}) {
  return {
    can: async (userId, permission) => {
      return permissions[userId]?.[permission] ?? false;
    },
    assignRole: async () => {},
    createPermission: async () => {},
    // ... other methods
  };
}

// Usage in tests
import { createMockPerms } from './helpers/mockPerms.js';

test('should allow user with permission', async () => {
  const mockPerms = createMockPerms({
    'user-1': { 'posts.delete': true },
  });

  const result = await mockPerms.can('user-1', 'posts.delete');
  expect(result).toBe(true);
});
```
