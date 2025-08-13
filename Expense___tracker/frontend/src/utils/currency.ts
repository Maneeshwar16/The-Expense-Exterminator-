/**
 * Utility functions for currency formatting
 */

/**
 * Format amount as Indian Rupees with proper locale
 */
export const formatCurrency = (amount: number): string => {
  return `₹${Math.abs(amount).toLocaleString('en-IN')}`;
};

/**
 * Format amount with sign (+ or -) and Indian Rupees
 */
export const formatCurrencyWithSign = (amount: number): string => {
  const sign = amount >= 0 ? '+' : '-';
  return `₹${Math.abs(amount).toLocaleString('en-IN')}`;
};

/**
 * Format amount as Indian Rupees without symbol (just numbers)
 */
export const formatAmount = (amount: number): string => {
  return Math.abs(amount).toLocaleString('en-IN');
};
