import io
import os
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from src.auth import get_google_credentials
from src.config import TEMP_DOWNLOAD_DIR

def get_drive_service():
    creds = get_google_credentials()
    return build('drive', 'v3', credentials=creds)

def download_file_from_drive(file_id):
    """Downloads a file from Google Drive by its ID."""
    service = get_drive_service()
    
    # Get metadata to find the filename
    file_metadata = service.files().get(fileId=file_id).execute()
    filename = file_metadata.get('name', f'drive_file_{file_id}')
    
    request = service.files().get_media(fileId=file_id)
    local_path = os.path.join(TEMP_DOWNLOAD_DIR, filename)
    
    fh = io.FileIO(local_path, 'wb')
    downloader = MediaIoBaseDownload(fh, request)
    
    done = False
    while not done:
        status, done = downloader.next_chunk()
        print(f"Download {int(status.progress() * 100)}% for {filename}.")
        
    return {
        'name': filename,
        'path': local_path
    }
