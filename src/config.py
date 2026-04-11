import os
from dotenv import load_dotenv

# Load .env file from root
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

# Google Config
GOOGLE_CLIENT_SECRET_FILE = os.getenv('GOOGLE_CLIENT_SECRET_FILE', 'credentials.json')
GOOGLE_TOKEN_FILE = os.getenv('GOOGLE_TOKEN_FILE', 'token.json')
CREATIVE_TRACKING_SHEET_ID = os.getenv('CREATIVE_TRACKING_SHEET_ID')
LOGGING_SHEET_ID = os.getenv('LOGGING_SHEET_ID')
GMAIL_SEARCH_QUERY = os.getenv('GMAIL_SEARCH_QUERY', 'label:project-x')

# Microsoft OneDrive Config
MS_ACCESS_TOKEN = os.getenv('MS_ACCESS_TOKEN')
MS_CLIENT_ID = os.getenv('MS_CLIENT_ID')
MS_CLIENT_SECRET = os.getenv('MS_CLIENT_SECRET')
MS_TENANT_ID = os.getenv('MS_TENANT_ID', 'common')
MS_REDIRECT_URI = os.getenv('MS_REDIRECT_URI', 'http://localhost:8080')
ONEDRIVE_VIDEOS_FOLDER_ID = os.getenv('ONEDRIVE_VIDEOS_FOLDER_ID')
ONEDRIVE_DATA_FOLDER_ID = os.getenv('ONEDRIVE_DATA_FOLDER_ID')

# System Config
POLLING_INTERVAL_MINUTES = int(os.getenv('POLLING_INTERVAL_MINUTES', 15))
REPORT_TIME = os.getenv('REPORT_TIME', '17:00')
RECIPIENT_EMAIL = os.getenv('RECIPIENT_EMAIL')
TEMP_DOWNLOAD_DIR = os.getenv('TEMP_DOWNLOAD_DIR', 'temp_downloads')

# Campaign Management Config
NIKHIL_EMAIL = os.getenv('NIKHIL_EMAIL', 'nikhil@syncmedia.io')
CHAITANYA_EMAIL = os.getenv('CHAITANYA_EMAIL', 'chaitanya@syncmedia.io')
CAMPAIGN_TRACKING_SHEET_NAME = os.getenv('CAMPAIGN_TRACKING_SHEET_NAME', 'Campaign_Tracking')
ACTIVITY_LOG_SHEET_NAME = os.getenv('ACTIVITY_LOG_SHEET_NAME', 'Activity_Log')
CLIENT_DOMAIN = os.getenv('CLIENT_DOMAIN', '@jiostar.com')
TEAM_DOMAIN = os.getenv('TEAM_DOMAIN', '@syncmedia.io')

# Ensure temp directory exists
if not os.path.exists(TEMP_DOWNLOAD_DIR):
    os.makedirs(TEMP_DOWNLOAD_DIR)
