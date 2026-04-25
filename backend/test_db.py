from rera_token_create import supabase
res = supabase.table("property_listings").select("*").limit(1).execute()
print(res.data)
