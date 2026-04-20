/**
 * Logger Utility
 * Only logs in development environment to prevent memory bloat in production
 */

const isDev = process.env.NODE_ENV === 'development';

export const logger = {
    /**
     * Development-only logging
     * Only logs when NODE_ENV === 'development'
     */
    dev: (...args: any[]) => {
        if (isDev) {
            console.log(...args);
        }
    },

    /**
     * Always log errors (production + development)
     */
    error: (...args: any[]) => {
        console.error(...args);
    },

    /**
     * Always log warnings (production + development)
     */
    warn: (...args: any[]) => {
        console.warn(...args);
    },

    /**
     * Development-only info logging
     */
    info: (...args: any[]) => {
        if (isDev) {
            console.info(...args);
        }
    },

    /**
     * Development-only table logging (useful for arrays/objects)
     */
    table: (data: any) => {
        if (isDev) {
            console.table(data);
        }
    },

    /**
     * Development-only group logging
     */
    group: (label: string) => {
        if (isDev) {
            console.group(label);
        }
    },

    groupEnd: () => {
        if (isDev) {
            console.groupEnd();
        }
    }
};
