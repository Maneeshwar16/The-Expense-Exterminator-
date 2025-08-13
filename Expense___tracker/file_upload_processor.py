from flask import Flask, request, jsonify
from flask_cors import CORS
import fitz  # PyMuPDF for PDF processing
import pytesseract
from pdfminer.high_level import extract_text
from PIL import Image
import pandas as pd
import openpyxl
import xlrd
import io
import re
import os
from typing import List, Dict, Any, Union
import traceback

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configure file upload settings
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size

def is_pdf_text_based(pdf_path: str) -> tuple[bool, str]:
    """Check if PDF contains selectable text."""
    try:
        text = extract_text(pdf_path)
        return bool(text.strip()), text.strip()
    except Exception as e:
        print(f"Error checking PDF text: {e}")
        return False, ""

def extract_pdf_with_ocr(pdf_path: str) -> str:
    """Extract text from a scanned PDF using OCR."""
    try:
        doc = fitz.open(pdf_path)
        all_text = []
        for page_num in range(len(doc)):
            pix = doc[page_num].get_pixmap(dpi=300)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            text = pytesseract.image_to_string(img, lang="eng")
            all_text.append(text)
        doc.close()
        return "\n".join(all_text)
    except Exception as e:
        print(f"Error with OCR extraction: {e}")
        return ""

def extract_pdf_data(file_path: str) -> Dict[str, Any]:
    """Extract data from PDF file."""
    try:
        # Check if PDF has selectable text
        has_text, extracted_text = is_pdf_text_based(file_path)
        
        if has_text and extracted_text:
            processing_method = "text_extraction"
            text_data = extracted_text
        else:
            processing_method = "ocr"
            text_data = extract_pdf_with_ocr(file_path)
        
        # Parse the extracted text for structured data
        parsed_data = parse_pdf_text(text_data)
        
        return {
            "success": True,
            "file_type": "PDF",
            "processing_method": processing_method,
            "raw_text": text_data[:2000] + "..." if len(text_data) > 2000 else text_data,
            "parsed_data": parsed_data,
            "total_records": len(parsed_data)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"PDF processing failed: {str(e)}",
            "file_type": "PDF"
        }

def extract_excel_data(file_path: str) -> Dict[str, Any]:
    """Extract data from Excel file (.xlsx, .xls, .csv)."""
    try:
        file_ext = os.path.splitext(file_path)[1].lower()
        
        # Read Excel/CSV file based on extension
        if file_ext == '.csv':
            df = pd.read_csv(file_path)
        elif file_ext in ['.xlsx', '.xlsm']:
            df = pd.read_excel(file_path, engine='openpyxl')
        elif file_ext == '.xls':
            df = pd.read_excel(file_path, engine='xlrd')
        else:
            raise ValueError(f"Unsupported file format: {file_ext}")
        
        # Convert DataFrame to structured data
        parsed_data = parse_excel_dataframe(df)
        
        # Get basic info about the data
        column_info = {
            "columns": df.columns.tolist(),
            "shape": df.shape,
            "dtypes": df.dtypes.to_dict()
        }
        
        return {
            "success": True,
            "file_type": f"Excel ({file_ext.upper()})",
            "processing_method": "pandas",
            "column_info": column_info,
            "parsed_data": parsed_data,
            "total_records": len(parsed_data),
            "sample_data": df.head(5).to_dict('records') if not df.empty else []
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"Excel processing failed: {str(e)}",
            "file_type": "Excel"
        }

def parse_pdf_text(text: str) -> List[Dict[str, Any]]:
    """Parse PDF text to extract structured transaction data."""
    transactions = []
    
    print(f"\n===== PDF TEXT PARSER DEBUG =====")
    print(f"Input text length: {len(text)} characters")
    print("First 1000 characters:")
    print(text[:1000])
    print("===============================\n")
    
    # Split text into lines
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    
    # Look for common transaction patterns
    for i, line in enumerate(lines):
        # Try to find transaction-like patterns
        transaction = extract_transaction_from_line(line)
        if transaction:
            transactions.append(transaction)
    
    # If no structured transactions found, try to extract key-value pairs
    if not transactions:
        transactions = extract_key_value_pairs(text)
    
    return transactions

def extract_transaction_from_line(line: str) -> Dict[str, Any]:
    """Extract transaction data from a single line."""
    # Common patterns for transaction data
    patterns = [
        # Amount patterns (₹, Rs, INR)
        r'(?:₹|Rs\.?|INR)\s*([0-9,]+\.?\d*)',
        # Date patterns
        r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
        r'(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4})',
        # UPI/Transaction ID patterns
        r'(?:UPI|TXN|REF).*?(\w{10,})',
    ]
    
    extracted_data = {}
    
    # Extract amounts
    amount_match = re.search(r'(?:₹|Rs\.?|INR)\s*([0-9,]+\.?\d*)', line, re.IGNORECASE)
    if amount_match:
        amount_str = amount_match.group(1).replace(',', '')
        try:
            extracted_data['amount'] = float(amount_str)
        except ValueError:
            pass
    
    # Extract dates
    date_match = re.search(r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', line)
    if not date_match:
        date_match = re.search(r'(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4})', line, re.IGNORECASE)
    
    if date_match:
        extracted_data['date'] = date_match.group(1)
    
    # Extract merchant/description (text before amount or after keywords)
    merchant_patterns = [
        r'(?:to|from|paid|received)\s+([^₹\d]+?)(?:₹|Rs|\d)',
        r'^([^₹\d]+?)(?:₹|Rs|\d)',
    ]
    
    for pattern in merchant_patterns:
        merchant_match = re.search(pattern, line, re.IGNORECASE)
        if merchant_match:
            merchant = merchant_match.group(1).strip()
            if len(merchant) > 3:  # Avoid single characters
                extracted_data['merchant'] = merchant
                break
    
    # Only return if we found meaningful data
    if len(extracted_data) >= 2:  # At least 2 fields
        extracted_data['raw_line'] = line
        return extracted_data
    
    return None

def extract_key_value_pairs(text: str) -> List[Dict[str, Any]]:
    """Extract key-value pairs from unstructured text."""
    data = []
    
    # Common key patterns in financial documents
    key_patterns = {
        'amount': r'(?:amount|total|sum|value|price)[:=\s]+(?:₹|Rs\.?|INR)?\s*([0-9,]+\.?\d*)',
        'date': r'(?:date|time|on)[:=\s]+(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
        'reference': r'(?:ref|reference|id|transaction)[:=\s]+(\w+)',
        'status': r'(?:status|state)[:=\s]+(success|failed|pending|completed)',
    }
    
    extracted = {}
    for key, pattern in key_patterns.items():
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            extracted[key] = match.group(1)
    
    if extracted:
        data.append(extracted)
    
    return data

def parse_excel_dataframe(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Parse Excel DataFrame to extract transaction data."""
    transactions = []
    
    # Convert DataFrame to list of dictionaries
    records = df.to_dict('records')
    
    for record in records:
        # Clean and process each record
        cleaned_record = {}
        for key, value in record.items():
            # Handle NaN values
            if pd.isna(value):
                continue
            
            # Clean column names
            clean_key = str(key).strip().lower().replace(' ', '_')
            
            # Process different data types
            if isinstance(value, (int, float)):
                cleaned_record[clean_key] = value
            else:
                cleaned_record[clean_key] = str(value).strip()
        
        if cleaned_record:  # Only add non-empty records
            transactions.append(cleaned_record)
    
    return transactions

@app.route('/upload-file', methods=['POST'])
def upload_file():
    """Upload and process PDF or Excel files."""
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    # Get file extension
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    # Check supported file types
    supported_extensions = ['.pdf', '.xlsx', '.xls', '.xlsm', '.csv']
    if file_ext not in supported_extensions:
        return jsonify({
            "error": f"Unsupported file type: {file_ext}. Supported types: {', '.join(supported_extensions)}"
        }), 400

    try:
        # Save uploaded file temporarily
        temp_path = f"temp_upload_{file.filename}"
        file.save(temp_path)

        # Process file based on type
        if file_ext == '.pdf':
            result = extract_pdf_data(temp_path)
        else:  # Excel/CSV files
            result = extract_excel_data(temp_path)

        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

        return jsonify(result)

    except Exception as e:
        # Clean up temp file on error
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)
        
        return jsonify({
            "success": False,
            "error": f"File processing failed: {str(e)}",
            "traceback": traceback.format_exc()
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "File Upload Processor",
        "supported_formats": ["PDF", "Excel (.xlsx, .xls, .xlsm)", "CSV"],
        "message": "File upload processor is running successfully!"
    })

@app.route('/test-pdf', methods=['GET'])
def test_pdf_parsing():
    """Test PDF parsing with sample data."""
    sample_text = """
    Transaction Details
    Date: 25 January 2025
    Amount: ₹1,500.00
    Merchant: Amazon India
    Reference: TXN123456789
    Status: Success
    """
    
    parsed_data = parse_pdf_text(sample_text)
    return jsonify({
        "success": True,
        "test_type": "PDF parsing",
        "sample_text": sample_text,
        "parsed_data": parsed_data,
        "total_records": len(parsed_data)
    })

@app.route('/test-excel', methods=['GET'])
def test_excel_parsing():
    """Test Excel parsing with sample data."""
    # Create sample DataFrame
    sample_data = {
        'Date': ['2025-01-25', '2025-01-24', '2025-01-23'],
        'Amount': [1500.00, 250.50, 75.25],
        'Merchant': ['Amazon India', 'Swiggy', 'Metro Station'],
        'Category': ['Shopping', 'Food', 'Transport'],
        'Status': ['Success', 'Success', 'Success']
    }
    
    df = pd.DataFrame(sample_data)
    parsed_data = parse_excel_dataframe(df)
    
    return jsonify({
        "success": True,
        "test_type": "Excel parsing",
        "sample_data": sample_data,
        "parsed_data": parsed_data,
        "total_records": len(parsed_data)
    })

if __name__ == '__main__':
    print("📁 Starting File Upload Processor Backend...")
    print("📝 Available endpoints:")
    print("   - POST /upload-file - Upload and process PDF/Excel files")
    print("   - GET  /health - Health check")
    print("   - GET  /test-pdf - Test PDF parsing")
    print("   - GET  /test-excel - Test Excel parsing")
    print("📋 Supported file formats:")
    print("   - PDF files (.pdf) - Text extraction + OCR")
    print("   - Excel files (.xlsx, .xls, .xlsm)")
    print("   - CSV files (.csv)")
    print("🌐 Server will be available at: http://localhost:5001")
    print("🔗 Frontend should connect to: http://localhost:5001")
    print("📦 Dependencies: PyMuPDF, pandas, openpyxl, xlrd, pytesseract")
    app.run(host='0.0.0.0', port=5001, debug=True)
