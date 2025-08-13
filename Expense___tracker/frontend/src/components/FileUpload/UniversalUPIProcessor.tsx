import React, { useState, useEffect } from 'react';
import { Upload, FileImage, AlertCircle, CheckCircle, Download, Trash2, Eye, Smartphone, CreditCard, TrendingUp } from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

// Mock context for demonstration
const useExpenses = () => ({
  uploadFiles: (transactions: ProcessedTransaction[]) => {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('Uploaded transactions:', transactions);
        resolve(transactions);
      }, 1000);
    });
  },
  monthRange: '3m'
});

interface ProcessedTransaction {
  date: string;
  amount: number;
  description: string;
  category: string;
  paymentMode: string;
  merchant: string;
  app?: string;
}

interface ProcessingResult {
  transactions: ProcessedTransaction[];
  errors: string[];
  warnings: string[];
}

interface UPIFile {
  id: string;
  file: File;
  name: string;
  size: string;
  detectedApp?: string;
  appName?: string;
  status: 'pending' | 'detecting' | 'detected' | 'processing' | 'completed' | 'error';
  transactions?: ProcessedTransaction[];
  error?: string;
  preview?: string;
}

interface SupportedApp {
  key: string;
  name: string;
  identifiers: string[];
}

// Enhanced date parsing function
function parseDate(dateStr: string): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  const cleanDateStr = dateStr.trim().replace(/^(Date|Dt|D):\s*/i, '');
  if (!cleanDateStr) return null;
  
  // Handle various date formats
  const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  
  // Pattern: "Aug 09, 2025" or "09 Aug, 2025"
  let monthMatch = cleanDateStr.match(/^(\w{3})\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (monthMatch) {
    const [, monthStr, day, year] = monthMatch;
    const monthIndex = monthNames.findIndex(m => monthStr.toLowerCase().startsWith(m));
    if (monthIndex !== -1) {
      const date = new Date(parseInt(year), monthIndex, parseInt(day));
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }
  
  // Pattern: "09 Aug, 2025"
  monthMatch = cleanDateStr.match(/^(\d{1,2})\s+(\w{3}),?\s+(\d{4})$/i);
  if (monthMatch) {
    const [, day, monthStr, year] = monthMatch;
    const monthIndex = monthNames.findIndex(m => monthStr.toLowerCase().startsWith(m));
    if (monthIndex !== -1) {
      const date = new Date(parseInt(year), monthIndex, parseInt(day));
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }
  
  // Try standard formats
  const formats = ['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd', 'dd-MM-yyyy'];
  for (const format of formats) {
    try {
      const normalizedStr = cleanDateStr.replace(/[\/\-\.]/g, '/');
      const parts = normalizedStr.split('/');
      
      if (parts.length === 3) {
        let day, month, year;
        
        if (format.startsWith('dd')) {
          [day, month, year] = parts;
        } else if (format.startsWith('MM')) {
          [month, day, year] = parts;
        } else {
          [year, month, day] = parts;
        }
        
        if (year.length === 2) {
          year = parseInt(year) < 50 ? '20' + year : '19' + year;
        }
        
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (date.getFullYear() === parseInt(year) && 
            date.getMonth() === parseInt(month) - 1 && 
            date.getDate() === parseInt(day)) {
          return date.toISOString().split('T')[0];
        }
      }
    } catch (error) {
      continue;
    }
  }
  
  return null;
}

// Enhanced amount parsing function
function parseAmount(amountStr: string): number | null {
  if (!amountStr || typeof amountStr !== 'string') return null;
  
  const cleanAmountStr = amountStr.trim().replace(/^(Amount|Amt|Debit|Credit):\s*/i, '');
  if (!cleanAmountStr) return null;
  
  try {
    let processedStr = cleanAmountStr
      .replace(/^(rs\.?|inr|₹)\s*/i, '')
      .replace(/\s*(rs\.?|inr|₹)$/i, '')
      .replace(/\s*cr\.?$/i, '')
      .replace(/\s*dr\.?$/i, '')
      .replace(/\s*(debit|credit|paid|received|balance|amount)$/i, '')
      .trim();
    
    let isNegative = false;
    if (processedStr.includes('dr') || processedStr.includes('debit') || 
        processedStr.includes('-') || processedStr.includes('(')) {
      isNegative = true;
      processedStr = processedStr.replace(/[()]/g, '').replace(/dr|debit/gi, '').trim();
    }
    
    const numericStr = processedStr.replace(/,/g, '');
    const amount = parseFloat(numericStr);
    
    if (isNaN(amount)) return null;
    
    return isNegative ? -Math.abs(amount) : Math.abs(amount);
  } catch (error) {
    return null;
  }
}

// Transaction categorization
function categorizeTransaction(description: string, merchant?: string): string {
  const text = (description + ' ' + (merchant || '')).toLowerCase();
  
  if (text.includes('swiggy') || text.includes('zomato') || text.includes('restaurant') || 
      text.includes('food') || text.includes('cafe') || text.includes('mcdonalds') ||
      text.includes('kfc') || text.includes('domino') || text.includes('pizza')) {
    return 'Food';
  }
  
  if (text.includes('uber') || text.includes('ola') || text.includes('metro') || 
      text.includes('petrol') || text.includes('fuel') || text.includes('rapido') ||
      text.includes('ride') || text.includes('taxi') || text.includes('cab')) {
    return 'Travel';
  }
  
  if (text.includes('amazon') || text.includes('flipkart') || text.includes('shopping') || 
      text.includes('mall') || text.includes('store') || text.includes('clothes')) {
    return 'Shopping';
  }
  
  if (text.includes('electricity') || text.includes('jio') || text.includes('airtel') || 
      text.includes('recharge') || text.includes('bill') || text.includes('rent') ||
      text.includes('water') || text.includes('gas')) {
    return 'Bills';
  }
  
  if (text.includes('hospital') || text.includes('clinic') || text.includes('pharma') ||
      text.includes('medicine') || text.includes('doctor') || text.includes('medical')) {
    return 'Health';
  }
  
  if (text.includes('movie') || text.includes('netflix') || text.includes('spotify') ||
      text.includes('entertainment') || text.includes('game')) {
    return 'Entertainment';
  }
  
  return 'Miscellaneous';
}

// File processing functions
async function processCSV(file: File): Promise<ProcessingResult> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (results: any) => {
        const transactions: ProcessedTransaction[] = [];
        const errors: string[] = [];
        const warnings: string[] = [];
        
        if (!results.data || !Array.isArray(results.data)) {
          resolve({ transactions: [], errors: ['Invalid CSV format'], warnings: [] });
          return;
        }
        
        const dateColumns = ['date', 'dt', 'transaction_date', 'date_time', 'time'];
        const amountColumns = ['amount', 'amt', 'debit', 'credit', 'transaction_amount'];
        const descColumns = ['description', 'desc', 'narration', 'remarks', 'particulars'];
        
        results.data.forEach((row: any, index: number) => {
          try {
            let dateStr = '', amountStr = '', description = '';
            
            for (const col of dateColumns) {
              if (row[col]) { dateStr = row[col]; break; }
            }
            for (const col of amountColumns) {
              if (row[col]) { amountStr = row[col]; break; }
            }
            for (const col of descColumns) {
              if (row[col]) { description = row[col]; break; }
            }
            
            const date = parseDate(dateStr);
            const amount = parseAmount(amountStr);
            
            if (date && amount !== null) {
              transactions.push({
                date,
                amount,
                description: description || 'Unknown transaction',
                category: categorizeTransaction(description),
                paymentMode: 'UPI',
                merchant: description.split(' ')[0] || 'Unknown'
              });
            }
          } catch (error) {
            errors.push(`Row ${index + 1}: ${error}`);
          }
        });
        
        resolve({ transactions, errors, warnings });
      }
    });
  });
}

async function processExcel(file: File): Promise<ProcessingResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        if (jsonData.length < 2) {
          resolve({ transactions: [], errors: ['Excel file must have header and data rows'], warnings: [] });
          return;
        }
        
        const headers = jsonData[0] as string[];
        const transactions: ProcessedTransaction[] = [];
        const errors: string[] = [];
        const warnings: string[] = [];
        
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0) continue;
          
          try {
            // Try to find date, amount, and description columns
            let date = null, amount = null, description = '';
            
            for (let j = 0; j < headers.length && j < row.length; j++) {
              const header = headers[j]?.toString().toLowerCase();
              const cellValue = row[j];
              
              if (header && cellValue) {
                if (header.includes('date') || header.includes('time')) {
                  date = parseDate(cellValue.toString());
                } else if (header.includes('amount') || header.includes('debit') || header.includes('credit')) {
                  amount = parseAmount(cellValue.toString());
                } else if (header.includes('description') || header.includes('narration') || header.includes('particular')) {
                  description = cellValue.toString();
                }
              }
            }
            
            if (date && amount !== null) {
              transactions.push({
                date,
                amount,
                description: description || 'Unknown transaction',
                category: categorizeTransaction(description),
                paymentMode: 'UPI',
                merchant: description.split(' ')[0] || 'Unknown'
              });
            }
          } catch (error) {
            errors.push(`Row ${i + 1}: ${error}`);
          }
        }
        
        resolve({ transactions, errors, warnings });
      } catch (error) {
        resolve({ transactions: [], errors: [`Excel processing error: ${error}`], warnings: [] });
      }
    };
    
    reader.readAsArrayBuffer(file);
  });
}

async function processPDF(file: File): Promise<ProcessingResult> {
  // For PDF processing, we'll return a mock result since PDF.js setup is complex
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        transactions: [],
        errors: [],
        warnings: ['PDF processing requires backend support. Please convert to CSV/Excel format.']
      });
    }, 1000);
  });
}

const UniversalUPIProcessor = () => {
  const { uploadFiles, monthRange } = useExpenses();
  const [files, setFiles] = useState<UPIFile[]>([]);
  const [supportedApps] = useState<SupportedApp[]>([
    { key: 'phonepe', name: 'PhonePe', identifiers: ['phonepe'] },
    { key: 'gpay', name: 'Google Pay', identifiers: ['google pay', 'gpay'] },
    { key: 'paytm', name: 'Paytm', identifiers: ['paytm'] },
    { key: 'amazonpay', name: 'Amazon Pay', identifiers: ['amazon pay'] },
    { key: 'mobikwik', name: 'MobiKwik', identifiers: ['mobikwik'] },
    { key: 'freecharge', name: 'FreeCharge', identifiers: ['freecharge'] }
  ]);
  const [allTransactions, setAllTransactions] = useState<ProcessedTransaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    const newFiles: UPIFile[] = selectedFiles
      .filter(file => 
        file.type === 'text/csv' || 
        file.type.includes('excel') || 
        file.type.includes('spreadsheet') ||
        file.name.toLowerCase().endsWith('.csv') ||
        file.name.toLowerCase().endsWith('.xlsx') ||
        file.name.toLowerCase().endsWith('.xls') ||
        file.type === 'application/pdf'
      )
      .map(file => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        name: file.name,
        size: formatFileSize(file.size),
        status: 'pending' as const
      }));

    if (newFiles.length !== selectedFiles.length) {
      alert('Some files were skipped. Only CSV, Excel, and PDF files are supported.');
    }

    setFiles(prev => [...prev, ...newFiles]);
    
    // Auto-detect and process files
    newFiles.forEach(fileItem => detectAndProcessFile(fileItem.id));
    
    // Clear input
    e.target.value = '';
  };

  const detectAndProcessFile = async (fileId: string) => {
    const fileItem = files.find(f => f.id === fileId);
    if (!fileItem) return;

    // Update status to detecting
    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, status: 'detecting' } : f
    ));

    try {
      // Detect app based on filename
      let detectedApp = 'unknown';
      let appName = 'Unknown App';
      
      const fileName = fileItem.name.toLowerCase();
      if (fileName.includes('phonepe')) {
        detectedApp = 'phonepe';
        appName = 'PhonePe';
      } else if (fileName.includes('gpay') || fileName.includes('googlepay')) {
        detectedApp = 'gpay';
        appName = 'Google Pay';
      } else if (fileName.includes('paytm')) {
        detectedApp = 'paytm';
        appName = 'Paytm';
      }

      // Update status to detected
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { 
          ...f, 
          status: 'detected',
          detectedApp,
          appName
        } : f
      ));

      // Auto-process the file
      await processFile(fileId);
    } catch (error) {
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { 
          ...f, 
          status: 'error', 
          error: `Detection failed: ${error}` 
        } : f
      ));
    }
  };

  const processFile = async (fileId: string) => {
    const fileItem = files.find(f => f.id === fileId);
    if (!fileItem) return;

    setFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, status: 'processing' } : f
    ));

    try {
      let result: ProcessingResult;
      
      const fileName = fileItem.name.toLowerCase();
      if (fileName.endsWith('.csv')) {
        result = await processCSV(fileItem.file);
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        result = await processExcel(fileItem.file);
      } else if (fileName.endsWith('.pdf')) {
        result = await processPDF(fileItem.file);
      } else {
        throw new Error('Unsupported file format');
      }

      if (result.transactions.length > 0) {
        const processedTransactions = result.transactions.map(tx => ({
          ...tx,
          app: fileItem.appName || 'Unknown'
        }));

        setFiles(prev => prev.map(f => 
          f.id === fileId ? { 
            ...f, 
            status: 'completed',
            transactions: processedTransactions
          } : f
        ));

        setAllTransactions(prev => [...prev, ...processedTransactions]);
      } else {
        setFiles(prev => prev.map(f => 
          f.id === fileId ? { 
            ...f, 
            status: 'error', 
            error: result.errors[0] || 'No transactions found'
          } : f
        ));
      }
    } catch (error) {
      setFiles(prev => prev.map(f => 
        f.id === fileId ? { 
          ...f, 
          status: 'error', 
          error: `Processing failed: ${error}`
        } : f
      ));
    }
  };

  const removeFile = (fileId: string) => {
    const fileItem = files.find(f => f.id === fileId);
    if (fileItem?.transactions) {
      // Remove transactions from allTransactions
      setAllTransactions(prev => 
        prev.filter(tx => !fileItem.transactions?.some(fileTx => 
          fileTx.date === tx.date && fileTx.amount === tx.amount && fileTx.description === tx.description
        ))
      );
    }
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'detecting': return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'detected': return <Eye className="w-4 h-4 text-blue-500" />;
      case 'processing': return <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending Detection';
      case 'detecting': return 'Detecting App...';
      case 'detected': return 'Ready to Process';
      case 'processing': return 'Processing...';
      case 'completed': return 'Completed';
      case 'error': return 'Error';
      default: return status;
    }
  };

  const handleUploadToExpenseTracker = async () => {
    if (allTransactions.length === 0) return;
    
    setIsUploading(true);
    try {
      await uploadFiles(allTransactions);
      alert(`Successfully uploaded ${allTransactions.length} transactions to Expense Tracker!`);
      // Clear all files and transactions after successful upload
      setFiles([]);
      setAllTransactions([]);
    } catch (error) {
      alert(`Upload failed: ${error}`);
    } finally {
      setIsUploading(false);
    }
  };

  const totalSpent = allTransactions
    .filter(tx => tx.amount < 0)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const totalReceived = allTransactions
    .filter(tx => tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0);

  const categoryBreakdown = allTransactions.reduce((acc, tx) => {
    if (tx.amount < 0) { // Only count expenses
      acc[tx.category] = (acc[tx.category] || 0) + Math.abs(tx.amount);
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Universal UPI Processor
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Month Range:</span>
            <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium">
              {monthRange === 'all' ? 'All Time' : monthRange === '1m' ? 'This Month' : `Last ${monthRange.replace('m', '')} Months`}
            </span>
          </div>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Upload CSV, Excel, or PDF files from different UPI apps. Each file will be automatically processed and categorized.
        </p>
      </div>

      {/* Supported Apps */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
          <Smartphone className="w-5 h-5" />
          Supported UPI Apps & Formats
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">UPI Apps</h4>
            <div className="grid grid-cols-2 gap-2">
              {supportedApps.map((app) => (
                <div key={app.key} className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-2 backdrop-blur-sm text-sm">
                  {app.name}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">File Formats</h4>
            <div className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
              <div>• CSV files (.csv)</div>
              <div>• Excel files (.xlsx, .xls)</div>
              <div>• PDF files (.pdf) - with limitations</div>
            </div>
          </div>
        </div>
      </div>

      {/* File Upload */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Files
          </h3>
          <div className="flex items-center gap-2">
            <input
              type="file"
              multiple
              accept=".csv,.xlsx,.xls,.pdf"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors flex items-center gap-2"
            >
              <FileImage className="w-4 h-4" />
              Select Files
            </label>
          </div>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-3">
            {files.map((fileItem) => (
              <div
                key={fileItem.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex-shrink-0">
                    {getStatusIcon(fileItem.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white truncate">
                        {fileItem.name}
                      </span>
                      {fileItem.appName && (
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs">
                          {fileItem.appName}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {fileItem.size} • {getStatusText(fileItem.status)}
                    </div>
                    {fileItem.error && (
                      <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                        {fileItem.error}
                      </div>
                    )}
                    {fileItem.status === 'completed' && fileItem.transactions && (
                      <div className="text-sm text-green-600 dark:text-green-400 mt-1">
                        Found {fileItem.transactions.length} transactions
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => removeFile(fileItem.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Remove file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No Files Message */}
        {files.length === 0 && (
          <div className="text-center py-12">
            <FileImage className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No files uploaded yet. Select files to get started.
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Supported formats: CSV, Excel (.xlsx, .xls), PDF
            </p>
          </div>
        )}
      </div>

      {/* Transactions Summary */}
      {allTransactions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Transactions Summary
            </h3>
            <button
              onClick={handleUploadToExpenseTracker}
              disabled={isUploading}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2 font-medium"
            >
              {isUploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Upload to Expense Tracker
                </>
              )}
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
              <div className="text-sm text-red-600 dark:text-red-400">Total Spent</div>
              <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                ₹{totalSpent.toLocaleString()}
              </div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <div className="text-sm text-green-600 dark:text-green-400">Total Received</div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                ₹{totalReceived.toLocaleString()}
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-sm text-blue-600 dark:text-blue-400">Total Transactions</div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {allTransactions.length}
              </div>
            </div>
          </div>

          {/* Category-wise Breakdown */}
          <div className="mb-6">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Expense Categories</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(categoryBreakdown).map(([category, amount]) => (
                <div key={category} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
                        {category.charAt(0)}
                      </span>
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white text-sm">{category}</span>
                  </div>
                  <span className="text-sm text-red-600 dark:text-red-400 font-medium">
                    ₹{amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Transactions Preview */}
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">Recent Transactions</h4>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {allTransactions.slice(-10).reverse().map((tx, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white text-sm">
                        {tx.description}
                      </span>
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs">
                        {tx.category}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {tx.date} • {tx.app || tx.paymentMode}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${tx.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      {tx.amount < 0 ? '-' : '+'}₹{Math.abs(tx.amount).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
              {allTransactions.length > 10 && (
                <div className="text-center py-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Showing last 10 of {allTransactions.length} transactions
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
        <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-3 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          How to Use
        </h3>
        <div className="space-y-2 text-amber-800 dark:text-amber-200 text-sm">
          <p><strong>Step 1:</strong> Download transaction statements from your UPI apps (PhonePe, GPay, Paytm, etc.)</p>
          <p><strong>Step 2:</strong> Upload the files using the "Select Files" button above</p>
          <p><strong>Step 3:</strong> Files will be automatically processed and transactions extracted</p>
          <p><strong>Step 4:</strong> Review the summary and click "Upload to Expense Tracker" to save</p>
        </div>
        <div className="mt-4 p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
          <p className="text-amber-800 dark:text-amber-200 text-sm">
            <strong>Best Results:</strong> Use CSV or Excel formats when available. PDF files may have limited support and require text-based (not image-based) PDFs.
          </p>
        </div>
      </div>
    </div>
  );
};

export default UniversalUPIProcessor;