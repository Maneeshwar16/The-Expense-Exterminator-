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

# File upload processor functions (moved inline)
def extract_pdf_data(file_path: str) -> List[Dict[str, Any]]:
    """Extract data from PDF files."""
    try:
        text = extract_text(file_path)
        return [{"text": text, "type": "pdf"}]
    except Exception as e:
        return [{"error": str(e), "type": "pdf"}]

def extract_excel_data(file_path: str) -> List[Dict[str, Any]]:
    """Extract data from Excel files."""
    try:
        import pandas as pd
        df = pd.read_excel(file_path)
        return df.to_dict('records')
    except Exception as e:
        return [{"error": str(e), "type": "excel"}]

app = Flask(__name__)

# --- CONFIGURATION ---
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')

# Fix for Railway/Heroku PostgreSQL URL format
database_url = os.environ.get('DATABASE_URL', 'sqlite:///expense_tracker.db')
if database_url and database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# --- EXTENSIONS ---
# Centralized CORS Configuration
CORS(app, supports_credentials=True, origins=[
    "http://localhost:5173",  # Local frontend
    "https://the-expense-exterminator-oh37.vercel.app" # Deployed frontend
])

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# --- DATABASE MODELS ---
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
    color = db.Column(db.String(7), nullable=False)
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

# --- HELPER FUNCTIONS ---
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
    pattern = re.compile(
        r'([A-Za-z]{3}\s+\d{1,2},\s+\d{4})\s+(?:Paid to|Received from)\s+([\s\S]*?)\s+(DEBIT|CREDIT)\s+₹([\d,]+(?:\.\d{1,2})?)',
        re.MULTILINE
    )
    for match in pattern.findall(text):
        date, merchant, txn_type, amount_str = match
        try:
            transactions.append({
                "date": date.strip(),
                "merchant": re.sub(r'\s+', ' ', merchant).strip(),
                "type": txn_type.strip(),
                "amount": float(amount_str.replace(',', ''))
            })
        except ValueError:
            continue
    return transactions

# --- ROOT AND HEALTH ROUTES ---
@app.route('/')
def home():
    """Root endpoint to confirm the API is running."""
    return jsonify({
        "status": "online",
        "service": "The Expense Exterminator API",
        "message": "Welcome! The backend is running successfully."
    })

@app.route('/health')
def health_check():
    """Health check endpoint for Render."""
    return jsonify({"status": "healthy"}), 200


# --- AUTHENTICATION ROUTES ---
@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password') or not data.get('name'):
        return jsonify({'error': 'Missing required fields'}), 400
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 409
    
    user = User(email=data['email'], name=data['name'])
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    
    preferences = UserPreferences(user_id=user.id)
    db.session.add(preferences)
    db.session.commit()
    
    login_user(user)
    return jsonify({'user': {'id': user.id, 'email': user.email, 'name': user.name}}), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Missing email or password'}), 400
    
    user = User.query.filter_by(email=data['email']).first()
    if user and user.check_password(data['password']):
        login_user(user)
        return jsonify({'user': {'id': user.id, 'email': user.email, 'name': user.name}})
    
    return jsonify({'error': 'Invalid email or password'}), 401

@app.route('/api/auth/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'message': 'Logged out successfully'})

@app.route('/api/auth/profile', methods=['GET'])
@login_required
def get_profile():
    return jsonify({'user': {'id': current_user.id, 'email': current_user.email, 'name': current_user.name}})


# --- TRANSACTION ROUTES ---
@app.route('/api/transactions', methods=['GET'])
@login_required
def get_transactions():
    transactions = Transaction.query.filter_by(user_id=current_user.id).order_by(Transaction.date.desc()).all()
    return jsonify([{
        'id': t.id, 'userId': t.user_id, 'amount': t.amount, 'merchant': t.merchant,
        'category': t.category, 'date': t.date.isoformat(), 'paymentMode': t.payment_mode,
        'notes': t.notes, 'source': t.source, 'createdAt': t.created_at.isoformat(),
        'updatedAt': t.updated_at.isoformat()
    } for t in transactions])

@app.route('/api/transactions', methods=['POST'])
@login_required
def add_transaction():
    data = request.get_json()
    try:
        transaction = Transaction(
            user_id=current_user.id, amount=data['amount'], merchant=data['merchant'],
            category=data['category'], date=datetime.strptime(data['date'], '%Y-%m-%d').date(),
            payment_mode=data['paymentMode'], notes=data.get('notes'), source=data['source']
        )
        db.session.add(transaction)
        db.session.commit()
        return jsonify({'id': transaction.id}), 201
    except KeyError as e:
        return jsonify({"error": f"Missing field: {e}"}), 400

# (Your other routes like update_transaction, delete_transaction, bulk_add_transactions, etc. go here)
# ... The rest of your existing routes are perfect, no changes needed ...

# --- FILE PROCESSING ROUTES ---
@app.route('/process-phonepe-pdf', methods=['POST'])
def process_phonepe_pdf():
    if 'file' not in request.files: return jsonify({"error": "No file provided"}), 400
    file = request.files['file']
    if file.filename == '' or not file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "Invalid PDF file"}), 400

    temp_path = f"temp_{uuid.uuid4()}.pdf"
    try:
        file.save(temp_path)
        has_text, extracted_text = is_text_based(temp_path)
        text_data = extracted_text if has_text else ocr_pdf(temp_path)
        transactions = parse_transactions(text_data)
        os.remove(temp_path)
        return jsonify({
            "success": True, "transactions": transactions,
            "total_transactions": len(transactions),
            "processing_method": "text_extraction" if has_text else "ocr"
        })
    except Exception as e:
        if os.path.exists(temp_path): os.remove(temp_path)
        return jsonify({"error": f"Processing failed: {str(e)}"}), 500

@app.route('/process-paytm-pdf', methods=['POST'])
def process_paytm_pdf():
    if 'file' not in request.files: return jsonify({"error": "No file provided"}), 400
    file = request.files['file']
    if file.filename == '' or not file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "Invalid PDF file"}), 400
        
    temp_path = f"temp_paytm_{uuid.uuid4()}.pdf"
    try:
        file.save(temp_path)
        has_text, extracted_text = paytm_is_text_based(temp_path)
        text_data = extracted_text if has_text else paytm_ocr_pdf(temp_path)
        transactions = parse_paytm_transactions(text_data)
        os.remove(temp_path)
        return jsonify({
            "success": True, "transactions": transactions,
            "total_transactions": len(transactions),
            "processing_method": "text_extraction" if has_text else "ocr",
            "service": "Paytm"
        })
    except Exception as e:
        if os.path.exists(temp_path): os.remove(temp_path)
        return jsonify({"error": f"Paytm processing failed: {str(e)}"}), 500

# (Your other routes like upload_file and test routes go here)
# ... They are also fine as they are ...


# --- MAIN EXECUTION ---
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV') == 'development'
    
    app.run(host='0.0.0.0', port=port, debug=debug)