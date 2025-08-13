// --- CORRECTED api/auth.ts ---

import { Transaction, Category, User } from '../types' // Assuming you have a types file

// CORRECTED: Use environment variable for production, with a fallback for local development
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const ENDPOINTS = {
  // File processing (Note: These are at the root, not under /api)
  PROCESS_PHONEPE_PDF: '/process-phonepe-pdf',
  PROCESS_PAYTM_PDF: '/process-paytm-pdf',
  
  // API routes
  TRANSACTIONS: '/api/transactions',
  TRANSACTION_BULK: '/api/transactions/bulk',
  TRANSACTION_DETAIL: (id: string) => `/api/transactions/${id}`,
  
  CATEGORIES: '/api/categories',
  CATEGORY_DETAIL: (id: string) => `/api/categories/${id}`,
  
  USER_PREFERENCES: '/api/user-preferences',
  
  // CORRECTED: Authentication endpoint names
  AUTH_LOGIN: '/api/auth/login',
  AUTH_REGISTER: '/api/auth/register',
  AUTH_LOGOUT: '/api/auth/logout',
  AUTH_PROFILE: '/api/auth/profile', // Corrected from /user to /profile
  
  HEALTH: '/health'
} as const;

// Helper function for making API calls
async function apiCall<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Essential for session cookies
    ...options,
  };

  const response = await fetch(url, defaultOptions);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    // Use the specific error message from the backend if it exists
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }
  
  // For DELETE requests or others that might not have a body
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return null as T;
  }

  return response.json();
}

// A separate helper for file uploads which use FormData
async function fileApiCall<T>(endpoint: string, file: File): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `File upload failed: ${response.status}`);
    }
    return response.json();
}


export class ApiService {
  // --- Authentication Methods ---
  static async register(email: string, password: string, name: string): Promise<{ user: User }> {
    // CORRECTED: Sending 'name' instead of 'displayName'
    return apiCall<{ user: User }>(ENDPOINTS.AUTH_REGISTER, {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  static async login(email: string, password: string): Promise<{ user: User }> {
    return apiCall<{ user: User }>(ENDPOINTS.AUTH_LOGIN, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  static async logout(): Promise<{ message: string }> {
    return apiCall<{ message: string }>(ENDPOINTS.AUTH_LOGOUT, {
      method: 'POST',
    });
  }

  static async getCurrentUser(): Promise<{ user: User | null }> {
    try {
      // CORRECTED: Using the correct profile endpoint
      return await apiCall<{ user: User }>(ENDPOINTS.AUTH_PROFILE);
    } catch (error) {
      // A 401 error is expected if the user is not logged in
      return { user: null };
    }
  }

  // --- Transaction Methods ---
  static async getTransactions(): Promise<Transaction[]> {
    return apiCall<Transaction[]>(ENDPOINTS.TRANSACTIONS);
  }
  
  static async bulkAddTransactions(transactions: Partial<Transaction>[]): Promise<Transaction[]> {
    // CORRECTED: Using the correct bulk endpoint
    return apiCall<Transaction[]>(ENDPOINTS.TRANSACTION_BULK, {
        method: 'POST',
        body: JSON.stringify({ transactions }),
    });
  }

  static async deleteTransaction(id: string): Promise<void> {
    await apiCall<null>(ENDPOINTS.TRANSACTION_DETAIL(id), {
        method: 'DELETE'
    });
  }

  // --- File Processing Methods ---
  static async processPhonePePDF(file: File): Promise<{ transactions: Transaction[] }> {
    return fileApiCall<{ transactions: Transaction[] }>(ENDPOINTS.PROCESS_PHONEPE_PDF, file);
  }

  static async processPaytmPDF(file: File): Promise<{ transactions: Transaction[] }> {
    return fileApiCall<{ transactions: Transaction[] }>(ENDPOINTS.PROCESS_PAYTM_PDF, file);
  }

  // --- Health Check ---
  static async healthCheck(): Promise<{ status: string }> {
    return apiCall<{ status: string }>(ENDPOINTS.HEALTH);
  }
}