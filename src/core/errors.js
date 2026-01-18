/**
 * Base error class for permission-related errors
 */
class PermissionError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'PermissionError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Error thrown when a user is not found
 */
class UserNotFoundError extends PermissionError {
  constructor(userId) {
    super(`User not found: ${userId}`, 'USER_NOT_FOUND', { userId });
    this.name = 'UserNotFoundError';
  }
}

/**
 * Error thrown when a role is not found
 */
class RoleNotFoundError extends PermissionError {
  constructor(roleId) {
    super(`Role not found: ${roleId}`, 'ROLE_NOT_FOUND', { roleId });
    this.name = 'RoleNotFoundError';
  }
}

/**
 * Error thrown when a permission is not found
 */
class PermissionNotFoundError extends PermissionError {
  constructor(permissionKey) {
    super(`Permission not found: ${permissionKey}`, 'PERMISSION_NOT_FOUND', { permissionKey });
    this.name = 'PermissionNotFoundError';
  }
}

/**
 * Error thrown when a role is already assigned to a user
 */
class RoleAlreadyAssignedError extends PermissionError {
  constructor(userId, roleId) {
    super(`Role already assigned to user`, 'ROLE_ALREADY_ASSIGNED', { userId, roleId });
    this.name = 'RoleAlreadyAssignedError';
  }
}

/**
 * Error thrown when a permission already exists
 */
class PermissionAlreadyExistsError extends PermissionError {
  constructor(permissionKey) {
    super(`Permission already exists: ${permissionKey}`, 'PERMISSION_EXISTS', { permissionKey });
    this.name = 'PermissionAlreadyExistsError';
  }
}

/**
 * Error thrown when a role already exists
 */
class RoleAlreadyExistsError extends PermissionError {
  constructor(roleName) {
    super(`Role already exists: ${roleName}`, 'ROLE_EXISTS', { roleName });
    this.name = 'RoleAlreadyExistsError';
  }
}

/**
 * Error thrown when circular inheritance is detected
 */
class CircularInheritanceError extends PermissionError {
  constructor(roleId, inheritsFromId) {
    super(`Circular inheritance detected`, 'CIRCULAR_INHERITANCE', { roleId, inheritsFromId });
    this.name = 'CircularInheritanceError';
  }
}

export {
  PermissionError,
  UserNotFoundError,
  RoleNotFoundError,
  PermissionNotFoundError,
  RoleAlreadyAssignedError,
  PermissionAlreadyExistsError,
  RoleAlreadyExistsError,
  CircularInheritanceError,
};
