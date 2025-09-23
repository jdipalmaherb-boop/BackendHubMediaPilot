import { BoostLog } from '../types.js';

export class BoostLogger {
  private logs: BoostLog[] = [];

  log(action: string, status: 'success' | 'error', message: string, data?: any): void {
    const log: BoostLog = {
      timestamp: new Date().toISOString(),
      action,
      status,
      message,
      data,
    };
    this.logs.push(log);
    console.log(`[${log.timestamp}] ${action}: ${message}`, data || '');
  }

  getLogs(): BoostLog[] {
    return [...this.logs];
  }

  clear(): void {
    this.logs = [];
  }
}



