import fs from 'fs';
import path from 'path';

export class Logger {
  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    this.logFile = path.join(this.logDir, `${new Date().toISOString().split('T')[0]}.log`);
  }

  log(message, type = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${type}] ${message}\n`;
    fs.appendFileSync(this.logFile, logMessage);
  }

  logAction(userId, action, details = '') {
    const message = `User: ${userId} | Action: ${action}${details ? ` | Details: ${details}` : ''}`;
    this.log(message, 'ACTION');
  }

  logError(error, context = '') {
    const message = `Error: ${error}${context ? ` | Context: ${context}` : ''}`;
    this.log(message, 'ERROR');
  }
}
