# Excel File Format Guide

## Supported Formats
- `.xlsx` (Excel 2007+)
- `.xls` (Excel 97-2003)

## Expected Column Headers
The system will automatically detect these columns based on common naming patterns:

### Date Column (Required)
- **Primary names**: `Date`, `Transaction Date`, `Date & Time`
- **Alternative names**: `Dt`, `Time`, `When`, `On`, `At`
- **Format**: Any date format (dd/mm/yyyy, mm/dd/yyyy, etc.)

### Amount Column (Required)
- **Primary names**: `Amount`, `Transaction Amount`, `Debit`, `Credit`
- **Alternative names**: `Amt`, `Value`, `Sum`, `Total`
- **Format**: Numbers with or without currency symbols (₹, $, €, £)

### Description Column (Optional but Recommended)
- **Primary names**: `Description`, `Narration`, `Remarks`, `Particulars`
- **Alternative names**: `Desc`, `Transaction Details`, `Info`
- **Format**: Text describing the transaction

## Example Structure
```
| Date       | Amount | Description           | Category |
|------------|--------|----------------------|----------|
| 15/02/2025 | 500    | Swiggy Food Order    | Food     |
| 16/02/2025 | 1200   | Uber Ride            | Travel   |
| 17/02/2025 | 2500   | Amazon Shopping      | Shopping |
```

## Tips for Best Results
1. **Use clear column headers** - Avoid abbreviations or special characters
2. **Keep data in the first sheet** - The system reads the first sheet only
3. **Avoid merged cells** - They can cause parsing issues
4. **Use consistent date formats** - The system handles multiple formats automatically
5. **Keep file size under 5MB** - Larger files may cause processing issues

## Common Issues & Solutions
- **"No transactions found"**: Check if your columns have the expected names
- **"Could not parse date"**: Ensure dates are in a recognizable format
- **"Could not parse amount"**: Remove currency symbols and extra formatting
- **"File too large"**: Reduce file size or split into smaller files

## Supported Apps
- PhonePe transaction exports
- Google Pay (GPay) exports
- Paytm transaction reports
- Bank statement exports
- Credit card statements 