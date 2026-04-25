import { createContext, useContext, useState, useCallback } from 'react'
import { ethers } from 'ethers'
import { switchToPolygon, TARGET_CHAIN_ID } from '../utils/contract'

const WalletContext = createContext(null)

export function WalletProvider({ children }) {
  const [wallet, setWallet] = useState(null)
  const [signer, setSigner] = useState(null)
  const [connecting, setConnecting] = useState(false)

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      alert('MetaMask is not installed. Please install it to continue.')
      return
    }

    setConnecting(true)
    try {
      // Request account access
      const provider = new ethers.BrowserProvider(window.ethereum)
      await provider.send('eth_requestAccounts', [])

      // Switch to Polygon network
      await switchToPolygon(provider)

      // Re-create provider after chain switch
      const polygonProvider = new ethers.BrowserProvider(window.ethereum)
      const walletSigner = await polygonProvider.getSigner()
      const address = await walletSigner.getAddress()

      setSigner(walletSigner)
      setWallet({
        address,
        short: address.slice(0, 6) + '…' + address.slice(-4),
        name: address.slice(0, 6) + '…' + address.slice(-4),
        kyc_status: 'verified', // keep existing flow
      })
    } catch (err) {
      console.error('Wallet connection failed:', err)
      alert('Failed to connect wallet: ' + (err?.message || err))
    } finally {
      setConnecting(false)
    }
  }, [])

  const disconnect = useCallback(() => {
    setWallet(null)
    setSigner(null)
  }, [])

  const updateKyc = useCallback((status) => {
    setWallet(w => w ? { ...w, kyc_status: status } : w)
  }, [])

  const isConnected = !!wallet
  const kycVerified = wallet?.kyc_status === 'verified'

  return (
    <WalletContext.Provider value={{ wallet, signer, connecting, connect, disconnect, updateKyc, isConnected, kycVerified }}>
      {children}
    </WalletContext.Provider>
  )
}

export const useWallet = () => {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be inside WalletProvider')
  return ctx
}
