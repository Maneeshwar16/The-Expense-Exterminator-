export interface Transaction {
  type: string;
  id: string;
  userId: string;
  date: string;
  amount: number;
  category: Category;
  merchant: string;
  paymentMode: 'Cash' | 'UPI';
  notes?: string;
  source: 'manual' | 'csv' | 'phonpe' | 'gpay' | 'paytm';
  createdAt: Date;
  updatedAt: Date;
}

export type Category = 
  | 'Food' 
  | 'Travel' 
  | 'Shopping' 
  | 'Bills' 
  | 'Entertainment' 
  | 'Health' 
  | 'Education' 
  | 'Investment' 
  | 'Miscellaneous';

export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: Date;
}

export interface AIInsight {
  type: 'overspending' | 'trend' | 'prediction' | 'suggestion';
  title: string;
  description: string;
  value?: number;
  previousValue?: number;
  category?: Category;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

export interface FileUploadResult {
  fileName: string;
  transactionCount: number;
  errors: string[];
}