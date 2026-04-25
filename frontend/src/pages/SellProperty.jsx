import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, CheckCircle, Upload, Building2, Landmark, Info, Zap } from 'lucide-react'
import { useWallet } from '../context/WalletContext'
import algosdk from 'algosdk'
import { Buffer } from 'buffer'
import './SellProperty.css'

export default function SellProperty() {
  const { wallet, isConnected, peraWallet } = useWallet()
  const navigate = useNavigate()
  const [tab, setTab] = useState('flat')
  const [step, setStep] = useState(1) // 1: form, 2: preview, 3: success
  const [submitting, setSubmitting] = useState(false)

  const [tokenResult, setTokenResult] = useState(null)
  const [verifiedData, setVerifiedData] = useState(null)

  // Flat form
  const [flatForm, setFlatForm] = useState({ reraId: '', flatNo: '1', price: '', expiryDays: 7 })

  // Land form
  const [landForm, setLandForm] = useState({ surveyNo: '', price: '', expiryDays: 7 })

  // Removed KYC blockers to allow demonstration

  const handleVerify = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const isFlat = tab === 'flat'
      const payload = {
        rera_id: isFlat ? flatForm.reraId : landForm.surveyNo
      }

      const response = await fetch('http://127.0.0.1:5000/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Verification failed')
      }

      setVerifiedData(data.data)
      setStep(2)
    } catch (error) {
      console.error(error)
      alert(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      if (!wallet) throw new Error("Please connect a wallet first.")
      const isFlat = tab === 'flat'
      const payload = {
        rera_id: isFlat ? flatForm.reraId : landForm.surveyNo,
        seller_wallet: wallet.address,
        price: isFlat ? flatForm.price : landForm.price,
        expiry_days: isFlat ? flatForm.expiryDays : landForm.expiryDays
      }

      // Step 1: Initiate Tokenisation
      const initRes = await fetch('http://127.0.0.1:5000/api/tokenise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const initData = await initRes.json()

      if (!initRes.ok || !initData.success) {
        throw new Error(initData.error || 'Tokenisation failed')
      }

      const unsignedB64Txns = initData.data.unsigned_txns;

      // Step 2: Decode and Sign with Pera
      const txnArray = unsignedB64Txns.map(b64Str => {
        const binaryString = window.atob(b64Str)
        const txnBytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          txnBytes[i] = binaryString.charCodeAt(i)
        }
        return algosdk.decodeUnsignedTransaction(txnBytes)
      })

      const signParam = txnArray.map(txn => [{ txn: txn, signers: [wallet.address] }])
      const signedTxnGroup = await peraWallet.signTransaction(signParam)

      const signedTxnsB64 = signedTxnGroup.map(signedBytes => {
        let binaryResult = ''
        for (let i = 0; i < signedBytes.byteLength; i++) {
          binaryResult += String.fromCharCode(signedBytes[i])
        }
        return window.btoa(binaryResult)
      })

      // Step 3: Complete Tokenisation
      const completePayload = {
        seller_wallet: wallet.address,
        signed_txns: signedTxnsB64,
        asset_ids: initData.data.assets.map(a => a.asset_id),
        rera_id: payload.rera_id,
        price: payload.price,
        expiry_days: payload.expiry_days
      };

      const compRes = await fetch('http://127.0.0.1:5000/api/tokenise-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completePayload)
      })
      const compData = await compRes.json()

      if (!compRes.ok || !compData.success) throw new Error(compData.error || 'Failed to complete tokenisation')

      setTokenResult(initData.data)
      setStep(3)
    } catch (error) {
      console.error(error)
      if (error?.data?.type === 'CONNECT_MODAL_CLOSED' || error?.message?.includes('Another transaction in progress')) {
        alert("Wallet signature error. Please open your Pera Wallet app directly to sign, or wait if it is still loading.")
      } else {
        alert('Error tokenising asset: ' + error.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="sell-page pb-80">
      <div className="mk-header">
        <div className="container text-center anim-fade">
          <h1>Sell Property</h1>
          <p>List your flat or land on D-LAND. Verified via Govt. records and minted on Algorand.</p>
        </div>
      </div>

      <div className="container container-sm anim-fade-1 mt-min-40">

        {step === 1 && (
          <div className="card shadow-xl">
            <div className="tabs p-4 m-24">
              <button
                className={`tab-btn text-lg py-12 ${tab === 'flat' ? 'active' : ''}`}
                onClick={() => setTab('flat')}
              >
                <Building2 size={16} className="inline mr-1" /> Sell Flat / Apartment
              </button>
              <button
                className={`tab-btn text-lg py-12 ${tab === 'land' ? 'active' : ''}`}
                onClick={() => setTab('land')}
              >
                <Landmark size={16} className="inline mr-1" /> Sell Land Parcel
              </button>
            </div>

            <div className="card-body pt-0 pb-32 px-32">
              <form onSubmit={handleVerify}>

                {tab === 'flat' ? (
                  <>
                    <div className="grid-2 mb-16">
                      <div className="form-group">
                        <label className="form-label">RERA Registration ID <span>*</span></label>
                        <input required type="text" className="form-input" placeholder="e.g. P519000..." value={flatForm.reraId} onChange={e => setFlatForm({ ...flatForm, reraId: e.target.value })} />
                      </div>
                    </div>
                    <div className="form-group mb-24">
                      <label className="form-label">Asking Price (algo) <span>*</span></label>
                      <input required type="number" className="form-input text-lg" placeholder="e.g. 15000000" value={flatForm.price} onChange={e => setFlatForm({ ...flatForm, price: e.target.value })} />
                    </div>
                    <div className="form-group mb-24">
                      <label className="form-label">Fiat Payment Expiry (Days) <span>*</span></label>
                      <input required type="number" className="form-input" placeholder="e.g. 7" value={flatForm.expiryDays} onChange={e => setFlatForm({ ...flatForm, expiryDays: e.target.value })} min="1" max="90" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-group mb-16">
                      <label className="form-label">Survey Number <span>*</span></label>
                      <input required type="text" className="form-input" placeholder="e.g. SRV/NAS/..." value={landForm.surveyNo} onChange={e => setLandForm({ ...landForm, surveyNo: e.target.value })} />
                    </div>
                    <div className="form-group mb-24">
                      <label className="form-label">Asking Price (algo) <span>*</span></label>
                      <input required type="number" className="form-input text-lg" placeholder="e.g. 5000000" value={landForm.price} onChange={e => setLandForm({ ...landForm, price: e.target.value })} />
                    </div>
                    <div className="form-group mb-24">
                      <label className="form-label">Fiat Payment Expiry (Days) <span>*</span></label>
                      <input required type="number" className="form-input" placeholder="e.g. 7" value={landForm.expiryDays} onChange={e => setLandForm({ ...landForm, expiryDays: e.target.value })} min="1" max="90" />
                    </div>
                  </>
                )}

                <div className="form-group mb-24">
                  <label className="form-label">Upload Ownership Document (Optional but recommended)</label>
                  <label className="upload-zone">
                    <Upload size={18} />
                    <span>Click to browse or drag PDF here</span>
                  </label>
                </div>

                <div className="alert alert-info mb-24">
                  <Info size={16} />
                  We will query the government database to verify your ownership using your linked KYC details ({wallet?.name || 'Anonymous'}).
                </div>

                <button type="submit" className="btn btn-primary btn-lg w-full justify-center text-lg" disabled={submitting}>
                  {submitting ? <div className="spinner border-dark" /> : <><ShieldCheck size={18} /> Verify & Preview Listing</>}
                </button>
              </form>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="card shadow-xl p-32 anim-fade">
            <div className="text-center mb-24">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success-muted text-success mb-16">
                <CheckCircle size={32} />
              </div>
              <h2>Ownership Verified Successfully</h2>
              <p className="text-gray">Please review the fetched property details before tokenizing.</p>
            </div>

            <div className="bg-surface-2 p-24 rounded-lg border border-border mb-24">
              <div className="grid-2 gap-16 text-sm mb-16">
                <div>
                  <div className="text-gray uppercase text-xs font-bold mb-4">Location</div>
                  <div className="font-bold">{verifiedData ? `${verifiedData.location_village}, ${verifiedData.location_district}` : (tab === 'flat' ? 'Bandra West, Mumbai' : 'Sinnar Taluka, Nashik')}</div>
                </div>
                <div>
                  <div className="text-gray uppercase text-xs font-bold mb-4">Area</div>
                  <div className="font-bold">{verifiedData ? `${verifiedData.area_sqft} sqft` : (tab === 'flat' ? '1450 sqft' : '2.5 acres')}</div>
                </div>
                <div>
                  <div className="text-gray uppercase text-xs font-bold mb-4">Registered Owner</div>
                  <div className="font-bold text-success flex items-center gap-4">{verifiedData ? verifiedData.owner_name : (wallet?.name || 'Anonymous')} <CheckCircle size={12} /></div>
                </div>
                <div>
                  <div className="text-gray uppercase text-xs font-bold mb-4">Asking Price</div>
                  <div className="font-bold font-display text-lg"> {Number(tab === 'flat' ? flatForm.price : landForm.price).toLocaleString('en-IN')}</div>
                </div>
              </div>

              <div className="bg-primary-muted border border-primary-dark p-16 rounded-md">
                <div className="font-bold text-sm text-primary-deep flex items-center gap-8 mb-8"><Zap size={14} /> Algorand Tokenization Preview</div>
                <div className="flex justify-between text-xs mb-4"><span className="text-gray">Network</span><span className="font-bold">Algorand Mainnet</span></div>
                <div className="flex justify-between text-xs mb-4"><span className="text-gray">Asset Type</span><span className="font-bold">ASA (Fractional: No)</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray">Smart Contract</span><span className="font-bold">D-LAND Atomic Escrow v2</span></div>
              </div>
            </div>

            <div className="flex gap-16">
              <button className="btn btn-outline flex-1 justify-center" onClick={() => setStep(1)} disabled={submitting}>Back</button>
              <button className="btn btn-primary flex-2 justify-center" onClick={handleConfirm} disabled={submitting}>
                {submitting ? <div className="spinner border-dark" /> : 'Confirm & Tokenize Asset'}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="card shadow-xl p-40 text-center anim-fade">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success text-white mb-24 shadow-md">
              <CheckCircle size={40} />
            </div>
            <h2 className="mb-12">Property Listed on D-LAND!</h2>
            <p className="text-gray mb-16 max-w-md mx-auto">
              Your property token(s) have been minted and locked in the smart contract. Your listing is now public.
            </p>
            {tokenResult && (
              <div className="bg-surface-2 p-16 rounded-lg text-left text-sm mb-32 d-inline-block mx-auto max-w-sm border border-border">
                <div className="flex justify-between mb-8"><span className="text-gray">IPFS Hash</span> <a href={tokenResult.ipfs_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{tokenResult.ipfs_hash.slice(0, 8)}...</a></div>
                <div className="flex justify-between mb-8"><span className="text-gray">Total Flats Minted</span> <span className="font-bold">{tokenResult.no_of_flats}</span></div>
                <div className="flex justify-between mb-8"><span className="text-gray">Asset IDs</span> <span className="font-bold">{tokenResult.assets.map(a => a.asset_id).join(', ')}</span></div>
              </div>
            )}
            <div className="flex justify-center gap-16">
              <button className="btn btn-outline" onClick={() => navigate('/marketplace')}>View in Marketplace</button>
              <button className="btn btn-primary" onClick={() => navigate('/activity?tab=listings')}>Manage My Listings</button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
