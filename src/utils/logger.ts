enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: any;
}

export class Logger {
  private static logLevel: LogLevel = LogLevel.INFO;
  private static logs: LogEntry[] = [];
  private static maxLogs = 1000;

  static setLogLevel(level: 'error' | 'warn' | 'info' | 'debug' | 'trace'): void {
    const levelMap = {
      error: LogLevel.ERROR,
      warn: LogLevel.WARN,
      info: LogLevel.INFO,
      debug: LogLevel.DEBUG,
      trace: LogLevel.TRACE
    };
    this.logLevel = levelMap[level] ?? LogLevel.INFO;
  }

  static getLogLevel(): string {
    const levelNames = ['error', 'warn', 'info', 'debug', 'trace'];
    return levelNames[this.logLevel] || 'info';
  }

  private static shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private static addLog(level: string, message: string, data?: any): void {
    const entry: LogEntry = {
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

  private static formatLog(entry: LogEntry): string {
    const timestamp = entry.timestamp.split('T')[1].split('.')[0]; // HH:MM:SS format
    let message = `[${timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`;
    
    if (entry.data !== undefined) {
      message += ` ${JSON.stringify(entry.data)}`;
    }
    
    return message;
  }

  static error(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.addLog('error', message, data);
    }
  }

  static warn(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.addLog('warn', message, data);
    }
  }

  static info(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.addLog('info', message, data);
    }
  }

  static debug(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.addLog('debug', message, data);
    }
  }

  static trace(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.TRACE)) {
      this.addLog('trace', message, data);
    }
  }

  static getLogs(limit?: number): LogEntry[] {
    if (limit && limit > 0) {
      return this.logs.slice(-limit);
    }
    return [...this.logs];
  }

  static clearLogs(): void {
    this.logs = [];
  }

  // Performance timing utilities
  static time(label: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.time(`[TIMER] ${label}`);
    }
  }

  static timeEnd(label: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.timeEnd(`[TIMER] ${label}`);
    }
  }

  // Safe logging that won't throw errors
  static safeLog(level: 'error' | 'warn' | 'info' | 'debug' | 'trace', message: string, data?: any): void {
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
    } catch (error) {
      // Fallback to console.error if our logging fails
      console.error(`Logging failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.error(`Original message: ${message}`);
    }
  }
}

// Initialize from environment variable
const envLogLevel = process.env.LOG_LEVEL?.toLowerCase();
if (envLogLevel && ['error', 'warn', 'info', 'debug', 'trace'].includes(envLogLevel)) {
  Logger.setLogLevel(envLogLevel as any);
}
