from flask import Flask, request, jsonify, session
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import fitz  # PyMuPDF
import pytesseract
from pdfminer.high_level import extract_text
from PIL import Image
import io
import re
import os
import time
import traceback
from typing import List, Dict, Any
from datetime import datetime
import uuid

# Import Paytm processor functions
from paytmapp import parse_paytm_transactions, is_text_based as paytm_is_text_based, ocr_pdf as paytm_ocr_pdf

# Import file upload processor functions
from file_upload_processor import extract_pdf_data, extract_excel_data

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
# Fix for Railway PostgreSQL URL format
database_url = os.environ.get('DATABASE_URL', 'sqlite:///expense_tracker.db')
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

CORS(app, supports_credentials=True)  # Enable CORS for all routes with credentials

# Initialize extensions
db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Database Models
class User(UserMixin, db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Transaction(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    merchant = db.Column(db.String(255), nullable=False)
    category = db.Column(db.String(100), nullable=False)
    date = db.Column(db.Date, nullable=False)
    payment_mode = db.Column(db.String(50), nullable=False)
    notes = db.Column(db.Text)
    source = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Category(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    color = db.Column(db.String(7), nullable=False)  # Hex color
    icon = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class UserPreferences(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False, unique=True)
    currency = db.Column(db.String(10), default='INR')
    theme = db.Column(db.String(20), default='light')
    notifications_enabled = db.Column(db.Boolean, default=True)
    auto_categorize = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(user_id)

# Helper functions
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

def parse_transactions(text: str) -> List[Dict[str, Any]]:
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
            "amount": amount
        })

    return transactions

# Authentication Routes
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('password') or not data.get('name'):
        return jsonify({'error': 'Missing required fields'}), 400
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 409
    
    user = User(
        email=data['email'],
        name=data['name']
    )
    user.set_password(data['password'])
    
    db.session.add(user)
    db.session.commit()
    
    # Create default preferences
    preferences = UserPreferences(user_id=user.id)
    db.session.add(preferences)
    db.session.commit()
    
    login_user(user)
    
    return jsonify({
        'user': {
            'id': user.id,
            'email': user.email,
            'name': user.name
        }
    }), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Missing email or password'}), 400
    
    user = User.query.filter_by(email=data['email']).first()
    
    if user and user.check_password(data['password']):
        login_user(user)
        return jsonify({
            'user': {
                'id': user.id,
                'email': user.email,
                'name': user.name
            }
        })
    
    return jsonify({'error': 'Invalid email or password'}), 401

@app.route('/api/auth/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'message': 'Logged out successfully'})

@app.route('/api/auth/profile', methods=['GET'])
@login_required
def get_profile():
    return jsonify({
        'user': {
            'id': current_user.id,
            'email': current_user.email,
            'name': current_user.name
        }
    })

# Transaction Routes
@app.route('/api/transactions', methods=['GET'])
@login_required
def get_transactions():
    transactions = Transaction.query.filter_by(user_id=current_user.id).order_by(Transaction.date.desc()).all()
    
    return jsonify([{
        'id': t.id,
        'userId': t.user_id,
        'amount': t.amount,
        'merchant': t.merchant,
        'category': t.category,
        'date': t.date.isoformat(),
        'paymentMode': t.payment_mode,
        'notes': t.notes,
        'source': t.source,
        'createdAt': t.created_at.isoformat(),
        'updatedAt': t.updated_at.isoformat()
    } for t in transactions])

@app.route('/api/transactions', methods=['POST'])
@login_required
def add_transaction():
    data = request.get_json()
    
    transaction = Transaction(
        user_id=current_user.id,
        amount=data['amount'],
        merchant=data['merchant'],
        category=data['category'],
        date=datetime.strptime(data['date'], '%Y-%m-%d').date(),
        payment_mode=data['paymentMode'],
        notes=data.get('notes'),
        source=data['source']
    )
    
    db.session.add(transaction)
    db.session.commit()
    
    return jsonify({
        'id': transaction.id,
        'userId': transaction.user_id,
        'amount': transaction.amount,
        'merchant': transaction.merchant,
        'category': transaction.category,
        'date': transaction.date.isoformat(),
        'paymentMode': transaction.payment_mode,
        'notes': transaction.notes,
        'source': transaction.source,
        'createdAt': transaction.created_at.isoformat(),
        'updatedAt': transaction.updated_at.isoformat()
    }), 201

@app.route('/api/transactions/<transaction_id>', methods=['PUT'])
@login_required
def update_transaction(transaction_id):
    transaction = Transaction.query.filter_by(id=transaction_id, user_id=current_user.id).first()
    
    if not transaction:
        return jsonify({'error': 'Transaction not found'}), 404
    
    data = request.get_json()
    
    if 'amount' in data:
        transaction.amount = data['amount']
    if 'merchant' in data:
        transaction.merchant = data['merchant']
    if 'category' in data:
        transaction.category = data['category']
    if 'date' in data:
        transaction.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
    if 'paymentMode' in data:
        transaction.payment_mode = data['paymentMode']
    if 'notes' in data:
        transaction.notes = data['notes']
    if 'source' in data:
        transaction.source = data['source']
    
    db.session.commit()
    
    return jsonify({
        'id': transaction.id,
        'userId': transaction.user_id,
        'amount': transaction.amount,
        'merchant': transaction.merchant,
        'category': transaction.category,
        'date': transaction.date.isoformat(),
        'paymentMode': transaction.payment_mode,
        'notes': transaction.notes,
        'source': transaction.source,
        'createdAt': transaction.created_at.isoformat(),
        'updatedAt': transaction.updated_at.isoformat()
    })

@app.route('/api/transactions/<transaction_id>', methods=['DELETE'])
@login_required
def delete_transaction(transaction_id):
    transaction = Transaction.query.filter_by(id=transaction_id, user_id=current_user.id).first()
    
    if not transaction:
        return jsonify({'error': 'Transaction not found'}), 404
    
    db.session.delete(transaction)
    db.session.commit()
    
    return jsonify({'message': 'Transaction deleted successfully'})

@app.route('/api/transactions/bulk', methods=['POST'])
@login_required
def bulk_add_transactions():
    data = request.get_json()
    transactions_data = data.get('transactions', [])
    
    transactions = []
    for t_data in transactions_data:
        transaction = Transaction(
            user_id=current_user.id,
            amount=t_data['amount'],
            merchant=t_data['merchant'],
            category=t_data['category'],
            date=datetime.strptime(t_data['date'], '%Y-%m-%d').date(),
            payment_mode=t_data['paymentMode'],
            notes=t_data.get('notes'),
            source=t_data['source']
        )
        transactions.append(transaction)
    
    db.session.add_all(transactions)
    db.session.commit()
    
    return jsonify([{
        'id': t.id,
        'userId': t.user_id,
        'amount': t.amount,
        'merchant': t.merchant,
        'category': t.category,
        'date': t.date.isoformat(),
        'paymentMode': t.payment_mode,
        'notes': t.notes,
        'source': t.source,
        'createdAt': t.created_at.isoformat(),
        'updatedAt': t.updated_at.isoformat()
    } for t in transactions]), 201

# Category Routes
@app.route('/api/categories', methods=['GET'])
@login_required
def get_categories():
    categories = Category.query.filter_by(user_id=current_user.id).all()
    
    return jsonify([{
        'id': c.id,
        'name': c.name,
        'color': c.color,
        'icon': c.icon
    } for c in categories])

@app.route('/api/categories', methods=['POST'])
@login_required
def add_category():
    data = request.get_json()
    
    category = Category(
        user_id=current_user.id,
        name=data['name'],
        color=data['color'],
        icon=data['icon']
    )
    
    db.session.add(category)
    db.session.commit()
    
    return jsonify({
        'id': category.id,
        'name': category.name,
        'color': category.color,
        'icon': category.icon
    }), 201

@app.route('/api/categories/<category_id>', methods=['PUT'])
@login_required
def update_category(category_id):
    category = Category.query.filter_by(id=category_id, user_id=current_user.id).first()
    
    if not category:
        return jsonify({'error': 'Category not found'}), 404
    
    data = request.get_json()
    
    if 'name' in data:
        category.name = data['name']
    if 'color' in data:
        category.color = data['color']
    if 'icon' in data:
        category.icon = data['icon']
    
    db.session.commit()
    
    return jsonify({
        'id': category.id,
        'name': category.name,
        'color': category.color,
        'icon': category.icon
    })

@app.route('/api/categories/<category_id>', methods=['DELETE'])
@login_required
def delete_category(category_id):
    category = Category.query.filter_by(id=category_id, user_id=current_user.id).first()
    
    if not category:
        return jsonify({'error': 'Category not found'}), 404
    
    db.session.delete(category)
    db.session.commit()
    
    return jsonify({'message': 'Category deleted successfully'})

# User Preferences Routes
@app.route('/api/user-preferences', methods=['GET'])
@login_required
def get_user_preferences():
    preferences = UserPreferences.query.filter_by(user_id=current_user.id).first()
    
    if not preferences:
        preferences = UserPreferences(user_id=current_user.id)
        db.session.add(preferences)
        db.session.commit()
    
    return jsonify({
        'currency': preferences.currency,
        'theme': preferences.theme,
        'notificationsEnabled': preferences.notifications_enabled,
        'autoCategorize': preferences.auto_categorize
    })

@app.route('/api/user-preferences', methods=['PUT'])
@login_required
def update_user_preferences():
    preferences = UserPreferences.query.filter_by(user_id=current_user.id).first()
    
    if not preferences:
        preferences = UserPreferences(user_id=current_user.id)
        db.session.add(preferences)
    
    data = request.get_json()
    
    if 'currency' in data:
        preferences.currency = data['currency']
    if 'theme' in data:
        preferences.theme = data['theme']
    if 'notificationsEnabled' in data:
        preferences.notifications_enabled = data['notificationsEnabled']
    if 'autoCategorize' in data:
        preferences.auto_categorize = data['autoCategorize']
    
    db.session.commit()
    
    return jsonify({
        'currency': preferences.currency,
        'theme': preferences.theme,
        'notificationsEnabled': preferences.notifications_enabled,
        'autoCategorize': preferences.auto_categorize
    })

# File Processing Routes (existing code)
@app.route('/process-phonepe-pdf', methods=['POST'])
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
        temp_path = f"temp_{file.filename}"
        file.save(temp_path)

        # Check if PDF is text-based or scanned
        has_text, extracted_text = is_text_based(temp_path)

        if has_text:
            text_data = extracted_text
            processing_method = "text_extraction"
        else:
            text_data = ocr_pdf(temp_path)
            processing_method = "ocr"

        # Debug first 500 chars
        print("\n===== DEBUG: FIRST 500 CHARS OF EXTRACTED TEXT =====")
        print(text_data[:500])
        print("====================================================\n")

        # Parse transactions
        transactions = parse_transactions(text_data)

        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

        return jsonify({
            "success": True,
            "transactions": transactions,
            "total_transactions": len(transactions),
            "processing_method": processing_method,
            "raw_text": text_data[:1000] + "..." if len(text_data) > 1000 else text_data
        })

    except Exception as e:
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({"error": f"Processing failed: {str(e)}"}), 500

@app.route('/process-paytm-pdf', methods=['POST'])
def process_paytm_pdf():
    """Process Paytm PDF and extract transactions using imported Paytm processor."""
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    if not file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "File must be a PDF"}), 400

    try:
        # Save uploaded file temporarily
        temp_path = f"temp_paytm_{file.filename}"
        file.save(temp_path)

        # Use Paytm-specific functions
        has_text, extracted_text = paytm_is_text_based(temp_path)

        if has_text:
            text_data = extracted_text
            processing_method = "text_extraction"
        else:
            text_data = paytm_ocr_pdf(temp_path)
            processing_method = "ocr"

        # Debug output
        print("\n===== DEBUG: PAYTM PDF TEXT EXTRACTION =====")
        print(f"Text length: {len(text_data)} characters")
        print("First 1000 chars:")
        print(text_data[:1000])
        print("============================================\n")

        # Parse transactions using Paytm parser
        transactions = parse_paytm_transactions(text_data)

        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

        return jsonify({
            "success": True,
            "transactions": transactions,
            "total_transactions": len(transactions),
            "processing_method": processing_method,
            "service": "Paytm",
            "raw_text": text_data[:1500] + "..." if len(text_data) > 1500 else text_data
        })

    except Exception as e:
        if 'temp_path' in locals() and os.path.exists(temp_path):
            os.remove(temp_path)
        return jsonify({"error": f"Paytm processing failed: {str(e)}"}), 500

@app.route('/upload-file', methods=['POST'])
def upload_file():
    """Upload and process PDF or Excel files using imported functions."""
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

        # Process file based on type using imported functions
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
            "file_type": "Unknown"
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "Expense Tracker API",
        "supported_apps": ["PhonePe", "Paytm"],
        "message": "Backend is running successfully!"
    })

@app.route('/test', methods=['GET'])
def test_parsing():
    """Test PhonePe parsing."""
    sample_text = """
    Feb 13, 2025 Paid to Salaar Devrartha Raisar DEBIT ₹1,000
    Feb 12, 2025 Received from ABC Pvt Ltd CREDIT ₹500
    Feb 11, 2025 Paid to Yashhh_v DEBIT ₹90
    Feb 10, 2025 Paid to Swiggy DEBIT ₹250
    Feb 09, 2025 Received from DEF Corp CREDIT ₹1,200
    """
    transactions = parse_transactions(sample_text)
    return jsonify({
        "success": True,
        "service": "PhonePe",
        "transactions": transactions,
        "total_transactions": len(transactions),
        "sample_text": sample_text
    })

@app.route('/test-paytm', methods=['GET'])
def test_paytm_parsing():
    """Test Paytm parsing using imported functions."""
    sample_text = """
    15 Jul
    8:02 PM
    Paid to Airtel
    UPI ID: airtel-prepaid.paytm@ptybl on
    UPI Ref No: 519687584286
    Note: PrepaidRecha
    rge,Data1GB
    Tag:
    # Bill Payments
    State Bank
    Of India - 17
    - Rs.22
    """
    transactions = parse_paytm_transactions(sample_text)
    return jsonify({
        "success": True,
        "service": "Paytm",
        "transactions": transactions,
        "total_transactions": len(transactions),
        "sample_text": sample_text[:500] + "..."
    })

if __name__ == '__main__':
    # Create database tables
    with app.app_context():
        db.create_all()
    
    # Get port from environment variable (for production)
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    print("🚀 Starting Expense Tracker API...")
    print("📝 Available endpoints:")
    print("   - POST /api/auth/register - User registration")
    print("   - POST /api/auth/login - User login")
    print("   - POST /api/auth/logout - User logout")
    print("   - GET  /api/auth/profile - Get user profile")
    print("   - GET  /api/transactions - Get user transactions")
    print("   - POST /api/transactions - Add transaction")
    print("   - PUT  /api/transactions/<id> - Update transaction")
    print("   - DELETE /api/transactions/<id> - Delete transaction")
    print("   - POST /api/transactions/bulk - Bulk add transactions")
    print("   - GET  /api/categories - Get user categories")
    print("   - POST /api/categories - Add category")
    print("   - PUT  /api/categories/<id> - Update category")
    print("   - DELETE /api/categories/<id> - Delete category")
    print("   - GET  /api/user-preferences - Get user preferences")
    print("   - PUT  /api/user-preferences - Update user preferences")
    print("   - POST /process-phonepe-pdf - Process PhonePe PDF files")
    print("   - POST /process-paytm-pdf - Process Paytm PDF files")
    print("   - POST /upload-file - Upload and process files")
    print("   - GET  /health - Health check")
    print("📋 Supported file formats:")
    print("   - PDF files (.pdf) - Text extraction + OCR")
    print("   - Excel files (.xlsx, .xls, .xlsm)")
    print("   - CSV files (.csv)")
    print(f"🌐 Server will be available at: http://localhost:{port}")
    print(f"🔗 Frontend should connect to: http://localhost:{port}")
    print(f"🐛 Debug mode: {debug}")
    app.run(host='0.0.0.0', port=port, debug=debug)
