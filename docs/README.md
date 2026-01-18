# v-perms Documentation

Welcome to the comprehensive documentation for **@faryzal2020/v-perms** - a minimal, flexible role-based permission system for JavaScript/Bun.js applications.

## Quick Navigation

### 🚀 Getting Started
- **[Getting Started Guide](./GETTING_STARTED.md)** - Complete setup walkthrough from installation to first permission check
- **[Schema Integration](../examples/schema-usage.md)** - How to integrate the Prisma schema into your project

### 📚 Core Documentation
- **[API Reference](./API.md)** - Complete reference for all methods, parameters, and return types
- **[Common Patterns](./PATTERNS.md)** - Real-world examples and integration patterns
- **[Best Practices](./BEST_PRACTICES.md)** - Production-ready guidelines and recommendations
- **[Troubleshooting](./TROUBLESHOOTING.md)** - Solutions to common issues and debugging tips

### 📖 Additional Resources
- **[Main README](../README.md)** - Project overview and quick start
- **[Changelog](../CHANGELOG.md)** - Version history and release notes

---

## Documentation Overview

### For New Users

If you're new to v-perms, start here:

1. **[Getting Started Guide](./GETTING_STARTED.md)** - Learn how to install and set up v-perms
2. **[Schema Integration](../examples/schema-usage.md)** - Add the permission tables to your database
3. **[Common Patterns](./PATTERNS.md)** - See real-world usage examples

### For Developers

If you're integrating v-perms into your application:

1. **[API Reference](./API.md)** - Detailed method documentation
2. **[Common Patterns](./PATTERNS.md)** - Express.js, Hono, and other framework examples
3. **[Best Practices](./BEST_PRACTICES.md)** - Security, performance, and code organization

### For Production

If you're deploying to production:

1. **[Best Practices](./BEST_PRACTICES.md)** - Security, performance, monitoring
2. **[Troubleshooting](./TROUBLESHOOTING.md)** - Debug common issues
3. **[API Reference](./API.md)** - Cache management and optimization

---

## Key Concepts

### Permissions
Permissions are the atomic units of access control. They represent specific actions users can perform.

**Example:** `users.delete`, `posts.edit`, `settings.view`

**Learn more:** [API Reference - Permissions](./API.md#permission-operations)

### Roles
Roles are collections of permissions that can be assigned to users. They support priorities and inheritance.

**Example:** `admin` (priority: 10), `moderator` (priority: 5), `member` (priority: 1)

**Learn more:** [API Reference - Roles](./API.md#role-operations)

### Wildcards
Wildcard permissions allow granting access to multiple permissions at once.

**Example:** `posts.*` matches `posts.create`, `posts.edit`, `posts.delete`

**Learn more:** [README - Wildcard Permissions](../README.md#wildcard-permissions)

### Role Inheritance
Roles can inherit permissions from other roles, creating hierarchical permission structures.

**Example:** `admin` inherits from `moderator`, which inherits from `member`

**Learn more:** [README - Role Inheritance](../README.md#role-inheritance)

### Ban/Deny Permissions
Explicitly deny specific permissions, even when wildcards would grant them.

**Example:** Admin has `posts.*` but is banned from `posts.delete`

**Learn more:** [README - Ban/Deny Permissions](../README.md#bandeny-permissions)

---

## Common Tasks

### Check if User Has Permission
```javascript
const canDelete = await perms.can(userId, 'users.delete');
```
**See:** [API Reference - can()](./API.md#can-userid-permissionkey)

### Create Permission
```javascript
await perms.createPermission('posts.publish', 'Publish posts', 'posts');
```
**See:** [API Reference - createPermission()](./API.md#createpermission-key-description-category)

### Assign Role to User
```javascript
await perms.assignRole('editor', userId);
```
**See:** [API Reference - assignRole()](./API.md#assignrole-roleidorname-userid)

### Set Up Role Inheritance
```javascript
await perms.manager.setRoleInheritance(adminRoleId, moderatorRoleId);
```
**See:** [API Reference - setRoleInheritance()](./API.md#managersetroleinheritance-roleid-inheritfromroleid-priority)

---

## Framework Integration

### Express.js
```javascript
function requirePermission(permission) {
  return async (req, res, next) => {
    const hasPermission = await perms.can(req.user.id, permission);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
```
**See:** [Common Patterns - Express.js](./PATTERNS.md#expressjs-integration)

### Hono
```javascript
function requirePermission(permission) {
  return async (c, next) => {
    const hasPermission = await perms.can(c.get('user').id, permission);
    if (!hasPermission) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  };
}
```
**See:** [Common Patterns - Hono](./PATTERNS.md#hono-integration)

---

## Performance Optimization

### Enable Redis Caching
```javascript
const perms = createPermissionSystem(prisma, {
  redis: redisClient,
  enableCache: true,
  cacheTTL: 300,
});
```
**See:** [Best Practices - Performance](./BEST_PRACTICES.md#performance-best-practices)

### Invalidate Cache After Changes
```javascript
await perms.assignPermission('posts.edit', roleId, 'role');
await perms.invalidateRoleCache(roleId);
```
**See:** [API Reference - Cache Operations](./API.md#cache-operations)

---

## Troubleshooting

### Permission Always Returns False
1. Check if permission exists
2. Verify user has roles assigned
3. Check role has the permission
4. Clear cache and retry

**See:** [Troubleshooting - Permission Check Issues](./TROUBLESHOOTING.md#permission-check-issues)

### Circular Inheritance Error
Remove the circular dependency in role inheritance chain.

**See:** [Troubleshooting - Role Issues](./TROUBLESHOOTING.md#role-issues)

---

## Support

- **Issues:** [GitHub Issues](https://github.com/faryzal2020/v-perms/issues)
- **Discussions:** [GitHub Discussions](https://github.com/faryzal2020/v-perms/discussions)
- **Email:** faryzal2020@example.com

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](../CONTRIBUTING.md) for details.

---

## License

MIT License - see [LICENSE](../LICENSE) file for details.
