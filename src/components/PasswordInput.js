'use client';
import { useState } from 'react';

// A password box with a Show/Hide toggle.
//
// It reveals what is being TYPED, not what the account's password is: passwords are
// stored one-way hashed (set_password → PBKDF2), so no existing password can be read
// back by anyone, this UI included. Setting a new one and reading it aloud is the
// only way to hand someone their password.
//
// Defaults to hidden, and every open of the form starts hidden again — an admin
// screen is the kind of place someone else is standing behind.
export default function PasswordInput({ style, ...props }) {
  const [shown, setShown] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        {...props}
        type={shown ? 'text' : 'password'}
        style={{ ...style, paddingRight: 58 }}
        onFocus={(e) => { e.target.style.borderColor = '#2F6DB5'; }}
        onBlur={(e) => { e.target.style.borderColor = '#DFE2E6'; }}
      />
      {/* type="button" so it never submits the form it sits in. */}
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        title={shown ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          border: 'none', background: 'none', cursor: 'pointer', padding: '4px 6px',
          fontSize: 12, fontWeight: 700, color: '#2F6DB5', lineHeight: 1,
        }}>
        {shown ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
