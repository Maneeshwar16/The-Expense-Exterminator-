import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ExpenseProvider } from './context/ExpenseContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/UI/ToastContainer';
import LoginScreen from './components/Auth/LoginScreen';
import Header from './components/Layout/Header';
import Sidebar from './components/Layout/Sidebar';
import Dashboard from './components/Dashboard/Dashboard';
import AddExpense from './components/AddExpense/AddExpense';
import FileUpload from './components/FileUpload/FileUpload';
import PhonePeProcessor from './components/FileUpload/PhonePeProcessor';

import PaytmProcessor from './components/FileUpload/PaytmProcessor';
import GPayProcessor from './components/FileUpload/GPayProcessor';
import SearchAndFilter from './components/Search/SearchAndFilter';
import AIChat from './components/Chat/AIChat';
import UserProfile from './components/Auth/UserProfile';
import SettingsPage from './components/Settings/Settings';

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading your expense tracker...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'add-expense':
        return <AddExpense />;
      case 'upload':
        return <FileUpload />;
      case 'phonepe':
        return <PhonePeProcessor />;

      case 'paytm':
        return <PaytmProcessor />;
      case 'gpay':
        return <GPayProcessor />;
      case 'settings':
        return <SettingsPage />;
      case 'search':
        return <SearchAndFilter />;
      case 'chat':
        return <AIChat />;
      case 'analytics':
        return <Dashboard />; // For now, same as dashboard
      case 'profile':
        return <UserProfile />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/50 via-blue-50/50 to-purple-50/50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <Header onNavigate={setActiveTab} />
      <div className="flex">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        <main className="flex-1 p-8 ml-0 min-w-0 overflow-x-hidden">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ExpenseProvider>
          <ToastProvider>
            <MainApp />
          </ToastProvider>
        </ExpenseProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;