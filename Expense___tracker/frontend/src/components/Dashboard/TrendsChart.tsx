import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Transaction } from '../../types';
import { format, eachMonthOfInterval } from 'date-fns';
import { lineChartConfig } from '../../utils/chartConfig';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface TrendsChartProps {
  transactions: Transaction[];
}

const TrendsChart: React.FC<TrendsChartProps> = ({ transactions }) => {
  const chartData = useMemo(() => {
    if (transactions.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }

    // Get the date range from the filtered transactions
    const dates = transactions.map(t => new Date(t.date)).sort((a, b) => a.getTime() - b.getTime());
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    
    // Generate months between start and end dates
    const months = eachMonthOfInterval({ start: startDate, end: endDate });
    
    const monthlyData = months.map(month => {
      const monthTransactions = transactions.filter(t => {
        const date = new Date(t.date);
        return date.getMonth() === month.getMonth() && 
               date.getFullYear() === month.getFullYear();
      });
      
      return {
        month: format(month, 'MMM yyyy'),
        total: monthTransactions.reduce((sum, t) => sum + t.amount, 0),
        upi: monthTransactions.filter(t => t.paymentMode === 'UPI').reduce((sum, t) => sum + t.amount, 0),
        cash: monthTransactions.filter(t => t.paymentMode === 'Cash').reduce((sum, t) => sum + t.amount, 0),
      };
    });

    return {
      labels: monthlyData.map(d => d.month),
      datasets: [
        {
          label: 'Total Spending',
          data: monthlyData.map(d => d.total),
          borderColor: 'rgba(16, 185, 129, 1)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
        },
        {
          label: 'UPI Payments',
          data: monthlyData.map(d => d.upi),
          borderColor: 'rgba(59, 130, 246, 1)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: false,
          tension: 0.4,
        },
        {
          label: 'Cash Payments',
          data: monthlyData.map(d => d.cash),
          borderColor: 'rgba(249, 115, 22, 1)',
          backgroundColor: 'rgba(249, 115, 22, 0.1)',
          borderWidth: 2,
          fill: false,
          tension: 0.4,
        },
      ],
    };
  }, [transactions]);

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
        Monthly Spending Trends
      </h3>
      <div className="h-80">
        <Line data={chartData} options={lineChartConfig.options} />
      </div>
    </div>
  );
};

export default TrendsChart;