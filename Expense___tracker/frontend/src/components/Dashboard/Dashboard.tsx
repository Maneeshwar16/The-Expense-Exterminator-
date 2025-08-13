import React, { useMemo } from 'react';
import { useExpenses } from '../../context/ExpenseContext';
import StatsCards from './StatsCards';
import CategoryChart from './CategoryChart';
import TrendsChart from './TrendsChart';
import AIInsights from './AIInsights';

const Dashboard: React.FC = () => {
  const { transactions, insights, loading, monthRange, setMonthRange, getFilteredTransactions } = useExpenses();

  const filteredTransactions = useMemo(() => {
    return getFilteredTransactions();
  }, [getFilteredTransactions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Dashboard
        </h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 dark:text-gray-400">Range</label>
          <select
            value={monthRange}
            onChange={(e) => setMonthRange(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="1m">This month</option>
            <option value="2m">Last 2 months</option>
            <option value="3m">Last 3 months</option>
            <option value="4m">Last 4 months</option>
            <option value="5m">Last 5 months</option>
            <option value="6m">Last 6 months</option>
            <option value="all">All</option>
          </select>
        </div>
        <p className="basis-full text-gray-600 dark:text-gray-400">
          Overview of your expenses and financial insights.
          <br>
          </br>
          This dashboard only shows the transactions that are debited from your account.
        </p>
      </div>

      <StatsCards transactions={filteredTransactions} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <CategoryChart transactions={filteredTransactions} />
        <AIInsights insights={insights} />
      </div>

      <TrendsChart transactions={filteredTransactions} />
    </div>
  );
};

export default Dashboard;
