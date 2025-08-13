import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react';
import { Transaction } from '../../types';
import { format } from 'date-fns';
import IncomeStatsCard from "./IncomeStatsCard";

interface StatsCardsProps {
  transactions: Transaction[];
}

const StatsCards: React.FC<StatsCardsProps> = ({ transactions }) => {
  // Use the filtered transactions directly (they already respect the month range)
  const filteredTransactions = transactions;
  
  // Calculate totals for the selected range
  const totalSpend = filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
  const totalTransactions = filteredTransactions.length;
  const avgTransaction = totalTransactions > 0 ? totalSpend / totalTransactions : 0;

  const upiTransactions = filteredTransactions.filter(t => t.paymentMode === 'UPI');
  const cashTransactions = filteredTransactions.filter(t => t.paymentMode === 'Cash');
  const upiTotal = upiTransactions.reduce((sum, t) => sum + t.amount, 0);
  const cashTotal = cashTransactions.reduce((sum, t) => sum + t.amount, 0);

  // Calculate change percentage (comparing with previous period of same length)
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  // Get the previous period transactions for comparison
  const getPreviousPeriodTransactions = () => {
    const filteredDates = filteredTransactions.map(t => new Date(t.date)).sort((a, b) => a.getTime() - b.getTime());
    if (filteredDates.length === 0) return [];
    
    const earliestDate = filteredDates[0];
    const latestDate = filteredDates[filteredDates.length - 1];
    const periodLength = latestDate.getTime() - earliestDate.getTime();
    
    // Calculate the previous period
    const previousPeriodStart = new Date(earliestDate.getTime() - periodLength);
    const previousPeriodEnd = new Date(earliestDate.getTime());
    
    return transactions.filter(t => {
      const date = new Date(t.date);
      return date >= previousPeriodStart && date < previousPeriodEnd;
    });
  };
  
  const previousPeriodTransactions = getPreviousPeriodTransactions();
  const previousTotal = previousPeriodTransactions.reduce((sum, t) => sum + t.amount, 0);
  const change = previousTotal !== 0 ? ((totalSpend - previousTotal) / Math.abs(previousTotal)) * 100 : 0;

  const stats = [
    {
      title: 'Total Spend',
      value: `₹${totalSpend.toLocaleString('en-IN')}`,
      change: change,
      icon: DollarSign,
      color: 'emerald',
    },
    {
      title: 'Total Transactions',
      value: totalTransactions.toString(),
      subtitle: `₹${avgTransaction.toFixed(0)} avg`,
      icon: Calendar,
      color: 'blue',
    },
    {
      title: 'UPI Payments',
      value: `₹${upiTotal.toLocaleString('en-IN')}`,
      subtitle: `${upiTransactions.length} transactions`,
      icon: TrendingUp,
      color: 'purple',
      totalAmount: upiTotal,
    },
    {
      title: 'Cash Payments',
      value: `₹${cashTotal.toLocaleString('en-IN')}`,
      subtitle: `${cashTransactions.length} transactions`,
      icon: TrendingDown,
      color: 'orange',
      totalAmount: cashTotal,
    },

  ];

  const getColorClasses = (color: string) => {
    const colorMap = {
      emerald: 'from-emerald-500 to-emerald-600 text-emerald-600',
      blue: 'from-blue-500 to-blue-600 text-blue-600',
      purple: 'from-purple-500 to-purple-600 text-purple-600',
      orange: 'from-orange-500 to-orange-600 text-orange-600',
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.emerald;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        const colorClasses = getColorClasses(stat.color);
        const [gradientClass, textColorClass] = colorClasses.split(' text-');

        return (
          <div
            key={index}
            className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl bg-gradient-to-r ${gradientClass}`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              {stat.change !== undefined && (
                <div className={`flex items-center space-x-1 text-sm font-medium ${
                  stat.change >= 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                }`}>
                  {stat.change >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  <span>{Math.abs(stat.change).toFixed(1)}%</span>
                </div>
              )}
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                {stat.title}
              </h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                {stat.value}
              </p>
              {stat.subtitle && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {stat.subtitle}
                </p>
              )}
            </div>
          </div>
          
        );
      })}
    </div>
  );
};

export default StatsCards;