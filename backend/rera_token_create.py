"""
rera_token_create.py
─────────────────────
1.  Fetch a RERA record from Supabase by its RERA-ID.
2.  Pin that record's metadata to IPFS via Pinata.
3.  Create N Algorand Standard Assets (one per flat).
4.  Transfer every ASA into the seller's wallet.

Environment variables required (loaded from .env):
    SUPABASE_URL, SUPABASE_SERVICE_KEY,
    PINATA_API_KEY, PINATA_SECRET_API_KEY,
    ALGOD_ADDRESS, ALGOD_TOKEN,
    CREATOR_MNEMONIC          ← the backend "creator" account that
                                 funds ASA creation & opt-in txns.
"""

import json, os, hashlib
from datetime import datetime
from typing import Any

import requests
from algosdk import mnemonic, account, transaction
from algosdk.v2client import algod
from supabase import create_client, Client


# ──────────────────────────────────────────────
#  CONFIG  (all read from env / .env)
# ──────────────────────────────────────────────
SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_KEY: str = os.environ["SUPABASE_SERVICE_KEY"]
PINATA_API_KEY: str = os.environ["PINATA_API_KEY"]
PINATA_SECRET: str = os.environ["PINATA_SECRET_API_KEY"]
ALGOD_ADDRESS: str = os.environ["ALGOD_ADDRESS"]
ALGOD_TOKEN: str = os.environ["ALGOD_TOKEN"]
CREATOR_MNEMONIC: str = os.environ["CREATOR_MNEMONIC"]

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
algod_client = algod.AlgodClient(ALGOD_TOKEN, ALGOD_ADDRESS)

# Derive creator keys
CREATOR_SK = mnemonic.to_private_key(CREATOR_MNEMONIC)
CREATOR_ADDR = account.address_from_private_key(CREATOR_SK)


# ──────────────────────────────────────────────
#  1 ▸ SUPABASE – fetch RERA row
# ──────────────────────────────────────────────
def fetch_rera_record(rera_id: str) -> dict[str, Any]:
    """Return a mocked rera_records row for MVP."""
    print("Mocking RERA fetch for ID:", rera_id)
    
    is_flat = not rera_id.startswith("SRV")
    
    if is_flat:
        mock_data = {
            "reraid": rera_id,
            "owner_name": "Verify Check Owner",
            "owner_pan": "ABCDE1234F",
            "location_district": "Mumbai Suburbs",
            "location_taluk": "Bandra",
            "location_village": "Bandra West",
            "area_sqft": 1450,
            "land_type": "Residential",
            "govt_valuation_inr": 15000000,
            "encumbrance_status": "clear",
            "last_registered": "2023-01-01",
            "raw_doc_url": "https://example.com/mock-doc",
            "no_of_flats": 1,
        }
    else:
        mock_data = {
            "reraid": rera_id,
            "owner_name": "Verify Check Owner",
            "owner_pan": "VWXYZ8765A",
            "location_district": "Nashik",
            "location_taluk": "Sinnar",
            "location_village": "Ghoti",
            "area_sqft": 108900,
            "land_type": "Agricultural",
            "govt_valuation_inr": 5000000,
            "encumbrance_status": "clear",
            "last_registered": "2021-06-15",
            "raw_doc_url": "https://example.com/mock-doc-land",
            "no_of_flats": 1,
        }
        
    try:
        supabase.table("rera_records").upsert(mock_data).execute()
    except Exception as e:
        print("Mock RERA upsert failed:", e)

    return mock_data


# ──────────────────────────────────────────────
#  2 ▸ PINATA – pin JSON metadata to IPFS
# ──────────────────────────────────────────────
PINATA_PIN_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS"

def pin_metadata_to_ipfs(record: dict) -> str:
    """
    Pin the RERA record as JSON to IPFS via Pinata.
    Returns the IPFS CID (hash).
    """
    # Build a clean metadata payload
    metadata_payload = {
        "standard": "arc3",
        "name": f"RERA-{record['reraid']}",
        "description": (
            f"Tokenised real-estate asset registered under "
            f"RERA ID {record['reraid']}"
        ),
        "properties": {
            "reraid": record["reraid"],
            "owner_name": record["owner_name"],
            "owner_pan": record.get("owner_pan"),
            "location": {
                "district": record["location_district"],
                "taluk": record["location_taluk"],
                "village": record["location_village"],
            },
            "area_sqft": str(record.get("area_sqft", "")),
            "land_type": record.get("land_type"),
            "govt_valuation_inr": record.get("govt_valuation_inr"),
            "encumbrance_status": record.get("encumbrance_status"),
            "last_registered": str(record.get("last_registered", "")),
            "raw_doc_url": record.get("raw_doc_url"),
            "no_of_flats": int(record.get("no_of_flats", 1)),
        },
        "pinned_at": datetime.utcnow().isoformat(),
    }

    headers = {
        "pinata_api_key": PINATA_API_KEY,
        "pinata_secret_api_key": PINATA_SECRET,
        "Content-Type": "application/json",
    }

    body = {
        "pinataContent": metadata_payload,
        "pinataMetadata": {"name": f"rera-{record['reraid']}"},
    }

    resp = requests.post(PINATA_PIN_URL, json=body, headers=headers, timeout=30)
    resp.raise_for_status()
    ipfs_hash = resp.json()["IpfsHash"]
    return ipfs_hash


# ──────────────────────────────────────────────
#  3 ▸ ALGORAND – create ASAs + transfer
# ──────────────────────────────────────────────
def _wait_for_confirmation(txid: str, timeout: int = 10) -> dict:
    """Block until the txn is confirmed or times out."""
    try:
        result = transaction.wait_for_confirmation(algod_client, txid, timeout)
        return result
    except Exception as exc:
        raise RuntimeError(f"Txn {txid} failed confirmation: {exc}") from exc


from algosdk import encoding

def initiate_tokenise(rera_id: str, seller_wallet: str, price: float = 0.0) -> dict:
    """
    Step 1 Pipeline:
      fetch mock -> pin IPFS -> create N ASAs -> build unsigned opt-in txns.

    Returns payload with unsigned transactions for the frontend to sign.
    """
    record = fetch_rera_record(rera_id)
    ipfs_hash = pin_metadata_to_ipfs(record)

    total_flats = max(1, int(record.get("no_of_flats", 1)))
    
    created_assets = []
    unsigned_opt_in_txns_b64 = []

    ipfs_url = f"ipfs://{ipfs_hash}"
    metadata_hash = hashlib.sha256(ipfs_url.encode()).digest()

    for i in range(1, total_flats + 1):
        params = algod_client.suggested_params()

        suffix = f"-F{i}/{total_flats}"
        prefix = "RERA-"
        max_rera_len = 32 - len(prefix) - len(suffix)
        short_rera = rera_id[-max_rera_len:] if len(rera_id) > max_rera_len else rera_id
        final_asset_name = f"{prefix}{short_rera}{suffix}"

        # 1. Create ASA
        create_txn = transaction.AssetConfigTxn(
            sender=CREATOR_ADDR,
            sp=params,
            total=1,
            decimals=0,
            default_frozen=False,
            unit_name="DLAND",
            asset_name=final_asset_name,
            url=ipfs_url,
            metadata_hash=metadata_hash,
            manager=CREATOR_ADDR,
            reserve=CREATOR_ADDR,
            freeze=CREATOR_ADDR,
            clawback=CREATOR_ADDR,
            strict_empty_address_check=False,
        )
        signed_create = create_txn.sign(CREATOR_SK)
        create_txid = algod_client.send_transaction(signed_create)
        result = _wait_for_confirmation(create_txid)
        asset_id = result["asset-index"]
        created_assets.append({"asset_id": asset_id, "flat_index": i})
        
        # 2. Build unsigned opt-in txn for seller
        params = algod_client.suggested_params()
        opt_in_txn = transaction.AssetTransferTxn(
            sender=seller_wallet,
            sp=params,
            receiver=seller_wallet,
            amt=0,
            index=asset_id
        )
        unsigned_opt_in_txns_b64.append(encoding.msgpack_encode(opt_in_txn))

    return {
        "rera_id": rera_id,
        "seller_wallet": seller_wallet,
        "price": price,
        "ipfs_hash": ipfs_hash,
        "ipfs_url": f"https://gateway.pinata.cloud/ipfs/{ipfs_hash}",
        "no_of_flats": total_flats,
        "assets": created_assets,
        "unsigned_txns": unsigned_opt_in_txns_b64
    }

def complete_tokenise(seller_wallet: str, signed_txns_b64: list, asset_ids: list, rera_id: str, price: float, expiry_days: int = 7):
    """
    Step 2 Pipeline:
      submit signed opt-in txns -> transfer from creator -> update DB.
    """
    # 1. Submit the user-signed opt-in transactions
    try:
        for signed_b64 in signed_txns_b64:
            txid = algod_client.send_raw_transaction(signed_b64)
            _wait_for_confirmation(txid)
    except Exception as e:
        raise ValueError(f"Failed to opt-in from signed txns: {str(e)}")

    # 2. Transfer ASAs from Creator to Seller
    for asset_id in asset_ids:
        params = algod_client.suggested_params()
        xfer_txn = transaction.AssetTransferTxn(
            sender=CREATOR_ADDR,
            sp=params,
            receiver=seller_wallet,
            amt=1,
            index=asset_id
        )
        stxn_xfer = xfer_txn.sign(CREATOR_SK)
        txid_xfer = algod_client.send_transaction(stxn_xfer)
        _wait_for_confirmation(txid_xfer)

        # 3. Create listing
        try:
            supabase.table("property_listings").insert({
                "rera_id": rera_id,
                "asset_id": asset_id,
                "seller_wallet": seller_wallet,
                "price": float(price),
                "status": "listed",
                "expiry_days": expiry_days
            }).execute()
        except Exception as e:
            print(f"Failed to insert listing for ASA {asset_id}: {e}")

    return {
        "success": True,
        "asset_ids": asset_ids
    }
