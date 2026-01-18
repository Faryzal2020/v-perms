# Getting Started with v-perms

This guide will walk you through setting up v-perms in your application from scratch.

## Prerequisites

- Node.js 18+ or Bun 1.0+
- PostgreSQL, MySQL, or SQLite database
- Prisma installed in your project

## Step-by-Step Setup

### 1. Install v-perms

```bash
npm install @faryzal2020/v-perms @prisma/client
# or
bun add @faryzal2020/v-perms @prisma/client
```

### 2. Add Schema to Prisma

Copy the permission models from `node_modules/@faryzal2020/v-perms/src/prisma/schema.prisma` into your `prisma/schema.prisma` file.

**Important:** Make sure to update the `User` references in the schema to match your actual User model name.

```prisma
// Add to your existing schema.prisma

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

// ... (copy all other models from the template)
```

### 3. Update Your User Model

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

### 4. Run Migration

```bash
npx prisma migrate dev --name add_permission_system
# or
bunx prisma migrate dev --name add_permission_system
```

### 5. Initialize v-perms in Your Code

Create a file to initialize the permission system (e.g., `lib/permissions.js`):

```javascript
import { PrismaClient } from '@prisma/client';
import { createPermissionSystem } from '@faryzal2020/v-perms';

const prisma = new PrismaClient();

export const perms = createPermissionSystem(prisma, {
  debug: process.env.NODE_ENV === 'development',
  enableCache: process.env.NODE_ENV === 'production',
  cacheTTL: 300, // 5 minutes
  // redis: redisClient, // Optional: add Redis for production
});

export default perms;
```

### 6. Create Initial Permissions and Roles

Create a seed file (`prisma/seed.js`):

```javascript
import { PrismaClient } from '@prisma/client';
import { createPermissionSystem } from '@faryzal2020/v-perms';

const prisma = new PrismaClient();
const perms = createPermissionSystem(prisma);

async function main() {
  console.log('🌱 Seeding permissions and roles...');

  // Create permissions
  const permissions = [
    { key: 'users.view', description: 'View users', category: 'users' },
    { key: 'users.create', description: 'Create users', category: 'users' },
    { key: 'users.edit', description: 'Edit users', category: 'users' },
    { key: 'users.delete', description: 'Delete users', category: 'users' },
  ];

  for (const perm of permissions) {
    try {
      await perms.createPermission(perm.key, perm.description, perm.category);
      console.log(`✓ Created permission: ${perm.key}`);
    } catch (error) {
      console.log(`- Permission exists: ${perm.key}`);
    }
  }

  // Create roles
  const memberRole = await perms.createRole('member', 'Basic member', 1, true);
  const adminRole = await perms.createRole('admin', 'Administrator', 10);

  // Assign permissions
  await perms.assignPermission('users.view', memberRole.id, 'role');
  await perms.assignPermission('*', adminRole.id, 'role'); // Admin gets all

  console.log('✅ Seeding complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Add to your `package.json`:

```json
{
  "prisma": {
    "seed": "node prisma/seed.js"
  }
}
```

Run the seed:

```bash
npx prisma db seed
```

### 7. Use in Your Application

#### Check Permissions

```javascript
import perms from './lib/permissions.js';

// In your route handler
app.get('/api/users', async (req, res) => {
  const userId = req.user.id;
  
  const canView = await perms.can(userId, 'users.view');
  
  if (!canView) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  // Continue with your logic
});
```

#### Create Middleware

```javascript
export function requirePermission(permission) {
  return async (req, res, next) => {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const hasPermission = await perms.can(userId, permission);
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    next();
  };
}

// Usage
app.delete('/api/users/:id', 
  authenticate,
  requirePermission('users.delete'),
  deleteUserHandler
);
```

#### Assign Roles to Users

```javascript
// When a user registers
async function registerUser(email, password) {
  const user = await prisma.user.create({
    data: { email, password },
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

## Next Steps

- Read the [API Reference](./API.md) for detailed method documentation
- Check out [Common Patterns](./PATTERNS.md) for real-world examples
- Learn about [Best Practices](./BEST_PRACTICES.md) for production use
- See [Troubleshooting](./TROUBLESHOOTING.md) if you encounter issues

## Quick Tips

✅ **DO:**
- Use descriptive permission keys (e.g., `users.delete`, `posts.edit`)
- Set up role inheritance for hierarchical permissions
- Use wildcards for admin roles (`*` or `category.*`)
- Invalidate cache after permission changes
- Use Redis caching in production

❌ **DON'T:**
- Hardcode permission checks everywhere (use middleware)
- Forget to handle permission errors
- Skip cache invalidation after updates
- Use overly generic permission names

## Need Help?

- 📖 [Full Documentation](./README.md)
- 💬 [GitHub Issues](https://github.com/faryzal2020/v-perms/issues)
- 📧 Contact: faryzal2020@example.com
