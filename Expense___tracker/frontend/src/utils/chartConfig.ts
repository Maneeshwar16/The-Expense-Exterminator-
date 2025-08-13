import { ChartConfiguration } from 'chart.js';

export const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        usePointStyle: true,
        padding: 20,
        font: {
          size: 12,
        },
      },
    },
  },
};

export const pieChartConfig: Partial<ChartConfiguration<'pie'>> = {
  options: {
    ...chartDefaults,
    plugins: {
      ...chartDefaults.plugins,
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${context.label}: ₹${value.toLocaleString()} (${percentage}%)`;
          },
        },
      },
    },
  },
};

export const lineChartConfig: Partial<ChartConfiguration<'line'>> = {
  options: {
    ...chartDefaults,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => `₹${value}`,
        },
      },
    },
    plugins: {
      ...chartDefaults.plugins,
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ₹${context.parsed.y.toLocaleString()}`,
        },
      },
    },
  },
};

export const barChartConfig: Partial<ChartConfiguration<'bar'>> = {
  options: {
    ...chartDefaults,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value) => `₹${value}`,
        },
      },
    },
    plugins: {
      ...chartDefaults.plugins,
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label}: ₹${context.parsed.y.toLocaleString()}`,
        },
      },
    },
  },
};