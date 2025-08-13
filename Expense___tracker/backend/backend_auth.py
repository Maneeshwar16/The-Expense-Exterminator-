from flask import Flask, request, jsonify, session
from flask_cors import CORS
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
import sqlite3
import hashlib
import secrets
import os
from datetime import datetime, timedelta
import json
from typing import List, Dict, Any
import fitz  # PyMuPDF
import pytesseract
from pdfminer.high_level import extract_text
from PIL import Image
import io
import re
import time
import traceback

# Import existing processors
from backend.paytmapp import parse_paytm_transactions, is_text_based as paytm_is_text_based, ocr_pdf as paytm_ocr_pdf
from file_upload_processor import extract_pdf_data, extract_excel_data

app = Flask(__name__)
app.config['SECRET_KEY'] = secrets.token_hex(16)
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)

# Enable CORS with credentials support
CORS(app, supports_credentials=True, origins=['http://localhost:3000', 'http://localhost:5173'])

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Database setup
DATABASE = 'expense_tracker.db'

class User(UserMixin):
    def __init__(self, id, email, display_name, created_at):
        self.id = id
        self.email = email
        self.display_name = display_name
        self.created_at = created_at

@login_manager.user_loader
def load_user(user_id):
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))
    user_data = cursor.fetchone()
    conn.close()
    
    if user_data:
        return User(user_data[0], user_data[1], user_data[3], user_data[4])
    return None

def init_database():
    """Initialize the SQLite database with required tables."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            display_name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Transactions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            merchant TEXT NOT NULL,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT,
            platform TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Categories table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            color TEXT DEFAULT '#3B82F6',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Budgets table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS budgets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            category TEXT NOT NULL,
            amount REAL NOT NULL,
            period TEXT DEFAULT 'monthly',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    conn.commit()
    conn.close()

def hash_password(password: str) -> str:
    """Hash a password with salt."""
    salt = secrets.token_hex(16)
    password_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return salt + password_hash.hex()

def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash."""
    salt = hashed[:32]
    stored_hash = hashed[32:]
    password_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return password_hash.hex() == stored_hash

# Authentication Routes
@app.route('/api/auth/register', methods=['POST'])
def register():
    """Register a new user."""
    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password are required'}), 400
    
    email = data['email'].lower().strip()
    password = data['password']
    display_name = data.get('displayName', email.split('@')[0])
    
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters long'}), 400
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    try:
        # Check if user already exists
        cursor.execute('SELECT id FROM users WHERE email = ?', (email,))
        if cursor.fetchone():
            return jsonify({'error': 'User already exists with this email'}), 400
        
        # Create new user
        password_hash = hash_password(password)
        cursor.execute('''
            INSERT INTO users (email, password_hash, display_name)
            VALUES (?, ?, ?)
        ''', (email, password_hash, display_name))
        
        user_id = cursor.lastrowid
        conn.commit()
        
        # Create default categories for new user
        default_categories = [
            ('Food & Dining', '#EF4444'),
            ('Transportation', '#F59E0B'),
            ('Shopping', '#8B5CF6'),
            ('Entertainment', '#EC4899'),
            ('Bills & Utilities', '#10B981'),
            ('Healthcare', '#06B6D4'),
            ('Other', '#6B7280')
        ]
        
        for category_name, color in default_categories:
            cursor.execute('''
                INSERT INTO categories (user_id, name, color)
                VALUES (?, ?, ?)
            ''', (user_id, category_name, color))
        
        conn.commit()
        
        # Log in the user
        user = User(user_id, email, display_name, datetime.now())
        login_user(user, remember=True)
        session.permanent = True
        
        return jsonify({
            'success': True,
            'user': {
                'id': user_id,
                'email': email,
                'displayName': display_name,
                'createdAt': datetime.now().isoformat()
            }
        })
        
    except Exception as e:
        conn.rollback()
        return jsonify({'error': f'Registration failed: {str(e)}'}), 500
    finally:
        conn.close()

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login user."""
    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password are required'}), 400
    
    email = data['email'].lower().strip()
    password = data['password']
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM users WHERE email = ?', (email,))
    user_data = cursor.fetchone()
    conn.close()
    
    if not user_data or not verify_password(password, user_data[2]):
        return jsonify({'error': 'Invalid email or password'}), 401
    
    user = User(user_data[0], user_data[1], user_data[3], user_data[4])
    login_user(user, remember=True)
    session.permanent = True
    
    return jsonify({
        'success': True,
        'user': {
            'id': user_data[0],
            'email': user_data[1],
            'displayName': user_data[3],
            'createdAt': user_data[4]
        }
    })

@app.route('/api/auth/logout', methods=['POST'])
@login_required
def logout():
    """Logout user."""
    logout_user()
    session.clear()
    return jsonify({'success': True})

@app.route('/api/auth/user', methods=['GET'])
@login_required
def get_current_user():
    """Get current authenticated user."""
    return jsonify({
        'success': True,
        'user': {
            'id': current_user.id,
            'email': current_user.email,
            'displayName': current_user.display_name,
            'createdAt': current_user.created_at
        }
    })

# Transaction Management Routes
@app.route('/api/transactions', methods=['GET'])
@login_required
def get_transactions():
    """Get user's transactions."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, date, merchant, type, amount, category, platform, created_at
        FROM transactions 
        WHERE user_id = ? 
        ORDER BY date DESC, created_at DESC
    ''', (current_user.id,))
    
    transactions = []
    for row in cursor.fetchall():
        transactions.append({
            'id': row[0],
            'date': row[1],
            'merchant': row[2],
            'type': row[3],
            'amount': row[4],
            'category': row[5],
            'platform': row[6],
            'createdAt': row[7]
        })
    
    conn.close()
    return jsonify({'success': True, 'transactions': transactions})

@app.route('/api/transactions', methods=['POST'])
@login_required
def add_transactions():
    """Add multiple transactions."""
    data = request.get_json()
    
    if not data or not data.get('transactions'):
        return jsonify({'error': 'Transactions data is required'}), 400
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    try:
        added_count = 0
        for transaction in data['transactions']:
            cursor.execute('''
                INSERT INTO transactions (user_id, date, merchant, type, amount, category, platform)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                current_user.id,
                transaction.get('date'),
                transaction.get('merchant'),
                transaction.get('type'),
                transaction.get('amount'),
                transaction.get('category', 'Other'),
                transaction.get('platform', 'Unknown')
            ))
            added_count += 1
        
        conn.commit()
        return jsonify({'success': True, 'added': added_count})
        
    except Exception as e:
        conn.rollback()
        return jsonify({'error': f'Failed to add transactions: {str(e)}'}), 500
    finally:
        conn.close()

@app.route('/api/transactions/<int:transaction_id>', methods=['DELETE'])
@login_required
def delete_transaction(transaction_id):
    """Delete a transaction."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            DELETE FROM transactions 
            WHERE id = ? AND user_id = ?
        ''', (transaction_id, current_user.id))
        
        if cursor.rowcount == 0:
            return jsonify({'error': 'Transaction not found'}), 404
        
        conn.commit()
        return jsonify({'success': True})
        
    except Exception as e:
        conn.rollback()
        return jsonify({'error': f'Failed to delete transaction: {str(e)}'}), 500
    finally:
        conn.close()

# PDF Processing Routes (with authentication)
@app.route('/api/process-phonepe-pdf', methods=['POST'])
@login_required
def process_phonepe_pdf():
    """Process PhonePe PDF and extract transactions."""
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    if not file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "File must be a PDF"}), 400

    try:
        # Save uploaded file temporarily
        temp_path = f"temp_{current_user.id}_{file.filename}"
        file.save(temp_path)

        # Check if PDF is text-based or scanned
        has_text, extracted_text = is_text_based(temp_path)

        if has_text:
            text_data = extracted_text
            processing_method = "text_extraction"
        else:
            text_data = ocr_pdf(temp_path)
            processing_method = "ocr"

        # Parse transactions
        transactions = parse_phonepe_transactions(text_data)

        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

        return jsonify({
            "success": True,
            "transactions": transactions,
            "total_transactions": len(transactions),
            "processing_method": processing_method,
            "platform": "PhonePe"
        })

    except Exception as e:
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({"error": f"Processing failed: {str(e)}"}), 500

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

def parse_phonepe_transactions(text: str) -> List[Dict[str, Any]]:
    """Extract date, merchant, type, and amount from PhonePe PDF text."""
    transactions = []

    # Match both "Paid to" (DEBIT) and "Received from" (CREDIT)
    pattern = re.compile(
        r'([A-Za-z]{3}\s+\d{1,2},\s+\d{4})\s+(?:Paid to|Received from)\s+([\s\S]*?)\s+(DEBIT|CREDIT)\s+₹([\d,]+(?:\.\d{1,2})?)',
        re.MULTILINE
    )

    for match in pattern.findall(text):
        date = match[0].strip()
        merchant = re.sub(r'\s+', ' ', match[1]).strip()
        txn_type = match[2].strip()
        amount_str = match[3].replace(',', '')  # remove commas
        try:
            amount = float(amount_str)
        except ValueError:
            continue  # skip invalid numbers

        transactions.append({
            "date": date,
            "merchant": merchant,
            "type": txn_type,
            "amount": amount,
            "platform": "PhonePe"
        })

    return transactions

@app.route('/api/process-paytm-pdf', methods=['POST'])
@login_required
def process_paytm_pdf():
    """Process Paytm PDF and extract transactions."""
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['file']
    if file.filename == '' or not file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "Invalid file"}), 400

    try:
        temp_path = f"temp_{current_user.id}_{file.filename}"
        file.save(temp_path)

        has_text, extracted_text = paytm_is_text_based(temp_path)
        text_data = extracted_text if has_text else paytm_ocr_pdf(temp_path)
        
        transactions = parse_paytm_transactions(text_data)
        
        # Add platform info
        for transaction in transactions:
            transaction['platform'] = 'Paytm'

        if os.path.exists(temp_path):
            os.remove(temp_path)

        return jsonify({
            "success": True,
            "transactions": transactions,
            "total_transactions": len(transactions),
            "platform": "Paytm"
        })

    except Exception as e:
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({"error": f"Processing failed: {str(e)}"}), 500

# Health check
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "Expense Tracker Backend",
        "authentication": "Local SQLite",
        "message": "Backend is running successfully!"
    })

if __name__ == '__main__':
    print("🚀 Starting Expense Tracker Backend with Local Authentication...")
    print("📝 Initializing SQLite database...")
    init_database()
    print("✅ Database initialized successfully!")
    print("📝 Available endpoints:")
    print("   - POST /api/auth/register - Register new user")
    print("   - POST /api/auth/login - Login user")
    print("   - POST /api/auth/logout - Logout user")
    print("   - GET  /api/auth/user - Get current user")
    print("   - GET  /api/transactions - Get user transactions")
    print("   - POST /api/transactions - Add transactions")
    print("   - POST /api/process-phonepe-pdf - Process PhonePe PDF")
    print("   - POST /api/process-paytm-pdf - Process Paytm PDF")
    print("   - GET  /api/health - Health check")
    print("🌐 Server will be available at: http://localhost:5000")
    print("🔐 Authentication: Local SQLite with Flask-Login")
    print("💾 Database: SQLite (expense_tracker.db)")
    app.run(host='0.0.0.0', port=5000, debug=True)
