import React, { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, X, FileImage } from 'lucide-react';
import { useExpenses } from '../../context/ExpenseContext';
import { processFile, ProcessedTransaction, debugFileInfo } from '../../utils/fileProcessor';

const FileUpload: React.FC = () => {
  const { uploadFiles, monthRange } = useExpenses();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<any[]>([]);
  const [processingResults, setProcessingResults] = useState<{
    [fileName: string]: {
      transactions: ProcessedTransaction[];
      errors: string[];
      warnings: string[];
    };
  }>({});

  const allowedTypes = [
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf'
  ];

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    handleFileSelection(files);
  }, []);

  const handleFileSelection = (files: File[]) => {
    const validFiles = files.filter(file => 
      allowedTypes.includes(file.type) || 
      file.name.endsWith('.csv') || 
      file.name.endsWith('.xlsx') || 
      file.name.endsWith('.xls') ||
      file.name.endsWith('.pdf')
    );

    if (validFiles.length !== files.length) {
      alert('Some files were rejected. Only CSV, Excel, and PDF files are allowed.');
    }

    if (selectedFiles.length + validFiles.length > 4) {
      alert('Maximum 4 files allowed');
      return;
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileSelection(Array.from(e.target.files));
    }
  };

  const removeFile = (index: number) => {
    const fileToRemove = selectedFiles[index];
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    
    // Remove processing results for this file
    setProcessingResults(prev => {
      const newResults = { ...prev };
      delete newResults[fileToRemove.name];
      return newResults;
    });
  };

  const processSelectedFile = async (file: File) => {
    try {
      // Debug file information
      debugFileInfo(file);
      
      const result = await processFile(file);
      
      // Log processing results for debugging
      console.log(`File ${file.name} processing result:`, result);
      
      setProcessingResults(prev => ({
        ...prev,
        [file.name]: result
      }));
      return result;
    } catch (error) {
      console.error('File processing error:', error);
      const errorResult = {
        transactions: [],
        errors: [`Processing failed: ${error instanceof Error ? error.message : String(error)}`],
        warnings: ['Please check the file format and try again.']
      };
      
      setProcessingResults(prev => ({
        ...prev,
        [file.name]: errorResult
      }));
      
      return errorResult;
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    try {
      // Process all files first
      const allResults = await Promise.all(
        selectedFiles.map(file => processSelectedFile(file))
      );

      // Combine all transactions
      const allTransactions = allResults.flatMap(result => result.transactions);
      const allErrors = allResults.flatMap(result => result.errors);
      const allWarnings = allResults.flatMap(result => result.warnings);

      // Show processing summary
      console.log('Processing summary:', {
        totalFiles: selectedFiles.length,
        totalTransactions: allTransactions.length,
        totalErrors: allErrors.length,
        totalWarnings: allWarnings.length
      });

      // Upload processed transactions
      if (allTransactions.length > 0) {
        await uploadFiles(allTransactions);
      }

      // Create upload results
      const results = selectedFiles.map((file, index) => {
        const result = allResults[index];
        return {
          fileName: file.name,
          transactionCount: result.transactions.length,
          errors: [...result.errors, ...result.warnings],
          success: result.transactions.length > 0
        };
      });

      setUploadResults(results);
      setSelectedFiles([]);
      setProcessingResults({});
      
      // Show success message
      if (allTransactions.length > 0) {
        alert(`Successfully processed ${allTransactions.length} transactions from ${selectedFiles.length} files!`);
      } else {
        alert('No transactions were found in the uploaded files. Please check the file format and content.');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.csv')) {
      return <FileText className="w-8 h-8 text-green-600" />;
    } else if (fileName.endsWith('.pdf')) {
      return <FileImage className="w-8 h-8 text-red-600" />;
    } else {
      return <FileText className="w-8 h-8 text-blue-600" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileTypeLabel = (fileName: string) => {
    if (fileName.endsWith('.csv')) return 'CSV';
    if (fileName.endsWith('.pdf')) return 'PDF';
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) return 'Excel';
    return 'Unknown';
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Upload Transaction Files
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Month Range:</span>
            <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium">
              {monthRange === 'all' ? 'All Time' : monthRange === '1m' ? 'This Month' : `Last ${monthRange.replace('m', '')} Months`}
            </span>
          </div>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Upload CSV, Excel, or PDF files from PhonePe, GPay, Paytm, or other payment apps. The month range is controlled from the Dashboard.
        </p>
      </div>

      {/* File Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-8 transition-all duration-200 ${
          dragActive
            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
            : 'border-gray-300 dark:border-gray-600'
        }`}
      >
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-full flex items-center justify-center mb-4">
            <Upload className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Drop files here or click to browse
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Supports CSV, Excel, and PDF files (Max 4 files, 10MB each)
          </p>
          <input
            type="file"
            multiple
            accept=".csv,.xlsx,.xls,.pdf"
            onChange={handleFileInput}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-emerald-500 to-blue-600 text-white rounded-xl hover:from-emerald-600 hover:to-blue-700 cursor-pointer transition-all duration-200 transform hover:scale-105"
          >
            <FileText className="w-4 h-4 mr-2" />
            Choose Files
          </label>
        </div>
      </div>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Selected Files ({selectedFiles.length}/4)
          </h3>
          <div className="space-y-3">
            {selectedFiles.map((file, index) => {
              const processingResult = processingResults[file.name];
              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-xl"
                >
                  <div className="flex items-center space-x-3">
                    {getFileIcon(file.name)}
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {file.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {getFileTypeLabel(file.name)} • {formatFileSize(file.size)}
                      </p>
                      {processingResult && (
                        <div className="mt-1">
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {processingResult.transactions.length} transactions found
                          </p>
                          {processingResult.warnings.length > 0 && (
                            <p className="text-xs text-yellow-600 dark:text-yellow-400">
                              {processingResult.warnings.length} warnings
                            </p>
                          )}
                          {processingResult.errors.length > 0 && (
                            <p className="text-xs text-red-600 dark:text-red-400">
                              {processingResult.errors.length} errors
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors duration-200"
                  >
                    <X size={16} />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-blue-600 text-white rounded-xl hover:from-emerald-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  <span>Processing & Uploading...</span>
                </>
              ) : (
                <>
                  <Upload size={16} />
                  <span>Process & Upload Files</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Upload Results */}
      {uploadResults.length > 0 && (
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Upload Results
          </h3>
          <div className="space-y-4">
            {uploadResults.map((result, index) => (
              <div
                key={index}
                className="flex items-start space-x-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl"
              >
                {result.success ? (
                  <CheckCircle className="w-6 h-6 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-yellow-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {result.fileName}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {result.transactionCount} transactions processed
                  </p>
                  {result.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                        Issues Found:
                      </p>
                      <ul className="text-sm text-yellow-600 dark:text-yellow-400 ml-4">
                        {result.errors.map((error: string, i: number) => (
                          <li key={i}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supported File Formats */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
          Supported Formats & Apps
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
              File Formats:
            </h4>
            <ul className="text-blue-700 dark:text-blue-300 space-y-1">
              <li>• CSV files (.csv)</li>
              <li>• Excel files (.xlsx, .xls)</li>
              <li>• PDF files (.pdf) - Limited support</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
              Supported Apps:
            </h4>
            <ul className="text-blue-700 dark:text-blue-300 space-y-1">
              <li>• PhonePe transaction history</li>
              <li>• Google Pay (GPay) exports</li>
              <li>• Paytm transaction reports</li>
              <li>• Bank statement CSV files</li>
              <li>• Credit card statements</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-800/30 rounded-lg">
          <p className="text-xs text-blue-800 dark:text-blue-200">
            <strong>Note:</strong> PDF parsing has limited support and works best with structured transaction statements. 
            For best results, use CSV or Excel exports from payment apps.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;