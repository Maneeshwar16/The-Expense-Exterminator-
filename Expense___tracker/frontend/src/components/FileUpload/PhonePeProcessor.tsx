import React, { useState } from 'react';
import { Upload, FileImage, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { useExpenses } from '../../context/ExpenseContext';
import { ProcessedTransaction } from '../../utils/fileProcessor';
import { ApiService } from '../../services/apiService';

interface PhonePeTransaction {
  date: string;
  merchant: string;
  type: 'DEBIT' | 'CREDIT';
  amount: string;
}

interface PhonePeProcessingResult {
  transactions: ProcessedTransaction[];
  errors: string[];
  warnings: string[];
}

const PhonePeProcessor: React.FC = () => {
  const { uploadFiles, monthRange } = useExpenses();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<PhonePeProcessingResult | null>(null);
  const [rawText, setRawText] = useState<string>('');

  const parsePhonePeTransactions = (text: string): PhonePeTransaction[] => {
    const transactions: PhonePeTransaction[] = [];
    
    // Pattern for: Date, Merchant (multi-line), Transaction Type, Amount
    const pattern = /([A-Za-z]{3}\s+\d{1,2},\s+\d{4})\s+Paid to\s+([\s\S]*?)\s+(DEBIT|CREDIT)\s+₹(\d+(?:\.\d{1,2})?)/g;
    
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const [, date, merchant, type, amount] = match;
      transactions.push({
        date: date.trim(),
        merchant: merchant.replace(/\s+/g, ' ').trim(), // merge multi-line names
        type: type as 'DEBIT' | 'CREDIT',
        amount: amount.trim()
      });
    }
    
    return transactions;
  };

  const parseDate = (dateStr: string): string | null => {
    try {
      // Handle "Feb 13, 2025" format
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
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
    
    return 'Miscellaneous';
  };

  const processPhonePePDF = async (file: File): Promise<PhonePeProcessingResult> => {
    try {
      // Try to use the Python backend first
      const result = await extractTextFromPDF(file);
      setRawText(result.warnings.join('\n'));
      return result;
    } catch (error) {
      // Fallback to client-side processing if backend is not available
      console.warn('Backend processing failed, using client-side fallback:', error);
      return await processPhonePePDFClientSide(file);
    }
  };

  const processPhonePePDFClientSide = async (file: File): Promise<PhonePeProcessingResult> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const uint8Array = new Uint8Array(arrayBuffer);
          
          // Convert to text (this is a simplified approach)
          const decoder = new TextDecoder('utf-8');
          const text = decoder.decode(uint8Array);
          setRawText(text.substring(0, 500) + '...');
          
          // Try to extract transactions using regex patterns
          const transactions = parsePhonePeTransactions(text);
          
          const processedTransactions: ProcessedTransaction[] = transactions.map((tx) => ({
            date: parseDate(tx.date) || tx.date,
            amount: tx.type === 'DEBIT' ? -parseFloat(tx.amount) : parseFloat(tx.amount),
            description: `PhonePe ${tx.type} to ${tx.merchant}`,
            category: categorizeTransaction(tx.merchant),
            paymentMode: 'UPI',
            merchant: tx.merchant
          }));

          resolve({
            transactions: processedTransactions,
            errors: [],
            warnings: [
              'Client-side processing used (limited accuracy)',
              'For better results, set up the Python backend service',
              `Found ${transactions.length} potential transactions`
            ]
          });
        } catch (error) {
          resolve({
            transactions: [],
            errors: [`Client-side processing error: ${error}`],
            warnings: ['Consider setting up the Python backend for better PDF processing']
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

    const extractTextFromPDF = async (file: File): Promise<PhonePeProcessingResult> => {
    const result = await ApiService.processPhonePePDF(file);
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    // Convert Python backend response to frontend format
    const processedTransactions: ProcessedTransaction[] = result.transactions.map((tx: any) => ({
      date: parseDate(tx.date) || tx.date,
      amount: tx.type === 'DEBIT' ? -parseFloat(tx.amount) : parseFloat(tx.amount),
      description: `PhonePe ${tx.type} to ${tx.merchant}`,
      category: categorizeTransaction(tx.merchant),
      paymentMode: 'UPI',
      merchant: tx.merchant
    }));
    
    return {
      transactions: processedTransactions,
      errors: [],
      warnings: [
        `Processing method: ${result.processing_method}`, 
        `Raw text preview: ${result.raw_text?.substring(0, 200)}...`
      ]
    };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setResult(null);
      setRawText('');
    } else {
      alert('Please select a PDF file');
    }
  };

  const handleProcess = async () => {
    if (!selectedFile) return;
    
    setProcessing(true);
    try {
      const processingResult = await processPhonePePDF(selectedFile);
      setResult(processingResult);
    } catch (error) {
      console.error('Processing error:', error);
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
    if (!result || result.transactions.length === 0) return;
    
    try {
      await uploadFiles(result.transactions);
      alert(`Successfully uploaded ${result.transactions.length} PhonePe transactions!`);
    } catch (error) {
      alert(`Upload failed: ${error}`);
    }
  };

  const downloadSampleData = () => {
    const sampleTransactions = [
      { date: 'Feb 13, 2025', merchant: 'Salaar Devrartha Raisar', type: 'DEBIT', amount: '100' },
      { date: 'Feb 11, 2025', merchant: 'Yashhh_v', type: 'DEBIT', amount: '90' },
      { date: 'Feb 10, 2025', merchant: 'Swiggy', type: 'DEBIT', amount: '250' },
      { date: 'Feb 09, 2025', merchant: 'Uber', type: 'DEBIT', amount: '180' }
    ];
    
    const blob = new Blob([JSON.stringify(sampleTransactions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'phonepe_sample_data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalSpent = result?.transactions
    .filter(tx => tx.amount < 0)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0) ?? 0;

  const spentByMerchant: Record<string, number> = {};
  result?.transactions
    .filter(tx => tx.amount < 0)
    .forEach(tx => {
      const merchant = tx.merchant || 'Unknown';
      spentByMerchant[merchant] = (spentByMerchant[merchant] || 0) + Math.abs(tx.amount);
    });

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            PhonePe PDF Processor
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Month Range:</span>
            <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium">
              {monthRange === 'all' ? 'All Time' : monthRange === '1m' ? 'This Month' : `Last ${monthRange.replace('m', '')} Months`}
            </span>
          </div>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Upload your PhonePe statement PDF to extract and categorize transactions. Works with both backend and client-side processing.
        </p>
      </div>

      {/* File Upload */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <button
            onClick={handleProcess}
            disabled={!selectedFile || processing}
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-blue-600 text-white rounded-xl hover:from-emerald-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {processing ? 'Processing...' : 'Process PDF'}
          </button>
        </div>
        
        {selectedFile && (
          <div className="mt-4 flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <FileImage className="w-4 h-4" />
            <span>{selectedFile.name}</span>
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Processing Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {result.transactions.length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Transactions Found</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  ₹{totalSpent.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Spent</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {Object.keys(spentByMerchant).length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Unique Merchants</div>
              </div>
            </div>
            
            {result.transactions.length > 0 && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleUpload}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:from-purple-600 hover:to-pink-700 transition-all duration-200"
                >
                  Upload to Expense Tracker
                </button>
              </div>
            )}
          </div>

          {/* Transactions Table */}
          {result.transactions.length > 0 && (
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Extracted Transactions
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
                      <tr key={i} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="py-3 px-4 text-gray-900 dark:text-white">{tx.date}</td>
                        <td className="py-3 px-4 text-right font-medium" style={{ color: tx.amount < 0 ? '#ef4444' : '#10b981' }}>
                          {tx.amount.toFixed(2)}
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
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Warnings</h4>
                  <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                    {result.warnings.map((warning, i) => (
                      <li key={i}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {result.errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                  <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">Errors</h4>
                  <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                    {result.errors.map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Raw Text Debug (only show if needed) */}
          {rawText && rawText.length > 0 && (
            <details className="bg-gray-50 dark:bg-gray-900/20 rounded-xl p-4">
              <summary className="font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                Debug: Raw Text Preview
              </summary>
              <pre className="mt-2 text-xs text-gray-600 dark:text-gray-400 overflow-auto max-h-40">
                {rawText}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* Python Integration Notice */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
          Processing Information
        </h3>
        <div className="text-blue-800 dark:text-blue-200 text-sm space-y-2">
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

export default PhonePeProcessor;