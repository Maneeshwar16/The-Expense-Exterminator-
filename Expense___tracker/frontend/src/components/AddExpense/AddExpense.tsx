import React, { useState } from 'react';
import { Save, X } from 'lucide-react';
import { useExpenses } from '../../context/ExpenseContext';
import { Category } from '../../types';

const AddExpense: React.FC = () => {
  const { addTransaction, monthRange } = useExpenses();
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    category: 'Miscellaneous' as Category,
    merchant: '',
    paymentMode: 'UPI' as 'Cash' | 'UPI',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const categories: Category[] = [
    'Food', 'Travel', 'Shopping', 'Bills', 'Entertainment', 
    'Health', 'Education', 'Investment', 'Miscellaneous'
  ];

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.date) newErrors.date = 'Date is required';
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }
    if (!formData.merchant.trim()) newErrors.merchant = 'Merchant is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    addTransaction({
      date: formData.date,
      amount: parseFloat(formData.amount),
      category: formData.category,
      merchant: formData.merchant.trim(),
      paymentMode: formData.paymentMode,
      notes: formData.notes.trim() || undefined,
      source: 'manual',
    });

    // Reset form
    setFormData({
      date: new Date().toISOString().split('T')[0],
      amount: '',
      category: 'Miscellaneous',
      merchant: '',
      paymentMode: 'UPI',
      notes: '',
    });

    setErrors({});
    
    // Show success message (you can implement toast notifications)
    alert('Expense added successfully!');
  };

  const handleClear = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      amount: '',
      category: 'Miscellaneous',
      merchant: '',
      paymentMode: 'UPI',
      notes: '',
    });
    setErrors({});
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Add New Expense
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Month Range:</span>
            <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium">
              {monthRange === 'all' ? 'All Time' : monthRange === '1m' ? 'This Month' : `Last ${monthRange.replace('m', '')} Months`}
            </span>
          </div>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Manually add a new expense transaction. The month range is controlled from the Dashboard.
        </p>
      </div>

      <div className="max-w-2xl">
        <form onSubmit={handleSubmit} className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl p-8 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date *
              </label>
              <input
                type="date"
                id="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
              />
              {errors.date && <p className="mt-1 text-sm text-red-600">{errors.date}</p>}
            </div>

            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Amount (₹) *
              </label>
              <input
                type="number"
                id="amount"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
              />
              {errors.amount && <p className="mt-1 text-sm text-red-600">{errors.amount}</p>}
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category *
              </label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as Category })}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="paymentMode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Payment Mode *
              </label>
              <select
                id="paymentMode"
                value={formData.paymentMode}
                onChange={(e) => setFormData({ ...formData, paymentMode: e.target.value as 'Cash' | 'UPI' })}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
              >
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="merchant" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Merchant *
              </label>
              <input
                type="text"
                id="merchant"
                value={formData.merchant}
                onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
                placeholder="e.g., Swiggy, Amazon, Starbucks"
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
              />
              {errors.merchant && <p className="mt-1 text-sm text-red-600">{errors.merchant}</p>}
            </div>

            <div className="md:col-span-2">
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes (Optional)
              </label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add any additional notes..."
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all duration-200"
              />
            </div>
          </div>

          <div className="flex items-center justify-end space-x-4 mt-8">
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center space-x-2 px-6 py-3 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
            >
              <X size={16} />
              <span>Clear</span>
            </button>
            <button
              type="submit"
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-blue-600 text-white rounded-xl hover:from-emerald-600 hover:to-blue-700 transform hover:scale-105 transition-all duration-200 shadow-lg"
            >
              <Save size={16} />
              <span>Save Expense</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddExpense;