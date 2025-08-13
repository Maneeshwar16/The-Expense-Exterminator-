import React, { useMemo } from 'react';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Transaction, Category } from '../../types';
import { pieChartConfig } from '../../utils/chartConfig';

ChartJS.register(ArcElement, Tooltip, Legend);

interface CategoryChartProps {
  transactions: Transaction[];
}

const CategoryChart: React.FC<CategoryChartProps> = ({ transactions }) => {
  const chartData = useMemo(() => {
    // Use the filtered transactions directly (they already respect the month range)
    const categoryData = transactions.reduce((acc, t) => {
      const amount = Math.abs(t.amount);
      acc[t.category] = (acc[t.category] || 0) + amount;
      return acc;
    }, {} as Record<Category, number>);

    const sortedCategories = Object.entries(categoryData).sort(([, a], [, b]) => b - a);

    const colors = [
      'rgba(16, 185, 129, 0.8)', 'rgba(59, 130, 246, 0.8)', 'rgba(139, 92, 246, 0.8)',
      'rgba(249, 115, 22, 0.8)', 'rgba(236, 72, 153, 0.8)', 'rgba(20, 184, 166, 0.8)',
      'rgba(245, 158, 11, 0.8)', 'rgba(239, 68, 68, 0.8)',
    ];

    const borderColors = colors.map(c => c.replace('0.8', '1'));

    return {
      labels: sortedCategories.map(([category]) => category),
      datasets: [
        {
          data: sortedCategories.map(([, amount]) => amount),
          backgroundColor: colors,
          borderColor: borderColors,
          borderWidth: 2,
          hoverBorderWidth: 3,
        },
      ],
    };
  }, [transactions]);

  return (
    <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
        Category-wise Spending
      </h3>
      <div className="h-80">
        <Pie data={chartData} options={pieChartConfig.options} />
      </div>
    </div>
  );
};

export default CategoryChart;
