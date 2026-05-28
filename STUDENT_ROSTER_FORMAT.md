# Student Roster Upload Format

## Overview
The student roster upload expects a **CSV (Comma-Separated Values)** file with student email addresses and names.

## File Format

### Headers (Required)
```
email,name
```

### Example Content
```csv
email,name
student1@inf.elte.hu,John Doe
student2@inf.elte.hu,Jane Smith
student3@inf.elte.hu,Alice Johnson
student4@inf.elte.hu,Bob Wilson
student5@inf.elte.hu,Carol Brown
```

## Requirements

1. **Email Column (Required)**
   - Must be a valid ELTE email: `*.elte.hu` domain
   - Examples: `name@inf.elte.hu`, `user@mail.elte.hu`
   - Invalid emails will be skipped with error count

2. **Name Column (Optional)**
   - Can be full name or any identifier
   - If blank, system can use email prefix
   - UTF-8 characters supported

## Rules

- **Max rows**: No hard limit, but typically 100-500 students per course
- **Duplicates**: Only first occurrence is kept; duplicates ignored
- **Encoding**: Must be UTF-8 or ASCII
- **Line endings**: LF or CRLF both accepted
- **Empty rows**: Automatically skipped

## Upload Steps

1. Download template from app or use example above
2. Fill in email and name columns
3. Save as `.csv` file
4. Go to Teacher Dashboard → Select Course → Upload Roster
5. Select the CSV file
6. Confirm upload

## Example Template Download

A template CSV is available in the public folder:  
[student_roster_template.csv](../public/student_roster_template.csv)

## Validation Response

After upload, you'll see:
```
Student registry uploaded: X valid row(s), Y invalid row(s).
```

- **Valid rows**: Emails matching `*.elte.hu` pattern
- **Invalid rows**: Non-matching emails or format issues

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "No valid student rows found" | Check all emails are `*.elte.hu` format |
| High invalid row count | Verify no extra columns or formatting issues |
| Upload fails | Ensure file is `.csv` format and properly encoded UTF-8 |

## Alternative: Manual Entry

If upload is problematic, you can:
1. Use API directly with JSON payload
2. Contact admin for bulk import
3. Add students one-by-one via dashboard (if available)
