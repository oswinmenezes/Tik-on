**D-Land** is a decentralized application (dApp) bridging real-world assets with Web3 technologies. It allows property owners to securely tokenize and list their real estate (Flats and Land parcels) using government RERA registry records and fractionally or entirely transfer ownership securely over the Algorand Blockchain.

---

## 📖 What It Does?

D-Land simplifies real-estate property buying and selling through blockchain tokenisation. The traditional real estate process requires immense paperwork, verifications, and trust between escrow agents. 

D-Land attempts to resolve this by:
1. **Verifying Assets:** Verifying real-estate existence through RERA or Land Survey Registry Records.
2. **Tokenisation:** Minting Algorand Standard Assets (ASAs) representing property rights.
3. **Immutability:** Storing crucial property metadata onto IPFS permanently (via Pinata).
4. **Decentralized Escrow with Fiat Support:** Combining smart contract escrow with a secure off-chain fiat settlement mechanism verified via Unique Transaction Reference (UTR) numbers.

## ⚙️ How It Works?

1. **KYC & Registration:** Users connect their Algorand Wallet (e.g., Pera Wallet) on the platform.
2. **Selling (Creating Listings):** A seller initiates a sell request with their properties' registry ID (RERA for flats, Survey No. for Land) and sets a **Fiat Payment Expiry Duration**.
3. **Minting:** The backend queries the Government Registry (simulated via Supabase `rera_records`), generates metadata, pins it to IPFS, creates the ASAs via the Algorand blockchain, and transfers ASAs to the seller's wallet.
4. **Buy Request:** A buyer peruses registered/tokenised properties on the marketplace and places a "Buy Request".
5. **Smart Escrow & Time-Locks:** When the seller accepts the deal, a **Logic-Signature (Smart Contract) Escrow** is dynamically created. The seller's asset tokens are locked securely with an active **Expiry Timer**.
6. **Fiat Payment & UTR Verification:** The buyer makes an off-chain fiat transfer (e.g., NEFT/RTGS) and submits their **UTR (Unique Transaction Reference) Number** to the platform.
7. **Settlement or Clawback:** 
   - **Successful Settlement:** If the seller verifies the UTR, both parties explicitly sign their parts (Fund lock & Asset lock) to conclude the Atomic Transfer, making the transaction trustless and secure.
   - **Clawback (Buyer Default):** If the buyer fails to upload a valid UTR or defaults on the payment before the escrow expiry deadline, the seller can trigger a **Clawback Mechanism** to securely reclaim their NFT assets and cancel the escrow.

---

## 🛠 Tools and Technologies Used

### Frontend (Client Application)
- **React 19 & Vite** - High-performance scaffolding and modern UI rendering.
- **React Router v7** - Client-side application routing.
- **Lucide React** - SVG UI elements and icons.
- **@perawallet/connect** - Official SDK to interface with Pera Algo Wallet.
- **Vanilla CSS (App.css, index.css, Component CSS)** - Custom styled components focusing on sleek UX without heavy frameworks.

### Backend (Server Application)
- **Python 3.x & Flask** - Lightweight RESTful web-server framework.
- **Algorand Python SDK (`algosdk`)** - Comprehensive toolkit to create transactions, logic signatures, interact with Algod nodes, and implement **Clawback mechanisms**.
- **Supabase (PostgreSQL)** - Leveraging its robust Data API for relational data involving properties, listings, logic states, mocked Govt. RERA records, and tracking **UTR submissions & expiry stages**.
- **Pinata (IPFS)** - Seamless pinning of JSON properties metadata to IPFS for permanently accessible and unalterable records.

---

## 🧠 Programmatic Approach & Architectures

D-Land utilizes a modular, distributed web architecture divided primarily into three layers: 

### 1. The Context-Driven UI Layer (Frontend)
- **Wallet State Management:** The frontend leverages a custom `WalletContext.jsx` heavily mapping to `@perawallet/connect`. The context exposes global hooks (`useWallet`) to keep track of connection status, address handling, and signing requests natively within components.
- **Component-based Abstraction:** Interfaces like `SellProperty.jsx`, `Marketplace.jsx`, and `Activity.jsx` rely strictly on functional components and hooks to asynchronously request backend pipelines, segregating UI logic from transaction compilation logic. Real-time expiry timers and UTR upload portals are handled locally.

### 2. Micro-Orchestrated REST API (Backend)
- **Controller & Router Module (`main.py`):** Flask handles frontend requests via strict endpoint schemas (e.g., `/api/tokenise` or `/api/accept-deal`). It provides validation, CORS handling, and gracefully handles unexpected blockchain timeouts.
- **Service Layer Abstraction:** The integration with complex APIs is decoupled:
  - `rera_token_create.py`: An orchestration service taking a RERA ID, fetching records, instructing Pinata to pin metadata, compiling metadata hashes (ARC-3 NFT standards), and natively executing ASA Creation transactions against an Algod Node.
  - `escrow_service.py`: Contains the deep-level Algorand Atomic Transfers logic. It compiles Teal Smart Contracts, simulates partial transactions to prevent failure, builds unsigned MsgPack blobs to send to the frontend, and groups the logic sig transactions. It also oversees the **Clawback operations** and **Asset Freezing** logic dynamically.

### 3. Trustless Resolution (Blockchain & Database Layer)
- Transactions are primarily formulated on the backend but **signed** physically by the users on the frontend leveraging their Pera wallet, ensuring the platform's backend is non-custodial regarding buyers' and sellers' primary funds.
- Supabase bridges the gap between off-chain property metadata, fiat payment statuses (UTR verification), and on-chain ownership execution tracking logic mappings (linking Escrows dynamically to Property IDs with foreign key relations and managing Expiration deadlines).

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- Python (3.9+)
- An Algorand Node Endpoint (e.g. from AlgoNode or PureStake)
- Pinata API Keys
- Supabase Project with initialized schema

### 1. Starting the Backend
```bash
cd backend
# Create a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install requirements
pip install -r requirements.txt # (Ensure flask, flask_cors, python-dotenv, algosdk, supabase, requests are installed)

# Setup Environment (.env)
# Include SUPABASE_URL, SUPABASE_SERVICE_KEY, PINATA_API_KEY, PINATA_SECRET_API_KEY, ALGOD_ADDRESS, ALGOD_TOKEN, CREATOR_MNEMONIC

# Run Flask
python main.py
```

### 2. Starting the Frontend
```bash
cd frontend

# Install Dependencies
npm install

# Start Dev Server
npm run dev
```

## 🔐 Licensing
MIT License - Open Source experimental prototype meant for Educational and Hackathon deployments.
