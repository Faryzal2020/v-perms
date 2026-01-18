# Troubleshooting Guide

Common issues and their solutions when using v-perms.

## Installation Issues

### Issue: Prisma Client Not Generated

**Error:**
```
Error: @prisma/client did not initialize yet
```

**Solution:**
```bash
# Generate Prisma client
npx prisma generate
# or
bunx prisma generate
```

### Issue: Schema Migration Fails

**Error:**
```
Error: Unique constraint failed on the fields: (`name`)
```

**Solution:**
This usually means you're trying to create duplicate roles or permissions. Check your seed script or migration.

```javascript
// Use try-catch to handle duplicates
try {
  await perms.createRole('admin', 'Administrator');
} catch (error) {
  console.log('Role already exists');
}
```

---

## Permission Check Issues

### Issue: Permission Always Returns False

**Possible Causes:**

1. **Permission doesn't exist**
   ```javascript
   // Check if permission exists
   const perm = await perms.manager.getPermission('users.delete');
   if (!perm) {
     console.log('Permission not found!');
     await perms.createPermission('users.delete', 'Delete users');
   }
   ```

2. **User has no roles**
   ```javascript
   // Check user's roles
   const roles = await perms.manager.getUserRoles(userId);
   console.log('User roles:', roles);
   
   if (roles.length === 0) {
     // Assign default role
     const defaultRole = await prisma.role.findFirst({
       where: { isDefault: true },
     });
     if (defaultRole) {
       await perms.assignRole(defaultRole.id, userId);
     }
   }
   ```

3. **Permission not assigned to role**
   ```javascript
   // Check role's permissions
   const permissions = await perms.manager.getRolePermissions(roleId);
   console.log('Role permissions:', permissions);
   ```

4. **Cache is stale**
   ```javascript
   // Clear cache and try again
   await perms.invalidateUserCache(userId);
   const result = await perms.can(userId, 'users.delete');
   ```

### Issue: Wildcard Permissions Not Working

**Problem:**
```javascript
await perms.assignPermission('posts.*', roleId, 'role');
const canEdit = await perms.can(userId, 'posts.edit'); // Returns false
```

**Solution:**

1. **Ensure permission exists**
   ```javascript
   // Create the specific permission first
   await perms.createPermission('posts.edit', 'Edit posts');
   
   // Then wildcard will match it
   await perms.assignPermission('posts.*', roleId, 'role');
   ```

2. **Check wildcard format**
   ```javascript
   // ✅ Correct
   'posts.*'      // Matches posts.edit, posts.delete, etc.
   '*'            // Matches everything
   
   // ❌ Wrong
   'posts*'       // Won't work
   'posts.**'     // Won't work
   ```

---

## Role Issues

### Issue: Circular Inheritance Error

**Error:**
```
CircularInheritanceError: Circular role inheritance detected
```

**Cause:**
You're trying to create a circular dependency:
```
admin → moderator → member → admin  // ❌ Circular!
```

**Solution:**
```javascript
// Check inheritance chain before adding
const inheritance = await perms.manager.getRoleInheritance(roleId);
console.log('Current inheritance:', inheritance);

// Remove problematic inheritance
await perms.manager.removeRoleInheritance(roleId, problematicRoleId);
```

### Issue: Role Priority Not Working

**Problem:**
Lower priority role's permissions override higher priority role.

**Solution:**
Check that priorities are set correctly (higher number = higher priority):

```javascript
const roles = await perms.manager.listRoles();
roles.forEach(role => {
  console.log(`${role.name}: priority ${role.priority}`);
});

// Update priorities if needed
await perms.manager.updateRole('admin', { priority: 10 });
await perms.manager.updateRole('moderator', { priority: 5 });
await perms.manager.updateRole('member', { priority: 1 });
```

---

## Cache Issues

### Issue: Permission Changes Not Reflected

**Problem:**
You assigned a permission but `can()` still returns false.

**Solution:**
Invalidate the cache after making changes:

```javascript
// After assigning permission to role
await perms.assignPermission('posts.edit', roleId, 'role');
await perms.invalidateRoleCache(roleId);

// After assigning role to user
await perms.assignRole(roleId, userId);
await perms.invalidateUserCache(userId);

// After bulk updates
await perms.clearCache();
```

### Issue: Redis Connection Errors

**Error:**
```
Error: Redis connection failed
```

**Solution:**

1. **Check Redis is running**
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

2. **Verify connection string**
   ```javascript
   const redis = createClient({
     url: process.env.REDIS_URL || 'redis://localhost:6379',
   });
   
   redis.on('error', (err) => {
     console.error('Redis error:', err);
   });
   
   await redis.connect();
   ```

3. **Disable cache if Redis unavailable**
   ```javascript
   const perms = createPermissionSystem(prisma, {
     enableCache: false, // Disable caching temporarily
   });
   ```

---

## Database Issues

### Issue: Foreign Key Constraint Failed

**Error:**
```
Foreign key constraint failed on the field: `userId`
```

**Cause:**
Trying to assign role/permission to non-existent user.

**Solution:**
```javascript
// Check if user exists first
const user = await prisma.user.findUnique({
  where: { id: userId },
});

if (!user) {
  throw new Error('User not found');
}

await perms.assignRole(roleId, userId);
```

### Issue: Unique Constraint Violation

**Error:**
```
Unique constraint failed on the fields: (`name`)
```

**Solution:**
```javascript
// Check if role exists before creating
const existing = await perms.manager.getRole('admin');

if (!existing) {
  await perms.createRole('admin', 'Administrator');
} else {
  console.log('Role already exists');
}
```

---

## Performance Issues

### Issue: Slow Permission Checks

**Symptoms:**
Permission checks taking > 100ms

**Solutions:**

1. **Enable Redis caching**
   ```javascript
   const perms = createPermissionSystem(prisma, {
     redis: redisClient,
     enableCache: true,
     cacheTTL: 300,
   });
   ```

2. **Add database indexes**
   ```prisma
   model Permission {
     @@index([category])
   }
   
   model UserRole {
     @@index([userId])
   }
   ```

3. **Batch permission checks**
   ```javascript
   // ❌ Bad: Sequential
   for (const perm of permissions) {
     await perms.can(userId, perm);
   }
   
   // ✅ Good: Parallel
   await Promise.all(
     permissions.map(p => perms.can(userId, p))
   );
   ```

4. **Reduce role inheritance depth**
   ```javascript
   // ❌ Bad: Deep nesting
   // superadmin → admin → moderator → editor → author → member
   
   // ✅ Good: Shallow hierarchy
   // admin → member
   // moderator → member
   ```

### Issue: High Memory Usage

**Cause:**
Too many cached entries or large role hierarchies.

**Solutions:**

1. **Reduce cache TTL**
   ```javascript
   const perms = createPermissionSystem(prisma, {
     cacheTTL: 60, // 1 minute instead of 5
   });
   ```

2. **Clear cache periodically**
   ```javascript
   // Clear cache every hour
   setInterval(async () => {
     await perms.clearCache();
   }, 60 * 60 * 1000);
   ```

---

## Debug Issues

### Issue: Can't See What's Happening

**Solution:**
Enable debug logging:

```javascript
const perms = createPermissionSystem(prisma, {
  debug: true,
});

// Or enable later
perms.logger.enable();
```

**Debug output:**
```
[v-perms:debug] checkPermission: user-123 posts.edit
[v-perms:debug] Cache miss
[v-perms:debug] User roles (with inheritance): ['editor', 'member']
[v-perms:debug] Checking role: editor (priority: 5)
[v-perms:debug] Role wildcard match: posts.* → posts.edit = true
[v-perms:debug] Permission granted
```

### Issue: Unexpected Permission Denials

**Debug Steps:**

1. **Check user's roles**
   ```javascript
   const roles = await perms.manager.getUserRoles(userId);
   console.log('User roles:', roles.map(r => r.name));
   ```

2. **Check role's permissions**
   ```javascript
   for (const role of roles) {
     const permissions = await perms.manager.getRolePermissions(role.id);
     console.log(`${role.name} permissions:`, permissions.map(p => p.key));
   }
   ```

3. **Check for ban permissions**
   ```javascript
   const userPerms = await perms.manager.getUserPermissions(userId);
   const banned = userPerms.direct.filter(p => !p.granted);
   console.log('Banned permissions:', banned.map(p => p.key));
   ```

4. **Check inheritance chain**
   ```javascript
   for (const role of roles) {
     const inherited = await perms.manager.getRoleInheritance(role.id);
     console.log(`${role.name} inherits from:`, inherited.map(i => i.inheritsFrom.name));
   }
   ```

---

## Migration Issues

### Issue: Existing Data Conflicts

**Problem:**
You have existing users/roles and want to add v-perms.

**Solution:**

1. **Backup your database**
   ```bash
   pg_dump mydb > backup.sql
   ```

2. **Run migration**
   ```bash
   npx prisma migrate dev --name add_permissions
   ```

3. **Migrate existing data**
   ```javascript
   async function migrateExistingUsers() {
     const users = await prisma.user.findMany();
     const memberRole = await perms.manager.getRole('member');
     
     for (const user of users) {
       try {
         await perms.assignRole(memberRole.id, user.id);
       } catch (error) {
         console.error(`Failed to assign role to ${user.id}:`, error);
       }
     }
   }
   ```

---

## Common Mistakes

### 1. Forgetting to Create Permissions

```javascript
// ❌ Wrong: Assigning permission that doesn't exist
await perms.assignPermission('posts.edit', roleId, 'role');
// Error: Permission not found

// ✅ Correct: Create permission first
await perms.createPermission('posts.edit', 'Edit posts');
await perms.assignPermission('posts.edit', roleId, 'role');
```

### 2. Using Wrong Target Type

```javascript
// ❌ Wrong: Using user ID with 'role' type
await perms.assignPermission('posts.edit', userId, 'role');

// ✅ Correct: Use 'user' type for users
await perms.assignPermission('posts.edit', userId, 'user');
```

### 3. Not Handling Async Properly

```javascript
// ❌ Wrong: Not awaiting
const canEdit = perms.can(userId, 'posts.edit'); // Returns Promise!
if (canEdit) { /* Won't work */ }

// ✅ Correct: Await the promise
const canEdit = await perms.can(userId, 'posts.edit');
if (canEdit) { /* Works! */ }
```

### 4. Checking Permissions Client-Side Only

```javascript
// ❌ Wrong: Only checking on frontend
// client.js
if (user.isAdmin) {
  // Show admin panel
}

// ✅ Correct: Always check server-side
// server.js
app.get('/api/admin/data', async (req, res) => {
  const canAccess = await perms.can(req.user.id, 'admin.access');
  if (!canAccess) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // Return data
});
```

---

## Getting Help

If you're still stuck:

1. **Check the logs**
   - Enable debug mode
   - Check database logs
   - Check Redis logs (if using)

2. **Verify your setup**
   - Run `npx prisma studio` to inspect database
   - Check that migrations ran successfully
   - Verify environment variables

3. **Create a minimal reproduction**
   ```javascript
   // Minimal test case
   const perms = createPermissionSystem(prisma, { debug: true });
   
   const role = await perms.createRole('test', 'Test role');
   await perms.createPermission('test.action', 'Test action');
   await perms.assignPermission('test.action', role.id, 'role');
   
   const user = await prisma.user.create({
     data: { email: 'test@example.com', password: 'hash' },
   });
   
   await perms.assignRole(role.id, user.id);
   
   const result = await perms.can(user.id, 'test.action');
   console.log('Result:', result); // Should be true
   ```

4. **Open an issue**
   - GitHub: https://github.com/faryzal2020/v-perms/issues
   - Include: error message, code snippet, debug logs
