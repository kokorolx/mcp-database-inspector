var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
    LogLevel[LogLevel["TRACE"] = 4] = "TRACE";
})(LogLevel || (LogLevel = {}));
export class Logger {
    static logLevel = LogLevel.INFO;
    static logs = [];
    static maxLogs = 1000;
    static setLogLevel(level) {
        const levelMap = {
            error: LogLevel.ERROR,
            warn: LogLevel.WARN,
            info: LogLevel.INFO,
            debug: LogLevel.DEBUG,
            trace: LogLevel.TRACE
        };
        this.logLevel = levelMap[level] ?? LogLevel.INFO;
    }
    static getLogLevel() {
        const levelNames = ['error', 'warn', 'info', 'debug', 'trace'];
        return levelNames[this.logLevel] || 'info';
    }
    static shouldLog(level) {
        return level <= this.logLevel;
    }
    static addLog(level, message, data) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            data
        };
        this.logs.push(entry);
        // Keep only the most recent logs
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
        // Output to stderr to avoid interfering with MCP protocol on stdout
        const logMessage = this.formatLog(entry);
        console.error(logMessage);
    }
    static formatLog(entry) {
        const timestamp = entry.timestamp.split('T')[1].split('.')[0]; // HH:MM:SS format
        let message = `[${timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`;
        if (entry.data !== undefined) {
            message += ` ${JSON.stringify(entry.data)}`;
        }
        return message;
    }
    static error(message, data) {
        if (this.shouldLog(LogLevel.ERROR)) {
            this.addLog('error', message, data);
        }
    }
    static warn(message, data) {
        if (this.shouldLog(LogLevel.WARN)) {
            this.addLog('warn', message, data);
        }
    }
    static info(message, data) {
        if (this.shouldLog(LogLevel.INFO)) {
            this.addLog('info', message, data);
        }
    }
    static debug(message, data) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            this.addLog('debug', message, data);
        }
    }
    static trace(message, data) {
        if (this.shouldLog(LogLevel.TRACE)) {
            this.addLog('trace', message, data);
        }
    }
    static getLogs(limit) {
        if (limit && limit > 0) {
            return this.logs.slice(-limit);
        }
        return [...this.logs];
    }
    static clearLogs() {
        this.logs = [];
    }
    // Performance timing utilities
    static time(label) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.time(`[TIMER] ${label}`);
        }
    }
    static timeEnd(label) {
        if (this.shouldLog(LogLevel.DEBUG)) {
            console.timeEnd(`[TIMER] ${label}`);
        }
    }
    // Safe logging that won't throw errors
    static safeLog(level, message, data) {
        try {
            switch (level) {
                case 'error':
                    this.error(message, data);
                    break;
                case 'warn':
                    this.warn(message, data);
                    break;
                case 'info':
                    this.info(message, data);
                    break;
                case 'debug':
                    this.debug(message, data);
                    break;
                case 'trace':
                    this.trace(message, data);
                    break;
            }
        }
        catch (error) {
            // Fallback to console.error if our logging fails
            console.error(`Logging failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            console.error(`Original message: ${message}`);
        }
    }
}
// Initialize from environment variable
const envLogLevel = process.env.LOG_LEVEL?.toLowerCase();
if (envLogLevel && ['error', 'warn', 'info', 'debug', 'trace'].includes(envLogLevel)) {
    Logger.setLogLevel(envLogLevel);
}
//# sourceMappingURL=logger.js.map