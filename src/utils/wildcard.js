/**
 * Check if a permission key matches a wildcard pattern
 * @param {string} pattern - Pattern like "endpoint.*" or "*"
 * @param {string} permissionKey - Actual permission like "endpoint.admin.users"
 * @returns {boolean}
 */
function matchesWildcard(pattern, permissionKey) {
    // Universal wildcard matches everything
    if (pattern === '*') return true;

    // Exact match
    if (pattern === permissionKey) return true;

    // Wildcard suffix match (e.g., "endpoint.*")
    if (pattern.endsWith('.*')) {
        const prefix = pattern.slice(0, -2);
        // Matches the prefix itself or anything starting with prefix.
        return permissionKey === prefix || permissionKey.startsWith(prefix + '.');
    }

    return false;
}

/**
 * Generate all possible wildcard patterns for a permission key
 * @param {string} permissionKey - Like "endpoint.admin.users.delete"
 * @returns {string[]} - ["endpoint.admin.users.*", "endpoint.admin.*", "endpoint.*", "*"]
 */
function generateWildcardPatterns(permissionKey) {
    const parts = permissionKey.split('.');
    const patterns = ['*'];

    // Generate patterns from most specific to least specific
    for (let i = parts.length - 1; i > 0; i--) {
        patterns.push([...parts.slice(0, i), '*'].join('.'));
    }

    return patterns;
}

export {
    matchesWildcard,
    generateWildcardPatterns,
};
