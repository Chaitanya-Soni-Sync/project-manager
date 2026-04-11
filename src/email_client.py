import os
import base64
import re
from email.mime.text import MIMEText
from googleapiclient.discovery import build
from src.auth import get_google_credentials
from src.config import GMAIL_SEARCH_QUERY, TEMP_DOWNLOAD_DIR

def get_gmail_service():
    creds = get_google_credentials()
    return build('gmail', 'v1', credentials=creds)

def fetch_unread_project_emails(query=GMAIL_SEARCH_QUERY):
    """Fetches a list of unread message IDs matching the query."""
    service = get_gmail_service()
    # Ensure query includes 'is:unread' if not already present
    if 'is:unread' not in query:
        query = f"{query} is:unread"
    
    results = service.users().messages().list(userId='me', q=query).execute()
    messages = results.get('messages', [])
    return messages

def get_attachment(service, msg_id, attachment_id):
    """Downloads a specific attachment by ID."""
    attachment = service.users().messages().attachments().get(
        userId='me', messageId=msg_id, id=attachment_id
    ).execute()
    data = attachment.get('data')
    if data:
        return base64.urlsafe_b64decode(data)
    return None

def parse_email_content(msg_id):
    """
    Parses an email for sender, subject, attachments, and Google Drive links.
    Returns a dictionary with metadata, body, and local file paths.
    """
    service = get_gmail_service()
    message = service.users().messages().get(userId='me', id=msg_id, format='full').execute()
    payload = message.get('payload', {})
    headers = payload.get('headers', [])
    
    subject = next((h['value'] for h in headers if h['name'] == 'Subject'), 'No Subject')
    sender = next((h['value'] for h in headers if h['name'] == 'From'), 'Unknown Sender')
    
    files_to_process = []
    
    # 1. Look for Native Attachments
    parts = [payload]
    while parts:
        part = parts.pop()
        if part.get('parts'):
            parts.extend(part.get('parts'))
        
        filename = part.get('filename')
        body = part.get('body', {})
        attachment_id = body.get('attachmentId')
        
        if filename and attachment_id:
            print(f"Found attachment: {filename}")
            file_data = get_attachment(service, msg_id, attachment_id)
            if file_data:
                local_path = os.path.join(TEMP_DOWNLOAD_DIR, filename)
                with open(local_path, 'wb') as f:
                    f.write(file_data)
                files_to_process.append({
                    'name': filename,
                    'path': local_path,
                    'type': 'attachment',
                    'subject': subject
                })

    # 2. Extract Body and Look for Google Drive Links
    body_text = ""
    if 'data' in payload.get('body', {}):
        body_text = base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8', errors='ignore')
    elif payload.get('parts'):
        for part in payload['parts']:
            if part['mimeType'] == 'text/plain' and 'data' in part['body']:
                body_text = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8', errors='ignore')
                break
            elif part['mimeType'] == 'text/html' and 'data' in part['body']:
                # Basic HTML to text conversion could be done here if needed
                body_text = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8', errors='ignore')

    drive_links = re.findall(r'https://drive\.google\.com/file/d/([a-zA-Z0-9_-]+)', body_text)
    for file_id in drive_links:
        print(f"Found Drive link ID: {file_id}")
        files_to_process.append({
            'name': f"drive_file_{file_id}",
            'drive_id': file_id,
            'type': 'drive_link',
            'subject': subject
        })

    from src.campaign_manager import extract_product_name
    
    return {
        'id': msg_id,
        'threadId': message.get('threadId'),
        'product_name': extract_product_name(subject),
        'sender': sender,
        'subject': subject,
        'body': body_text,
        'files': files_to_process
    }

from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders

def send_email(to, subject, body_html, attachments=None):
    """Sends an HTML email with optional attachments."""
    service = get_gmail_service()
    
    if attachments:
        message = MIMEMultipart()
        message['to'] = to
        message['subject'] = subject
        
        # HTML Part
        html_part = MIMEText(body_html, 'html')
        message.attach(html_part)
        
        # Attachment Parts
        for file_path in attachments:
            if not os.path.exists(file_path): continue
            
            part = MIMEBase('application', 'octet-stream')
            with open(file_path, 'rb') as f:
                part.set_payload(f.read())
            encoders.encode_base64(part)
            part.add_header(
                'Content-Disposition',
                f'attachment; filename={os.path.basename(file_path)}'
            )
            message.attach(part)
        raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
    else:
        message = MIMEText(body_html, 'html')
        message['to'] = to
        message['subject'] = subject
        raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

    try:
        service.users().messages().send(userId='me', body={'raw': raw}).execute()
        print(f"Email sent successfully to {to}.")
    except Exception as e:
        print(f"Failed to send email to {to}: {e}")

def mark_as_read(msg_id):
    """Removes the UNREAD label from a message."""
    service = get_gmail_service()
    service.users().messages().batchModify(
        userId='me',
        body={
            'ids': [msg_id],
            'removeLabelIds': ['UNREAD']
        }
    ).execute()

if __name__ == "__main__":
    # Quick test
    print("Fetching unread emails...")
    msgs = fetch_unread_project_emails()
    print(f"Found {len(msgs)} messages.")
    for m in msgs:
        content = parse_email_content(m['id'])
        print(f"Message {m['id']} content: {content}")
