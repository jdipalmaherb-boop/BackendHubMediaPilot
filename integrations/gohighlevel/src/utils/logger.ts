interface LogLevel {
  ERROR: 'error';
  WARN: 'warn';
  INFO: 'info';
  DEBUG: 'debug';
}

const LOG_LEVELS: LogLevel = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug'
};

class Logger {
  private log(level: string, message: string, meta?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      service: 'gohighlevel-integration',
      ...meta
    };

    if (level === 'error') {
      console.error(JSON.stringify(logEntry));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(logEntry));
    } else {
      console.log(JSON.stringify(logEntry));
    }
  }

  error(message: string, meta?: any) {
    this.log(LOG_LEVELS.ERROR, message, meta);
  }

  warn(message: string, meta?: any) {
    this.log(LOG_LEVELS.WARN, message, meta);
  }

  info(message: string, meta?: any) {
    this.log(LOG_LEVELS.INFO, message, meta);
  }

  debug(message: string, meta?: any) {
    this.log(LOG_LEVELS.DEBUG, message, meta);
  }
}

export const logger = new Logger();



