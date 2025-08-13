import { Transaction, AIInsight, Category } from '../types';
import { subDays, subMonths, format } from 'date-fns';

const categories: Category[] = ['Food', 'Travel', 'Shopping', 'Bills', 'Entertainment', 'Health', 'Education', 'Investment', 'Miscellaneous'];
const merchants = [
  'Swiggy', 'Zomato', 'McDonald\'s', 'Starbucks',
  'Uber', 'Ola', 'Indian Railways', 'SpiceJet',
  'Amazon', 'Flipkart', 'Big Bazaar', 'H&M',
  'Electricity Board', 'Airtel', 'Jio', 'Gas Agency',
  'PVR Cinemas', 'BookMyShow', 'Spotify', 'Netflix',
  'Apollo Pharmacy', 'Max Healthcare',
  'Udemy', 'Coursera',
  'SIP Investment', 'FD Deposit'
];

export const generateSampleData = (userId: string = 'demo-user'): Transaction[] => {
  const transactions: Transaction[] = [];
  
  // Generate transactions for the last 3 months
  for (let i = 0; i < 150; i++) {
    const date = subDays(new Date(), Math.floor(Math.random() * 90));
    const category = categories[Math.floor(Math.random() * categories.length)];
    const merchant = merchants[Math.floor(Math.random() * merchants.length)];
    
    // Generate more realistic amounts based on category
    let amount: number;
    switch (category) {
      case 'Food':
        amount = Math.floor(Math.random() * 800) + 50; // 50-850
        break;
      case 'Travel':
        amount = Math.floor(Math.random() * 2000) + 100; // 100-2100
        break;
      case 'Shopping':
        amount = Math.floor(Math.random() * 3000) + 200; // 200-3200
        break;
      case 'Bills':
        amount = Math.floor(Math.random() * 1500) + 100; // 100-1600
        break;
      case 'Entertainment':
        amount = Math.floor(Math.random() * 1000) + 100; // 100-1100
        break;
      case 'Health':
        amount = Math.floor(Math.random() * 1200) + 150; // 150-1350
        break;
      case 'Education':
        amount = Math.floor(Math.random() * 2500) + 300; // 300-2800
        break;
      case 'Investment':
        amount = Math.floor(Math.random() * 5000) + 1000; // 1000-6000
        break;
      default:
        amount = Math.floor(Math.random() * 1000) + 100; // 100-1100
    }
    
    const paymentMode = Math.random() > 0.3 ? 'UPI' : 'Cash';
    
    transactions.push({
      id: `transaction_${i}_${Date.now()}`,
      userId,
      date: format(date, 'yyyy-MM-dd'),
      amount,
      category,
      merchant,
      paymentMode: paymentMode as 'UPI' | 'Cash',
      notes: Math.random() > 0.7 ? `Sample note for ${merchant}` : undefined,
      source: ['manual', 'phonpe', 'gpay', 'paytm'][Math.floor(Math.random() * 4)] as any,
      createdAt: date,
      updatedAt: date,
    });
  }
  
  return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const generateAIInsights = (transactions: Transaction[]): AIInsight[] => {
  const insights: AIInsight[] = [];
  
  if (transactions.length === 0) {
    return insights;
  }
  
  // Current month spending
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const currentMonthTransactions = transactions.filter(t => {
    const date = new Date(t.date);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });
  
  const previousMonthTransactions = transactions.filter(t => {
    const date = new Date(t.date);
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    return date.getMonth() === prevMonth && date.getFullYear() === prevYear;
  });
  
  const currentTotal = currentMonthTransactions.reduce((sum, t) => sum + t.amount, 0);
  const previousTotal = previousMonthTransactions.reduce((sum, t) => sum + t.amount, 0);
  
  // Overspending detection
  if (previousTotal > 0) {
    const increase = ((currentTotal - previousTotal) / previousTotal) * 100;
    if (increase > 20) {
      insights.push({
        type: 'overspending',
        title: 'Overspending Alert',
        description: `You've spent ${increase.toFixed(1)}% more this month compared to last month`,
        value: currentTotal,
        previousValue: previousTotal,
      });
    } else if (increase < -15) {
      insights.push({
        type: 'trend',
        title: 'Great Job on Savings!',
        description: `You've reduced spending by ${Math.abs(increase).toFixed(1)}% compared to last month`,
        value: currentTotal,
        previousValue: previousTotal,
      });
    }
  }
  
  // Category-wise insights
  const categorySpending = currentMonthTransactions.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {} as Record<Category, number>);
  
  const topCategory = Object.entries(categorySpending)
    .sort(([,a], [,b]) => b - a)[0];
  
  if (topCategory) {
    insights.push({
      type: 'trend',
      title: 'Top Spending Category',
      description: `You spent the most on ${topCategory[0]} this month`,
      value: topCategory[1],
      category: topCategory[0] as Category,
    });
  }
  
  // Payment mode analysis
  const upiTotal = currentMonthTransactions.filter(t => t.paymentMode === 'UPI').reduce((sum, t) => sum + t.amount, 0);
  const cashTotal = currentMonthTransactions.filter(t => t.paymentMode === 'Cash').reduce((sum, t) => sum + t.amount, 0);
  
  if (upiTotal > 0 || cashTotal > 0) {
    const total = upiTotal + cashTotal;
    const upiPercentage = (upiTotal / total) * 100;
    
    insights.push({
      type: 'trend',
      title: 'Payment Method Preference',
      description: `You use ${upiPercentage > 70 ? 'UPI' : 'Cash'} for ${upiPercentage.toFixed(1)}% of your transactions`,
      value: upiPercentage,
    });
  }
  
  // Prediction
  if (currentMonthTransactions.length > 0) {
    const avgDaily = currentTotal / new Date().getDate();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const projection = avgDaily * daysInMonth;
    
    insights.push({
      type: 'prediction',
      title: 'Month-end Projection',
      description: `Based on your current spending, you might spend ₹${projection.toFixed(0)} this month`,
      value: projection,
    });
  }
  
  // Savings suggestion
  if (currentTotal > 0) {
    const dailyAvg = currentTotal / new Date().getDate();
    const suggestedBudget = Math.round(dailyAvg * 30);
    
    insights.push({
      type: 'suggestion',
      title: 'Budget Suggestion',
      description: `Consider setting a monthly budget of ₹${suggestedBudget.toLocaleString()} based on your current spending patterns`,
    });
  }
  
  // Category-specific suggestions
  const foodSpending = categorySpending.Food || 0;
  if (foodSpending > 5000) {
    insights.push({
      type: 'suggestion',
      title: 'Food Spending Tip',
      description: 'Your food spending is high. Consider cooking at home more often to save money.',
      category: 'Food',
    });
  }
  
  const travelSpending = categorySpending.Travel || 0;
  if (travelSpending > 8000) {
    insights.push({
      type: 'suggestion',
      title: 'Travel Optimization',
      description: 'Look for public transport options or carpooling to reduce travel expenses.',
      category: 'Travel',
    });
  }
  
  return insights;
};