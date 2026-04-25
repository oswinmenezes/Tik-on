"""
main.py  –  Flask REST API for D-Land tokenisation
───────────────────────────────────────────────────
POST /api/tokenise
  Body (JSON):
    {
      "rera_id":          "PRM/KA/RERA/...",
      "seller_mnemonic":  "word1 word2 ... word25"
    }

  Returns:
    {
      "success": true,
      "data": {
        "rera_id": "...",
        "seller_wallet": "ALGO...",
        "ipfs_hash": "Qm...",
        "ipfs_url": "https://gateway.pinata.cloud/ipfs/Qm...",
        "no_of_flats": 15,
        "assets": [
          {"asset_id": 123456, "flat_index": 1},
          ...
        ]
      }
    }
"""

from flask import Flask, request, jsonify # Correct
from flask_cors import CORS
from dotenv import load_dotenv

# Load .env BEFORE any module that reads os.environ
load_dotenv()

from rera_token_create import initiate_tokenise, complete_tokenise, fetch_rera_record, supabase  # noqa: E402

app = Flask(__name__)
CORS(app)


@app.route("/api/verify", methods=["POST"])
def verify():
    """
    Verify a RERA ID exists in the database.
    Expects JSON body with:
      - rera_id (str)
    """
    body = request.get_json(force=True, silent=True)
    if not body:
        return jsonify({"success": False, "error": "Request body must be JSON"}), 400

    rera_id = body.get("rera_id", "").strip()
    if not rera_id:
        return jsonify({"success": False, "error": "rera_id is required"}), 400

    try:
        record = fetch_rera_record(rera_id)
        return jsonify({"success": True, "data": record}), 200
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 404
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

@app.route("/api/tokenise", methods=["POST"])
def tokenise():
    """
    Tokenise a RERA-registered property - Initiation step.

    Expects JSON body with:
      - rera_id          (str)  – RERA registration string
      - seller_wallet    (str)  – The public address of the seller's wallet
      - price            (str)
    """
    body = request.get_json(force=True, silent=True)
    if not body:
        return jsonify({"success": False, "error": "Request body must be JSON"}), 400

    rera_id = body.get("rera_id", "").strip()
    seller_wallet = body.get("seller_wallet", "").strip()
    price_str = body.get("price", "0")
    
    try:
        price = float(price_str)
    except ValueError:
        price = 0.0

    # ── validation ──────────────────────────────
    if not rera_id:
        return jsonify({"success": False, "error": "rera_id is required"}), 400
    if not seller_wallet:
        return jsonify({"success": False, "error": "seller_wallet is required"}), 400

    try:
        result = initiate_tokenise(rera_id, seller_wallet, price)
        return jsonify({"success": True, "data": result}), 201
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 404
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

@app.route("/api/tokenise-complete", methods=["POST"])
def tokenise_complete():
    """
    Completes the tokenisation process by submitting signed opt-in txns.

    Expects JSON body with:
      - seller_wallet (str)
      - signed_txns (list of base64 strings)
      - asset_ids (list of int)
      - rera_id (str)
      - price (float)
      - expiry_days (int)
    """
    body = request.get_json(force=True, silent=True)
    if not body:
        return jsonify({"success": False, "error": "Request body must be JSON"}), 400

    seller_wallet = body.get("seller_wallet", "").strip()
    signed_txns = body.get("signed_txns", [])
    asset_ids = body.get("asset_ids", [])
    rera_id = body.get("rera_id", "").strip()
    price = float(body.get("price", 0))
    expiry_days = int(body.get("expiry_days", 7))

    if not seller_wallet or not signed_txns or not asset_ids:
        return jsonify({"success": False, "error": "Missing required fields"}), 400

    try:
        result = complete_tokenise(seller_wallet, signed_txns, asset_ids, rera_id, price, expiry_days)
        return jsonify({"success": True, "data": result}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/api/listings", methods=["GET"])
def get_listings():
    """
    Fetch all available property listings.
    Joins property_listings with rera_records.
    """
    try:
        # Supabase allows joining via foreign keys
        response = supabase.table("property_listings").select("*, rera_records(*)").eq("status", "listed").execute()
        return jsonify({"success": True, "data": response.data}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

@app.route("/api/seller-properties/<wallet>", methods=["GET"])
def get_seller_properties(wallet: str):
    """Fetch all properties for a specific seller, including unlisted ones."""
    try:
        response = supabase.table("property_listings").select("*, rera_records(*)").eq("seller_wallet", wallet).execute()
        return jsonify({"success": True, "data": response.data}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

@app.route("/api/list-property", methods=["POST"])
def list_property():
    """Update a specific unlisted property to listed."""
    body = request.get_json(force=True, silent=True)
    property_id = body.get("property_id")
    if not property_id:
        return jsonify({"success": False, "error": "Missing property_id"}), 400
    try:
        response = supabase.table("property_listings").update({"status": "listed"}).eq("id", property_id).execute()
        return jsonify({"success": True, "data": response.data}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

# ── Escrow System ──────────────────────────────
from escrow_service import (
    create_escrow_contract, get_escrow_details, update_escrow_status,
    simulate_lock_token, simulate_lock_payment,
    build_lock_token_txn_b64, build_lock_payment_txn_b64, submit_signed_lock, settle_offchain, expire_escrow
)

@app.route("/api/buy-request", methods=["POST"])
def create_buy_request():
    body = request.get_json(force=True, silent=True)
    if not body: return jsonify({"success": False, "error": "Request body must be JSON"}), 400
    try:
        # First, fetch the listing details
        listing = supabase.table("property_listings").select("*, rera_records(*)").eq("id", body["listing_id"]).single().execute()
        if not listing.data:
            return jsonify({"success": False, "error": "Listing not found"}), 404
            
        property_title = f"{'Flat' if listing.data.get('rera_records', {}).get('no_of_flats', 0) > 0 else 'Land'} in {listing.data.get('rera_records', {}).get('location_village', '')}"
        
        req = supabase.table("buy_requests").insert({
            "listing_id": body["listing_id"],
            "property_title": property_title,
            "buyer_wallet": body["buyer_wallet"],
            "buyer_name": body.get("buyer_name", "Anonymous"),
            "amount": body["amount"]
        }).execute()
        return jsonify({"success": True, "data": req.data}), 201
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

@app.route("/api/seller-requests/<wallet>", methods=["GET"])
def get_seller_requests(wallet: str):
    try:
        # Get listings owned by this seller
        listings = supabase.table("property_listings").select("id").eq("seller_wallet", wallet).execute()
        listing_ids = [l["id"] for l in listings.data]
        if not listing_ids:
            return jsonify({"success": True, "data": []}), 200
            
        reqs = supabase.table("buy_requests").select("*").in_("listing_id", listing_ids).execute()
        return jsonify({"success": True, "data": reqs.data}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

@app.route("/api/buyer-requests/<wallet>", methods=["GET"])
def get_buyer_requests(wallet: str):
    try:
        reqs = supabase.table("buy_requests").select("*").eq("buyer_wallet", wallet).execute()
        return jsonify({"success": True, "data": reqs.data}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

@app.route("/api/accept-deal", methods=["POST"])
def accept_deal():
    """Seller accepts the deal. We transition the request to accepted and create Escrow."""
    body = request.get_json(force=True, silent=True)
    req_id = body.get("request_id")
    try:
        # 1. Update request status
        supabase.table("buy_requests").update({"status": "accepted"}).eq("id", req_id).execute()
        buy_req = supabase.table("buy_requests").select("*").eq("id", req_id).single().execute().data
        
        listing_id = buy_req["listing_id"]
        listing = supabase.table("property_listings").select("*").eq("id", listing_id).single().execute().data
        expiry_days = listing.get("expiry_days", 7)
        
        # 2. Update listing status
        supabase.table("property_listings").update({"status": "escrow"}).eq("id", listing_id).execute()
        
        # 3. Create Escrow LogicSig Contract (funds + opt-in to ASA intrinsically)
        wallet_info = create_escrow_contract(
            buyer_addr=buy_req["buyer_wallet"],
            seller_addr=listing["seller_wallet"],
            asset_id=int(listing["asset_id"]),
            amount_algo=float(buy_req["amount"])
        )
        
        esc = supabase.table("escrows").insert({
            "buy_request_id": req_id,
            "property_id": listing_id,
            "property_title": buy_req["property_title"],
            "asset_id": listing["asset_id"],
            "escrow_address": wallet_info["address"],
            "seller_wallet": listing["seller_wallet"],
            "buyer_wallet": buy_req["buyer_wallet"],
            "amount": buy_req["amount"],
            "expiry_days": expiry_days
        }).execute()
        
        return jsonify({"success": True, "data": esc.data}), 201
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

@app.route("/api/escrows/<wallet>", methods=["GET"])
def get_escrows(wallet: str):
    """Returns all escrows where wallet is buyer or seller."""
    try:
        escrows = supabase.table("escrows").select("*").or_(f"seller_wallet.eq.{wallet},buyer_wallet.eq.{wallet}").execute()
        # hide mnemonic
        for e in escrows.data:
            e.pop("escrow_mnemonic", None)
        return jsonify({"success": True, "data": escrows.data}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

@app.route("/api/escrow/detail/<id>", methods=["GET"])
def get_escrow_detail(id: str):
    try:
        escrow = get_escrow_details(id)
        # Scrub mnemonic before returning to frontend!
        escrow.pop("escrow_mnemonic", None)
        return jsonify({"success": True, "data": escrow}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

@app.route("/api/escrow/build-lock-token-tx/<id>", methods=["GET"])
def build_lock_token_tx(id: str):
    """Builds an unsigned ASA transfer transaction for the Seller's Pera wallet"""
    try:
        b64_msgpack = build_lock_token_txn_b64(id)
        return jsonify({"success": True, "data": b64_msgpack}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

@app.route("/api/escrow/build-lock-payment-tx/<id>", methods=["GET"])
def build_lock_payment_tx(id: str):
    try:
        b64_msgpack = build_lock_payment_txn_b64(id)
        return jsonify({"success": True, "data": b64_msgpack}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

@app.route("/api/escrow/submit-signed-lock", methods=["POST"])
def submit_signed_lock_route():
    body = request.get_json(force=True, silent=True)
    escrow_id = body.get("escrow_id")
    signed_b64 = body.get("signed_b64")
    lock_type = body.get("lock_type") # "token" or "payment"
    
    if not escrow_id or not signed_b64 or not lock_type:
        return jsonify({"success": False, "error": "Missing fields"}), 400
        
    try:
        submit_signed_lock(escrow_id, signed_b64, lock_type)
        return jsonify({"success": True}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

@app.route("/api/escrow/settle-offchain", methods=["POST"])
def finalize_settle_offchain():
    """Manual unfreeze endpoint to finalize property transfer offchain."""
    body = request.get_json(force=True, silent=True)
    escrow_id = body.get("escrow_id")
    if not escrow_id:
        return jsonify({"success": False, "error": "escrow_id is required"}), 400
    try:
        settle_offchain(escrow_id)
        return jsonify({"success": True}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

@app.route("/api/escrow/expire", methods=["POST"])
def expire_escrow_route():
    body = request.get_json(force=True, silent=True)
    escrow_id = body.get("escrow_id")
    try:
        expire_escrow(escrow_id)
        return jsonify({"success": True}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

@app.route("/api/escrow/upload-utr", methods=["POST"])
def upload_utr_route():
    body = request.get_json(force=True, silent=True)
    escrow_id = body.get("escrow_id")
    utr_number = body.get("utr_number")
    if not escrow_id or not utr_number:
        return jsonify({"success": False, "error": "Missing fields"}), 400
    try:
        from datetime import datetime
        supabase.table("escrows").update({"utr_number": utr_number, "utr_uploaded_at": datetime.utcnow().isoformat()}).eq("id", escrow_id).execute()
        return jsonify({"success": True}), 200
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

# ── health check ──────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
