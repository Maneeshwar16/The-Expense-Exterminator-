import React, { useMemo, useState } from 'react';
import { Search, Filter, Calendar, IndianRupee, MapPin, CreditCard, Tags } from 'lucide-react';
import { useExpenses } from '../../context/ExpenseContext';
import { Transaction, Category } from '../../types';
import { format } from 'date-fns';

const SearchAndFilter: React.FC = () => {
  const { transactions, updateTransaction, updateMerchantCategoryForAll, monthRange, allCategories, addCustomCategory } = useExpenses();
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ merchant: string; category: Category }>({ merchant: '', category: 'Miscellaneous' });
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState<string>('');
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [editCategoryValue, setEditCategoryValue] = useState<string>('');
  const [bulkCategoryValue, setBulkCategoryValue] = useState<string>('');
  const [filters, setFilters] = useState({
    category: '',
    paymentMode: '',
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
  });
  const [showAddCategory, setShowAddCategory] = useState(false);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      const matchesSearch = searchTerm === '' ||
        transaction.merchant.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.category.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = filters.category === '' || transaction.category === filters.category;
      const matchesPaymentMode = filters.paymentMode === '' || transaction.paymentMode === filters.paymentMode;

      const transactionDate = new Date(transaction.date);
      const matchesDateFrom = filters.dateFrom === '' || transactionDate >= new Date(filters.dateFrom);
      const matchesDateTo = filters.dateTo === '' || transactionDate <= new Date(filters.dateTo);

      const matchesAmountMin = filters.amountMin === '' || transaction.amount >= parseFloat(filters.amountMin);
      const matchesAmountMax = filters.amountMax === '' || transaction.amount <= parseFloat(filters.amountMax);

      return matchesSearch && matchesCategory && matchesPaymentMode &&
             matchesDateFrom && matchesDateTo && matchesAmountMin && matchesAmountMax;
    });
  }, [transactions, searchTerm, filters, transactions.length]); // Added transactions.length as dependency

  const startEditing = (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    setEditingId(id);
    setEditValues({ merchant: tx.merchant, category: tx.category });
    setEditCategoryValue(tx.category);
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateTransaction(editingId, { merchant: editValues.merchant, category: editCategoryValue as Category });
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFilters({
      category: '',
      paymentMode: '',
      dateFrom: '',
      dateTo: '',
      amountMin: '',
      amountMax: '',
    });
  };

  const handleBulkCategoryUpdate = () => {
    if (!selectedMerchant || !bulkCategoryValue) return;
    
    const updatedCount = updateMerchantCategoryForAll(selectedMerchant, bulkCategoryValue as Category);
    setShowBulkModal(false);
    setSelectedMerchant('');
    setBulkCategoryValue('Miscellaneous');
    
    // Show success message
    if (updatedCount && updatedCount > 0) {
      alert(`Successfully updated ${updatedCount} transaction${updatedCount !== 1 ? 's' : ''} from ${selectedMerchant} to category ${bulkCategoryValue}`);
    }
  };

  const openBulkModal = (merchant: string, currentCategory: Category) => {
    setSelectedMerchant(merchant);
    setBulkCategoryValue(currentCategory);
    setShowBulkModal(true);
  };

  const getTotalAmount = (txs: Transaction[]) => txs.reduce((sum, t) => sum + t.amount, 0);

  const getCategoryColor = (category: Category) => {
    const colors = {
      Food: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
      Travel: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
      Shopping: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
      Bills: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      Entertainment: 'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400',
      Health: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      Education: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400',
      Investment: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400',
      Miscellaneous: 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400',
    } as const;
    return colors[category] || colors.Miscellaneous;
  };

  return (
    <div className="space-y-8 min-h-[calc(100vh-8rem)] max-w-[1200px] mx-auto px-4 sm:px-6 min-w-0">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Search & Filter</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Month Range:</span>
            <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium">
              {monthRange === 'all' ? 'All Time' : monthRange === '1m' ? 'This Month' : `Last ${monthRange.replace('m', '')} Months`}
            </span>
          </div>
        </div>
        <p className="text-gray-600 dark:text-gray-400">Find specific transactions and analyze your spending patterns. The month range is controlled from the Dashboard.</p>
      </div>

      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by merchant, notes, or category..."
            className="block w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-4 sm:mb-6 min-w-0">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</label>
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
            className="w-full min-w-0 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="">All Categories</option>
              {allCategories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
              <option value="__add_new__">+ Add New Category</option>
            </select>
            {showAddCategory && filters.category === '__add_new__' && (
              <div className="mt-2">
                <input
                  type="text"
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addCustomCategory(newCategoryInput);
                      setNewCategoryInput('');
                      setShowAddCategory(false);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Enter new category name"
                />
                <button
                  onClick={() => {
                    addCustomCategory(newCategoryInput);
                    setNewCategoryInput('');
                    setShowAddCategory(false);
                  }}
                  className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  Add Category
                </button>
                <button
                  onClick={() => setShowAddCategory(false)}
                  className="mt-2 ml-2 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Payment Mode</label>
            <select
              value={filters.paymentMode}
              onChange={(e) => handleFilterChange('paymentMode', e.target.value)}
            className="w-full min-w-0 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            >
              <option value="">All Payment Modes</option>
              <option value="UPI">UPI</option>
              <option value="Cash">Cash</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            className="w-full min-w-0 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            className="w-full min-w-0 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Min Amount (₹)</label>
            <input
              type="number"
              value={filters.amountMin}
              onChange={(e) => handleFilterChange('amountMin', e.target.value)}
              placeholder="0"
              min="0"
            className="w-full min-w-0 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Max Amount (₹)</label>
            <input
              type="number"
              value={filters.amountMax}
              onChange={(e) => handleFilterChange('amountMax', e.target.value)}
              placeholder="10000"
              min="0"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Showing {filteredTransactions.length} of {transactions.length} transactions
            {filteredTransactions.length > 0 && (
              <span className="ml-2 font-medium">(Total: ₹{getTotalAmount(filteredTransactions).toLocaleString('en-IN')})</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowBulkModal(true)}
              className="flex items-center space-x-2 px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors duration-200"
              title="Bulk update categories for merchants with multiple transactions"
            >
              <Tags size={16} />
              <span>Bulk Categories</span>
            </button>
            <button
              onClick={clearFilters}
              className="flex items-center space-x-2 px-4 py-2 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors duration-200"
            >
              <Filter size={16} />
              <span>Clear Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Merchant Summary - Only show merchants that need categorization */}
      {filteredTransactions.length > 0 && (() => {
        const merchantsNeedingCategorization = Array.from(new Set(filteredTransactions.map(t => t.merchant)))
          .filter(merchant => {
            const merchantTransactions = filteredTransactions.filter(t => t.merchant === merchant);
            // Only show merchants with multiple transactions AND mixed categories
            if (merchantTransactions.length <= 1) return false;
            
            const categories = new Set(merchantTransactions.map(t => t.category));
            const hasMixedCategories = categories.size > 1;
            const hasMiscellaneous = categories.has('Miscellaneous');
            
            // Show if: mixed categories OR has miscellaneous category
            return hasMixedCategories || hasMiscellaneous;
          });

        if (merchantsNeedingCategorization.length === 0) {
          return (
            <div className="bg-green-50 dark:bg-green-900/20 backdrop-blur-sm rounded-2xl border border-green-200 dark:border-green-700 p-4 mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                <h3 className="text-sm font-medium text-green-700 dark:text-green-300">
                  All merchants are properly categorized! 🎉
                </h3>
              </div>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                No merchants need bulk categorization updates.
              </p>
            </div>
          );
        }

        return (
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Merchants Needing Categorization ({merchantsNeedingCategorization.length})
            </h3>
            <div className="flex flex-wrap gap-2">
              {merchantsNeedingCategorization.map(merchant => {
                const merchantTransactions = filteredTransactions.filter(t => t.merchant === merchant);
                const count = merchantTransactions.length;
                const totalAmount = merchantTransactions.reduce((sum, t) => sum + t.amount, 0);
                const categories = new Set(merchantTransactions.map(t => t.category));
                const hasMixedCategories = categories.size > 1;
                const hasMiscellaneous = categories.has('Miscellaneous');
                const categoryText = hasMixedCategories ? `${Array.from(categories).join(', ')}` : Array.from(categories)[0];
                
                return (
                  <button
                    key={merchant}
                    onClick={() => openBulkModal(merchant, filteredTransactions.find(t => t.merchant === merchant)?.category || 'Miscellaneous')}
                    className={`px-3 py-2 border rounded-lg text-sm transition-colors ${
                      hasMiscellaneous 
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40' 
                        : hasMixedCategories
                        ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/40'
                        : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                    }`}
                    title={`${count} transactions, Categories: ${categoryText}, Total: ₹${totalAmount.toLocaleString('en-IN')}${
                      hasMiscellaneous ? ' - Has uncategorized transactions!' : hasMixedCategories ? ' - Mixed categories!' : ' - Needs attention'
                    }`}
                  >
                    {merchant} ({count})
                    {hasMiscellaneous && <span className="ml-1 text-xs">❌</span>}
                    {hasMixedCategories && !hasMiscellaneous && <span className="ml-1 text-xs">⚠️</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden min-w-0">
        {filteredTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <Search className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No transactions found</h3>
            <p className="text-gray-600 dark:text-gray-400">Try adjusting your search terms or filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="w-28 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="w-48 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Merchant</th>
                  <th className="w-32 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
                  <th className="w-28 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</th>
                  <th className="w-24 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Payment</th>
                  <th className="w-64 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Notes</th>
                  <th className="w-28 px-4 py-3 text-left text-xs font-medium text-transparent">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200">
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <div className="flex items-center space-x-2">
                        <Calendar size={16} className="text-gray-400" />
                        <span>{format(new Date(transaction.date), 'MMM dd, yyyy')}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {editingId === transaction.id ? (
                        <div className="flex items-center space-x-2">
                          <MapPin size={16} className="text-gray-400" />
                          <input
                            value={editValues.merchant}
                            onChange={(e) => setEditValues(v => ({ ...v, merchant: e.target.value }))}
                            className="w-44 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2 max-w-[180px] truncate">
                          <MapPin size={16} className="text-gray-400" />
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{transaction.merchant}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {editingId === transaction.id ? (
                        <>
                          <select
                            value={editCategoryValue}
                            onChange={(e) => {
                              if (e.target.value === '__add_new__') setShowAddCategory(true);
                              setEditCategoryValue(e.target.value);
                            }}
                            className="w-40 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                          >
                            {allCategories.map(category => (
                              <option key={category} value={category}>{category}</option>
                            ))}
                            <option value="__add_new__">+ Add New Category</option>
                          </select>
                          {showAddCategory && editCategoryValue === '__add_new__' && (
                            <div className="mt-2">
                              <input
                                type="text"
                                value={newCategoryInput}
                                onChange={(e) => setNewCategoryInput(e.target.value)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    addCustomCategory(newCategoryInput);
                                    setEditCategoryValue(newCategoryInput);
                                    setNewCategoryInput('');
                                    setShowAddCategory(false);
                                  }
                                }}
                                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                                placeholder="Enter new category name"
                              />
                              <button
                                onClick={() => {
                                  addCustomCategory(newCategoryInput);
                                  setEditCategoryValue(newCategoryInput);
                                  setNewCategoryInput('');
                                  setShowAddCategory(false);
                                }}
                                className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                              >
                                Add Category
                              </button>
                              <button
                                onClick={() => setShowAddCategory(false)}
                                className="mt-2 ml-2 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(transaction.category)}`}>{transaction.category}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <IndianRupee size={16} className={transaction.amount > 0 ? 'text-emerald-500' : 'text-red-500'} />
                        <span className={`text-sm font-medium ${transaction.amount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {transaction.amount > 0 ? '+' : '-'}{Math.abs(transaction.amount).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <CreditCard size={16} className="text-gray-400" />
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${transaction.paymentMode === 'UPI' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'}`}>{transaction.paymentMode}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400 max-w-[260px] truncate">{transaction.notes || '-'}</td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                      {editingId === transaction.id ? (
                        <div className="flex items-center gap-2">
                          <button onClick={saveEdit} className="px-3 py-1 rounded bg-emerald-600 text-white">Save</button>
                          <button onClick={cancelEdit} className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-600">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {transaction.category === 'Miscellaneous' && (
                            <button onClick={() => startEditing(transaction.id)} className="px-3 py-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Fix Misc</button>
                          )}
                          {filteredTransactions.filter(t => t.merchant.toLowerCase() === transaction.merchant.toLowerCase()).length > 1 && (
                            <button 
                              onClick={() => openBulkModal(transaction.merchant, transaction.category)}
                              className="px-3 py-1 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-xs"
                              title={`Update all ${filteredTransactions.filter(t => t.merchant.toLowerCase() === transaction.merchant.toLowerCase()).length} transactions from ${transaction.merchant}`}
                            >
                              Bulk
                            </button>
                          )}
                          <button onClick={() => startEditing(transaction.id)} className="px-3 py-1 rounded bg-gray-100 dark:bg-gray-700">Edit</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk Category Update Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Bulk Category Update
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Merchant
                </label>
                <input
                  type="text"
                  value={selectedMerchant}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  New Category
                </label>
                <select
                  value={bulkCategoryValue}
                  onChange={(e) => {
                    if (e.target.value === '__add_new__') setShowAddCategory(true);
                    setBulkCategoryValue(e.target.value);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {allCategories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                  <option value="__add_new__">+ Add New Category</option>
                </select>
                {showAddCategory && bulkCategoryValue === '__add_new__' && (
                  <div className="mt-2">
                    <input
                      type="text"
                      value={newCategoryInput}
                      onChange={(e) => setNewCategoryInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          addCustomCategory(newCategoryInput);
                          setBulkCategoryValue(newCategoryInput);
                          setNewCategoryInput('');
                          setShowAddCategory(false);
                        }
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="Enter new category name"
                    />
                    <button
                      onClick={() => {
                        addCustomCategory(newCategoryInput);
                        setBulkCategoryValue(newCategoryInput);
                        setNewCategoryInput('');
                        setShowAddCategory(false);
                      }}
                      className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                    >
                      Add Category
                    </button>
                    <button
                      onClick={() => setShowAddCategory(false)}
                      className="mt-2 ml-2 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
              
              <div className="text-sm text-gray-600 dark:text-gray-400">
                This will update all transactions from <strong>{selectedMerchant}</strong> to category <strong>{bulkCategoryValue}</strong>.
                <br />
                Affected transactions: {filteredTransactions.filter(t => t.merchant.toLowerCase() === selectedMerchant.toLowerCase()).length}
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowBulkModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkCategoryUpdate}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Update All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchAndFilter;
