import os
import pickle
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from msal import PublicClientApplication, ConfidentialClientApplication
from dotenv import load_dotenv

load_dotenv()

# Google Scopes
GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly'
]

# Microsoft Scopes
MS_SCOPES = ['Files.ReadWrite.All', 'User.Read']

def get_google_credentials():
    """Gets valid user credentials from storage or performs OAuth flow."""
    creds = None
    token_file = os.getenv('GOOGLE_TOKEN_FILE', 'token.json')
    client_secret_file = os.getenv('GOOGLE_CLIENT_SECRET_FILE', 'credentials.json')

    if os.path.exists(token_file):
        with open(token_file, 'rb') as token:
            creds = pickle.load(token)
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(client_secret_file, GOOGLE_SCOPES)
            creds = flow.run_local_server(port=0)
        
        with open(token_file, 'wb') as token:
            pickle.dump(creds, token)
            
    return creds

def get_ms_access_token():
    """Gets Microsoft Graph API access token, prioritizing the direct token from config."""
    from src.config import MS_ACCESS_TOKEN
    
    # Priority 1: Use direct token from .env if provided
    if MS_ACCESS_TOKEN:
        return MS_ACCESS_TOKEN

    # Priority 2: Full MSAL Flow fallback
    client_id = os.getenv('MS_CLIENT_ID')
    client_secret = os.getenv('MS_CLIENT_SECRET')
    tenant_id = os.getenv('MS_TENANT_ID', 'common')
    authority = f"https://login.microsoftonline.com/{tenant_id}"

    # Using ConfidentialClientApplication as we have a client secret
    app = ConfidentialClientApplication(
        client_id,
        authority=authority,
        client_credential=client_secret,
    )

    # Check if we have a token in cache
    result = app.acquire_token_silent(MS_SCOPES, account=None)

    if not result:
        # If no token in cache, perform the interactive flow (or device code)
        # For a daemon script with secret, we use client credential flow for app-only permissions
        # OR we use interactive if it's meant to be user-delegated.
        # Given "OneDrive", user-delegated is often safer for personal accounts.
        # But for automation, Client Credentials or Refresh Token flow is preferred.
        # We will attempt client credential flow first.
        result = app.acquire_token_for_client(scopes=["https://graph.microsoft.com/.default"])

    if "access_token" in result:
        return result['access_token']
    else:
        raise Exception(f"Could not acquire MS token: {result.get('error_description')}")

if __name__ == "__main__":
    # Test script (requires credentials.json to exist)
    try:
        print("Testing Google Auth...")
        get_google_credentials()
        print("Google Auth Success!")
    except Exception as e:
        print(f"Google Auth Failed: {e}")
