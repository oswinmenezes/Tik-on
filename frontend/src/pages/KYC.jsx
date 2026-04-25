import { useState } from 'react'

export default function KYC() {
  const [pan, setPan] = useState('')
  const [otp, setOtp] = useState('')
  const [email, setEmail] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // 👉 BUTTON 1 → VERIFY PAN + SEND OTP
  const handleSendOtp = async () => {
    if (!pan) {
      setError('Enter PAN number')
      return
    }

    try {
      setLoading(true)
      setError('')
      setMessage('')

      // 1. VERIFY PAN
      const verifyRes = await fetch(
        `http://localhost:5000/verify-pan?pan=${encodeURIComponent(pan)}`
      )

      const verifyData = await verifyRes.json()

      if (!verifyRes.ok || !verifyData.exists) {
        setError(verifyData.message || verifyData.error || 'PAN not found')
        return
      }

      const foundEmail = verifyData.email
      setEmail(foundEmail)

      // 2. SEND OTP
      const otpRes = await fetch('http://localhost:5000/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: foundEmail }),
      })

      const otpData = await otpRes.json()

      if (!otpRes.ok) {
        setError(otpData.error || 'Failed to send OTP')
        return
      }

      setOtpSent(true)
      setMessage(`OTP sent to ${foundEmail}`)
    } catch (err) {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // 👉 BUTTON 2 → VERIFY OTP
  const handleVerifyOtp = async () => {
    if (!otp) {
      setError('Enter OTP')
      return
    }

    try {
      setLoading(true)
      setError('')
      setMessage('')

      const res = await fetch(
        `http://localhost:5000/verify-otp?email=${encodeURIComponent(email)}&otp=${encodeURIComponent(otp)}`
      )

      const data = await res.json()

      if (!res.ok || !data.valid) {
        setError(data.message || data.error || 'Invalid OTP')
        return
      }

      setOtpVerified(true)
      setMessage('OTP verified successfully')
    } catch (err) {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', fontFamily: 'sans-serif' }}>
      <h2>KYC Verification</h2>

      {/* PAN INPUT */}
      <div style={{ marginBottom: '15px' }}>
        <label>PAN Number</label>
        <input
          type="text"
          value={pan}
          onChange={(e) => {
            setPan(e.target.value.toUpperCase())
            setOtpSent(false)
            setOtpVerified(false)
            setEmail('')
            setOtp('')
            setError('')
            setMessage('')
          }}
          placeholder="ABCDE1234F"
          maxLength={10}
          style={{ width: '100%', padding: '10px', marginTop: '5px' }}
        />
      </div>

      {/* SEND OTP BUTTON */}
      <button onClick={handleSendOtp} disabled={loading} style={{ width: '100%', padding: '10px' }}>
        {loading ? 'Please wait...' : 'Verify PAN & Send OTP'}
      </button>

      {/* OTP INPUT */}
      {otpSent && (
        <>
          <div style={{ marginTop: '15px' }}>
            <label>Enter OTP</label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="6 digit OTP"
              maxLength={6}
              style={{ width: '100%', padding: '10px', marginTop: '5px' }}
            />
          </div>

          {/* VERIFY OTP BUTTON */}
          <button
            onClick={handleVerifyOtp}
            disabled={loading}
            style={{ width: '100%', padding: '10px', marginTop: '10px' }}
          >
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
        </>
      )}

      {/* STATUS */}
      {message && <p style={{ color: 'green' }}>{message}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* FINAL SUBMIT */}
      <button
        disabled={!otpVerified}
        style={{
          width: '100%',
          padding: '12px',
          marginTop: '20px',
          background: otpVerified ? 'green' : 'gray',
          color: 'white',
          border: 'none',
        }}
      >
        Submit KYC
      </button>
    </div>
  )
}