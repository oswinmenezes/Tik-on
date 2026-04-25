import os
from supabase import create_client

from dotenv import load_dotenv
load_dotenv()

supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

try:
    supabase.table("property_listings").insert({"rera_id": "test", "asset_id": 999, "seller_wallet": "test", "price": 0.0, "status": "listed", "expiry_days": 7}).execute()
except Exception as e:
    print(f"Error: {e}")
