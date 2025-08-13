# Backend Integration Guide for PhonePe PDF Processing

## Overview
This guide explains how to integrate your Python PDF processing code with the React frontend for optimal PhonePe statement parsing.

## Python Backend Setup

### 1. Required Dependencies
```bash
pip install fastapi uvicorn pymupdf pytesseract pdfminer.six pillow
```

### 2. FastAPI Backend Code
Create a file `backend/main.py`:

```python
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import fitz  # PyMuPDF
import pytesseract
from pdfminer.high_level import extract_text
from PIL import Image
import io
import re
from typing import List, Dict, Any

app = FastAPI(title="PhonePe PDF Processor")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    
    # Pattern for: Date, Merchant (multi-line), Transaction Type, Amount
    pattern = re.compile(
        r'([A-Za-z]{3}\s+\d{1,2},\s+\d{4})\s+Paid to\s+([\s\S]*?)\s+(DEBIT|CREDIT)\s+₹(\d+(?:\.\d{1,2})?)',
        re.MULTILINE
    )
    
    for match in pattern.findall(text):
        date = match[0].strip()
        merchant = re.sub(r'\s+', ' ', match[1]).strip()
        txn_type = match[2].strip()
        amount = match[3].strip()
        
        transactions.append({
            "date": date,
            "merchant": merchant,
            "type": txn_type,
            "amount": amount
        })
    
    return transactions

@app.post("/process-phonepe-pdf")
async def process_phonepe_pdf(file: UploadFile = File(...)):
    """Process PhonePe PDF and extract transactions."""
    
    if not file.filename.lower().endswith('.pdf'):
        return {"error": "File must be a PDF"}
    
    try:
        # Save uploaded file temporarily
        temp_path = f"temp_{file.filename}"
        with open(temp_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Check if PDF is text-based or scanned
        has_text, extracted_text = is_text_based(temp_path)
        
        if has_text:
            text_data = extracted_text
        else:
            text_data = ocr_pdf(temp_path)
        
        # Parse transactions
        transactions = parse_transactions(text_data)
        
        # Clean up temp file
        import os
        os.remove(temp_path)
        
        return {
            "success": True,
            "transactions": transactions,
            "total_transactions": len(transactions),
            "processing_method": "text_extraction" if has_text else "ocr"
        }
        
    except Exception as e:
        return {"error": f"Processing failed: {str(e)}"}

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "PhonePe PDF Processor"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### 3. Run the Backend
```bash
cd backend
python main.py
```

## Frontend Integration

### 1. Update PhonePeProcessor Component
Modify the `extractTextFromPDF` function in `src/components/FileUpload/PhonePeProcessor.tsx`:

```typescript
const extractTextFromPDF = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await fetch('http://localhost:8000/process-phonepe-pdf', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    // Convert Python backend response to frontend format
    const processedTransactions: ProcessedTransaction[] = result.transactions.map((tx: any) => ({
      date: parseDate(tx.date) || tx.date,
      amount: tx.type === 'DEBIT' ? -parseFloat(tx.amount) : parseFloat(tx.amount),
      description: `PhonePe ${tx.type} to ${tx.merchant}`,
      category: categorizeTransaction(tx.merchant),
      paymentMode: 'UPI',
      merchant: tx.merchant
    }));
    
    return {
      transactions: processedTransactions,
      errors: [],
      warnings: []
    };
  } catch (error) {
    throw new Error(`Backend processing failed: ${error}`);
  }
};
```

### 2. Environment Configuration
Create `.env` file in your React project:

```env
VITE_BACKEND_URL=http://localhost:8000
```

## Deployment Options

### Option 1: Local Development
- Run Python backend on `localhost:8000`
- Run React frontend on `localhost:5173`
- Use CORS middleware for communication

### Option 2: Docker Deployment
Create `Dockerfile` for backend:

```dockerfile
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Option 3: Cloud Deployment
- Deploy Python backend to services like:
  - Heroku
  - Railway
  - DigitalOcean App Platform
  - AWS Lambda (with API Gateway)

## Testing

### Test with Sample Data
```python
# Test the parsing function
sample_text = """
Feb 13, 2025 Paid to Salaar Devrartha Raisar DEBIT ₹100
Feb 11, 2025 Paid to Yashhh_v DEBIT ₹90
Feb 10, 2025 Paid to Swiggy DEBIT ₹250
"""

transactions = parse_transactions(sample_text)
print(transactions)
```

## Benefits of This Approach

1. **Accurate Parsing**: Python's regex and OCR capabilities are superior for PDF processing
2. **Scalability**: Backend can handle multiple file formats and processing methods
3. **Maintainability**: Separation of concerns between frontend and backend
4. **Extensibility**: Easy to add support for other payment apps (GPay, Paytm, etc.)

## Next Steps

1. Implement error handling and retry logic
2. Add support for other payment app formats
3. Implement caching for processed results
4. Add authentication and rate limiting
5. Set up monitoring and logging

## Troubleshooting

### Common Issues:
1. **CORS errors**: Ensure CORS middleware is properly configured
2. **File size limits**: Adjust FastAPI file upload limits
3. **OCR accuracy**: Increase DPI or use different OCR engines
4. **Memory usage**: Implement streaming for large PDFs

### Performance Tips:
1. Use async processing for large files
2. Implement result caching
3. Use connection pooling for database operations
4. Optimize OCR settings based on PDF quality
