import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, CheckCircle, Upload, Building2, Landmark, Info, Zap } from 'lucide-react'
import { useWallet } from '../context/WalletContext'
import { mintNFTs } from '../utils/contract'
import './SellProperty.css'

export default function SellProperty() {
  const { wallet, signer, isConnected } = useWallet()
  const navigate = useNavigate()
  const [tab, setTab] = useState('flat')
  const [step, setStep] = useState(1) // 1: form, 2: preview, 3: success
  const [submitting, setSubmitting] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [mintError, setMintError] = useState('')

  // Flat form
  const [flatForm, setFlatForm] = useState({ reraId: '', flatNo: '', price: '', nftCount: '1', walletAddr: '' })
  
  // Land form
  const [landForm, setLandForm] = useState({ surveyNo: '', price: '', nftCount: '1', walletAddr: '' })

  // Active form helpers
  const activeForm = tab === 'flat' ? flatForm : landForm
  const setActiveForm = tab === 'flat' ? setFlatForm : setLandForm

  if (!isConnected) {
    return (
      <div className="container section text-center">
        <h2>Please Connect Wallet</h2>
        <p className="text-gray mt-12 mb-24">You need to connect a Polygon wallet (MetaMask) to sell properties.</p>
        <button className="btn btn-blue" onClick={() => alert('Use top right connect button')}>Connect Wallet</button>
      </div>
    )
  }

  if (wallet.kyc_status !== 'verified') {
    return (
      <div className="container section text-center">
        <h2>KYC Required</h2>
        <p className="text-gray mt-12 mb-24">Only verified users can list properties for sale to prevent fraud.</p>
        <button className="btn btn-primary" onClick={() => navigate('/kyc')}>Complete KYC Now</button>
      </div>
    )
  }

  const handleVerify = (e) => {
    e.preventDefault()
    setSubmitting(true)
    setMintError('')
    setTimeout(() => {
      setSubmitting(false)
      setStep(2)
    }, 1500)
  }

  const handleConfirm = async () => {
    setSubmitting(true)
    setMintError('')
    try {
      const n = parseInt(activeForm.nftCount, 10)
      const targetWallet = activeForm.walletAddr.trim() || wallet.address

      if (isNaN(n) || n < 1 || n > 50) {
        throw new Error('NFT count must be between 1 and 50')
      }

      const { tx } = await mintNFTs(signer, targetWallet, n)
      setTxHash(tx.hash)
      setStep(3)
    } catch (err) {
      console.error('Minting failed:', err)
      setMintError(err?.reason || err?.message || 'Transaction failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="sell-page pb-80">
      <div className="mk-header">
        <div className="container text-center anim-fade">
          <h1>Sell Property</h1>
          <p>List your flat or land on Tik-on. Verified via Govt. records and minted on Polygon.</p>
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
                        <input required type="text" className="form-input" placeholder="e.g. P519000..." value={flatForm.reraId} onChange={e => setFlatForm({...flatForm, reraId: e.target.value})} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Flat / Unit Number <span>*</span></label>
                        <input required type="text" className="form-input" placeholder="e.g. B-1204" value={flatForm.flatNo} onChange={e => setFlatForm({...flatForm, flatNo: e.target.value})} />
                      </div>
                    </div>
                    <div className="form-group mb-16">
                      <label className="form-label">Asking Price (₹) <span>*</span></label>
                      <input required type="number" className="form-input text-lg" placeholder="e.g. 15000000" value={flatForm.price} onChange={e => setFlatForm({...flatForm, price: e.target.value})} />
                    </div>
                  </>
                ) : (
                   <>
                    <div className="form-group mb-16">
                      <label className="form-label">Survey Number <span>*</span></label>
                      <input required type="text" className="form-input" placeholder="e.g. SRV/NAS/..." value={landForm.surveyNo} onChange={e => setLandForm({...landForm, surveyNo: e.target.value})} />
                    </div>
                    <div className="form-group mb-16">
                      <label className="form-label">Asking Price (₹) <span>*</span></label>
                      <input required type="number" className="form-input text-lg" placeholder="e.g. 5000000" value={landForm.price} onChange={e => setLandForm({...landForm, price: e.target.value})} />
                    </div>
                  </>
                )}

                {/* ── NFT Minting Options ── */}
                <div className="grid-2 mb-16">
                  <div className="form-group">
                    <label className="form-label">Number of NFTs to Mint <span>*</span></label>
                    <input 
                      required 
                      type="number" 
                      min="1" 
                      max="50" 
                      className="form-input" 
                      placeholder="e.g. 1" 
                      value={activeForm.nftCount} 
                      onChange={e => setActiveForm(prev => ({...prev, nftCount: e.target.value}))} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Recipient Wallet Address</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder={wallet.short + ' (your wallet)'}
                      value={activeForm.walletAddr} 
                      onChange={e => setActiveForm(prev => ({...prev, walletAddr: e.target.value}))} 
                    />
                  </div>
                </div>

                <div className="form-group mb-24">
                  <label className="form-label">Upload Ownership Document (Optional but recommended)</label>
                  <label className="upload-zone">
                    <Upload size={18} />
                    <span>Click to browse or drag PDF here</span>
                  </label>
                </div>

                <div className="alert alert-info mb-24">
                  <Info size={16} />
                  We will query the government database to verify your ownership using your linked KYC details ({wallet.short}).
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
                  <div className="font-bold">{tab === 'flat' ? 'Bandra West, Mumbai' : 'Sinnar Taluka, Nashik'}</div>
                </div>
                <div>
                  <div className="text-gray uppercase text-xs font-bold mb-4">Area</div>
                  <div className="font-bold">{tab === 'flat' ? '1450 sqft' : '2.5 acres'}</div>
                </div>
                <div>
                  <div className="text-gray uppercase text-xs font-bold mb-4">Registered Owner</div>
                  <div className="font-bold text-success flex items-center gap-4">{wallet.short} <CheckCircle size={12}/></div>
                </div>
                <div>
                  <div className="text-gray uppercase text-xs font-bold mb-4">Asking Price</div>
                  <div className="font-bold font-display text-lg">₹ {Number(activeForm.price).toLocaleString('en-IN')}</div>
                </div>
              </div>

              <div className="bg-primary-muted border border-primary-dark p-16 rounded-md">
                <div className="font-bold text-sm text-primary-deep flex items-center gap-8 mb-8"><Zap size={14}/> Polygon Tokenization Preview</div>
                <div className="flex justify-between text-xs mb-4"><span className="text-gray">Network</span><span className="font-bold">Polygon (MATIC)</span></div>
                <div className="flex justify-between text-xs mb-4"><span className="text-gray">Token Standard</span><span className="font-bold">ERC-721 (PropertyNFT)</span></div>
                <div className="flex justify-between text-xs mb-4"><span className="text-gray">NFTs to Mint</span><span className="font-bold">{activeForm.nftCount}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray">Recipient</span><span className="font-bold" style={{fontSize:'0.65rem'}}>{activeForm.walletAddr || wallet.address}</span></div>
              </div>
            </div>

            {mintError && (
              <div className="alert alert-danger mb-16" style={{color:'#dc3545', background:'#f8d7da', border:'1px solid #f5c6cb', borderRadius:8, padding:'12px 16px'}}>
                ⚠️ {mintError}
              </div>
            )}

            <div className="flex gap-16">
               <button className="btn btn-outline flex-1 justify-center" onClick={() => { setStep(1); setMintError(''); }} disabled={submitting}>Back</button>
               <button className="btn btn-primary flex-2 justify-center" onClick={handleConfirm} disabled={submitting}>
                 {submitting ? <div className="spinner border-dark"/> : 'Confirm & Mint NFT on Polygon'}
               </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="card shadow-xl p-40 text-center anim-fade">
             <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success text-white mb-24 shadow-md">
               <CheckCircle size={40} />
             </div>
             <h2 className="mb-12">Property NFTs Minted on Polygon!</h2>
             <p className="text-gray mb-16 max-w-md mx-auto">
               {activeForm.nftCount} NFT{parseInt(activeForm.nftCount) > 1 ? 's' : ''} minted successfully to{' '}
               <strong style={{wordBreak:'break-all', fontSize:'0.8rem'}}>{activeForm.walletAddr || wallet.address}</strong>
             </p>
             {txHash && (
               <div className="mb-24" style={{background:'#f0f0f0', borderRadius:8, padding:'12px 16px', wordBreak:'break-all', fontSize:'0.8rem'}}>
                 <strong>Tx Hash:</strong>{' '}
                 <a 
                   href={`https://amoy.polygonscan.com/tx/${txHash}`} 
                   target="_blank" 
                   rel="noopener noreferrer"
                   style={{color:'#7c3aed'}}
                 >
                   {txHash}
                 </a>
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
