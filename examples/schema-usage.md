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

**Note:** You'll also need to update all foreign key references from `String` to `Int`.

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

## Full Example Schema

Here's a complete example with a User model:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  password  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  userRoles       UserRole[]
  userPermissions UserPermission[]

  @@map("users")
}

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

## Seeding Initial Data

Create a seed file to set up initial roles and permissions:

```javascript
// prisma/seed.js
import { PrismaClient } from '@prisma/client';
import { createPermissionSystem } from '@faryzal2020/v-perms';

const prisma = new PrismaClient();
const perms = createPermissionSystem(prisma);

async function main() {
  // Create permissions
  const permissions = [
    { key: 'page.home', description: 'Access home page', category: 'page' },
    { key: 'page.admin', description: 'Access admin dashboard', category: 'page' },
    { key: 'endpoint.users.list', description: 'List users', category: 'endpoint' },
    { key: 'endpoint.users.create', description: 'Create users', category: 'endpoint' },
    { key: 'endpoint.users.update', description: 'Update users', category: 'endpoint' },
    { key: 'endpoint.users.delete', description: 'Delete users', category: 'endpoint' },
  ];

  for (const perm of permissions) {
    try {
      await perms.createPermission(perm.key, perm.description, perm.category);
      console.log(`Created permission: ${perm.key}`);
    } catch (error) {
      console.log(`Permission exists: ${perm.key}`);
    }
  }

  // Create roles
  const roles = [
    { name: 'member', description: 'Basic member', priority: 1, isDefault: true },
    { name: 'moderator', description: 'Moderator', priority: 5, isDefault: false },
    { name: 'admin', description: 'Administrator', priority: 10, isDefault: false },
  ];

  for (const role of roles) {
    try {
      await perms.createRole(role.name, role.description, role.priority, role.isDefault);
      console.log(`Created role: ${role.name}`);
    } catch (error) {
      console.log(`Role exists: ${role.name}`);
    }
  }

  // Assign permissions to roles
  const memberRole = await perms.manager.getRole('member');
  const moderatorRole = await perms.manager.getRole('moderator');
  const adminRole = await perms.manager.getRole('admin');

  // Member permissions
  await perms.assignPermission('page.home', memberRole.id, 'role');

  // Moderator inherits member + has more
  await perms.manager.setRoleInheritance(moderatorRole.id, memberRole.id);
  await perms.assignPermission('endpoint.users.list', moderatorRole.id, 'role');

  // Admin inherits moderator + has all
  await perms.manager.setRoleInheritance(adminRole.id, moderatorRole.id);
  await perms.assignPermission('page.admin', adminRole.id, 'role');
  await perms.assignPermission('endpoint.*', adminRole.id, 'role');

  console.log('Seeding complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

Add to package.json:

```json
{
  "prisma": {
    "seed": "node prisma/seed.js"
  }
}
```

Run:

```bash
npx prisma db seed
```
