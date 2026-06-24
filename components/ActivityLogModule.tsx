
import React, { useState, useEffect, useMemo } from 'react';
import { Activity, Search, Filter, Trash2, Calendar, User, Clock, FileText } from 'lucide-react';
import { UserLog } from '../types';
import { loggerService } from '../services/loggerService';
import { useAuth } from '../contexts/AuthContext';

export const ActivityLogModule: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const [logs, setLogs] = useState<UserLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUser, setFilterUser] = useState('all');
  const [filterModule, setFilterModule] = useState('all');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = () => {
    const data = loggerService.getLogs();
    setLogs(data);
  };

  const handleClearLogs = () => {
    if (window.confirm('هل أنت متأكد من مسح جميع سجلات النشاط؟ لا يمكن التراجع عن هذا الإجراء.')) {
      loggerService.clearLogs();
      loadLogs();
    }
  };

  // Extract unique users and modules for filters
  const uniqueUsers = useMemo(() => Array.from(new Set(logs.map(l => l.userName))), [logs]);
  const uniqueModules = useMemo(() => Array.from(new Set(logs.map(l => l.module))), [logs]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.action.includes(searchTerm) || 
      log.details.includes(searchTerm) ||
      log.userName.includes(searchTerm);
    
    const matchesUser = filterUser === 'all' || log.userName === filterUser;
    const matchesModule = filterModule === 'all' || log.module === filterModule;

    return matchesSearch && matchesUser && matchesModule;
  });

  return (
    <div className="flex-1 bg-gray-100 p-8 overflow-auto h-full animate-fade-in">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-jilco-900 flex items-center gap-2">
              <Activity className="text-gold-500" /> سجل نشاط المستخدمين
            </h1>
            <p className="text-gray-500 text-sm mt-1">تتبع كافة العمليات والإجراءات التي تتم داخل النظام</p>
          </div>
          {isAdmin && (
            <button 
              onClick={handleClearLogs}
              className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg font-bold text-sm hover:bg-red-100 flex items-center gap-2"
            >
              <Trash2 size={16}/> مسح السجل
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="بحث في السجل..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border border-gray-400 rounded-lg text-sm bg-white text-black font-bold outline-none focus:ring-2 focus:ring-jilco-500"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400"/>
            <select 
              value={filterUser} 
              onChange={(e) => setFilterUser(e.target.value)}
              className="p-2 border border-gray-400 rounded-lg text-sm bg-white text-black font-bold outline-none"
            >
              <option value="all">جميع المستخدمين</option>
              {uniqueUsers.map(user => <option key={user} value={user}>{user}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <select 
              value={filterModule} 
              onChange={(e) => setFilterModule(e.target.value)}
              className="p-2 border border-gray-400 rounded-lg text-sm bg-white text-black font-bold outline-none"
            >
              <option value="all">جميع الأقسام</option>
              {uniqueModules.map(mod => <option key={mod} value={mod}>{mod}</option>)}
            </select>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
              <tr>
                <th className="p-4 w-48">المستخدم</th>
                <th className="p-4 w-40">القسم / الإجراء</th>
                <th className="p-4">التفاصيل</th>
                <th className="p-4 w-48 text-left pl-6">التوقيت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-jilco-100 text-jilco-700 flex items-center justify-center font-bold text-xs">
                        {log.userName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{log.userName}</p>
                        <p className="text-[10px] text-gray-400">{log.userRole}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="font-bold text-jilco-900">{log.action}</p>
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full mt-1 inline-block border border-gray-200">
                      {log.module}
                    </span>
                  </td>
                  <td className="p-4 text-gray-600 font-medium">
                    {log.details}
                  </td>
                  <td className="p-4 text-left pl-6">
                    <div className="flex flex-col items-end text-xs text-gray-500">
                      <span className="flex items-center gap-1 font-bold"><Calendar size={10}/> {new Date(log.timestamp).toLocaleDateString('en-GB')}</span>
                      <span className="flex items-center gap-1 font-mono"><Clock size={10}/> {new Date(log.timestamp).toLocaleTimeString('en-US', {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <FileText size={32} className="opacity-20"/>
                      <p>لا توجد سجلات مطابقة.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
};
