/**
 * Debug logging utility with on/off toggle
 */
class Logger {
    constructor(enabled = false) {
        this.enabled = enabled;
    }

    /**
     * Enable debug logging
     */
    enable() {
        this.enabled = true;
    }

    /**
     * Disable debug logging
     */
    disable() {
        this.enabled = false;
    }

    /**
     * Log debug message
     * @param {...any} args - Arguments to log
     */
    debug(...args) {
        if (this.enabled) {
            console.log('[v-perms:debug]', ...args);
        }
    }

    /**
     * Log info message
     * @param {...any} args - Arguments to log
     */
    info(...args) {
        if (this.enabled) {
            console.info('[v-perms:info]', ...args);
        }
    }

    /**
     * Log warning message
     * @param {...any} args - Arguments to log
     */
    warn(...args) {
        if (this.enabled) {
            console.warn('[v-perms:warn]', ...args);
        }
    }

    /**
     * Log error message
     * @param {...any} args - Arguments to log
     */
    error(...args) {
        if (this.enabled) {
            console.error('[v-perms:error]', ...args);
        }
    }
}

export default Logger;
