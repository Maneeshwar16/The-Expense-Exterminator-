#!/usr/bin/env python3
"""
Test script to verify database setup and SECRET_KEY generation
"""

import os
import secrets
from datetime import datetime
from app import app, db, User, Transaction, Category, UserPreferences

def generate_secret_key():
    """Generate a secure SECRET_KEY"""
    return secrets.token_hex(32)

def test_database_setup():
    """Test database creation and table setup"""
    print("🔧 Testing Database Setup...")
    
    with app.app_context():
        try:
            # Create all tables
            db.create_all()
            print("✅ Database tables created successfully!")
            
            # Check if test user already exists
            existing_user = User.query.filter_by(email="test@example.com").first()
            if existing_user:
                test_user = existing_user
                print("✅ Using existing test user")
            else:
                # Test creating a user
                test_user = User(
                    email="test@example.com",
                    name="Test User"
                )
                test_user.set_password("password123")
                
                db.session.add(test_user)
                db.session.commit()
                print("✅ User creation test passed!")
            
            # Test creating a transaction
            test_transaction = Transaction(
                user_id=test_user.id,
                amount=100.50,
                merchant="Test Store",
                category="Food",
                date=datetime.strptime("2024-01-15", "%Y-%m-%d").date(),
                payment_mode="UPI",
                source="manual"
            )
            
            db.session.add(test_transaction)
            db.session.commit()
            print("✅ Transaction creation test passed!")
            
            # Test creating a category
            test_category = Category(
                user_id=test_user.id,
                name="Test Category",
                color="#FF5733",
                icon="shopping-cart"
            )
            
            db.session.add(test_category)
            db.session.commit()
            print("✅ Category creation test passed!")
            
            # Test creating user preferences
            test_preferences = UserPreferences(
                user_id=test_user.id,
                currency="INR",
                theme="light",
                notifications_enabled=True,
                auto_categorize=True
            )
            
            db.session.add(test_preferences)
            db.session.commit()
            print("✅ User preferences creation test passed!")
            
            # Clean up test data
            db.session.delete(test_preferences)
            db.session.delete(test_category)
            db.session.delete(test_transaction)
            db.session.delete(test_user)
            db.session.commit()
            print("✅ Test data cleaned up!")
            
            print("\n🎉 All database tests passed!")
            return True
            
        except Exception as e:
            print(f"❌ Database test failed: {e}")
            return False

def main():
    print("🚀 Expense Tracker Setup Test")
    print("=" * 40)
    
    # Generate SECRET_KEY
    secret_key = generate_secret_key()
    print(f"🔑 Generated SECRET_KEY: {secret_key}")
    print(f"📝 Add this to your .env file: SECRET_KEY={secret_key}")
    
    print("\n" + "=" * 40)
    
    # Test database
    if test_database_setup():
        print("\n✅ Setup is ready! You can now:")
        print("   1. Create a .env file with your SECRET_KEY")
        print("   2. Run: python app.py")
        print("   3. Open: http://localhost:5000")
    else:
        print("\n❌ Setup failed. Please check the error messages above.")

if __name__ == "__main__":
    main()
