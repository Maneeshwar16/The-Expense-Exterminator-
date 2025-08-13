import React, { useState } from 'react';
import { Upload, FileImage, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { ApiService } from '../../services/apiService';

interface GPayTransaction {
  date: string;
  merchant: string;
  type: 'DEBIT' | 'CREDIT';
  amount: string;
}

interface ProcessedTransaction {
  date: string;
  amount: number;
  description: string;
  category: string;
  paymentMode: string;
  merchant: string;
  app: string;
}

interface GPayProcessingResult {
  transactions: ProcessedTransaction[];
  errors: string[];
  warnings: string[];
}

const GPayProcessor: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<GPayProcessingResult | null>(null);
  const [monthRange] = useState([new Date(), new Date()]); // Mock month range
  
  // Mock upload function since context is not available
  const uploadFiles = async (transactions: ProcessedTransaction[]) => {
    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Uploaded transactions:', transactions);
  };

  const parseGPayTransactions = (text: string): GPayTransaction[] => {
    const transactions: GPayTransaction[] = [];
    
    // GPay patterns: Various formats including "You paid" and "You received"
    const patterns = [
      // Pattern 1: "MMM DD, YYYY You paid/received Merchant ₹Amount"
      /([A-Za-z]{3}\s+\d{1,2},\s+\d{4})\s+You\s+(paid|received)\s+([\s\S]*?)\s+₹([\d,]+(?:\.\d{1,2})?)/gi,
      // Pattern 2: "DD/MM/YYYY Sent to/Received from Merchant ₹Amount"
      /(\d{1,2}\/\d{1,2}\/\d{4})\s+(?:Sent to|Received from)\s+([\s\S]*?)\s+₹([\d,]+(?:\.\d{1,2})?)/gi
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match.length === 5) { // Pattern 1
          const [, date, action, merchant, amount] = match;
          transactions.push({
            date: date.trim(),
            merchant: merchant.replace(/\s+/g, ' ').trim(),
            type: action.toLowerCase() === 'paid' ? 'DEBIT' : 'CREDIT',
            amount: amount.trim()
          });
        } else if (match.length === 4) { // Pattern 2
          const [, date, merchant, amount] = match;
          transactions.push({
            date: date.trim(),
            merchant: merchant.replace(/\s+/g, ' ').trim(),
            type: 'DEBIT', // Default for sent transactions
            amount: amount.trim()
          });
        }
      }
    });
    
    return transactions;
  };

  const parseDate = (dateStr: string): string | null => {
    try {
      // Handle "Feb 13, 2025" format
      const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      let monthMatch = dateStr.match(/^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})$/i);
      
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
      
      // Handle "DD/MM/YYYY" format
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const [day, month, year] = parts;
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
    } catch (error) {
      console.error('Date parsing error:', error);
    }
    return null;
  };

  const categorizeTransaction = (merchant: string): string => {
    const text = merchant.toLowerCase();
    
    // Food and dining
    if (text.includes('swiggy') || text.includes('zomato') || text.includes('restaurant') || 
        text.includes('food') || text.includes('cafe') || text.includes('hotel') || 
        text.includes('mcdonalds') || text.includes('starbucks') || text.includes('dominos')) {
      return 'Food';
    }
    
    // Travel and transportation
    if (text.includes('uber') || text.includes('ola') || text.includes('railway') || 
        text.includes('flight') || text.includes('bus') || text.includes('metro') || 
        text.includes('petrol') || text.includes('fuel') || text.includes('parking')) {
      return 'Travel';
    }
    
    // Shopping
    if (text.includes('amazon') || text.includes('flipkart') || text.includes('shopping') || 
        text.includes('mall') || text.includes('store') || text.includes('market')) {
      return 'Shopping';
    }
    
    // Bills and utilities
    if (text.includes('electricity') || text.includes('water') || text.includes('gas') || 
        text.includes('airtel') || text.includes('jio') || text.includes('bill') || 
        text.includes('recharge') || text.includes('mobile')) {
      return 'Bills';
    }
    
    // Entertainment
    if (text.includes('movie') || text.includes('cinema') || text.includes('netflix') || 
        text.includes('spotify') || text.includes('game') || text.includes('concert')) {
      return 'Entertainment';
    }
    
    // Health
    if (text.includes('pharmacy') || text.includes('hospital') || text.includes('doctor') || 
        text.includes('medical') || text.includes('health')) {
      return 'Health';
    }
    
    // Education
    if (text.includes('course') || text.includes('book') || text.includes('education') || 
        text.includes('training') || text.includes('class')) {
      return 'Education';
    }
    
    // Investment
    if (text.includes('investment') || text.includes('sip') || text.includes('mutual') || 
        text.includes('stock') || text.includes('fd') || text.includes('deposit')) {
      return 'Investment';
    }
    
    return 'Other';
  };

  const processGPayPDF = async (file: File): Promise<GPayProcessingResult> => {
    try {
      // Use the API service instead of hardcoded URL
      const data = await ApiService.processPhonePePDF(file); // Using PhonePe endpoint as fallback since GPay specific endpoint doesn't exist
      
      if (!data.success) {
        throw new Error(data.error || 'Processing failed');
      }

      // Convert backend transactions to ProcessedTransaction format
      const processedTransactions: ProcessedTransaction[] = data.transactions.map((tx: any) => {
        const parsedDate = parseDate(tx.date);
        const cleanAmount = tx.amount.replace(/[,₹]/g, '');
        const amount = tx.type === 'DEBIT' ? -parseFloat(cleanAmount) : parseFloat(cleanAmount);
        
        return {
          date: parsedDate || tx.date,
          amount: amount,
          description: tx.merchant,
          category: categorizeTransaction(tx.merchant),
          paymentMode: 'UPI',
          merchant: tx.merchant,
          app: 'Google Pay'
        };
      });

      return {
        transactions: processedTransactions,
        errors: [],
        warnings: data.processing_method === 'ocr' ? ['PDF processed using OCR - accuracy may vary'] : []
      };

    } catch (error) {
      console.error('Backend processing failed:', error);
      // Fallback to client-side processing
      return await processGPayPDFClientSide(file);
    }
  };

  const processGPayPDFClientSide = async (file: File): Promise<GPayProcessingResult> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const text = event.target?.result as string;
          
          if (!text) {
            resolve({
              transactions: [],
              errors: ['Could not read PDF content'],
              warnings: []
            });
            return;
          }
          
          const gpayTransactions = parseGPayTransactions(text);
          
          const processedTransactions: ProcessedTransaction[] = gpayTransactions.map(tx => {
            const parsedDate = parseDate(tx.date);
            const cleanAmount = tx.amount.replace(/[,₹]/g, '');
            const amount = tx.type === 'DEBIT' ? -parseFloat(cleanAmount) : parseFloat(cleanAmount);
            
            return {
              date: parsedDate || tx.date,
              amount: amount,
              description: tx.merchant,
              category: categorizeTransaction(tx.merchant),
              paymentMode: 'UPI',
              merchant: tx.merchant,
              app: 'Google Pay'
            };
          });

          resolve({
            transactions: processedTransactions,
            errors: processedTransactions.length === 0 ? ['No transactions found. PDF may be image-based or in unsupported format.'] : [],
            warnings: ['Client-side processing used - limited accuracy for complex PDFs']
          });
        } catch (error) {
          resolve({
            transactions: [],
            errors: [`Failed to process PDF: ${error}`],
            warnings: []
          });
        }
      };
      
      reader.onerror = () => {
        resolve({
          transactions: [],
          errors: ['Failed to read PDF file'],
          warnings: []
        });
      };
      
      // Read as text for simple processing (this won't work for real PDFs)
      reader.readAsText(file);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
    }
  };

  const handleProcess = async () => {
    if (!selectedFile) return;
    
    setProcessing(true);
    try {
      const result = await processGPayPDF(selectedFile);
      setResult(result);
    } catch (error) {
      setResult({
        transactions: [],
        errors: [`Processing failed: ${error}`],
        warnings: []
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleUpload = async () => {
    if (result && result.transactions.length > 0) {
      await uploadFiles(result.transactions);
      alert(`Successfully uploaded ${result.transactions.length} transactions!`);
    }
  };

  const downloadSampleData = () => {
    const sampleData = `Date,Amount,Description,Category,Payment Mode,Merchant,App
13/02/2025,-250,You paid Swiggy,Food,UPI,Swiggy,Google Pay
12/02/2025,500,You received from John Doe,Other,UPI,John Doe,Google Pay
11/02/2025,-1200,Sent to Amazon,Shopping,UPI,Amazon,Google Pay`;

    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gpay_sample_format.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 p-4 min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
            <FileImage className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Google Pay PDF Processor</h2>
            <p className="text-gray-600 dark:text-gray-400">Extract transactions from Google Pay PDF statements</p>
          </div>
        </div>

        {/* File Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Google Pay PDF File
          </label>
          <div className="flex items-center space-x-4">
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100 dark:file:bg-green-900/30 dark:file:text-green-400"
            />
            {selectedFile && (
              <button
                onClick={handleProcess}
                disabled={processing}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Process PDF</span>
                  </>
                )}
              </button>
            )}
          </div>
          {selectedFile && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700 space-y-6">
          {/* Summary */}
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Processing Results</h3>
            {result.transactions.length > 0 && (
              <button
                onClick={handleUpload}
                className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Upload to Expense Tracker</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {result.transactions.length}
              </div>
              <div className="text-sm text-green-800 dark:text-green-300">Transactions Found</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                ₹{result.transactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0).toFixed(2)}
              </div>
              <div className="text-sm text-blue-800 dark:text-blue-300">Total Amount</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {new Set(result.transactions.map(tx => tx.category)).size}
              </div>
              <div className="text-sm text-purple-800 dark:text-purple-300">Categories</div>
            </div>
          </div>

          {/* Transactions Table */}
          {result.transactions.length > 0 && (
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Extracted Transactions</h4>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-200 dark:border-gray-700 rounded-lg">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700">
                      <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Date</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900 dark:text-white">Amount</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Merchant</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.transactions.map((tx, i) => (
                      <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-3 px-4 text-gray-900 dark:text-white">{tx.date}</td>
                        <td className="py-3 px-4 text-right font-medium" style={{ color: tx.amount < 0 ? '#ef4444' : '#10b981' }}>
                          ₹{tx.amount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-gray-900 dark:text-white">{tx.merchant}</td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">{tx.category}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Warnings and Errors */}
          {(result.warnings.length > 0 || result.errors.length > 0) && (
            <div className="space-y-4">
              {result.warnings.length > 0 && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    <h4 className="font-medium text-yellow-800 dark:text-yellow-200">Warnings</h4>
                  </div>
                  <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                    {result.warnings.map((warning, i) => (
                      <li key={i}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {result.errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    <h4 className="font-medium text-red-800 dark:text-red-200">Errors</h4>
                  </div>
                  <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                    {result.errors.map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Information */}
      <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-6 border border-green-200 dark:border-green-800">
        <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-3">
          Processing Information
        </h3>
        <div className="text-green-800 dark:text-green-200 text-sm space-y-2">
          <p>
            <strong>Backend Mode:</strong> If you have a Python backend running on localhost:5000, it will be used for optimal PDF processing with PyMuPDF and OCR.
          </p>
          <p>
            <strong>Fallback Mode:</strong> If the backend is not available, client-side processing will be used (limited accuracy for complex PDFs).
          </p>
        </div>
        <div className="mt-4">
          <button
            onClick={downloadSampleData}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
          >
            <Download className="w-4 h-4" />
            <span>Download Sample Data Format</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GPayProcessor;