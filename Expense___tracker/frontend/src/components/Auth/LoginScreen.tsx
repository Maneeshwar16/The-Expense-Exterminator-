import React, { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff, Sparkles, ArrowRight, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const LoginScreen: React.FC = () => {
  const { login, register, loading, error, clearError } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        if (formData.password !== formData.confirmPassword) {
          throw new Error('Passwords do not match');
        }
        await register(formData.email, formData.password, formData.displayName);
      }
    } catch (error) {
      // Error is handled by the context
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setFormData({ email: '', password: '', confirmPassword: '', displayName: '' });
    clearError();
  };

  const isValidForm = () => {
    if (isLogin) {
      return formData.email.trim() && formData.password.trim();
    } else {
      return (
        formData.email.trim() &&
        formData.password.trim() &&
        formData.confirmPassword.trim() &&
        formData.displayName.trim() &&
        formData.password === formData.confirmPassword &&
        formData.password.length >= 6 &&
        formData.displayName.trim().length >= 2
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-3xl p-8 border border-gray-200 dark:border-gray-700 shadow-2xl">
          {/* Logo and Title */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Expense Tracker
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              AI-powered expense management and insights
            </p>
          </div>

          {/* Features List */}
          <div className="mb-8 space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Upload CSV/Excel/PDF files from payment apps
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                AI-powered expense categorization
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Interactive dashboard and insights
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-2 h-2 bg-pink-500 rounded-full"></div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Smart chatbot for expense queries
              </span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Display Name (Registration only) */}
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Full Name"
                  value={formData.displayName}
                  onChange={(e) => handleInputChange('displayName', e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                  required
                />
              </div>
            )}

            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="email"
                placeholder="Email Address"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                required
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="w-full pl-10 pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {/* Confirm Password (Registration only) */}
            {!isLogin && (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm Password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors duration-200"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !isValidForm()}
              className="w-full flex items-center justify-center space-x-3 px-6 py-4 bg-gradient-to-r from-emerald-500 to-blue-600 text-white rounded-xl hover:from-emerald-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 shadow-lg"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  <span>{isLogin ? 'Signing in...' : 'Creating account...'}</span>
                </>
              ) : (
                <>
                  {isLogin ? <ArrowRight size={20} /> : <ArrowRight size={20} />}
                  <span className="font-medium">
                    {isLogin ? 'Sign In' : 'Create Account'}
                  </span>
                </>
              )}
            </button>
          </form>

          {/* Toggle Mode */}
          <div className="mt-6 text-center">
            <button
              onClick={toggleMode}
              className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium transition-colors duration-200"
            >
              {isLogin ? (
                <>
                  <ArrowLeft className="inline w-4 h-4 mr-1" />
                  Don't have an account? Sign up
                </>
              ) : (
                <>
                  <ArrowLeft className="inline w-4 h-4 mr-1" />
                  Already have an account? Sign in
                </>
              )}
            </button>
          </div>

          {/* Demo Notice */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200 text-center">
              <strong>Free Demo:</strong> Create an account or sign in to start tracking your expenses. 
              All data is stored locally in your browser.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;