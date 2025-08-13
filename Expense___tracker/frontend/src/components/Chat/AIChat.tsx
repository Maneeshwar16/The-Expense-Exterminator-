import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { useExpenses } from '../../context/ExpenseContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../UI/ToastContainer';
import { ChatMessage, Transaction, Category } from '../../types';

const AIChat: React.FC = () => {
  const { transactions, addTransaction, addMerchantAlias, monthRange, getFilteredTransactions } = useExpenses();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      text: `Hi ${user?.displayName || 'there'}! I'm your AI expense assistant. I can help you analyze your spending patterns, find specific transactions, and provide financial insights. I'm currently analyzing your data for ${monthRange === 'all' ? 'all time' : monthRange === '1m' ? 'this month' : `last ${monthRange.replace('m', '')} months`}. Try asking me something like 'Where did I spend the most?' or 'Show me my food expenses'.`,
      sender: 'bot',
      timestamp: new Date(),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatHistory, setChatHistory] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  // Update welcome message when month range changes
  useEffect(() => {
    setMessages(prev => {
      if (prev.length > 0 && prev[0].sender === 'bot') {
        const newMessages = [...prev];
        newMessages[0] = {
          ...newMessages[0],
          text: `Hi ${user?.displayName || 'there'}! I'm your AI expense assistant. I can help you analyze your spending patterns, find specific transactions, and provide financial insights. I'm currently analyzing your data for ${monthRange === 'all' ? 'all time' : monthRange === '1m' ? 'this month' : `last ${monthRange.replace('m', '')} months`}. Try asking me something like 'Where did I spend the most?' or 'Show me my food expenses'.`
        };
        return newMessages;
      }
      return prev;
    });
  }, [monthRange, user?.displayName]);

  // Helper function to get transactions for a specific time period
  const getTransactionsForPeriod = (userMessage: string): Transaction[] => {
    const lowerMessage = userMessage.toLowerCase();
    const currentDate = new Date();
    
    // Check for specific time periods
    if (lowerMessage.includes('last 2 months') || lowerMessage.includes('past 2 months')) {
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(currentDate.getMonth() - 2);
      return transactions.filter(t => new Date(t.date) >= twoMonthsAgo);
    }
    
    if (lowerMessage.includes('last 3 months') || lowerMessage.includes('past 3 months')) {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(currentDate.getMonth() - 3);
      return transactions.filter(t => new Date(t.date) >= threeMonthsAgo);
    }
    
    if (lowerMessage.includes('last 6 months') || lowerMessage.includes('past 6 months')) {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(currentDate.getMonth() - 6);
      return transactions.filter(t => new Date(t.date) >= sixMonthsAgo);
    }
    
    if (lowerMessage.includes('this year')) {
      const startOfYear = new Date(currentDate.getFullYear(), 0, 1);
      return transactions.filter(t => new Date(t.date) >= startOfYear);
    }
    
    if (lowerMessage.includes('last year')) {
      const lastYearStart = new Date(currentDate.getFullYear() - 1, 0, 1);
      const lastYearEnd = new Date(currentDate.getFullYear() - 1, 11, 31);
      return transactions.filter(t => {
        const date = new Date(t.date);
        return date >= lastYearStart && date <= lastYearEnd;
      });
    }
    
    // Check for specific months
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 
                   'july', 'august', 'september', 'october', 'november', 'december'];
    
    for (let i = 0; i < months.length; i++) {
      if (lowerMessage.includes(months[i])) {
        const year = currentDate.getFullYear();
        return transactions.filter(t => {
          const date = new Date(t.date);
          return date.getMonth() === i && date.getFullYear() === year;
        });
      }
    }
    
    // Check for week references like "1st week", "first week"
    if (lowerMessage.includes('1st week') || lowerMessage.includes('first week')) {
      // Get April 1st week (1-7)
      if (lowerMessage.includes('april')) {
        const year = currentDate.getFullYear();
        return transactions.filter(t => {
          const date = new Date(t.date);
          return date.getMonth() === 3 && date.getDate() <= 7 && date.getFullYear() === year;
        });
      }
    }
    
    // Default to filtered transactions based on current month range
    return getFilteredTransactions();
  };

  // Helper function to find transactions by amount and timeframe
  const findTransactionsByAmountAndTime = (amount: number, timeQuery: string): Transaction[] => {
    const lowerQuery = timeQuery.toLowerCase();
    let relevantTransactions = transactions;
    
    // Parse time period
    if (lowerQuery.includes('april') && (lowerQuery.includes('1st week') || lowerQuery.includes('first week'))) {
      const year = new Date().getFullYear();
      relevantTransactions = transactions.filter(t => {
        const date = new Date(t.date);
        return date.getMonth() === 3 && date.getDate() <= 7 && date.getFullYear() === year;
      });
    }
    
    // Find transactions with matching amount (allow for small differences)
    return relevantTransactions.filter(t => Math.abs(Math.abs(t.amount) - amount) <= 5);
  };

  // Enhanced AI response generation
  const generateAIResponse = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase();
    
    // Store chat history for context
    setChatHistory(prev => [...prev.slice(-5), userMessage]);

    // 1. Quick add expense (handle BEFORE any analysis)
    const amountQuickMatch = lowerMessage.match(/(?:rs|₹)?\s*(\d{2,7})(?:\/-)?/i);
    const wantsAdd = /\b(spent|add|added|record|log)\b/.test(lowerMessage);
    if (amountQuickMatch && wantsAdd) {
      return handleAddExpense(userMessage, amountQuickMatch);
    }

    // 2. Find specific transaction by amount and time
    if (lowerMessage.includes('transferred') || lowerMessage.includes('paid') || lowerMessage.includes('sent')) {
      const amountMatch = lowerMessage.match(/(?:rs|₹)?\s*(\d{2,7})(?:\/-)?/i);
      if (amountMatch) {
        const amount = Number(amountMatch[1]);
        const foundTransactions = findTransactionsByAmountAndTime(amount, userMessage);
        
        if (foundTransactions.length === 0) {
          return `I couldn't find any transaction of ₹${amount.toLocaleString()} for the specified time period. Could you check the amount or date?`;
        }
        
        if (foundTransactions.length === 1) {
          const t = foundTransactions[0];
          return `On ${new Date(t.date).toLocaleDateString()}, you paid ₹${Math.abs(t.amount).toLocaleString()} to **${t.merchant}** (${t.category}) via ${t.paymentMode}.`;
        }
        
        let response = `Found ${foundTransactions.length} transactions of around ₹${amount.toLocaleString()}:\n\n`;
        foundTransactions.forEach((t, index) => {
          response += `${index + 1}. ${new Date(t.date).toLocaleDateString()} - **${t.merchant}** (₹${Math.abs(t.amount).toLocaleString()}, ${t.category})\n`;
        });
        return response;
      }
    }

    // 3. Merchant-specific spending analysis
    if (lowerMessage.includes('how much') && (lowerMessage.includes('spent on') || lowerMessage.includes('at'))) {
      const merchantMatch = lowerMessage.match(/(?:spent on|at|to)\s+([a-z0-9\s&.-]{3,}?)(?:\s+(?:last|in|for|during)|\s*$)/i);
      if (merchantMatch) {
        const merchantName = merchantMatch[1].trim();
        const relevantTransactions = getTransactionsForPeriod(userMessage);
        const merchantTransactions = relevantTransactions.filter(t => 
          t.merchant.toLowerCase().includes(merchantName.toLowerCase()) ||
          merchantName.toLowerCase().includes(t.merchant.toLowerCase())
        );
        
        if (merchantTransactions.length === 0) {
          return `I couldn't find any transactions for "${merchantName}" in the specified period. Check the spelling or try a different time range.`;
        }
        
        const total = merchantTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const timeDescription = getTimeDescription(userMessage);
        
        let response = `You spent **₹${total.toLocaleString()}** on ${merchantName} ${timeDescription}.\n\n`;
        response += `**Transaction details:**\n`;
        merchantTransactions.forEach(t => {
          response += `• ${new Date(t.date).toLocaleDateString()}: ₹${Math.abs(t.amount).toLocaleString()} (${t.category})\n`;
        });
        
        return response;
      }
    }

    // 4. Hospital/Healthcare spending analysis
    if (lowerMessage.includes('hospital') && (lowerMessage.includes('most') || lowerMessage.includes('highest') || lowerMessage.includes('paid'))) {
      const relevantTransactions = getTransactionsForPeriod(userMessage);
      const healthTransactions = relevantTransactions.filter(t => 
        t.category.toLowerCase() === 'health' || 
        t.merchant.toLowerCase().includes('hospital') ||
        t.merchant.toLowerCase().includes('clinic') ||
        t.merchant.toLowerCase().includes('medical')
      );
      
      if (healthTransactions.length === 0) {
        return "You haven't recorded any hospital or healthcare expenses in the specified period.";
      }
      
      const merchantTotals = healthTransactions.reduce((acc, t) => {
        acc[t.merchant] = (acc[t.merchant] || 0) + Math.abs(t.amount);
        return acc;
      }, {} as Record<string, number>);
      
      const sortedHospitals = Object.entries(merchantTotals)
        .sort(([,a], [,b]) => b - a);
      
      const topHospital = sortedHospitals[0];
      const timeDescription = getTimeDescription(userMessage);
      
      let response = `You paid the most to **${topHospital[0]}**: ₹${topHospital[1].toLocaleString()} ${timeDescription}.\n\n`;
      
      if (sortedHospitals.length > 1) {
        response += `**Other healthcare providers:**\n`;
        sortedHospitals.slice(1, 4).forEach(([hospital, amount]) => {
          response += `• ${hospital}: ₹${amount.toLocaleString()}\n`;
        });
      }
      
      return response;
    }

    // 5. Total spending analysis
    if ((lowerMessage.includes('how much') || lowerMessage.includes('total')) && 
        (lowerMessage.includes('spent') || lowerMessage.includes('expense'))) {
      const relevantTransactions = getTransactionsForPeriod(userMessage);
      
      if (relevantTransactions.length === 0) {
        return "No transactions found for the specified period.";
      }
      
      const total = relevantTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const timeDescription = getTimeDescription(userMessage);
      
      let response = `You spent a total of **₹${total.toLocaleString()}** ${timeDescription}.\n\n`;
      
      // Add category breakdown for longer periods
      if (relevantTransactions.length > 5) {
        const categoryTotals = relevantTransactions.reduce((acc, t) => {
          acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
          return acc;
        }, {} as Record<string, number>);
        
        const sortedCategories = Object.entries(categoryTotals)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5);
        
        response += `**Top categories:**\n`;
        sortedCategories.forEach(([category, amount]) => {
          const percentage = ((amount / total) * 100).toFixed(1);
          response += `• ${category}: ₹${amount.toLocaleString()} (${percentage}%)\n`;
        });
      }
      
      return response;
    }

    // 6. Category-specific spending with time period (e.g., "how much did I spend on health last 2 months")
    if ((lowerMessage.includes('how much') || lowerMessage.includes('total')) && 
        (lowerMessage.includes('spent') || lowerMessage.includes('spend')) &&
        (lowerMessage.includes('on') || lowerMessage.includes('for'))) {
      
      // Extract category from the message
      const categories: Record<string, Category> = {
        'health': 'Health',
        'medical': 'Health',
        'hospital': 'Health',
        'doctor': 'Health',
        'food': 'Food',
        'restaurant': 'Food',
        'dining': 'Food',
        'eat': 'Food',
        'travel': 'Travel',
        'cab': 'Travel',
        'taxi': 'Travel',
        'uber': 'Travel',
        'ola': 'Travel',
        'shopping': 'Shopping',
        'clothes': 'Shopping',
        'amazon': 'Shopping',
        'flipkart': 'Shopping',
        'bills': 'Bills',
        'electricity': 'Bills',
        'rent': 'Bills',
        'entertainment': 'Entertainment',
        'movie': 'Entertainment',
        'netflix': 'Entertainment',
        'education': 'Education',
        'course': 'Education',
        'investment': 'Investment',
        'mutual fund': 'Investment'
      };
      
      let foundCategory: Category | null = null;
      let foundKeyword = '';
      
      Object.entries(categories).forEach(([keyword, category]) => {
        if (lowerMessage.includes(keyword)) {
          foundCategory = category;
          foundKeyword = keyword;
        }
      });
      
      if (foundCategory) {
        return generateCategorySpendingAnalysis(foundCategory, foundKeyword, getTransactionsForPeriod(userMessage), userMessage);
      }
    }

    // 7. Spending breakdown and analysis
    if (lowerMessage.includes('where') && (lowerMessage.includes('spent') || lowerMessage.includes('spend'))) {
      return generateSpendingAnalysis(getTransactionsForPeriod(userMessage));
    }

    // 8. Monthly summary (move before general patterns)
    if (lowerMessage.includes('summary') || lowerMessage.includes('overview')) {
      return generateMonthlySummary(getTransactionsForPeriod(userMessage));
    }

    // 9. Payment mode analysis (move before general patterns)
    if (lowerMessage.includes('payment') || lowerMessage.includes('upi') || lowerMessage.includes('cash')) {
      return generatePaymentAnalysis(getTransactionsForPeriod(userMessage));
    }

    // 10. Budget and savings advice (move before general patterns)
    if (lowerMessage.includes('budget') || lowerMessage.includes('save') || lowerMessage.includes('advice')) {
      return generateBudgetAdvice(getTransactionsForPeriod(userMessage));
    }

    // 11. Category analysis (move before general patterns)
    if (lowerMessage.includes('category') || lowerMessage.includes('categories')) {
      return generateCategoryAnalysis(getTransactionsForPeriod(userMessage));
    }

    // 12. General food analysis (fallback for food-specific queries)
    if (lowerMessage.includes('food') || lowerMessage.includes('restaurant') || lowerMessage.includes('dining')) {
      return generateFoodAnalysis(getTransactionsForPeriod(userMessage));
    }

    // Default response with suggestions
    return generateDefaultResponse();
  };

  // Helper function to get time description
  const getTimeDescription = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('last 2 months')) return 'in the last 2 months';
    if (lowerMessage.includes('last 3 months')) return 'in the last 3 months';
    if (lowerMessage.includes('last 6 months')) return 'in the last 6 months';
    if (lowerMessage.includes('this year')) return 'this year';
    if (lowerMessage.includes('last year')) return 'last year';
    if (lowerMessage.includes('april')) return 'in April';
    if (lowerMessage.includes('1st week')) return 'in the first week';
    
    return 'this period';
  };

  // Handle adding expenses
  const handleAddExpense = (userMessage: string, amountMatch: RegExpMatchArray): string => {
    const lowerMessage = userMessage.toLowerCase();
    
    const categoryKeywords: Record<Category, string[]> = {
      Food: ['food','restaurant','dining','meal','lunch','dinner','breakfast','swiggy','zomato','mcdonald','kfc','domino','pizza','burger','cafe'],
      Travel: ['travel','cab','taxi','uber','ola','bus','train','flight','rapido','bike'],
      Shopping: ['shopping','amazon','flipkart','mall','store','clothes','fashion'],
      Bills: ['bill','electricity','water','gas','recharge','rent','postpaid','broadband'],
      Entertainment: ['movie','netflix','spotify','bms','pvr','entertainment'],
      Health: ['health','hospital','clinic','pharma','medicine','doctor'],
      Education: ['education','course','udemy','coursera','fee','tuition'],
      Investment: ['investment','sip','fd','mutual fund','stock'],
      Miscellaneous: ['misc','other','general']
    };
    
    let chosenCategory: Category = 'Miscellaneous';
    Object.entries(categoryKeywords).some(([cat, keys]) => {
      if (keys.some(k => lowerMessage.includes(k))) { 
        chosenCategory = cat as Category; 
        return true; 
      }
      return false;
    });

    const merchantMatch = lowerMessage.match(/\b(?:to|at|on)\s+([A-Za-z0-9 ._''&\-]{3,})/u);
    const merchant = (merchantMatch && merchantMatch[1])?.trim() || 
                    ((chosenCategory as string) === 'Bills' && lowerMessage.includes('rent') ? 'House Rent' : 'Unknown');

    const dateMatch = lowerMessage.match(/today|yesterday|\b(\d{4}-\d{2}-\d{2})\b|\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
    const today = new Date();
    let dateStr = today.toISOString().slice(0,10);
    
    if (dateMatch) {
      const dm = dateMatch[0].toLowerCase();
      if (dm === 'yesterday') { 
        const d = new Date(); 
        d.setDate(d.getDate()-1); 
        dateStr = d.toISOString().slice(0,10); 
      }
      else if (dm !== 'today') {
        const s = dm.includes('-') ? dm.split('-') : dm.split('/');
        if (s[0].length === 4) {
          dateStr = dm;
        } else {
          const y = s[2].length === 2 ? `20${s[2]}` : s[2];
          dateStr = `${y}-${String(Number(s[1])).padStart(2,'0')}-${String(Number(s[0])).padStart(2,'0')}`;
        }
      }
    }

    const amtRaw = Number(amountMatch[1]);
    const isIncome = /(received|credited|credit|income|refund)/.test(lowerMessage);
    const amt = isIncome ? Math.abs(amtRaw) : -Math.abs(amtRaw);
    
    addTransaction({
      date: dateStr,
      amount: amt,
      category: chosenCategory,
      merchant: merchant,
      paymentMode: 'UPI',
      notes: 'Added via AI chat',
      source: 'manual'
    });
    
    return `✅ Added ${amt < 0 ? '-' : '+'}₹${Math.abs(amt).toLocaleString()} to ${chosenCategory} (${merchant}) on ${new Date(dateStr).toDateString()}.`;
  };

  // Generate category-specific spending analysis
  const generateCategorySpendingAnalysis = (category: Category, keyword: string, transactions: Transaction[], originalMessage: string): string => {
    const categoryTransactions = transactions.filter(t => {
      // Match by category or by merchant keywords
      if (t.category === category) return true;
      
      // Additional keyword matching for merchant names
      const merchantLower = t.merchant.toLowerCase();
      if (keyword === 'health' && (merchantLower.includes('hospital') || merchantLower.includes('clinic') || merchantLower.includes('medical') || merchantLower.includes('pharma'))) return true;
      if (keyword === 'food' && (merchantLower.includes('restaurant') || merchantLower.includes('cafe') || merchantLower.includes('swiggy') || merchantLower.includes('zomato'))) return true;
      if (keyword === 'travel' && (merchantLower.includes('uber') || merchantLower.includes('ola') || merchantLower.includes('cab') || merchantLower.includes('taxi'))) return true;
      
      return false;
    });

    if (categoryTransactions.length === 0) {
      const timeDescription = getTimeDescription(originalMessage);
      return `You haven't spent anything on ${category.toLowerCase()} ${timeDescription}. Your ${category.toLowerCase()} expenses are well under control! 💚`;
    }

    const categoryTotal = categoryTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const timeDescription = getTimeDescription(originalMessage);
    const avgTransaction = categoryTotal / categoryTransactions.length;

    // Get merchant breakdown for this category
    const merchantTotals = categoryTransactions.reduce((acc, t) => {
      acc[t.merchant] = (acc[t.merchant] || 0) + Math.abs(t.amount);
      return acc;
    }, {} as Record<string, number>);

    const sortedMerchants = Object.entries(merchantTotals)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    const icon = getCategoryIcon(category);

    let response = `${icon} **${category} Spending Analysis**\n\n`;
    response += `• **Total spent ${timeDescription}**: ₹${categoryTotal.toLocaleString()}\n`;
    response += `• **Number of transactions**: ${categoryTransactions.length}\n`;
    response += `• **Average per transaction**: ₹${avgTransaction.toFixed(0)}\n\n`;

    if (sortedMerchants.length > 0) {
      response += `**Top ${category.toLowerCase()} merchants:**\n`;
      sortedMerchants.forEach(([merchant, amount], index) => {
        const percentage = ((amount / categoryTotal) * 100).toFixed(1);
        response += `${index + 1}. **${merchant}**: ₹${amount.toLocaleString()} (${percentage}%)\n`;
      });
    }

    // Add category-specific insights
    if (category === 'Health' && categoryTotal > 5000) {
      response += `\n💡 **Health Insight**: Consider health insurance to manage medical costs better.`;
    } else if (category === 'Food' && categoryTotal > 8000) {
      response += `\n💡 **Food Insight**: Try meal planning and cooking at home to reduce food costs.`;
    } else if (category === 'Entertainment' && categoryTotal > 3000) {
      response += `\n💡 **Entertainment Insight**: Look for free alternatives or set a monthly entertainment budget.`;
    }

    return response;
  };
  const generateSpendingAnalysis = (transactions: Transaction[]): string => {
    if (transactions.length === 0) {
      return "No transactions found for the specified period.";
    }

    const categorySpending = transactions.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
      return acc;
    }, {} as Record<string, number>);

    const sortedCategories = Object.entries(categorySpending)
      .sort(([,a], [,b]) => b - a);

    const topCategory = sortedCategories[0];
    const total = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const topPercentage = ((topCategory[1] / total) * 100).toFixed(1);

    let response = `💰 **Spending Analysis**\n\n`;
    response += `You spent the most on **${topCategory[0]}** with ₹${topCategory[1].toLocaleString()} (${topPercentage}% of total).\n\n`;

    if (sortedCategories.length > 1) {
      response += `**Top spending categories:**\n`;
      sortedCategories.slice(0, 5).forEach(([category, amount], index) => {
        const percentage = ((amount / total) * 100).toFixed(1);
        const icon = getCategoryIcon(category as Category);
        response += `${index + 1}. ${icon} ${category}: ₹${amount.toLocaleString()} (${percentage}%)\n`;
      });
    }

    response += `\n💡 **Total Spending**: ₹${total.toLocaleString()} across ${transactions.length} transactions`;

    return response;
  };

  // Generate food analysis
  const generateFoodAnalysis = (transactions: Transaction[]): string => {
    const foodTransactions = transactions.filter(t => 
      t.category === 'Food' || 
      t.merchant.toLowerCase().includes('restaurant') ||
      t.merchant.toLowerCase().includes('food') ||
      t.merchant.toLowerCase().includes('cafe') ||
      t.merchant.toLowerCase().includes('swiggy') ||
      t.merchant.toLowerCase().includes('zomato')
    );

    if (foodTransactions.length === 0) {
      return "No food expenses found for the specified period.";
    }

    const foodTotal = foodTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const avgTransaction = foodTotal / foodTransactions.length;

    const merchantSpending = foodTransactions.reduce((acc, t) => {
      acc[t.merchant] = (acc[t.merchant] || 0) + Math.abs(t.amount);
      return acc;
    }, {} as Record<string, number>);

    const topMerchants = Object.entries(merchantSpending)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    let response = `🍽️ **Food Spending Analysis**\n\n`;
    response += `• **Total**: ₹${foodTotal.toLocaleString()}\n`;
    response += `• **Average per transaction**: ₹${avgTransaction.toFixed(0)}\n`;
    response += `• **Number of transactions**: ${foodTransactions.length}\n\n`;

    if (topMerchants.length > 0) {
      response += `**Top food merchants:**\n`;
      topMerchants.forEach(([merchant, amount], index) => {
        response += `${index + 1}. **${merchant}**: ₹${amount.toLocaleString()}\n`;
      });
    }

    return response;
  };

  // Generate monthly summary
  const generateMonthlySummary = (transactions: Transaction[]): string => {
    if (transactions.length === 0) {
      return "No transactions found for the specified period.";
    }

    const total = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const avgTransaction = total / transactions.length;

    const paymentMethods = transactions.reduce((acc, t) => {
      acc[t.paymentMode] = (acc[t.paymentMode] || 0) + Math.abs(t.amount);
      return acc;
    }, {} as Record<string, number>);

    const categoryCount = transactions.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const mostFrequentCategory = Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)[0];

    let response = `📊 **Summary Report**\n\n`;
    response += `• **Total Spending**: ₹${total.toLocaleString()}\n`;
    response += `• **Total Transactions**: ${transactions.length}\n`;
    response += `• **Average Transaction**: ₹${avgTransaction.toFixed(0)}\n`;
    response += `• **Most Frequent Category**: ${mostFrequentCategory[0]} (${mostFrequentCategory[1]} times)\n\n`;

    response += `**Payment Methods:**\n`;
    Object.entries(paymentMethods).forEach(([method, amount]) => {
      const percentage = ((amount / total) * 100).toFixed(1);
      response += `• ${method}: ₹${amount.toLocaleString()} (${percentage}%)\n`;
    });

    return response;
  };

  // Generate payment analysis
  const generatePaymentAnalysis = (transactions: Transaction[]): string => {
    const paymentMethods = transactions.reduce((acc, t) => {
      acc[t.paymentMode] = (acc[t.paymentMode] || 0) + Math.abs(t.amount);
      return acc;
    }, {} as Record<string, number>);

    const total = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    let response = `💳 **Payment Method Analysis**\n\n`;
    
    Object.entries(paymentMethods).forEach(([method, amount]) => {
      const percentage = ((amount / total) * 100).toFixed(1);
      const count = transactions.filter(t => t.paymentMode === method).length;
      response += `**${method}**: ₹${amount.toLocaleString()} (${percentage}%) - ${count} transactions\n`;
    });

    return response;
  };

  // Generate budget advice
  const generateBudgetAdvice = (transactions: Transaction[]): string => {
    if (transactions.length === 0) {
      return "No transaction data available to provide budget advice.";
    }

    const total = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    // Calculate category spending
    const categorySpending = transactions.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
      return acc;
    }, {} as Record<string, number>);

    const sortedCategories = Object.entries(categorySpending)
      .sort(([,a], [,b]) => b - a);

    let response = `💡 **Budget Advice & Tips**\n\n`;
    response += `**Current Spending**: ₹${total.toLocaleString()}\n\n`;

    response += `**Top spending categories to review:**\n`;
    sortedCategories.slice(0, 3).forEach(([category, amount], index) => {
      const percentage = ((amount / total) * 100).toFixed(1);
      response += `${index + 1}. ${category}: ₹${amount.toLocaleString()} (${percentage}%)\n`;
    });

    response += `\n**Suggestions:**\n`;
    response += `• Set category-specific budgets\n`;
    response += `• Review recurring subscriptions\n`;
    response += `• Consider the 50/30/20 rule (needs/wants/savings)\n`;
    response += `• Track daily spending to stay on budget`;

    return response;
  };

  // Generate category analysis
  const generateCategoryAnalysis = (transactions: Transaction[]): string => {
    const categorySpending = transactions.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
      return acc;
    }, {} as Record<string, number>);

    const total = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const sortedCategories = Object.entries(categorySpending)
      .sort(([,a], [,b]) => b - a);

    let response = `📂 **Category Analysis**\n\n`;
    
    sortedCategories.forEach(([category, amount], index) => {
      const percentage = ((amount / total) * 100).toFixed(1);
      const icon = getCategoryIcon(category as Category);
      const count = transactions.filter(t => t.category === category).length;
      response += `${index + 1}. ${icon} **${category}**: ₹${amount.toLocaleString()} (${percentage}%) - ${count} transactions\n`;
    });

    return response;
  };

  // Generate default response
  const generateDefaultResponse = (): string => {
    return `I'm here to help you analyze your expenses! Here are some things you can ask me:

**💰 Spending Analysis:**
• "How much did I spend on groceries last 2 months?"
• "What's the hospital I paid the most to?"
• "Where did I spend the most money?"

**🔍 Find Transactions:**
• "I transferred 5000 to someone in April 1st week, who was it?"
• "Show me all food expenses this month"

**📊 Reports & Insights:**
• "Give me a monthly summary"
• "Show me spending by category"
• "Payment method breakdown"

**➕ Add Expenses:**
• "I spent 200 on food today"
• "Add 1500 for electricity bill"

Try asking me anything about your expenses in natural language! I understand various ways of asking the same question.`;
  };

  const getCategoryIcon = (category: Category): string => {
    const icons: Record<Category, string> = {
      'Food': '🍽️',
      'Travel': '✈️',
      'Shopping': '🛍️',
      'Bills': '📄',
      'Entertainment': '🎬',
      'Health': '🏥',
      'Education': '📚',
      'Investment': '📈',
      'Miscellaneous': '📦'
    };
    return icons[category] || '📊';
  };

  // Generate contextual follow-up questions based on the last AI response
  const getFollowUpQuestions = (lastBotMessage: string, userMessage: string): string[] => {
    const lowerBotMessage = lastBotMessage.toLowerCase();
    const lowerUserMessage = userMessage.toLowerCase();
    
    // If user asked about a specific category, suggest related questions
    if (lowerUserMessage.includes('health') || lowerBotMessage.includes('health')) {
      return [
        "Which hospital did I pay the most to?",
        "Show me all health transactions this year",
        "Compare my health expenses to last month",
        "What's my average medical expense?"
      ];
    }
    
    if (lowerUserMessage.includes('food') || lowerBotMessage.includes('food')) {
      return [
        "Which restaurant did I spend most at?",
        "How much do I spend on food daily?",
        "Show me my delivery vs dining out expenses",
        "Compare food spending to last month"
      ];
    }
    
    if (lowerUserMessage.includes('travel') || lowerBotMessage.includes('travel')) {
      return [
        "How much did I spend on cab rides?",
        "Show me my travel expenses breakdown",
        "Compare Uber vs Ola spending",
        "What's my monthly travel budget?"
      ];
    }
    
    if (lowerUserMessage.includes('shopping') || lowerBotMessage.includes('shopping')) {
      return [
        "How much did I spend on Amazon?",
        "Show me my online vs offline shopping",
        "What's my biggest shopping expense?",
        "Compare shopping expenses to last month"
      ];
    }
    
    // If user asked about spending analysis, suggest drill-downs
    if (lowerUserMessage.includes('where') || lowerUserMessage.includes('most') || lowerBotMessage.includes('spent the most')) {
      return [
        "Show me detailed breakdown by merchant",
        "How much did I spend on the top category?",
        "Give me daily spending pattern",
        "What can I do to reduce this spending?"
      ];
    }
    
    // If user asked about totals or summaries, suggest comparisons
    if (lowerUserMessage.includes('total') || lowerUserMessage.includes('summary') || lowerBotMessage.includes('total spending')) {
      return [
        "Compare this to last month",
        "Show me spending trends over time",
        "Which category increased the most?",
        "Give me budget suggestions"
      ];
    }
    
    // If user added an expense, suggest related actions
    if (lowerUserMessage.includes('spent') || lowerUserMessage.includes('add') || lowerBotMessage.includes('added')) {
      return [
        "Show me today's expenses",
        "How much have I spent this week?",
        "What's my spending in this category?",
        "Set a budget reminder for this category"
      ];
    }
    
    // Default follow-up questions
    return [
      "Where did I spend the most this month?",
      "Show me my food expenses breakdown",
      "Give me a monthly summary",
      "How can I save money?",
      "Compare to previous month",
      "Show me payment method breakdown"
    ];
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: inputMessage,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage; // Store before clearing
    setInputMessage('');
    setIsTyping(true);

    // Simulate AI processing time
    setTimeout(() => {
      const aiResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: generateAIResponse(currentInput),
        sender: 'bot',
        timestamp: new Date(),
        followUpQuestions: getFollowUpQuestions(generateAIResponse(currentInput), currentInput)
      };

      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
      
      // Show toast for AI response
      showToast({
        type: 'success',
        title: 'AI Response Ready',
        message: 'Your AI assistant has analyzed your request'
      });
    }, 800 + Math.random() * 1200);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessage = (text: string) => {
    // Enhanced markdown-like formatting
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br />');
  };

  const suggestedQuestions = [
    "How much did I spend on food last 2 months?",
    "What's the hospital I paid the most to?",
    "Where did I spend the most money?",
    "Show me my total spending this month",
    "Which restaurant did I spend most at?",
    "I transferred 1000 rupees last week, who was it?",
    "Give me a spending summary",
    "Show me payment method breakdown",
    "What categories did I spend on?",
    "Give me budget suggestions"
  ];

  return (
    <div className="space-y-8 h-full">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            AI Assistant
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Analyzing:</span>
            <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium">
              {monthRange === 'all' ? 'All Time' : monthRange === '1m' ? 'This Month' : `Last ${monthRange.replace('m', '')} Months`}
            </span>
          </div>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Chat with your AI assistant to get insights about your expenses. Ask complex questions in natural language!
        </p>
      </div>

      <div className="flex flex-col h-[calc(100vh-250px)] bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-gray-700">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((message, messageIndex) => (
            <div key={message.id}>
              <div
                className={`flex items-start space-x-3 ${
                  message.sender === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.sender === 'bot' && (
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                
                <div
                  className={`max-w-lg px-4 py-3 rounded-2xl ${
                    message.sender === 'user'
                      ? 'bg-gradient-to-r from-emerald-500 to-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                  }`}
                >
                  <div
                    className="text-sm whitespace-pre-line"
                    dangerouslySetInnerHTML={{ __html: formatMessage(message.text) }}
                  />
                  <div className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {message.sender === 'user' && (
                  <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
              
              {/* Show follow-up questions after bot messages (except the initial welcome message) */}
              {message.sender === 'bot' && messageIndex > 0 && message.followUpQuestions && (
                <div className="mt-3 ml-11">
                  <div className="flex items-center space-x-2 mb-2">
                    <Sparkles className="w-3 h-3 text-purple-500" />
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Related questions:
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {message.followUpQuestions.slice(0, 4).map((question, index) => (
                      <button
                        key={`${message.id}-followup-${index}`}
                        onClick={() => setInputMessage(question)}
                        className="px-2 py-1 text-xs bg-purple-50 dark:bg-purple-900/10 text-purple-700 dark:text-purple-400 rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/20 transition-colors duration-200 border border-purple-200 dark:border-purple-800"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex items-start space-x-3 justify-start">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-gray-100 dark:bg-gray-700 px-4 py-3 rounded-2xl">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Questions */}
        {messages.length === 1 && (
          <div className="px-6 pb-4">
            <div className="flex items-center space-x-2 mb-3">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Try asking complex questions:
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {suggestedQuestions.map((question) => (
                <button
                  key={question}
                  onClick={() => setInputMessage(question)}
                  className="px-3 py-2 text-sm bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/30 transition-colors duration-200 text-left"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="flex space-x-4">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything about your expenses in natural language..."
              disabled={isTyping}
              className="flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50 transition-all duration-200"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isTyping}
              className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-blue-600 text-white rounded-xl hover:from-emerald-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-200 shadow-lg"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChat;