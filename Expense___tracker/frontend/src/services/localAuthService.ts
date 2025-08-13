// Local Authentication Service - replaces Supabase
const API_BASE_URL = 'http://localhost:5000/api';

export interface User {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
}

export interface Transaction {
  id?: number;
  date: string;
  merchant: string;
  type: string;
  amount: number;
  category?: string;
  platform?: string;
  createdAt?: string;
}

export class LocalAuthService {
  private static async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      credentials: 'include', // Important for session cookies
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    
    return data;
  }

  // Authentication methods
  static async signUp(email: string, password: string, displayName?: string): Promise<AuthResponse> {
    try {
      const data = await this.makeRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, displayName }),
      });
      
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  static async signIn(email: string, password: string): Promise<AuthResponse> {
    try {
      const data = await this.makeRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  static async signOut(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.makeRequest('/auth/logout', {
        method: 'POST',
      });
      
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  static async getCurrentUser(): Promise<{ user: User | null; error?: string }> {
    try {
      const data = await this.makeRequest('/auth/user');
      return { user: data.user };
    } catch (error) {
      // User not authenticated
      return { user: null };
    }
  }

  // Transaction methods
  static async getTransactions(): Promise<{ transactions: Transaction[]; error?: string }> {
    try {
      const data = await this.makeRequest('/transactions');
      return { transactions: data.transactions };
    } catch (error) {
      return { transactions: [], error: (error as Error).message };
    }
  }

  static async addTransactions(transactions: Transaction[]): Promise<{ success: boolean; error?: string }> {
    try {
      await this.makeRequest('/transactions', {
        method: 'POST',
        body: JSON.stringify({ transactions }),
      });
      
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  static async deleteTransaction(transactionId: number): Promise<{ success: boolean; error?: string }> {
    try {
      await this.makeRequest(`/transactions/${transactionId}`, {
        method: 'DELETE',
      });
      
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // PDF Processing methods
  static async processPhonePePDF(file: File): Promise<{ success: boolean; transactions?: Transaction[]; error?: string }> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/process-phonepe-pdf`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Processing failed');
      }

      return { success: true, transactions: data.transactions };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  static async processPaytmPDF(file: File): Promise<{ success: boolean; transactions?: Transaction[]; error?: string }> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/process-paytm-pdf`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Processing failed');
      }

      return { success: true, transactions: data.transactions };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  // Health check
  static async healthCheck(): Promise<{ status: string; message: string }> {
    try {
      const data = await fetch(`${API_BASE_URL}/health`).then(r => r.json());
      return data;
    } catch (error) {
      return { status: 'error', message: 'Backend not available' };
    }
  }
}
