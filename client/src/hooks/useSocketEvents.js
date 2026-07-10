import { useEffect } from 'react';
import { connectSocket, getSocket } from '@/lib/socket';

/**
 * Subscribe to a map of socket events for the lifetime of a component.
 * `handlers` = { 'order:new': fn, 'order:updated': fn, ... }
 */
export function useSocketEvents(handlers) {
  useEffect(() => {
    const socket = getSocket() || connectSocket();
    const entries = Object.entries(handlers);
    entries.forEach(([event, fn]) => socket.on(event, fn));
    return () => entries.forEach(([event, fn]) => socket.off(event, fn));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Short beep via Web Audio (no asset needed) for new-order alerts. */
export function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine'; osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(); osc.stop(ctx.currentTime + 0.4);
  } catch { /* ignore */ }
}
