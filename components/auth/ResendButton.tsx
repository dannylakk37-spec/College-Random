'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function ResendButton({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  async function resend() {
    setState('sending');
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    if (error) {
      setState('error');
      setMsg(/seconds|rate/i.test(error.message) ? 'Please wait a minute before trying again.' : error.message);
    } else {
      setState('sent');
    }
  }

  return (
    <div className="mt-6">
      <button onClick={resend} disabled={state === 'sending' || state === 'sent'} className="btn-outline w-full">
        {state === 'sending' ? 'Sending…' : state === 'sent' ? 'Sent! Check your inbox' : 'Resend verification email'}
      </button>
      {state === 'error' && <p className="mt-2 text-sm text-red-600">{msg}</p>}
    </div>
  );
}
