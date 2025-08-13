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

# --- App Initialization ---
app = Flask(__name__)

# --- Configuration ---
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-for-development')

# Fix for Production PostgreSQL URL format
database_url = os.environ.get('DATABASE_URL', 'sqlite:///expense_tracker.db')
if database_url and database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)
app.config['SQLALCHEMY_DATABASE_URI'] = database_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# --- Extensions ---
# Centralized CORS Configuration
CORS(app, supports_credentials=True, origins=[
    "http://localhost:5173",  # Local dev environment
    "https://the-expense-exterminator-oh37.vercel.app"  # Deployed frontend
])

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)

# --- IMPORTANT FIX FOR API AUTHENTICATION ---
# This stops Flask-Login from redirecting API requests, which causes errors.
# Instead, it will return a proper 401 Unauthorized error that our frontend can handle.
@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({"error": "Authentication required"}), 401
# --- END OF FIX ---

# --- Database Models ---
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

# --- Helper Functions ---
# (These are all correct and do not need changes)
def is_text_based(pdf_path: str) -> tuple[bool, str]:
    text = extract_text(pdf_path)
    return bool(text.strip()), text.strip()

def ocr_pdf(pdf_path: str) -> str:
    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        text += page.get_text()
    return text

def parse_transactions(text: str) -> List[Dict[str, Any]]:
    transactions = []
    pattern = re.compile(
        r'([A-Za-z]{3}\s+\d{1,2},\s+\d{4})\s+(?:Paid to|Received from)\s+([\s\S]*?)\s+(DEBIT|CREDIT)\s+₹([\d,]+(?:\.\d{1,2})?)',
        re.MULTILINE
    )
    for match in pattern.findall(text):
        try:
            transactions.append({
                "date": match[0].strip(), "merchant": re.sub(r'\s+', ' ', match[1]).strip(),
                "type": match[2].strip(), "amount": float(match[3].replace(',', ''))
            })
        except (ValueError, IndexError):
            continue
    return transactions

# --- ROUTES ---
@app.route('/')
def home():
    """Root endpoint to confirm the API is running."""
    return jsonify({"status": "online", "message": "Welcome! The backend is running successfully."})

# Authentication Routes
@app.route('/api/auth/register', methods=['POST'])
def register():
    # ... (No changes needed here)
    data = request.get_json()
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'Email already registered'}), 409
    user = User(email=data['email'], name=data['name'])
    user.set_password(data['password'])
    db.session.add(user)
    preferences = UserPreferences(user_id=user.id)
    db.session.add(preferences)
    db.session.commit()
    login_user(user)
    return jsonify({'user': {'id': user.id, 'email': user.email, 'name': user.name}}), 201

@app.route('/api/auth/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.get_json()
        user = User.query.filter_by(email=data['email']).first()
        if user and user.check_password(data['password']):
            login_user(user)
            return jsonify({'user': {'id': user.id, 'email': user.email, 'name': user.name}})
        return jsonify({'error': 'Invalid email or password'}), 401
    # If a GET request is made, it's likely from the old redirect behavior.
    # We return the proper 401 error.
    return jsonify({"error": "Authentication required"}), 401

@app.route('/api/auth/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({'message': 'Logged out successfully'})

@app.route('/api/auth/profile', methods=['GET'])
@login_required
def get_profile():
    return jsonify({'user': {'id': current_user.id, 'email': current_user.email, 'name': current_user.name}})

# Transaction Routes
@app.route('/api/transactions', methods=['GET'])
@login_required
def get_transactions():
    transactions = Transaction.query.filter_by(user_id=current_user.id).order_by(Transaction.date.desc()).all()
    return jsonify([{'id': t.id, 'amount': t.amount, 'merchant': t.merchant, 'category': t.category, 'date': t.date.isoformat(), 'payment_mode': t.payment_mode, 'notes': t.notes, 'source': t.source} for t in transactions])

# Add the rest of your routes here (they are fine as they are)...
@app.route('/api/transactions', methods=['POST'])
@login_required
def add_transaction():
    data = request.get_json()
    new_transaction = Transaction(
        user_id=current_user.id, amount=data['amount'], merchant=data['merchant'],
        category=data['category'], date=datetime.strptime(data['date'], '%Y-%m-%d').date(),
        payment_mode=data['paymentMode'], notes=data.get('notes'), source=data['source']
    )
    db.session.add(new_transaction)
    db.session.commit()
    return jsonify({'id': new_transaction.id}), 201

# --- (The rest of your code for updating, deleting, categories, etc. is fine) ---
# ...
# ---

# --- MAIN EXECUTION ---
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)