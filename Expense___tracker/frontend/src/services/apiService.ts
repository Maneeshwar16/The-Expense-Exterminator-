import { Transaction, Category } from '../types'

// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'

// API endpoints
const ENDPOINTS = {
  // File processing
  UPLOAD_FILE: '/upload-file',
  PROCESS_PHONEPE_PDF: '/process-phonepe-pdf',
  PROCESS_PAYTM_PDF: '/process-paytm-pdf',
  
  // Transactions
  TRANSACTIONS: '/api/transactions',
  TRANSACTION: (id: string) => `/api/transactions/${id}`,
  
  // Categories
  CATEGORIES: '/api/categories',
  CATEGORY: (id: string) => `/api/categories/${id}`,
  
  // User preferences
  USER_PREFERENCES: '/api/user-preferences',
  
  // Authentication
  AUTH_LOGIN: '/api/auth/login',
  AUTH_REGISTER: '/api/auth/register',
  AUTH_LOGOUT: '/api/auth/logout',
  AUTH_PROFILE: '/api/auth/profile',
  
  // Health check
  HEALTH: '/health'
} as const

// Helper function for API calls
async function apiCall<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Include cookies for session management
    ...options,
  }

  try {
    const response = await fetch(url, defaultOptions)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }
    
    return await response.json()
  } catch (error) {
    console.error(`API call failed for ${endpoint}:`, error)
    throw error
  }
}

export class ApiService {
  // File Processing Methods
  static async uploadFile(file: File, fileType: 'pdf' | 'excel' | 'csv') {
    const formData = new FormData()
    formData.append('file', file)
    
    const url = `${API_BASE_URL}${ENDPOINTS.UPLOAD_FILE}`
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Upload failed: ${response.status}`)
    }
    
    return await response.json()
  }

  static async processPhonePePDF(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    
    const url = `${API_BASE_URL}${ENDPOINTS.PROCESS_PHONEPE_PDF}`
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `PhonePe processing failed: ${response.status}`)
    }
    
    return await response.json()
  }

  static async processPaytmPDF(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    
    const url = `${API_BASE_URL}${ENDPOINTS.PROCESS_PAYTM_PDF}`
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    })
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Paytm processing failed: ${response.status}`)
    }
    
    return await response.json()
  }

  // Transaction Methods
  static async getTransactions(): Promise<Transaction[]> {
    return apiCall<Transaction[]>(ENDPOINTS.TRANSACTIONS)
  }

  static async addTransaction(transaction: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Transaction> {
    return apiCall<Transaction>(ENDPOINTS.TRANSACTIONS, {
      method: 'POST',
      body: JSON.stringify(transaction),
    })
  }

  static async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    return apiCall<Transaction>(ENDPOINTS.TRANSACTION(id), {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  static async deleteTransaction(id: string): Promise<void> {
    return apiCall<void>(ENDPOINTS.TRANSACTION(id), {
      method: 'DELETE',
    })
  }

  static async bulkAddTransactions(transactions: Omit<Transaction, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[]): Promise<Transaction[]> {
    return apiCall<Transaction[]>(`${ENDPOINTS.TRANSACTIONS}/bulk`, {
      method: 'POST',
      body: JSON.stringify({ transactions }),
    })
  }

  // Category Methods
  static async getCategories(): Promise<Category[]> {
    return apiCall<Category[]>(ENDPOINTS.CATEGORIES)
  }

  static async addCategory(category: Omit<Category, 'id'>): Promise<Category> {
    return apiCall<Category>(ENDPOINTS.CATEGORIES, {
      method: 'POST',
      body: JSON.stringify(category),
    })
  }

  static async updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
    return apiCall<Category>(ENDPOINTS.CATEGORY(id), {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  static async deleteCategory(id: string): Promise<void> {
    return apiCall<void>(ENDPOINTS.CATEGORY(id), {
      method: 'DELETE',
    })
  }

  // Authentication Methods
  static async login(email: string, password: string): Promise<{ user: any; token?: string }> {
    return apiCall<{ user: any; token?: string }>(ENDPOINTS.AUTH_LOGIN, {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  }

  static async register(email: string, password: string, name: string): Promise<{ user: any; token?: string }> {
    return apiCall<{ user: any; token?: string }>(ENDPOINTS.AUTH_REGISTER, {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    })
  }

  static async logout(): Promise<void> {
    return apiCall<void>(ENDPOINTS.AUTH_LOGOUT, {
      method: 'POST',
    })
  }

  static async getCurrentUser(): Promise<any> {
    return apiCall<any>(ENDPOINTS.AUTH_PROFILE)
  }

  // User Preferences Methods
  static async getUserPreferences(): Promise<any> {
    return apiCall<any>(ENDPOINTS.USER_PREFERENCES)
  }

  static async updateUserPreferences(preferences: any): Promise<any> {
    return apiCall<any>(ENDPOINTS.USER_PREFERENCES, {
      method: 'PUT',
      body: JSON.stringify(preferences),
    })
  }

  // Health Check
  static async healthCheck(): Promise<{ status: string; service: string }> {
    return apiCall<{ status: string; service: string }>(ENDPOINTS.HEALTH)
  }
}
