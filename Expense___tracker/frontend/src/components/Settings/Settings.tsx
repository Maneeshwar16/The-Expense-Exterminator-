import React, { useState } from 'react';
import { Settings, Trash2, Download, Shield, Bell, Palette, Database, AlertTriangle, Tags } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useExpenses } from '../../context/ExpenseContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../UI/ToastContainer';
import BulkCategoryManager from './BulkCategoryManager';

const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { transactions, clearAllTransactions, monthRange } = useExpenses();
  const { darkMode, toggleDarkMode } = useTheme();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'general' | 'data' | 'security' | 'notifications'>('general');

  const exportData = () => {
    const dataStr = JSON.stringify(transactions, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expense-data-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    showToast({
      type: 'success',
      title: 'Data Exported',
      message: `Successfully exported ${transactions.length} transactions`
    });
  };

  const handleClearDemoData = () => {
    if (window.confirm('Are you sure you want to clear all demo data? This action cannot be undone.')) {
      clearAllTransactions();
      showToast({
        type: 'warning',
        title: 'Demo Data Cleared',
        message: 'All demo transactions have been cleared successfully'
      });
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      showToast({
        type: 'info',
        title: 'Logging Out',
        message: 'You have been logged out successfully'
      });
      await logout();
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Settings
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Month Range:</span>
            <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium">
              {monthRange === 'all' ? 'All Time' : monthRange === '1m' ? 'This Month' : `Last ${monthRange.replace('m', '')} Months`}
            </span>
          </div>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your application preferences and data. The month range is controlled from the Dashboard.
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-gray-700">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'general', label: 'General', icon: Settings },
            { id: 'data', label: 'Data Management', icon: Database },
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'security', label: 'Security', icon: Shield }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center space-x-2 px-6 py-4 text-sm font-medium transition-colors duration-200 ${
                activeTab === id
                  ? 'text-emerald-600 border-b-2 border-emerald-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Appearance</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Dark Mode</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Switch between light and dark themes</p>
                    </div>
                    <button
                      onClick={toggleDarkMode}
                      className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200"
                    >
                      <Palette size={16} />
                      <span>{darkMode ? 'Dark' : 'Light'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-medium">{user?.displayName?.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.displayName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Data Management */}
          {activeTab === 'data' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Data Export</h3>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <Download className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-1">Export Your Data</h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                        Download all your expense transactions as a JSON file for backup or analysis.
                      </p>
                      <button
                        onClick={exportData}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 flex items-center space-x-2"
                      >
                        <Download size={16} />
                        <span>Export Data ({transactions.length} transactions)</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Demo Data Management</h3>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">Clear Demo Data</h4>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                        Remove all demo transactions and start fresh. This action cannot be undone.
                      </p>
                      <button
                        onClick={handleClearDemoData}
                        className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors duration-200 flex items-center space-x-2"
                      >
                        <Trash2 size={16} />
                        <span>Clear Demo Data</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Bulk Category Management</h3>
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <Tags className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-emerald-800 dark:text-emerald-200 mb-1">Manage Categories in Bulk</h4>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300 mb-3">
                        Change categories for all transactions from the same merchant at once. Perfect for organizing multiple transactions from stores like medical shops, restaurants, etc.
                      </p>
                      <div className="mt-4">
                        <BulkCategoryManager />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notifications */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Notification Preferences</h3>
                <div className="space-y-4">
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Weekly expense summaries</span>
                  </label>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Monthly budget alerts</span>
                  </label>
                  <label className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">AI insights and tips</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Security */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account Security</h3>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <Shield className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-green-800 dark:text-green-200 mb-1">Local Data Storage</h4>
                      <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                        Your data is stored locally in your browser for maximum privacy and security.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Account Actions</h3>
                <div className="space-y-3">
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200 flex items-center justify-center space-x-2"
                  >
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
