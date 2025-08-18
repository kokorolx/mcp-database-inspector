interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    data?: any;
}
export declare class Logger {
    private static logLevel;
    private static logs;
    private static maxLogs;
    static setLogLevel(level: 'error' | 'warn' | 'info' | 'debug' | 'trace'): void;
    static getLogLevel(): string;
    private static shouldLog;
    private static addLog;
    private static formatLog;
    static error(message: string, data?: any): void;
    static warn(message: string, data?: any): void;
    static info(message: string, data?: any): void;
    static debug(message: string, data?: any): void;
    static trace(message: string, data?: any): void;
    static getLogs(limit?: number): LogEntry[];
    static clearLogs(): void;
    static time(label: string): void;
    static timeEnd(label: string): void;
    static safeLog(level: 'error' | 'warn' | 'info' | 'debug' | 'trace', message: string, data?: any): void;
}
export {};
//# sourceMappingURL=logger.d.ts.map