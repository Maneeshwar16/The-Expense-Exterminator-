from flask import Flask, request, jsonify
from flask_cors import CORS
import fitz  # PyMuPDF
import pytesseract
from pdfminer.high_level import extract_text
from PIL import Image
import io
import re
import os
from typing import List, Dict, Any

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes


def is_text_based(pdf_path: str) -> tuple[bool, str]:
    """Check if PDF contains selectable text."""
    text = extract_text(pdf_path)
    return bool(text.strip()), text.strip()


def ocr_pdf(pdf_path: str) -> str:
    """Extract text from a scanned PDF using OCR."""
    doc = fitz.open(pdf_path)
    all_text = []
    for page_num in range(len(doc)):
        pix = doc[page_num].get_pixmap(dpi=300)
        img = Image.open(io.BytesIO(pix.tobytes("png")))
        text = pytesseract.image_to_string(img, lang="eng")
        all_text.append(text)
    return "\n".join(all_text)


def parse_supermoney_transactions(text: str) -> List[Dict[str, Any]]:
    """Extract transactions from SuperMoney PDF text."""
    transactions = []
    
    print(f"\n===== SUPERMONEY PARSER DEBUG =====")
    print(f"Input text length: {len(text)} characters")
    print("FULL TEXT CONTENT:")
    print(repr(text))  # Show exact text with escape characters
    print("\nFIRST 1500 CHARACTERS:")
    print(text[:1500])
    print("===============================\n")

    # Split text into lines for easier processing
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    print(f"Total lines after splitting: {len(lines)}")
    
    # Show all lines for debugging
    for i, line in enumerate(lines):
        print(f"Line {i}: '{line}'")
    
    print("\n=== STARTING TRANSACTION PARSING ===")
    
    # Look for the specific SuperMoney table format
    # Expected format: SIMHADRI SUPER MARKET | SBI 7317 | -10.00 | 25 January 2025 | SUCCESS
    
    for i, line in enumerate(lines):
        print(f"\nProcessing line {i}: '{line}'")
        
        # Skip empty lines
        if not line:
            print("  -> Skipping empty line")
            continue
            
        # Skip headers and metadata
        if any(skip_word in line.lower() for skip_word in [
            'transaction history', 'powered by', 'yes bank', 'upi',
            'name bank amount date status', 'january 2025 to'
        ]):
            print(f"  -> Skipping header/metadata: {line}")
            continue
        
        # Check if line contains key elements we expect
        has_sbi = 'sbi' in line.lower()
        has_amount = re.search(r'-?\d+\.\d+', line)
        has_january = 'january' in line.lower()
        has_success = 'success' in line.lower()
        
        print(f"  -> Line analysis: SBI={has_sbi}, Amount={bool(has_amount)}, January={has_january}, Success={has_success}")
        
        # Try multiple approaches to find transactions
        if has_sbi and has_amount:
            print(f"  -> Found potential transaction (has SBI + amount): {line}")
            transaction = parse_supermoney_line(line)
            if transaction:
                transactions.append(transaction)
                print(f"  ✅ Successfully parsed: {transaction}")
            else:
                print(f"  ❌ Failed to parse transaction line")
        elif has_amount and (has_january or has_success):
            print(f"  -> Found potential transaction (has amount + date/status): {line}")
            transaction = parse_supermoney_line(line)
            if transaction:
                transactions.append(transaction)
                print(f"  ✅ Successfully parsed: {transaction}")
            else:
                print(f"  ❌ Failed to parse transaction line")
        else:
            print(f"  -> Not a transaction line")
    
    # Fallback: try to find any line with amount pattern
    if not transactions:
        print("\n=== FALLBACK: Looking for any amount patterns ===")
        for i, line in enumerate(lines):
            if re.search(r'-?\d+\.\d+', line):
                print(f"Trying fallback parse on line {i}: {line}")
                transaction = parse_supermoney_line(line)
                if transaction:
                    transactions.append(transaction)
                    print(f"✅ Fallback parsed: {transaction}")
    
    print(f"\n🎯 FINAL RESULT: {len(transactions)} transactions extracted")
    for i, tx in enumerate(transactions):
        print(f"Transaction {i+1}: {tx}")
    
    return transactions


def parse_supermoney_line(line: str) -> Dict[str, Any]:
    """Parse a SuperMoney transaction line with the specific format."""
    print(f"\n  Parsing SuperMoney line: '{line}'")
    
    # Clean the line
    line = ' '.join(line.split())
    
    # Try regex pattern for: NAME BANK ACCOUNT AMOUNT DATE STATUS
    # Example: SIMHADRI SUPER MARKET SBI 7317 -10.00 25 January 2025 SUCCESS
    pattern = r'^(.+?)\s+(SBI|HDFC|ICICI|AXIS)\s+(\d+)\s+(-?\d+\.\d+)\s+(\d+\s+\w+\s+\d{4})\s+(SUCCESS|FAILED|PENDING)$'
    match = re.match(pattern, line, re.IGNORECASE)
    
    if match:
        name = match.group(1).strip()
        bank_name = match.group(2).strip()
        account = match.group(3).strip()
        amount = float(match.group(4))
        date = match.group(5).strip()
        status = match.group(6).strip()
        
        transaction = {
            'name': name,
            'bank': f"{bank_name} {account}",
            'amount': amount,
            'date': date,
            'status': status
        }
        print(f"    ✅ Regex matched: {transaction}")
        return transaction
    
    # Fallback: try to extract manually by finding key components
    parts = line.split()
    
    # Find amount (negative decimal number)
    amount_idx = -1
    amount_val = None
    for i, part in enumerate(parts):
        if re.match(r'-\d+\.\d+$', part):
            try:
                amount_val = float(part)
                amount_idx = i
                break
            except ValueError:
                continue
    
    if amount_idx == -1 or amount_val is None:
        print(f"    ❌ No amount found")
        return None
    
    # Extract components
    name_parts = []
    bank_parts = []
    date_parts = []
    status = "SUCCESS"
    
    # Name is before bank
    bank_found = False
    for i, part in enumerate(parts):
        if i >= amount_idx:
            break
        if part.upper() in ['SBI', 'HDFC', 'ICICI', 'AXIS'] or part.isdigit():
            bank_found = True
            bank_parts.append(part)
        elif not bank_found:
            name_parts.append(part)
        else:
            bank_parts.append(part)
    
    # Date and status are after amount
    for i in range(amount_idx + 1, len(parts)):
        if parts[i].upper() in ['SUCCESS', 'FAILED', 'PENDING']:
            status = parts[i].upper()
        else:
            date_parts.append(parts[i])
    
    name = ' '.join(name_parts).strip()
    bank = ' '.join(bank_parts).strip()
    date = ' '.join(date_parts).strip()
    
    if name and bank and date:
        transaction = {
            'name': name,
            'bank': bank,
            'amount': amount_val,
            'date': date,
            'status': status
        }
        print(f"    ✅ Manual parse: {transaction}")
        return transaction
    
    print(f"    ❌ Manual parse failed - name: '{name}', bank: '{bank}', date: '{date}'")
    return None


def parse_transaction_line(line: str) -> Dict[str, Any]:
    """Parse a single transaction line into structured data."""
    print(f"\nParsing line: '{line}'")
    
    # Clean the line
    line = ' '.join(line.split())
    
    # Pattern for SuperMoney format: NAME BANK ACCOUNT -AMOUNT DATE STATUS
    # Example: SIMHADRI SUPER MARKET SBI 7317 -10.00 25 January 2025 SUCCESS
    
    # Try multiple parsing approaches
    
    # Approach 1: Look for amount pattern first
    amount_pattern = r'(-?\d+\.?\d*)\s+'
    amount_matches = list(re.finditer(amount_pattern, line))
    
    for amount_match in amount_matches:
        try:
            amount = float(amount_match.group(1))
            amount_start = amount_match.start()
            amount_end = amount_match.end()
            
            # Get parts before amount (name and bank info)
            before_amount = line[:amount_start].strip()
            # Get parts after amount (date and status)
            after_amount = line[amount_end:].strip()
            
            print(f"  Amount: {amount}")
            print(f"  Before amount: '{before_amount}'")
            print(f"  After amount: '{after_amount}'")
            
            # Parse date and status from after_amount
            date_str, status = parse_date_and_status(after_amount)
            
            if not date_str:
                continue
                
            # Parse name and bank from before_amount
            name, bank = parse_name_and_bank(before_amount)
            
            if name and bank:
                transaction = {
                    'name': name,
                    'bank': bank,
                    'amount': amount,
                    'date': date_str,
                    'status': status or 'SUCCESS'
                }
                print(f"  ✅ Successfully parsed: {transaction}")
                return transaction
                
        except ValueError:
            continue
    
    # Approach 2: Use regex pattern matching
    # Pattern: (NAME) (BANK ACCOUNT) (AMOUNT) (DATE) (STATUS)
    pattern = r'^(.+?)\s+(SBI|HDFC|ICICI|AXIS|PNB|BOI|CANARA|UNION|[A-Z]+)\s+(\d+)\s+(-?\d+\.?\d*)\s+(\d+\s+\w+\s+\d{4})\s+(\w+)$'
    match = re.match(pattern, line, re.IGNORECASE)
    
    if match:
        name = match.group(1).strip()
        bank_name = match.group(2).strip()
        account = match.group(3).strip()
        amount = float(match.group(4))
        date = match.group(5).strip()
        status = match.group(6).strip()
        
        transaction = {
            'name': name,
            'bank': f"{bank_name} {account}",
            'amount': amount,
            'date': date,
            'status': status
        }
        print(f"  ✅ Regex parsed: {transaction}")
        return transaction
    
    # Approach 3: Split by common patterns and guess structure
    parts = line.split()
    if len(parts) >= 5:
        # Find amount (should be a number)
        amount_idx = -1
        amount_val = None
        
        for i, part in enumerate(parts):
            try:
                if re.match(r'-?\d+\.?\d*$', part):
                    amount_val = float(part)
                    amount_idx = i
                    break
            except ValueError:
                continue
        
        if amount_idx > 0 and amount_val is not None:
            # Status is likely the last part if it's a known status
            status = parts[-1] if parts[-1].upper() in ['SUCCESS', 'FAILED', 'PENDING'] else 'SUCCESS'
            status_idx = len(parts) - 1 if parts[-1].upper() in ['SUCCESS', 'FAILED', 'PENDING'] else len(parts)
            
            # Date is before status
            date_parts = []
            for i in range(amount_idx + 1, status_idx):
                date_parts.append(parts[i])
            date_str = ' '.join(date_parts) if date_parts else 'Unknown'
            
            # Name and bank are before amount
            name_bank_parts = parts[:amount_idx]
            name, bank = parse_name_and_bank(' '.join(name_bank_parts))
            
            if name and bank:
                transaction = {
                    'name': name,
                    'bank': bank,
                    'amount': amount_val,
                    'date': date_str,
                    'status': status
                }
                print(f"  ✅ Split method parsed: {transaction}")
                return transaction
    
    print(f"  ❌ Could not parse line")
    return None


def parse_name_and_bank(text: str) -> tuple[str, str]:
    """Extract name and bank from combined text."""
    if not text:
        return None, None
    
    parts = text.split()
    if len(parts) < 2:
        return None, None
    
    # Common bank keywords
    bank_keywords = ['SBI', 'HDFC', 'ICICI', 'AXIS', 'PNB', 'BOI', 'CANARA', 'UNION', 'BANK']
    
    # Look for bank keywords
    bank_start_idx = -1
    for i, part in enumerate(parts):
        if any(keyword in part.upper() for keyword in bank_keywords):
            bank_start_idx = i
            break
    
    if bank_start_idx > 0:
        name = ' '.join(parts[:bank_start_idx])
        bank = ' '.join(parts[bank_start_idx:])
        return name.strip(), bank.strip()
    else:
        # Fallback: assume last part is bank/account
        name = ' '.join(parts[:-1])
        bank = parts[-1]
        return name.strip(), bank.strip()


def parse_date_and_status(text: str) -> tuple[str, str]:
    """Extract date and status from text."""
    if not text:
        return None, None
    
    parts = text.split()
    status = None
    
    # Check if last part is a status
    if parts and parts[-1].upper() in ['SUCCESS', 'FAILED', 'PENDING']:
        status = parts[-1].upper()
        date_parts = parts[:-1]
    else:
        date_parts = parts
        status = 'SUCCESS'  # Default
    
    # Try to construct date
    date_str = ' '.join(date_parts) if date_parts else None
    
    # Validate date format (should contain day, month, year)
    if date_str and re.search(r'\d+.*?(January|February|March|April|May|June|July|August|September|October|November|December).*?\d{4}', date_str, re.IGNORECASE):
        return date_str, status
    
    return date_str, status


@app.route('/process-supermoney-pdf', methods=['POST'])
def process_supermoney_pdf():
    """Process SuperMoney PDF and extract transactions."""
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    if not file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "File must be a PDF"}), 400

    try:
        # Save uploaded file temporarily
        temp_path = f"temp_supermoney_{file.filename}"
        file.save(temp_path)

        # Check if PDF is text-based or scanned
        has_text, extracted_text = is_text_based(temp_path)

        if has_text:
            text_data = extracted_text
            processing_method = "text_extraction"
        else:
            text_data = ocr_pdf(temp_path)
            processing_method = "ocr"

        # Debug output
        print("\n===== DEBUG: EXTRACTED TEXT =====")
        print(f"Processing method: {processing_method}")
        print(f"Text length: {len(text_data)} characters")
        print("First 1000 characters:")
        print(text_data[:1000])
        print("Last 500 characters:")
        print(text_data[-500:] if len(text_data) > 500 else text_data)
        print("==================================\n")

        # Parse transactions
        transactions = parse_supermoney_transactions(text_data)

        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

        return jsonify({
            "success": True,
            "transactions": transactions,
            "total_transactions": len(transactions),
            "processing_method": processing_method,
            "raw_text": text_data[:2000] + "..." if len(text_data) > 2000 else text_data
        })

    except Exception as e:
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({"error": f"Processing failed: {str(e)}"}), 500


@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "SuperMoney PDF Processor",
        "message": "SuperMoney backend is running successfully!"
    })


@app.route('/test', methods=['GET'])
def test_parsing():
    """Test parsing with sample SuperMoney data."""
    sample_text = """
    Transaction History
    25 January 2025 to 25 January 2025
    Name Bank Amount Date Status
    SIMHADRI SUPER MARKET SBI 7317 -10.00 25 January 2025 SUCCESS
    OLIV SBI 7317 -100.00 25 January 2025 SUCCESS
    """
    
    transactions = parse_supermoney_transactions(sample_text)
    return jsonify({
        "success": True,
        "transactions": transactions,
        "total_transactions": len(transactions),
        "sample_text": sample_text,
        "debug_info": "This endpoint tests the parser with your exact SuperMoney format"
    })


@app.route('/debug-text', methods=['POST'])
def debug_text():
    """Debug endpoint to see exactly what text is extracted from PDF."""
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['file']
    
    try:
        temp_path = f"debug_supermoney_{file.filename}"
        file.save(temp_path)
        
        # Extract text
        has_text, extracted_text = is_text_based(temp_path)
        
        if not has_text:
            extracted_text = ocr_pdf(temp_path)
        
        # Clean up
        if os.path.exists(temp_path):
            os.remove(temp_path)
        
        return jsonify({
            "success": True,
            "has_selectable_text": has_text,
            "text_length": len(extracted_text),
            "full_text": extracted_text,
            "lines": extracted_text.split('\n')[:50]  # First 50 lines
        })
        
    except Exception as e:
        return jsonify({"error": f"Debug failed: {str(e)}"}), 500


@app.route('/export-csv', methods=['POST'])
def export_transactions_csv():
    """Export transactions to CSV format."""
    try:
        data = request.get_json()
        if not data or 'transactions' not in data:
            return jsonify({"error": "No transactions provided"}), 400
        
        transactions = data['transactions']
        if not transactions:
            return jsonify({"error": "Empty transactions list"}), 400
        
        # Create CSV content
        csv_content = "Name,Bank,Amount,Date,Status\n"
        for tx in transactions:
            csv_content += f'"{tx.get("name", "")}","{tx.get("bank", "")}",{tx.get("amount", 0)},"{tx.get("date", "")}","{tx.get("status", "")}"\n'
        
        return jsonify({
            "success": True,
            "csv_content": csv_content,
            "total_transactions": len(transactions)
        })
        
    except Exception as e:
        return jsonify({"error": f"CSV export failed: {str(e)}"}), 500


if __name__ == '__main__':
    print("💳 Starting SuperMoney PDF Processor Backend...")
    print("📝 Available endpoints:")
    print("   - POST /process-supermoney-pdf - Process SuperMoney PDF files")
    print("   - POST /debug-text - Debug text extraction")
    print("   - POST /export-csv - Export transactions to CSV")
    print("   - GET  /health - Health check")
    print("   - GET  /test - Test parsing with sample SuperMoney data")
    print("🌐 Server will be available at: http://localhost:5002")
    print("🔗 Frontend should connect to: http://localhost:5002")
    print("🎯 Ready to extract SuperMoney transactions!")
    app.run(host='0.0.0.0', port=5002, debug=True)
