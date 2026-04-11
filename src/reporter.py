import datetime
from src.sheets_client import get_sheets_service
from src.email_client import get_gmail_service
from src.config import GOOGLE_SHEET_ID, RECIPIENT_EMAIL
import base64
from email.mime.text import MIMEText

def fetch_daily_activity():
    """Fetches activity from Google Sheets for the last 24 hours."""
    service = get_sheets_service()
    spreadsheet_id = GOOGLE_SHEET_ID
    range_name = 'Sheet1!A:F'
    
    result = service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id, 
        range=range_name
    ).execute()
    
    rows = result.get('values', [])
    if not rows:
        return []
    
    # Filter rows by today's date
    today = datetime.datetime.now().strftime("%Y-%m-%d")
    daily_rows = [row for row in rows if row[0].startswith(today)]
    return daily_rows

def send_report_email(summary):
    """Sends the formatted summary report via Gmail."""
    if not RECIPIENT_EMAIL:
        print("No recipient email configured. Skipping report.")
        return

    service = get_gmail_service()
    subject = f"Daily Project Management Report - {datetime.datetime.now().strftime('%Y-%m-%d')}"
    
    message_text = "Hello,\n\nHere is your project automation report for today:\n\n"
    if summary:
        message_text += "--- Activity Summary ---\n"
        for row in summary:
            # Row structure: [Timestamp, Subject, File Name, Category, Link, Status]
            message_text += f"- [{row[0]}] {row[2]} ({row[3]}) : {row[4]} - Status: {row[5]}\n"
    else:
        message_text += "No activity recorded for today."
        
    message_text += "\nBest regards,\nYour Automation System"

    message = MIMEText(message_text)
    message['to'] = RECIPIENT_EMAIL
    message['subject'] = subject
    
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    try:
        service.users().messages().send(userId='me', body={'raw': raw}).execute()
        print(f"Report sent successfully to {RECIPIENT_EMAIL}.")
    except Exception as e:
        print(f"Failed to send report: {e}")

def run_reporter():
    """Main function to trigger the daily report."""
    print(f"--- Running Daily Report: {datetime.datetime.now()} ---")
    summary = fetch_daily_activity()
    send_report_email(summary)
    print("--- Daily Report Run Complete ---\n")

if __name__ == "__main__":
    run_reporter()
