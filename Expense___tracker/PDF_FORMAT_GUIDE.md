# PDF File Processing Guide

## Important Note
**PDF parsing has limited support** and works best with structured transaction statements. For best results, use CSV or Excel exports from payment apps.

## Supported PDF Types
- Transaction statements from payment apps
- Bank statements
- Credit card statements
- Simple, text-based PDFs

## Limitations
- **File size**: Maximum 10MB
- **Pages**: Only first 3 pages are processed
- **Format**: Text-based PDFs work best (scanned PDFs won't work)
- **Accuracy**: May miss some transactions due to PDF complexity

## Expected Format
The system looks for transaction patterns like:
```
15/02/2025 ₹500 Swiggy Food Order
16/02/2025 ₹1200 Uber Ride
17/02/2025 ₹2500 Amazon Shopping
```

## Common Issues & Solutions

### "PDF processing error: Worker not found"
- **Cause**: PDF.js worker configuration issue
- **Solution**: Refresh the page and try again

### "PDF processing timeout"
- **Cause**: File is too complex or large
- **Solution**: Use smaller files or convert to CSV/Excel

### "No transactions found"
- **Cause**: PDF format not supported or no recognizable patterns
- **Solution**: 
  - Export as CSV/Excel from the original app
  - Check if the PDF contains transaction data
  - Try a different statement period

### "File too large"
- **Cause**: PDF exceeds 10MB limit
- **Solution**: 
  - Split into smaller files
  - Export as CSV/Excel instead
  - Use a different statement period

## Best Practices
1. **Use CSV/Excel when possible** - More reliable and faster
2. **Keep PDFs small** - Under 5MB for best results
3. **Use recent statements** - Older formats may not be supported
4. **Avoid scanned documents** - Only text-based PDFs work
5. **Check the source** - Export directly from payment apps

## Alternative Solutions
If PDF processing doesn't work:
1. **Export as CSV/Excel** from the payment app
2. **Use the app's export feature** instead of PDF statements
3. **Manually enter transactions** for important ones
4. **Contact support** if you need help with specific formats

## Supported Apps
- PhonePe (export as CSV/Excel recommended)
- Google Pay (export as CSV/Excel recommended)
- Paytm (export as CSV/Excel recommended)
- Bank statements (CSV/Excel preferred)
- Credit card statements (CSV/Excel preferred) 