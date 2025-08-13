import React, { useState, useMemo } from 'react';
import { useExpenses } from '../../context/ExpenseContext';
import { Category } from '../../types';

interface MerchantCategoryCount {
  merchant: string;
  category: Category;
  count: number;
  totalAmount: number;
}

const BulkCategoryManager: React.FC = () => {
  const { transactions, updateMerchantCategoryForAll } = useExpenses();
  const [selectedMerchant, setSelectedMerchant] = useState<string>('');
  const [newCategory, setNewCategory] = useState<Category>('Miscellaneous');
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Group transactions by merchant and category
  const merchantStats = useMemo(() => {
    const merchantMap = new Map<string, MerchantCategoryCount>();
    
    transactions.forEach(tx => {
      const key = tx.merchant.toLowerCase();
      if (!merchantMap.has(key)) {
        merchantMap.set(key, {
          merchant: tx.merchant,
          category: tx.category,
          count: 0,
          totalAmount: 0
        });
      }
      
      const existing = merchantMap.get(key)!;
      existing.count += 1;
      existing.totalAmount += tx.amount;
      
      // If categories differ, mark as mixed
      if (existing.category !== tx.category) {
        existing.category = 'Miscellaneous';
      }
    });
    
    return Array.from(merchantMap.values())
      .sort((a, b) => b.count - a.count); // Sort by transaction count
  }, [transactions]);

  const handleBulkUpdate = () => {
    if (!selectedMerchant || !newCategory) return;
    
    setShowConfirmation(true);
  };

  const confirmBulkUpdate = () => {
    const updatedCount = updateMerchantCategoryForAll(selectedMerchant, newCategory);
    setSelectedMerchant('');
    setNewCategory('Miscellaneous');
    setShowConfirmation(false);
    
    // Show success message
    if (updatedCount > 0) {
      // You can add a toast notification here if you have a toast system
      alert(`Successfully updated ${updatedCount} transaction${updatedCount !== 1 ? 's' : ''} from ${selectedMerchant} to category ${newCategory}`);
    }
  };

  const getCategoryColor = (category: Category) => {
    const colors: Record<Category, string> = {
      Food: 'bg-orange-100 text-orange-800',
      Travel: 'bg-blue-100 text-blue-800',
      Shopping: 'bg-purple-100 text-purple-800',
      Bills: 'bg-red-100 text-red-800',
      Entertainment: 'bg-pink-100 text-pink-800',
      Health: 'bg-green-100 text-green-800',
      Education: 'bg-indigo-100 text-indigo-800',
      Investment: 'bg-yellow-100 text-yellow-800',
      Miscellaneous: 'bg-gray-100 text-gray-800'
    };
    return colors[category];
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">
        Bulk Category Manager
      </h2>
      
      <div className="mb-6">
        <p className="text-gray-600 mb-4">
          Change categories for all transactions from a specific merchant. This is useful when you have multiple transactions 
          from the same store that should all be categorized the same way.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Merchant
            </label>
            <select
              value={selectedMerchant}
              onChange={(e) => setSelectedMerchant(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a merchant...</option>
              {merchantStats.map((stat) => (
                <option key={stat.merchant} value={stat.merchant}>
                  {stat.merchant} ({stat.count} transactions)
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              New Category
            </label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as Category)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Food">Food</option>
              <option value="Travel">Travel</option>
              <option value="Shopping">Shopping</option>
              <option value="Bills">Bills</option>
              <option value="Entertainment">Entertainment</option>
              <option value="Health">Health</option>
              <option value="Education">Education</option>
              <option value="Investment">Investment</option>
              <option value="Miscellaneous">Miscellaneous</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={handleBulkUpdate}
              disabled={!selectedMerchant || !newCategory}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Update All
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Confirm Bulk Update
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to change all transactions from <strong>{selectedMerchant}</strong> 
              to category <strong>{newCategory}</strong>? This will affect {merchantStats.find(s => s.merchant === selectedMerchant)?.count} transactions.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmBulkUpdate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merchant Statistics */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Merchant Overview
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {merchantStats.map((stat) => (
            <div
              key={stat.merchant}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => {
                setSelectedMerchant(stat.merchant);
                setNewCategory(stat.category);
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-800 truncate" title={stat.merchant}>
                  {stat.merchant}
                </h4>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(stat.category)}`}>
                  {stat.category}
                </span>
              </div>
              <div className="text-sm text-gray-600">
                <p>{stat.count} transaction{stat.count !== 1 ? 's' : ''}</p>
                <p>Total: ₹{stat.totalAmount.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BulkCategoryManager;
