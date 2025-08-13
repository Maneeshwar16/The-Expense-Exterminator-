import React, { useState } from 'react';
import { Upload, FileImage, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { useExpenses } from '../../context/ExpenseContext';
import { ProcessedTransaction } from '../../utils/fileProcessor';
import { ApiService } from '../../services/apiService';

interface PaytmTransaction {
  date: string;
  merchant: string;
  type: 'DEBIT' | 'CREDIT';
  amount: string;
  time?: string;
  upi_id?: string;
}

interface PaytmProcessingResult {
  transactions: ProcessedTransaction[];
  errors: string[];
  warnings: string[];
}

const PaytmProcessor: React.FC = () => {
  const { uploadFiles, monthRange } = useExpenses();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<PaytmProcessingResult | null>(null);
  const [rawText, setRawText] = useState<string>('');

  const parsePaytmTransactions = (text: string): PaytmTransaction[] => {
    const transactions: PaytmTransaction[] = [];
    
    // Pattern for Paytm: Date, Description/Merchant, Debit/Credit, Amount
    const pattern = /(\d{1,2}\/\d{1,2}\/\d{4})\s+([\s\S]*?)\s+(Debit|Credit|DEBIT|CREDIT)\s+(?:Rs\.?\s*|₹\s*)([\d,]+(?:\.\d{1,2})?)/gi;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const [, date, merchant, type, amount] = match;
      transactions.push({
        date: date.trim(),
        merchant: merchant.replace(/\s+/g, ' ').trim(),
        type: type.toUpperCase() as 'DEBIT' | 'CREDIT',
        amount: amount.trim()
      });
    }
    
    return transactions;
  };

  const parseDate = (dateStr: string): string | null => {
    try {
      // Handle both "DD/MM/YYYY" and "DD Mon YYYY" formats
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
          const [day, month, year] = parts;
          const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        }
      } else {
        // Handle "15 Jul 2025" format
        const date = new Date(dateStr);
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
        text.includes('training') || text.includes('class') || text.includes('skverse')) {
      return 'Education';
    }
    
    // Investment
    if (text.includes('investment') || text.includes('sip') || text.includes('mutual') || 
        text.includes('stock') || text.includes('fd') || text.includes('deposit')) {
      return 'Investment';
    }
    
    return 'Other';
  };

  const processPaytmPDF = async (file: File): Promise<PaytmProcessingResult> => {
    try {
      // Use the API service instead of hardcoded URL
      const data = await ApiService.processPaytmPDF(file);
      
      if (!data.success) {
        throw new Error(data.error || 'Processing failed');
      }

      // Set raw text for debugging
      setRawText(data.raw_text?.substring(0, 1000) || '');

      // Convert backend transactions to ProcessedTransaction format
      const processedTransactions: ProcessedTransaction[] = data.transactions.map((tx: any) => {
        const parsedDate = parseDate(tx.date);
        const amount = tx.type === 'DEBIT' ? -parseFloat(tx.amount) : parseFloat(tx.amount);
        
        return {
          date: parsedDate || tx.date,
          amount: amount,
          description: `${tx.merchant} (Paytm)`,
          category: categorizeTransaction(tx.merchant),
          paymentMode: 'UPI',
          merchant: tx.merchant,
          app: 'Paytm'
        };
      });

      return {
        transactions: processedTransactions,
        errors: [],
        warnings: [
          `Processing method: ${data.processing_method}`,
          `Found ${data.total_transactions} transactions`,
          ...(data.processing_method === 'ocr' ? ['PDF processed using OCR - accuracy may vary'] : [])
        ]
      };

    } catch (error) {
      console.error('Backend processing failed:', error);
      // Fallback to client-side processing
      return await processPaytmPDFClientSide(file);
    }
  };

  const processPaytmPDFClientSide = async (file: File): Promise<PaytmProcessingResult> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const uint8Array = new Uint8Array(arrayBuffer);
          
          // Simple text extraction (limited functionality)
          const text = new TextDecoder().decode(uint8Array);
          const paytmTransactions = parsePaytmTransactions(text);
          
          const processedTransactions: ProcessedTransaction[] = paytmTransactions.map(tx => {
            const parsedDate = parseDate(tx.date);
            const amount = tx.type === 'DEBIT' ? -parseFloat(tx.amount) : parseFloat(tx.amount);
            
            return {
              date: parsedDate || tx.date,
              amount: amount,
              description: `${tx.merchant} (Paytm)`,
              category: categorizeTransaction(tx.merchant),
              paymentMode: 'UPI',
              merchant: tx.merchant,
              app: 'Paytm'
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
      
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
      setRawText('');
    }
  };

  const handleProcess = async () => {
    if (!selectedFile) return;
    
    setProcessing(true);
    try {
      const result = await processPaytmPDF(selectedFile);
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
15 Jul 2025,-22,Airtel (Paytm),Bills,UPI,Airtel,Paytm
15 Jul 2025,-199,SKVerse (Paytm),Education,UPI,SKVerse,Paytm
10 Jul 2025,-77,Www Airtel In (Paytm),Bills,UPI,Www Airtel In,Paytm`;

    const blob = new Blob([sampleData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'paytm_sample_format.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const totalSpent = result?.transactions
    .filter(tx => tx.amount < 0)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0) ?? 0;

  const totalReceived = result?.transactions
    .filter(tx => tx.amount > 0)
    .reduce((sum, tx) => sum + tx.amount, 0) ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            💳 Paytm PDF Processor
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Month Range:</span>
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
              {monthRange === 'all' ? 'All Time' : monthRange === '1m' ? 'This Month' : `Last ${monthRange.replace('m', '')} Months`}
            </span>
          </div>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Upload your Paytm UPI statement PDF to extract and categorize transactions. Connects to dedicated backend on port 5001.
        </p>
      </div>

      {/* File Upload */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
            <FileImage className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">Upload Paytm PDF</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Select your Paytm UPI statement</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <button
            onClick={handleProcess}
            disabled={!selectedFile || processing}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center space-x-2"
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
        </div>
        
        {selectedFile && (
          <div className="mt-4 flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <FileImage className="w-4 h-4" />
            <span>{selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                📊 Processing Summary
              </h3>
              {result.transactions.length > 0 && (
                <button
                  onClick={handleUpload}
                  className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:from-green-600 hover:to-emerald-700 transition-all duration-200"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Upload to Expense Tracker</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {result.transactions.length}
                </div>
                <div className="text-sm text-blue-800 dark:text-blue-300">Transactions Found</div>
              </div>
              <div className="bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-xl p-4">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  ₹{totalSpent.toFixed(2)}
                </div>
                <div className="text-sm text-red-800 dark:text-red-300">Total Spent</div>
              </div>
              <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-4">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  ₹{totalReceived.toFixed(2)}
                </div>
                <div className="text-sm text-green-800 dark:text-green-300">Total Received</div>
              </div>
              <div className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-4">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {new Set(result.transactions.map(tx => tx.category)).size}
                </div>
                <div className="text-sm text-purple-800 dark:text-purple-300">Categories</div>
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          {result.transactions.length > 0 && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                📋 Extracted Transactions
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Date</th>
                      <th className="text-right py-3 px-4 font-medium text-gray-900 dark:text-white">Amount (₹)</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Merchant</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-white">Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.transactions.map((tx, i) => (
                      <tr key={i} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="py-3 px-4 text-gray-900 dark:text-white font-medium">{tx.date}</td>
                        <td className="py-3 px-4 text-right font-bold" style={{ color: tx.amount < 0 ? '#ef4444' : '#10b981' }}>
                          {tx.amount.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-gray-900 dark:text-white">{tx.merchant}</td>
                        <td className="py-3 px-4 text-gray-600 dark:text-gray-400">
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs">
                            {tx.category}
                          </span>
                        </td>
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
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Processing Information
                  </h4>
                  <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                    {result.warnings.map((warning, i) => (
                      <li key={i}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {result.errors.length > 0 && (
                <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                  <h4 className="font-medium text-red-800 dark:text-red-200 mb-2 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Errors
                  </h4>
                  <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                    {result.errors.map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Debug Raw Text */}
          {rawText && rawText.length > 0 && (
            <details className="bg-gray-50 dark:bg-gray-900/20 rounded-xl p-4">
              <summary className="font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:text-gray-900 dark:hover:text-white">
                🔍 Debug: Raw Text Preview
              </summary>
              <pre className="mt-3 text-xs text-gray-600 dark:text-gray-400 overflow-auto max-h-40 bg-white dark:bg-gray-800 p-3 rounded border">
                {rawText}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* Backend Information */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
          🔧 Backend Integration
        </h3>
        <div className="text-blue-800 dark:text-blue-200 text-sm space-y-2">
          <p>
            <strong>Dedicated Backend:</strong> Paytm processor connects to <code>paytm_app.py</code> running on port 5001
          </p>
          <p>
            <strong>Optimal Processing:</strong> Uses PyMuPDF for text extraction and Tesseract OCR for image-based PDFs
          </p>
          <p>
            <strong>Fallback Mode:</strong> Client-side processing if backend is unavailable (limited accuracy)
          </p>
          <p>
            <strong>Port Setup:</strong> Paytm (5001) | PhonePe (5000) - No conflicts!
          </p>
        </div>
        <div className="mt-4">
          <button
            onClick={downloadSampleData}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            <Download className="w-4 h-4" />
            <span>Download Sample Data Format</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaytmProcessor;