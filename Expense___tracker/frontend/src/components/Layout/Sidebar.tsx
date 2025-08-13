import React from 'react';
import { Home, Plus, FileImage, BarChart3, MessageCircle, Search, Settings, User } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { user } = useAuth();
  
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'add-expense', label: 'Add Expense', icon: Plus },
    { id: 'phonepe', label: 'PhonePe PDF', icon: FileImage },
    { id: 'paytm', label: 'Paytm PDF', icon: FileImage },
    { id: 'gpay', label: 'Google Pay PDF', icon: FileImage },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'search', label: 'Search & Filter', icon: Search },
    { id: 'chat', label: 'AI Assistant', icon: MessageCircle },
  ];

  return (
    <aside className="flex-shrink-0 w-64 bg-white/70 dark:bg-gray-900/70 backdrop-blur-lg border-r border-gray-200 dark:border-gray-700 h-screen sticky top-16 overflow-y-auto z-40">
      <nav className="p-6">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.id}>
                <button
                  onClick={() => setActiveTab(item.id)}
                  className={clsx(
                    'w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-left font-medium transition-all duration-200',
                    activeTab === item.id
                      ? 'bg-gradient-to-r from-emerald-500 to-blue-600 text-white shadow-lg transform scale-105'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:scale-102'
                  )}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <button 
            onClick={() => setActiveTab('profile')}
            className={clsx(
              'w-full flex items-center space-x-3 px-4 py-3 text-left font-medium transition-all duration-200 rounded-xl',
              activeTab === 'profile'
                ? 'bg-gradient-to-r from-emerald-500 to-blue-600 text-white shadow-lg transform scale-105'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:scale-102'
            )}
          >
            <User size={20} />
            <span>Profile</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('settings')}
            className={clsx(
              'w-full flex items-center space-x-3 px-4 py-3 text-left font-medium transition-all duration-200 rounded-xl mt-2',
              activeTab === 'settings'
                ? 'bg-gradient-to-r from-emerald-500 to-blue-600 text-white shadow-lg transform scale-105'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:scale-102'
            )}
          >
            <Settings size={20} />
            <span>Settings</span>
          </button>
        </div>

        {/* User Profile Section */}
        {user && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3 px-4 py-3">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                  <User size={20} className="text-white" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {user.displayName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {user.email}
                </p>
              </div>
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
};

export default Sidebar;