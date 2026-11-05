'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { DailyCall } from '@daily-co/daily-js';
import { Logo } from '@/components/Logo';
import { ReportDialog, BlockDialog } from '@/components/chat/SafetyDialogs';

type Phase = 'setup' | 'ready' | 'searching' | 'connecting' | 'connected' | 'ended';
type Partner = { username: string; university: string };
type StatusResponse =
  | { status: 'idle' | 'waiting' | 'forbidden' }
  | { status: 'matched'; match: { id: string; partner: Partner } };
type EndReason = 'left' | 'reported' | 'blocked' | 'restricted';

const SEARCH_POLL_MS = 2500; // how often we ask "found anyone yet?"
const CALL_POLL_MS = 8000; // heartbeat while in a call
const JOIN_TIMEOUT_MS = 25000; // give up if partner never shows up

class ApiCallError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

async function api<T>(url: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? 'GET',
    headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiCallError(data.error || 'Request failed', res.status, data.code);
  return data as T;
}

export function ChatClient({ me, isAdmin }: { me: { username: string; university: string }; isAdmin: boolean }) {
  const [phase, setPhaseState] = useState<Phase>('setup');
  const [partner, setPartner] = useState<Partner | null>(null);
  const [endReason, setEndReason] = useState<EndReason | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [partnerCam, setPartnerCam] = useState(true);
  const [partnerMic, setPartnerMic] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [canReport, setCanReport] = useState(false);

  const phaseRef = useRef<Phase>('setup');
  const callRef = useRef<DailyCall | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const matchIdRef = useRef<string | null>(null); // current live match
  const lastMatchIdRef = useRef<string | null>(null); // most recent match (for reporting after it ends)
  const joinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyRef = useRef(false);
  const micRef = useRef(true);
  const camRef = useRef(true);
  const unmountedRef = useRef(false);

  // NOTE: every helper below reads refs (never state) so the Daily event
  // listeners, which are registered once, always see current values.

  function setPhase(p: Phase) {
    phaseRef.current = p;
    setPhaseState(p);
  }

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 3500);
  }

  function clearJoinTimer() {
    if (joinTimerRef.current) clearTimeout(joinTimerRef.current);
    joinTimerRef.current = null;
  }

  function handleApiError(e: unknown) {
    if (e instanceof ApiCallError) {
      if (e.status === 401) {
        window.location.href = '/login?next=/chat';
        return;
      }
      if (e.code === 'restricted' || e.code === 'unverified') {
        setError(e.message);
        setEndReason('restricted');
        setPhase('ended');
        return;
      }
      setError(e.message);
      return;
    }
    setError(e instanceof Error ? e.message : 'Something went wrong.');
  }

  // ---------------- Camera & microphone ----------------
  async function ensureLocalStream(): Promise<MediaStream> {
    const existing = localStreamRef.current;
    if (existing && existing.getTracks().length > 0 && existing.getTracks().every((t) => t.readyState === 'live')) {
      return existing;
    }
    existing?.getTracks().forEach((t) => t.stop());
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    stream.getAudioTracks().forEach((t) => (t.enabled = micRef.current));
    stream.getVideoTracks().forEach((t) => (t.enabled = camRef.current));
    localStreamRef.current = stream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
      localVideoRef.current.play().catch(() => {});
    }
    return stream;
  }

  async function enableCamera() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Your browser doesn’t support video chat. Try the latest Chrome, Safari, Edge or Firefox (HTTPS required).');
      return;
    }
    try {
      await ensureLocalStream();
      setPhase('ready');
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === 'NotAllowedError') {
        setError('Camera/mic access was blocked. Click the camera icon in your address bar, allow access, then try again.');
      } else if (name === 'NotFoundError') {
        setError('No camera or microphone found. Plug one in and try again.');
      } else if (name === 'NotReadableError') {
        setError('Your camera is being used by another app (Zoom, FaceTime…). Close it and try again.');
      } else {
        setError('Could not start your camera. Please try again.');
      }
    }
  }

  function sendMyState() {
    const call = callRef.current;
    if (call && call.meetingState() === 'joined-meeting') {
      try {
        call.sendAppMessage({ type: 'cr-state', cam: camRef.current, mic: micRef.current }, '*');
      } catch {
        /* not critical */
      }
    }
  }

  function toggleMic() {
    micRef.current = !micRef.current;
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = micRef.current));
    setMicOn(micRef.current);
    sendMyState();
  }

  function toggleCam() {
    camRef.current = !camRef.current;
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = camRef.current));
    setCamOn(camRef.current);
    sendMyState();
  }

  // ---------------- Daily call object ----------------
  async function getCall(): Promise<DailyCall> {
    if (callRef.current) return callRef.current;
    const Daily = (await import('@daily-co/daily-js')).default;
    // Reuse an existing instance if one survived (Daily allows only one at a time).
    const existing = (Daily as unknown as { getCallInstance?: () => DailyCall | undefined }).getCallInstance?.();
    const call = existing ?? Daily.createCallObject();

    call.on('participant-joined', () => syncRemote());
    call.on('participant-updated', () => syncRemote());
    call.on('track-started', () => syncRemote());
    call.on('track-stopped', () => syncRemote());
    call.on('participant-left', (ev) => {
      if (ev && !ev.participant?.local) void partnerGone('left');
    });
    call.on('left-meeting', () => {
      // Fires when the server deletes the room (other person left / was blocked).
      if (matchIdRef.current) void partnerGone('left');
    });
    call.on('error', (ev) => {
      console.warn('[daily] error', ev);
      if (matchIdRef.current) void partnerGone('left');
    });
    call.on('app-message', (ev) => {
      const data = ev?.data as { type?: string; cam?: boolean; mic?: boolean } | undefined;
      if (data?.type === 'cr-state') {
        setPartnerCam(data.cam !== false);
        setPartnerMic(data.mic !== false);
      }
    });

    callRef.current = call;
    return call;
  }

  function syncRemote() {
    const call = callRef.current;
    if (!call || !matchIdRef.current) return;
    const remote = Object.values(call.participants()).find((p) => !p.local);
    if (!remote) return;

    const tracks = [remote.tracks?.video?.persistentTrack, remote.tracks?.audio?.persistentTrack].filter(
      (t): t is MediaStreamTrack => Boolean(t),
    );
    const el = remoteVideoRef.current;
    if (el && tracks.length > 0) {
      const current = el.srcObject as MediaStream | null;
      const same =
        current && current.getTracks().length === tracks.length && tracks.every((t) => current.getTracks().includes(t));
      if (!same) {
        el.srcObject = new MediaStream(tracks);
        el.play()
          .then(() => setNeedsTap(false))
          .catch(() => setNeedsTap(true)); // browser blocked autoplay with sound
      }
    }

    if (phaseRef.current === 'connecting') {
      clearJoinTimer();
      setPhase('connected');
      sendMyState();
    }
  }

  function clearRemote() {
    const el = remoteVideoRef.current;
    if (el) el.srcObject = null;
    setPartnerCam(true);
    setPartnerMic(true);
    setNeedsTap(false);
  }

  async function leaveDaily() {
    const call = callRef.current;
    if (!call) return;
    const state = call.meetingState();
    if (state !== 'new' && state !== 'left-meeting') {
      try {
        await call.leave();
      } catch {
        /* ignore */
      }
    }
    // After a fatal error (e.g. room deleted mid-join) start fresh next time.
    if (call.meetingState() === 'error') {
      callRef.current = null;
      try {
        await call.destroy();
      } catch {
        /* ignore */
      }
    }
    // Some browsers stop our camera when the call ends — bring the preview back.
    if (!unmountedRef.current && localStreamRef.current?.getTracks().some((t) => t.readyState === 'ended')) {
      try {
        await ensureLocalStream();
      } catch {
        /* user will see the error when they try again */
      }
    }
  }

  // ---------------- Matching flow ----------------
  async function startSearch() {
    if (busyRef.current) return;
    busyRef.current = true;
    setError(null);
    setEndReason(null);
    try {
      await ensureLocalStream();
      matchIdRef.current = null;
      clearJoinTimer();
      await leaveDaily();
      clearRemote();
      setPartner(null);
      setPhase('searching');
      // Server: ends any previous chat (kicking the other person) and queues us.
      const res = await api<StatusResponse>('/api/match/join', { method: 'POST' });
      handleStatus(res);
    } catch (e) {
      handleApiError(e);
      if (phaseRef.current === 'searching') setPhase('ready');
    } finally {
      busyRef.current = false;
    }
  }

  function handleStatus(res: StatusResponse) {
    const p = phaseRef.current;
    if (res.status === 'forbidden') {
      matchIdRef.current = null;
      void leaveDaily();
      setError('Your account can’t chat right now. Refresh the page for details.');
      setEndReason('restricted');
      setPhase('ended');
      return;
    }
    if (p === 'searching') {
      if (res.status === 'matched') void beginConnect(res.match.id, res.match.partner);
      else if (res.status === 'idle' && !busyRef.current) void startSearch(); // dropped from queue (e.g. tab slept)
      return;
    }
    if (p === 'connecting' || p === 'connected') {
      const stillSame = res.status === 'matched' && res.match.id === matchIdRef.current;
      if (!stillSame && matchIdRef.current) void partnerGone('left');
    }
  }

  async function beginConnect(matchId: string, who: Partner) {
    if (matchIdRef.current === matchId) return; // already handling this match
    matchIdRef.current = matchId;
    lastMatchIdRef.current = matchId;
    setCanReport(true);
    setPartner(who);
    setPhase('connecting');

    try {
      const { url, token } = await api<{ url: string; token: string }>('/api/match/token', {
        method: 'POST',
        body: { matchId },
      });
      if (matchIdRef.current !== matchId) return;
      const stream = await ensureLocalStream();
      const call = await getCall();
      await call.join({
        url,
        token,
        videoSource: stream.getVideoTracks()[0] ?? false,
        audioSource: stream.getAudioTracks()[0] ?? false,
      });
      if (matchIdRef.current !== matchId) {
        await leaveDaily();
        return;
      }
      syncRemote();
      clearJoinTimer();
      joinTimerRef.current = setTimeout(() => {
        if (phaseRef.current === 'connecting' && matchIdRef.current === matchId) void partnerGone('no-show');
      }, JOIN_TIMEOUT_MS);
    } catch (e) {
      console.warn('[chat] connect failed', e);
      if (matchIdRef.current === matchId) {
        if (e instanceof ApiCallError && (e.code === 'restricted' || e.status === 401)) return handleApiError(e);
        void partnerGone('no-show');
      }
    }
  }

  /** The other person left, the chat ended server-side, or they never arrived. */
  async function partnerGone(reason: 'left' | 'no-show') {
    if (!matchIdRef.current) return;
    matchIdRef.current = null;
    clearJoinTimer();
    await leaveDaily();
    clearRemote();
    api('/api/match/leave', { method: 'POST' }).catch(() => {});

    if (reason === 'no-show') {
      // They never connected — quietly look for someone else.
      setPartner(null);
      busyRef.current = false;
      await startSearch();
      return;
    }
    setEndReason('left');
    setPhase('ended');
  }

  async function next() {
    if (busyRef.current) return;
    matchIdRef.current = null; // stop our own listeners treating this as "partner left"
    await startSearch();
  }

  async function disconnect() {
    matchIdRef.current = null;
    clearJoinTimer();
    await leaveDaily();
    clearRemote();
    setPartner(null);
    setEndReason(null);
    setPhase('ready');
    try {
      await api('/api/match/leave', { method: 'POST' });
    } catch {
      /* best effort */
    }
  }

  function afterSafetyAction(kind: 'reported' | 'blocked') {
    const wasLive = matchIdRef.current && matchIdRef.current === lastMatchIdRef.current;
    if (wasLive || phaseRef.current === 'connecting' || phaseRef.current === 'connected') {
      matchIdRef.current = null;
      clearJoinTimer();
      void leaveDaily();
      clearRemote();
      setEndReason(kind);
      setPhase('ended');
    }
    setCanReport(false);
    flash(kind === 'reported' ? 'Report sent. Thanks for keeping CollegeRandom safe.' : 'Blocked. You won’t be matched again.');
  }

  // ---------------- Effects ----------------
  // Poll the server: searching → look for a match; in a call → heartbeat.
  useEffect(() => {
    if (phase !== 'searching' && phase !== 'connecting' && phase !== 'connected') return;
    let stopped = false;
    const ms = phase === 'searching' ? SEARCH_POLL_MS : CALL_POLL_MS;
    const id = setInterval(async () => {
      if (stopped || (phase === 'searching' && busyRef.current)) return;
      try {
        const res = await api<StatusResponse>('/api/match/status');
        if (!stopped) handleStatus(res);
      } catch (e) {
        if (e instanceof ApiCallError && (e.status === 401 || e.code === 'restricted')) handleApiError(e);
      }
    }, ms);
    return () => {
      stopped = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Leave cleanly when the tab closes or the user navigates away.
  useEffect(() => {
    unmountedRef.current = false;
    const onHide = () => {
      if (matchIdRef.current || phaseRef.current === 'searching') {
        navigator.sendBeacon?.('/api/match/leave');
      }
    };
    window.addEventListener('pagehide', onHide);
    return () => {
      unmountedRef.current = true;
      window.removeEventListener('pagehide', onHide);
      onHide();
      matchIdRef.current = null;
      clearJoinTimer();
      const call = callRef.current;
      callRef.current = null;
      if (call) {
        call
          .leave()
          .catch(() => {})
          .finally(() => call.destroy().catch(() => {}));
      }
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };
  }, []);

  // ---------------- UI ----------------
  const statusText: Record<Phase, string> = {
    setup: 'Camera off',
    ready: 'Ready',
    searching: 'Searching…',
    connecting: 'Connecting…',
    connected: 'Connected',
    ended: 'Chat ended',
  };
  const dot =
    phase === 'connected' ? 'bg-mint-400' : phase === 'searching' || phase === 'connecting' ? 'bg-amber-400 animate-pulse' : 'bg-white/30';

  const inCall = phase === 'connecting' || phase === 'connected';
  const endMessages: Record<EndReason, string> = {
    left: `${partner?.username ?? 'The other student'} left.`,
    reported: 'Report sent. Chat ended.',
    blocked: 'Blocked. You won’t see them again.',
    restricted: error ?? 'Your account can’t chat right now.',
  };

  const Spinner = () => <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/15 border-t-white" />;
  const smallBtn = 'rounded-full px-4 py-2 text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white';

  return (
    <div className="flex min-h-[100dvh] flex-col bg-ink-950 text-white">
      <header className="flex h-14 items-center justify-between px-4 sm:px-6">
        <Logo dark />
        <span className="flex items-center gap-2 text-sm text-white/70">
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          {statusText[phase]}
        </span>
      </header>

      <main className="flex flex-1 flex-col gap-3 px-3 sm:px-4 lg:flex-row">
        {/* Other student */}
        <section className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl bg-ink-900 lg:aspect-auto lg:flex-1">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`absolute inset-0 h-full w-full object-cover ${phase === 'connected' && partnerCam ? 'opacity-100' : 'opacity-0'}`}
          />
          <div className="relative px-6 text-center text-white/70">
            {phase === 'setup' && <p>Turn on your camera to start.</p>}
            {phase === 'ready' && <p>Press <strong className="text-white">Start</strong> to meet a student.</p>}
            {phase === 'searching' && (<><Spinner /><p className="mt-4">Looking for a student…</p></>)}
            {phase === 'connecting' && (<><Spinner /><p className="mt-4">Connecting…</p></>)}
            {phase === 'connected' && !partnerCam && <p>Their camera is off.</p>}
            {phase === 'ended' && <p className="text-white">{endReason ? endMessages[endReason] : 'Chat ended.'}</p>}
          </div>
          {phase === 'connected' && partner && (
            <div className="absolute left-3 top-3 max-w-[80%] truncate rounded-lg bg-black/55 px-3 py-1.5 text-sm">
              <strong>{partner.username}</strong>
              <span className="text-white/70"> · {partner.university}</span>
              {!partnerMic && <span className="text-red-300"> · muted</span>}
            </div>
          )}
          {needsTap && phase === 'connected' && (
            <button
              onClick={() => remoteVideoRef.current?.play().then(() => setNeedsTap(false)).catch(() => {})}
              className="btn-primary absolute bottom-4 left-1/2 -translate-x-1/2"
            >
              Tap to hear audio
            </button>
          )}
        </section>

        {/* You */}
        <section className="relative mx-auto flex aspect-[4/3] w-1/2 items-center justify-center overflow-hidden rounded-2xl bg-ink-900 sm:w-2/3 lg:mx-0 lg:aspect-auto lg:w-auto lg:flex-1">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`mirror absolute inset-0 h-full w-full object-cover ${phase !== 'setup' && camOn ? 'opacity-100' : 'opacity-0'}`}
          />
          {phase === 'setup' && <p className="relative text-sm text-white/40">You</p>}
          {phase !== 'setup' && !camOn && <p className="relative text-sm text-white/50">Camera off</p>}
          {phase !== 'setup' && (
            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-2">
              <button
                onClick={toggleMic}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${micOn ? 'bg-black/55 hover:bg-black/75' : 'bg-red-500'}`}
              >
                {micOn ? 'Mic off' : 'Mic on'}
              </button>
              <button
                onClick={toggleCam}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${camOn ? 'bg-black/55 hover:bg-black/75' : 'bg-red-500'}`}
              >
                {camOn ? 'Cam off' : 'Cam on'}
              </button>
            </div>
          )}
        </section>
      </main>

      <footer className="px-4 pb-4 pt-4">
        {error && phase !== 'ended' && (
          <p role="alert" className="mx-auto mb-3 max-w-xl rounded-lg bg-red-500/15 px-4 py-2 text-center text-sm text-red-200">
            {error}
          </p>
        )}
        <div className="mx-auto flex max-w-xl flex-wrap items-center justify-center gap-2">
          {phase === 'setup' && (
            <button onClick={enableCamera} className="btn-primary px-10 py-4 text-lg">Turn on camera</button>
          )}
          {phase === 'ready' && (
            <button onClick={startSearch} className="btn-primary px-16 py-4 text-lg">Start</button>
          )}
          {phase === 'searching' && (
            <button onClick={disconnect} className="btn-dark px-10 py-4 text-lg">Stop</button>
          )}
          {(inCall || (phase === 'ended' && endReason !== 'restricted')) && (
            <>
              <button onClick={inCall ? next : startSearch} className="btn-primary px-14 py-4 text-lg">Next</button>
              <button onClick={disconnect} className="btn-dark px-8 py-4 text-lg">Stop</button>
            </>
          )}
        </div>
        {(inCall || (phase === 'ended' && canReport && endReason === 'left')) && (
          <div className="mt-2 flex justify-center gap-1">
            <button onClick={() => setReportOpen(true)} className={smallBtn}>Report</button>
            {inCall && <button onClick={() => setBlockOpen(true)} className={smallBtn}>Block</button>}
          </div>
        )}
        <p className="mx-auto mt-3 max-w-xl text-center text-[11px] text-white/35">
          We never record chats, but others could record their screen. Follow the{' '}
          <Link href="/guidelines" target="_blank" className="underline">rules</Link>.
        </p>
      </footer>

      {toast && (
        <div className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-ink-900 shadow-2xl">
          {toast}
        </div>
      )}

      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        matchId={lastMatchIdRef.current}
        partnerName={partner?.username ?? 'this student'}
        onDone={(blocked) => {
          setReportOpen(false);
          afterSafetyAction(blocked ? 'blocked' : 'reported');
        }}
      />
      <BlockDialog
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        matchId={lastMatchIdRef.current}
        partnerName={partner?.username ?? 'this student'}
        onDone={() => {
          setBlockOpen(false);
          afterSafetyAction('blocked');
        }}
      />
    </div>
  );
}
