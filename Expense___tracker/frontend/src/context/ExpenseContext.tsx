import React, { createContext, useContext, useState, useEffect } from 'react';
import { Transaction, AIInsight, Category } from '../types';
import { generateSampleData, generateAIInsights } from '../utils/sampleData';
import { ProcessedTransaction } from '../utils/fileProcessor';
import { useAuth } from './AuthContext';
import { ApiService } from '../services/apiService';

const DEFAULT_CATEGORIES: Category[] = [
  'Food', 'Travel', 'Shopping', 'Bills', 'Entertainment',
  'Health', 'Education', 'Investment', 'Miscellaneous'
];

interface ExpenseContextType {
  transactions: Transaction[];
  addTransaction: (transaction: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => void;
  deleteTransaction: (id: string) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  clearAllTransactions: () => void;
  addMerchantAlias: (pattern: string, merchant: string, category: Category) => void;
  updateMerchantCategoryForAll: (merchant: string, newCategory: Category) => number;
  insights: AIInsight[];
  loading: boolean;
  uploadFiles: (processedTransactions: ProcessedTransaction[]) => Promise<void>;
  // Global month range state
  monthRange: '1m' | '2m' | '3m' | '4m' | '5m' | '6m' | 'all';
  setMonthRange: (range: '1m' | '2m' | '3m' | '4m' | '5m' | '6m' | 'all') => void;
  getFilteredTransactions: () => Transaction[];
  customCategories: string[];
  addCustomCategory: (cat: string) => void;
  allCategories: string[];
}

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

export const ExpenseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthRange, setMonthRange] = useState<'1m' | '2m' | '3m' | '4m' | '5m' | '6m' | 'all'>('1m');
  const [isUsingAPI, setIsUsingAPI] = useState(false);
  const { user } = useAuth();
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  const getKey = (base: string) => `${base}_${user?.id || 'guest'}`;

  type MerchantAliasRule = { pattern: string; merchant: string; category: Category };
  const [aliasRules, setAliasRules] = useState<MerchantAliasRule[]>([]);

  // Function to get filtered transactions based on current month range
  const getFilteredTransactions = (): Transaction[] => {
    if (monthRange === 'all') return transactions;
    const months = parseInt(monthRange.replace('m', ''), 10);
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - (months - 1));
    cutoff.setDate(1);
    return transactions.filter(t => new Date(t.date) >= cutoff);
  };

  // Function to remove duplicate transactions
  const removeDuplicates = (transactions: Transaction[]): Transaction[] => {
    const seen = new Set();
    return transactions.filter(transaction => {
      // Create a unique key for each transaction
      const key = `${transaction.merchant}-${transaction.amount}-${transaction.date}-${transaction.paymentMode}`;
      if (seen.has(key)) {
        console.log(`Removing duplicate transaction: ${transaction.merchant} on ${transaction.date}`);
        return false;
      }
      seen.add(key);
      return true;
    });
  };

  useEffect(() => {
    const loadTransactions = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Try to load from API first
        const apiTransactions = await ApiService.getTransactions();
        if (apiTransactions && apiTransactions.length > 0) {
          const deduplicatedTransactions = removeDuplicates(apiTransactions);
          console.log(`Loaded ${apiTransactions.length} transactions from API, ${deduplicatedTransactions.length} after deduplication`);
          setTransactions(deduplicatedTransactions);
          setIsUsingAPI(true);
          // Clear local storage when using API to prevent duplicates
          localStorage.removeItem(getKey('expense_tracker_transactions'));
        } else {
          // Fallback to local storage only if API returns empty
          const stored = localStorage.getItem(getKey('expense_tracker_transactions'));
          const demoCleared = localStorage.getItem(getKey('expense_tracker_demo_cleared')) === 'true';
          
          if (stored) {
            const parsed: Transaction[] = JSON.parse(stored);
            const deduplicatedTransactions = removeDuplicates(parsed);
            console.log(`Loaded ${parsed.length} transactions from local storage, ${deduplicatedTransactions.length} after deduplication`);
            setTransactions(deduplicatedTransactions);
            setIsUsingAPI(false);
          } else if (!demoCleared) {
            const sampleTransactions = generateSampleData(user?.id || 'demo-user');
            console.log(`Generated ${sampleTransactions.length} sample transactions`);
            setTransactions(sampleTransactions);
            setIsUsingAPI(false);
            localStorage.setItem(getKey('expense_tracker_transactions'), JSON.stringify(sampleTransactions));
          } else {
            console.log('No transactions found, starting with empty list');
            setTransactions([]);
            setIsUsingAPI(false);
          }
        }

        // Load other settings from local storage
        const storedRules = localStorage.getItem(getKey('expense_tracker_alias_rules'));
        const storedMonthRange = localStorage.getItem(getKey('expense_tracker_month_range'));
        const storedCustomCategories = localStorage.getItem(getKey('expense_tracker_custom_categories'));
        
        if (storedRules) setAliasRules(JSON.parse(storedRules));
        if (storedMonthRange) setMonthRange(storedMonthRange as any);
        if (storedCustomCategories) setCustomCategories(JSON.parse(storedCustomCategories));
      } catch (error) {
        console.error('Failed to load transactions from API, falling back to local storage:', error);
        // Fallback to local storage
        const stored = localStorage.getItem(getKey('expense_tracker_transactions'));
        if (stored) {
          const parsed: Transaction[] = JSON.parse(stored);
          const deduplicatedTransactions = removeDuplicates(parsed);
          console.log(`Fallback: Loaded ${parsed.length} transactions from local storage, ${deduplicatedTransactions.length} after deduplication`);
          setTransactions(deduplicatedTransactions);
          setIsUsingAPI(false);
        } else {
          console.log('Fallback: No local storage data, starting with empty list');
          setTransactions([]);
          setIsUsingAPI(false);
        }
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, [user?.id]);

  // Keep insights in sync with transactions
  useEffect(() => {
    setInsights(generateAIInsights(transactions));
  }, [transactions]);

  // Persist transactions to localStorage only when not using API
  useEffect(() => {
    // Only persist to localStorage if we're not using the API
    // This prevents conflicts between API and local storage
    if (!isUsingAPI) {
      try {
        localStorage.setItem(getKey('expense_tracker_transactions'), JSON.stringify(transactions));
        console.log(`Persisted ${transactions.length} transactions to local storage`);
      } catch (error) {
        console.error('Failed to persist transactions:', error);
      }
    }
  }, [transactions, user?.id, isUsingAPI]);

  // Persist month range whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(getKey('expense_tracker_month_range'), monthRange);
    } catch (error) {
      console.error('Failed to persist month range:', error);
    }
  }, [monthRange, user?.id]);

  // Persist alias rules
  useEffect(() => {
    try {
      localStorage.setItem(getKey('expense_tracker_alias_rules'), JSON.stringify(aliasRules));
    } catch (error) {
      console.error('Failed to persist alias rules:', error);
    }
  }, [aliasRules, user?.id]);

  // Persist custom categories
  useEffect(() => {
    try {
      localStorage.setItem(getKey('expense_tracker_custom_categories'), JSON.stringify(customCategories));
    } catch {}
  }, [customCategories, user?.id]);

  const applyAliases = (tx: Transaction): Transaction => {
    const found = aliasRules.find(rule => tx.merchant.toLowerCase().includes(rule.pattern.toLowerCase()));
    if (!found) return tx;
    return {
      ...tx,
      merchant: found.merchant,
      category: found.category
    };
  };

  const addTransaction = async (transactionData: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newTransaction = await ApiService.addTransaction(transactionData);
      const transactionWithAliases = applyAliases(newTransaction);
      setTransactions(prev => [transactionWithAliases, ...prev]);
    } catch (error) {
      console.error('Failed to add transaction via API, falling back to local storage:', error);
      // Fallback to local storage
      const baseTransaction: Transaction = {
        ...transactionData,
        id: `transaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: user?.id || 'demo-user',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newTransaction = applyAliases(baseTransaction);
      setTransactions(prev => [newTransaction, ...prev]);
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      await ApiService.deleteTransaction(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Failed to delete transaction via API, falling back to local storage:', error);
      setTransactions(prev => prev.filter(t => t.id !== id));
    }
  };

  const updateTransaction = async (id: string, updates: Partial<Transaction>) => {
    try {
      const updatedTransaction = await ApiService.updateTransaction(id, updates);
      const transactionWithAliases = applyAliases(updatedTransaction);
      setTransactions(prev => prev.map(t => t.id === id ? transactionWithAliases : t));
    } catch (error) {
      console.error('Failed to update transaction via API, falling back to local storage:', error);
      setTransactions(prev => prev.map(t => {
        if (t.id !== id) return t;
        const updated = { ...t, ...updates, updatedAt: new Date() } as Transaction;
        return applyAliases(updated);
      }));
    }
  };

  const uploadFiles = async (processedTransactions: ProcessedTransaction[]) => {
    try {
      // Convert ProcessedTransaction to Transaction format
      const newTransactions: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[] = processedTransactions.map(pt => ({
        date: pt.date,
        amount: pt.amount,
        category: (pt.category as Category) || 'Miscellaneous',
        merchant: pt.merchant || 'Unknown',
        paymentMode: (pt.paymentMode as 'Cash' | 'UPI') || 'UPI',
        notes: pt.description,
        source: 'csv' as const,
      }));

      // Try to upload via API first
      try {
        const uploadedTransactions = await ApiService.bulkAddTransactions(newTransactions);
        const transactionsWithAliases = uploadedTransactions.map(applyAliases);
        setTransactions(prev => [...transactionsWithAliases, ...prev]);
        console.log(`Successfully uploaded ${uploadedTransactions.length} transactions via API`);
      } catch (apiError) {
        console.error('Failed to upload via API, falling back to local storage:', apiError);
        // Fallback to local storage
        const localTransactions: Transaction[] = newTransactions.map(tx => ({
          ...tx,
          id: `uploaded_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId: user?.id || 'demo-user',
          createdAt: new Date(),
          updatedAt: new Date(),
        })).map(applyAliases);

        setTransactions(prev => [...localTransactions, ...prev]);
        console.log(`Successfully uploaded ${localTransactions.length} transactions to local storage`);
      }
    } catch (error) {
      console.error('Error uploading transactions:', error);
      throw error;
    }
  };

  const clearAllTransactions = () => {
    setTransactions([]);
    setInsights([]);
    setIsUsingAPI(false);
    try {
      localStorage.setItem(getKey('expense_tracker_transactions'), JSON.stringify([]));
      localStorage.setItem(getKey('expense_tracker_demo_cleared'), 'true');
      console.log('Cleared all transactions and reset to local storage mode');
    } catch (error) {
      console.error('Failed to update demo cleared flag:', error);
    }
  };

  const addMerchantAlias = (pattern: string, merchant: string, category: Category) => {
    const newRule = { pattern, merchant, category };
    setAliasRules(prev => [newRule, ...prev]);
    // Re-apply to existing transactions for immediate effect
    setTransactions(prev => prev.map(applyAliases));
  };

  const updateMerchantCategoryForAll = (merchant: string, newCategory: Category) => {
    let updatedCount = 0;
    setTransactions(prev => prev.map(tx => {
      if (tx.merchant.toLowerCase() === merchant.toLowerCase()) {
        updatedCount++;
        return { ...tx, category: newCategory, updatedAt: new Date() };
      }
      return tx;
    }));
    
    // Re-generate insights after bulk update
    setTimeout(() => {
      setInsights(generateAIInsights(transactions));
    }, 100);
    
    return updatedCount;
  };

  // Add a new custom category
  const addCustomCategory = (cat: string) => {
    if (!cat || customCategories.includes(cat) || DEFAULT_CATEGORIES.includes(cat as Category)) return;
    setCustomCategories(prev => [...prev, cat]);
  };

  // All categories for dropdowns
  const allCategories: string[] = [...DEFAULT_CATEGORIES, ...customCategories];

  return (
    <ExpenseContext.Provider value={{
      transactions,
      addTransaction,
      deleteTransaction,
      updateTransaction,
      clearAllTransactions,
      insights,
      loading,
      uploadFiles,
      addMerchantAlias,
      updateMerchantCategoryForAll,
      monthRange,
      setMonthRange,
      getFilteredTransactions,
      customCategories,
      addCustomCategory,
      allCategories,
    }}>
      {children}
    </ExpenseContext.Provider>
  );
};

export const useExpenses = () => {
  const context = useContext(ExpenseContext);
  if (context === undefined) {
    throw new Error('useExpenses must be used within an ExpenseProvider');
  }
  return context;
};