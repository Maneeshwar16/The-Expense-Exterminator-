import React, { useState, useRef, useEffect } from 'react';
import { User, Moon, Sun, LogOut, Settings, ChevronDown, User as UserIcon, Shield, Download, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useExpenses } from '../../context/ExpenseContext';
import { useToast } from '../UI/ToastContainer';

interface HeaderProps {
  onNavigate?: (tab: string) => void;
}

const Header: React.FC<HeaderProps> = ({ onNavigate }) => {
  const { user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const { transactions, clearAllTransactions } = useExpenses();
  const { showToast } = useToast();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

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
    setShowProfileMenu(false);
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
    setShowProfileMenu(false);
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
    setShowProfileMenu(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">ET</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                Expense Tracker
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={toggleDarkMode}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all duration-200"
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {user && (
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                      <User size={16} className="text-white" />
                    </div>
                  )}
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {user.displayName}
                  </span>
                  <ChevronDown size={16} className="text-gray-400" />
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{user.displayName}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                    </div>
                    
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        onNavigate?.('profile');
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3"
                    >
                      <UserIcon size={16} />
                      <span>Profile</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        onNavigate?.('settings');
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3"
                    >
                      <Settings size={16} />
                      <span>Settings</span>
                    </button>
                    
                    <button
                      onClick={exportData}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3"
                    >
                      <Download size={16} />
                      <span>Export Data</span>
                    </button>
                    
                    <button
                      onClick={handleClearDemoData}
                      className="w-full text-left px-4 py-2 text-sm text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 flex items-center space-x-3"
                    >
                      <Trash2 size={16} />
                      <span>Clear Demo Data</span>
                    </button>
                    
                    <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                    
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-3"
                    >
                      <LogOut size={16} />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;