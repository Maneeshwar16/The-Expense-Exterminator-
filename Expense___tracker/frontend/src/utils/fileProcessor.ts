import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface ProcessedTransaction {
  date: string;
  amount: number;
  description: string;
  category?: string;
  paymentMode?: string;
  merchant?: string;
}

export interface ProcessingResult {
  transactions: ProcessedTransaction[];
  errors: string[];
  warnings: string[];
}

// Debug function to log file information
export function debugFileInfo(file: File) {
  console.log('File Info:', {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: new Date(file.lastModified).toISOString()
  });
}

// Common date formats found in Indian payment apps
const DATE_FORMATS = [
  'dd/MM/yyyy',
  'dd-MM-yyyy',
  'dd.MM.yyyy',
  'MM/dd/yyyy',
  'MM-dd-yyyy',
  'yyyy-MM-dd',
  'yyyy/MM/dd',
  'dd/MM/yy',
  'dd-MM-yy',
  'MM/dd/yy',
  'MM-dd-yy',
  'yy-MM-dd',
  'yy/MM/dd',
  'MMM dd, yyyy', // Feb 13, 2025
  'dd MMM yyyy',
  'yyyy MMM dd'
];

// Parse date string with multiple format support
export function parseDate(dateStr: string): string | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  // Remove extra spaces and common prefixes
  const cleanDateStr = dateStr.trim().replace(/^(Date|Dt|D):\s*/i, '');
  
  // Try parsing with different formats
  for (const format of DATE_FORMATS) {
    try {
      // Handle different separators
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
        
        // Handle 2-digit years
        if (year.length === 2) {
          year = parseInt(year) < 50 ? `20${year}` : `19${year}`;
        }
        
        // Validate date components
        const parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() === parseInt(year)) {
          return parsedDate.toISOString().split('T')[0];
        }
      }
    } catch (error) {
      continue;
    }
  }
  
  // Try parsing with Date constructor as fallback
  try {
    const parsed = new Date(cleanDateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch (error) {
    // Continue to next attempt
  }
  
  return null;
}

// Extract amount from string, handling various formats
export function parseAmount(amountStr: string): number | null {
  if (!amountStr || typeof amountStr !== 'string') return null;
  
  // Remove currency symbols, commas, and extra spaces
  const cleanAmount = amountStr
    .replace(/[₹$€£,]/g, '')
    .replace(/\s+/g, '')
    .trim();
  
  // Handle negative amounts (debits/credits)
  const isNegative = cleanAmount.includes('-') || cleanAmount.includes('(') || cleanAmount.includes('Dr');
  const numericAmount = parseFloat(cleanAmount.replace(/[()DrCr]/g, ''));
  
  if (isNaN(numericAmount)) return null;
  
  return isNegative ? -Math.abs(numericAmount) : Math.abs(numericAmount);
}

// Categorize transaction based on description/merchant
export function categorizeTransaction(description: string, merchant?: string): string {
  const text = (description + ' ' + (merchant || '')).toLowerCase();
  
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
}

// Process CSV file
export async function processCSV(file: File): Promise<ProcessingResult> {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const transactions: ProcessedTransaction[] = [];
        const errors: string[] = [];
        const warnings: string[] = [];
        
        results.data.forEach((row: any, index: number) => {
          try {
            // Try to find date column
            let dateStr = '';
            let amountStr = '';
            let description = '';
            
            // Common column names in Indian payment apps
            const dateColumns = ['date', 'dt', 'transaction_date', 'date_time', 'time'];
            const amountColumns = ['amount', 'amt', 'debit', 'credit', 'transaction_amount', 'balance'];
            const descColumns = ['description', 'desc', 'narration', 'remarks', 'particulars', 'transaction_details'];
            
            // Find date column
            for (const col of dateColumns) {
              if (row[col]) {
                dateStr = row[col];
                break;
              }
            }
            
            // Find amount column
            for (const col of amountColumns) {
              if (row[col]) {
                amountStr = row[col];
                break;
              }
            }
            
            // Find description column
            for (const col of descColumns) {
              if (row[col]) {
                description = row[col];
                break;
              }
            }
            
            // Parse date and amount
            const date = parseDate(dateStr);
            const amount = parseAmount(amountStr);
            
            if (!date) {
              warnings.push(`Row ${index + 1}: Could not parse date "${dateStr}"`);
            }
            
            if (!amount) {
              warnings.push(`Row ${index + 1}: Could not parse amount "${amountStr}"`);
            }
            
            if (date && amount) {
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
      },
      error: (error) => {
        resolve({ 
          transactions: [], 
          errors: [`CSV parsing error: ${error.message}`], 
          warnings: [] 
        });
      }
    });
  });
}

// Process Excel file
export async function processExcel(file: File): Promise<ProcessingResult> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length < 2) {
          resolve({ 
            transactions: [], 
            errors: ['Excel file must have at least a header row and one data row'], 
            warnings: [] 
          });
          return;
        }
        
        const headers = jsonData[0] as string[];
        const transactions: ProcessedTransaction[] = [];
        const errors: string[] = [];
        const warnings: string[] = [];
        
        // Find column indices
        const dateColIndex = headers.findIndex(h => 
          h && dateColumns.some(dc => h.toLowerCase().includes(dc))
        );
        const amountColIndex = headers.findIndex(h => 
          h && amountColumns.some(ac => h.toLowerCase().includes(ac))
        );
        const descColIndex = headers.findIndex(h => 
          h && descColumns.some(dc => h.toLowerCase().includes(dc))
        );
        
        if (dateColIndex === -1) {
          warnings.push('Could not find date column');
        }
        if (amountColIndex === -1) {
          warnings.push('Could not find amount column');
        }
        if (descColIndex === -1) {
          warnings.push('Could not find description column');
        }
        
        // Process data rows
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i] as any[];
          if (!row || row.length === 0) continue;
          
          try {
            const dateStr = dateColIndex >= 0 ? row[dateColIndex] : '';
            const amountStr = amountColIndex >= 0 ? row[amountColIndex] : '';
            const description = descColIndex >= 0 ? row[descColIndex] : '';
            
            const date = parseDate(dateStr);
            const amount = parseAmount(amountStr);
            
            if (!date) {
              warnings.push(`Row ${i + 1}: Could not parse date "${dateStr}"`);
            }
            
            if (!amount) {
              warnings.push(`Row ${i + 1}: Could not parse amount "${amountStr}"`);
            }
            
            if (date && amount) {
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
        resolve({ 
          transactions: [], 
          errors: [`Excel processing error: ${error}`], 
          warnings: [] 
        });
      }
    };
    
    reader.onerror = () => {
      resolve({ 
        transactions: [], 
        errors: ['Failed to read Excel file'], 
        warnings: [] 
      });
    };
    
    reader.readAsArrayBuffer(file);
  });
}

// Process PDF file - redirects to Python backend
export async function processPDF(file: File): Promise<ProcessingResult> {
  return new Promise(async (resolve) => {
    try {
      // For PDF files, we'll redirect to the Python backend
      // This avoids CORS issues with PDF.js
      resolve({ 
        transactions: [], 
        errors: ['PDF processing requires Python backend setup'], 
        warnings: ['Please use the dedicated PhonePe Processor or set up the Python backend as described in BACKEND_INTEGRATION.md'] 
      });
    } catch (error) {
      resolve({ 
        transactions: [], 
        errors: [`PDF processing error: ${error}`], 
        warnings: [] 
      });
    }
  });
}

// Main file processing function
export async function processFile(file: File): Promise<ProcessingResult> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();
  
  try {
    if (fileType === 'text/csv' || fileName.endsWith('.csv')) {
      return await processCSV(file);
    } else if (fileType.includes('excel') || fileType.includes('spreadsheet') || 
               fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      return await processExcel(file);
    } else if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      return await processPDF(file);
    } else {
      return {
        transactions: [],
        errors: [`Unsupported file type: ${fileType}`],
        warnings: []
      };
    }
  } catch (error) {
    return {
      transactions: [],
      errors: [`File processing failed: ${error}`],
      warnings: []
    };
  }
}

// Helper constants
const dateColumns = ['date', 'dt', 'transaction_date', 'date_time', 'time'];
const amountColumns = ['amount', 'amt', 'debit', 'credit', 'transaction_amount', 'balance'];
const descColumns = ['description', 'desc', 'narration', 'remarks', 'particulars', 'transaction_details'];
