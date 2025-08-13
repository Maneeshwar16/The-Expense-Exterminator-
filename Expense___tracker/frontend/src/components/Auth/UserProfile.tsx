import React, { useState } from 'react';
import { User, Mail, Calendar, Settings, Key, Shield, Bell, Palette, Download, Trash2, Edit3, Save, X, BarChart3 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useExpenses } from '../../context/ExpenseContext';
import { useToast } from '../UI/ToastContainer';

interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  currency: 'INR' | 'USD' | 'EUR';
  notifications: boolean;
  weeklyReports: boolean;
  monthlyReports: boolean;
}

const UserProfile: React.FC = () => {
  const { user, logout } = useAuth();
  const { transactions, clearAllTransactions, monthRange } = useExpenses();
  const { showToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    displayName: user?.displayName || '',
    email: user?.email || ''
  });
  const [preferences, setPreferences] = useState<UserPreferences>({
    theme: 'auto',
    currency: 'INR',
    notifications: true,
    weeklyReports: true,
    monthlyReports: true
  });
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'data' | 'security'>('profile');

  const handleSaveProfile = () => {
    // In a real app, this would update the user profile
    setIsEditing(false);
    showToast({
      type: 'success',
      title: 'Profile Updated',
      message: 'Your profile has been updated successfully!'
    });
  };

  const handleCancelEdit = () => {
    setEditData({
      displayName: user?.displayName || '',
      email: user?.email || ''
    });
    setIsEditing(false);
  };

  const handlePreferenceChange = (key: keyof UserPreferences, value: any) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

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

  const handleClearData = () => {
    if (window.confirm('Are you sure you want to clear all your expense data? This action cannot be undone.')) {
      clearAllTransactions();
      showToast({
        type: 'warning',
        title: 'Data Cleared',
        message: 'All expense data has been cleared successfully'
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

  const getAccountStats = () => {
    const totalTransactions = transactions.length;
    const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);
    const avgTransaction = totalTransactions > 0 ? totalSpent / totalTransactions : 0;
    const categories = new Set(transactions.map(t => t.category)).size;

    return { totalTransactions, totalSpent, avgTransaction, categories };
  };

  const stats = getAccountStats();

  return (
    <div className="space-y-8 h-full">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            User Profile
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Month Range:</span>
            <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium">
              {monthRange === 'all' ? 'All Time' : monthRange === '1m' ? 'This Month' : `Last ${monthRange.replace('m', '')} Months`}
            </span>
          </div>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your account settings and preferences. The month range is controlled from the Dashboard.
        </p>
      </div>

      {/* Profile Header */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center space-x-6">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-full flex items-center justify-center">
            <User className="w-10 h-10 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              {user?.displayName}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">{user?.email}</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
            </p>
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors duration-200 flex items-center space-x-2"
          >
            <Edit3 size={16} />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      {/* Account Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Transactions</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.totalTransactions}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
              <Download className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Spent</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">₹{stats.totalSpent.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Avg Transaction</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">₹{stats.avgTransaction.toFixed(0)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Categories</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.categories}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-gray-700">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'profile', label: 'Profile', icon: User },
            { id: 'preferences', label: 'Preferences', icon: Settings },
            { id: 'data', label: 'Data', icon: Download },
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
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={editData.displayName}
                      onChange={(e) => setEditData(prev => ({ ...prev, displayName: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={editData.email}
                      onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={handleSaveProfile}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors duration-200 flex items-center space-x-2"
                    >
                      <Save size={16} />
                      <span>Save</span>
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200 flex items-center space-x-2"
                    >
                      <X size={16} />
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <User className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-900 dark:text-white">{user?.displayName}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-900 dark:text-white">{user?.email}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-900 dark:text-white">
                      Joined {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Theme
                </label>
                <select
                  value={preferences.theme}
                  onChange={(e) => handlePreferenceChange('theme', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="auto">Auto (System)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Currency
                </label>
                <select
                  value={preferences.currency}
                  onChange={(e) => handlePreferenceChange('currency', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  <option value="INR">Indian Rupee (₹)</option>
                  <option value="USD">US Dollar ($)</option>
                  <option value="EUR">Euro (€)</option>
                </select>
              </div>

              <div className="space-y-4">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={preferences.notifications}
                    onChange={(e) => handlePreferenceChange('notifications', e.target.checked)}
                    className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Enable notifications</span>
                </label>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={preferences.weeklyReports}
                    onChange={(e) => handlePreferenceChange('weeklyReports', e.target.checked)}
                    className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Weekly expense reports</span>
                </label>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={preferences.monthlyReports}
                    onChange={(e) => handlePreferenceChange('monthlyReports', e.target.checked)}
                    className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Monthly expense reports</span>
                </label>
              </div>
            </div>
          )}

          {/* Data Tab */}
          {activeTab === 'data' && (
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Data Export</h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mb-4">
                  Export your expense data as JSON file for backup or analysis purposes.
                </p>
                <button
                  onClick={exportData}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 flex items-center space-x-2"
                >
                  <Download size={16} />
                  <span>Export Data</span>
                </button>
              </div>

              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">Clear All Data</h4>
                <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                  This will permanently delete all your expense transactions. This action cannot be undone.
                </p>
                <button
                  onClick={handleClearData}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200 flex items-center space-x-2"
                >
                  <Trash2 size={16} />
                  <span>Clear All Data</span>
                </button>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Account Security</h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-4">
                  Your data is stored locally in your browser. For enhanced security, consider using a password manager.
                </p>
              </div>

              <div className="space-y-4">
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200 flex items-center justify-center space-x-2"
                >
                  <Key size={16} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile; 