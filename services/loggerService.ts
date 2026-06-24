
import { User, UserLog } from '../types';

const LOG_KEY = 'jilco_user_logs';

export const loggerService = {
  // Add a new log entry
  addLog: (user: User | null, action: string, details: string, module: string) => {
    if (!user) return; // Don't log if no user context (unless system)

    const newLog: UserLog = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action: action,
      details: details,
      module: module,
      timestamp: new Date().toISOString()
    };

    try {
      const storedLogs = localStorage.getItem(LOG_KEY);
      const logs: UserLog[] = storedLogs ? JSON.parse(storedLogs) : [];
      // Keep last 1000 logs to prevent overflow
      const updatedLogs = [newLog, ...logs].slice(0, 1000);
      localStorage.setItem(LOG_KEY, JSON.stringify(updatedLogs));
    } catch (error) {
      console.error("Failed to save activity log", error);
    }
  },

  // Get all logs
  getLogs: (): UserLog[] => {
    try {
      const storedLogs = localStorage.getItem(LOG_KEY);
      return storedLogs ? JSON.parse(storedLogs) : [];
    } catch (error) {
      console.error("Failed to retrieve activity logs", error);
      return [];
    }
  },

  // Clear logs (Admin only)
  clearLogs: () => {
    localStorage.removeItem(LOG_KEY);
  }
};
