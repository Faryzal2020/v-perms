# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [1.0.2] - 2026-02-10

### Fixed
- Wildcard permission matching now supports colon (`:`) separators (e.g., `vehicles:*` matches `vehicles:read`). Previously only dot (`.`) separators were supported.

## [1.0.0] - 2026-01-18

### Added
- Initial release of v-perms
- Role-based access control (RBAC) system
- Role inheritance support
- User-specific permission overrides
- Wildcard permission matching (`*`, `category.*`)
- Ban/deny permissions (explicit denials)
- Optional Redis caching for performance
- Prisma adapter for PostgreSQL, MySQL, and SQLite
- Debug logging system
- Comprehensive error handling with custom error classes
- Full API documentation
- Getting started guide
- Common patterns and examples
- Best practices guide
- Troubleshooting guide
- Schema integration guide

### Features
- `createPermissionSystem()` - Factory function to initialize the system
- `can()` - Check if user has permission
- `canRole()` - Check if role has permission
- `createPermission()` - Create new permissions
- `createRole()` - Create new roles with priority and default settings
- `assignPermission()` - Assign permissions to roles or users
- `banPermission()` - Explicitly deny permissions
- `assignRole()` - Assign roles to users
- `setRoleInheritance()` - Set up role inheritance chains
- Cache invalidation methods for users and roles
- Permission and role listing methods
- Circular inheritance detection

### Documentation
- README.md - Main documentation with quick start
- docs/GETTING_STARTED.md - Step-by-step setup guide
- docs/API.md - Complete API reference
- docs/PATTERNS.md - Common usage patterns
- docs/BEST_PRACTICES.md - Production best practices
- docs/TROUBLESHOOTING.md - Common issues and solutions
- examples/schema-usage.md - Prisma schema integration guide

### Dependencies
- Peer dependency: `@prisma/client` (^5.0.0)
- Optional dependency: `redis` (^4.0.0)

## [Unreleased]

### Planned
- Resource-based permissions (e.g., `posts:123:edit`)
- Temporary permissions with expiration
- Attribute-based access control (ABAC)
- Permission templates
- Bulk operations for assignments
- GraphQL adapter
- TypeScript type definitions
- CLI tool for permission management
- Web UI for permission administration
- Performance benchmarks
- Migration tools from other permission systems

---

## Version History

- **1.0.2** (2026-02-10) - Wildcard permission fix
- **1.0.0** (2026-01-18) - Initial release

---

## How to Update

### From 0.x to 1.0.0
This is the initial release. No migration needed.

---

## Breaking Changes

None yet.

---

## Security

If you discover a security vulnerability, please email fary290796@gmail.com instead of using the issue tracker.
