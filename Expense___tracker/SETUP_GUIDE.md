# Setup Guide - Expense Tracker with PhonePe PDF Processing

## Quick Start

### 1. Frontend Setup (React)
```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```
The frontend will be available at: http://localhost:5174

### 2. Backend Setup (Python)
```bash
# Install Python dependencies
pip install -r requirements.txt

# Start the Python backend
python app.py
```
The backend will be available at: http://localhost:5000

## Features

### ✅ What's Working:
- **User Authentication**: Register/login system (free, stored locally)
- **CSV/Excel Upload**: Process transaction files from payment apps
- **AI Chat Assistant**: Get insights about your expenses
- **Dashboard**: Visual charts and spending analysis
- **PhonePe PDF Processing**: Upload PhonePe statements (requires Python backend)

### 🔧 PhonePe PDF Processing:
1. Start the Python backend: `python app.py`
2. Go to the PhonePe Processor in the app
3. Upload your PhonePe PDF statement
4. View extracted transactions and upload to expense tracker

## File Structure

```
project/
├── src/                          # React frontend
│   ├── components/
│   │   ├── FileUpload/
│   │   │   ├── FileUpload.tsx    # General file upload
│   │   │   └── PhonePeProcessor.tsx  # PhonePe specific
│   │   ├── Auth/
│   │   ├── Chat/
│   │   └── Dashboard/
│   ├── context/                  # React contexts
│   └── utils/
│       └── fileProcessor.ts      # File processing utilities
├── app.py                        # Python Flask backend
├── requirements.txt              # Python dependencies
└── BACKEND_INTEGRATION.md        # Detailed backend guide
```

## Testing

### Test the Backend:
```bash
# Health check
curl http://localhost:5000/health

# Test parsing
curl http://localhost:5000/test
```

### Test the Frontend:
1. Open http://localhost:5174
2. Create an account or login
3. Try uploading CSV/Excel files
4. Test the AI chat assistant
5. Use the PhonePe processor (with backend running)

## Troubleshooting

### CORS Issues:
- Make sure the Python backend is running on port 5000
- Check that CORS is enabled in `app.py`

### PDF Processing Issues:
- Ensure all Python dependencies are installed
- Check that Tesseract OCR is installed (for scanned PDFs)
- Verify the PDF format matches PhonePe statement format

### Frontend Issues:
- Clear browser cache
- Check browser console for errors
- Ensure all npm dependencies are installed

## Next Steps

1. **Deploy to Production**: Use services like Vercel (frontend) + Railway (backend)
2. **Add More Payment Apps**: Extend the backend for GPay, Paytm, etc.
3. **Database Integration**: Replace local storage with a real database
4. **Advanced Analytics**: Add more AI insights and predictions

## Support

If you encounter any issues:
1. Check the browser console for errors
2. Check the Python backend logs
3. Verify all dependencies are installed
4. Test with sample data first
