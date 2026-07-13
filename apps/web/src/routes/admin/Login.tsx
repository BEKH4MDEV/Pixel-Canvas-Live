import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { api } from '@/data/api';
import { queryKeys } from '@/data/query-keys';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

type Visual = 'idle' | 'error' | 'success';

export function Login() {
  const qc = useQueryClient();
  const [digits, setDigits] = useState(['', '', '', '']);
  const [visual, setVisual] = useState<Visual>('idle');
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [permanent, setPermanent] = useState(false);
  const [now, setNow] = useState(Date.now());
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (!lockedUntil) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const lockRemaining = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - now) / 1000)) : 0;
  const isLocked = permanent || lockRemaining > 0;
  const pin = digits.join('');

  const login = useMutation({
    mutationFn: () => api.login(pin),
    onSuccess: (session) => {
      if (session.authenticated) {
        setVisual('success');
        setTimeout(() => qc.invalidateQueries({ queryKey: queryKeys.session }), 300);
        return;
      }
      if (session.permanentlyLocked) {
        setPermanent(true);
      } else if (session.locked && session.lockedUntil) {
        setLockedUntil(Date.parse(session.lockedUntil));
      }
      setVisual('error');
      setDigits(['', '', '', '']);
      refs.current[0]?.focus();
      setTimeout(() => setVisual('idle'), 600);
    },
  });

  const setDigit = (i: number, value: string): void => {
    const v = value.replace(/\D/g, '').slice(-1);
    setDigits((d) => {
      const next = [...d];
      next[i] = v;
      return next;
    });
    if (v && i < 3) refs.current[i + 1]?.focus();
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'Enter' && pin.length === 4) login.mutate();
  };

  const onPaste = (e: React.ClipboardEvent): void => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!text) return;
    e.preventDefault();
    const next = ['', '', '', ''];
    for (let i = 0; i < text.length; i++) next[i] = text[i]!;
    setDigits(next);
    refs.current[Math.min(text.length, 3)]?.focus();
  };

  const lockLabel = useMemo(() => {
    if (permanent) return 'Acceso bloqueado';
    if (lockRemaining > 0) {
      const m = Math.floor(lockRemaining / 60);
      const s = lockRemaining % 60;
      return `Acceso bloqueado. Inténtalo en ${m > 0 ? `${m}m ` : ''}${s}s`;
    }
    return null;
  }, [permanent, lockRemaining]);

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-canvas px-4">
      <div className="bg-pixel-grid bg-pixel-grid-fade absolute inset-0 opacity-50" />
      <motion.div
        animate={visual === 'error' ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-sm"
      >
        <div className="mb-8 flex flex-col items-center gap-5 text-center">
          <Logo />
          <div>
            <h1 className="font-display text-2xl font-semibold text-fg">Panel de control</h1>
            <p className="mt-1 text-sm text-fg-subtle">Introduce tu PIN para continuar</p>
          </div>
        </div>

        <div className="flex justify-center gap-3" onPaste={onPaste}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={digit}
              disabled={isLocked || login.isPending || visual === 'success'}
              inputMode="numeric"
              maxLength={1}
              aria-label={`Dígito ${i + 1}`}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              className={cn(
                'h-16 w-14 rounded-[var(--radius-md)] border bg-input text-center font-mono text-2xl text-fg',
                'transition-[border-color,box-shadow] focus:outline-none focus:ring-2 focus:ring-brand/30',
                visual === 'error' ? 'border-danger' : 'border-border-strong focus:border-border-focus',
                visual === 'success' && 'border-success ring-2 ring-success/30',
              )}
            />
          ))}
        </div>

        <div className="mt-4 h-5 text-center text-sm">
          {lockLabel ? (
            <span className="text-danger">{lockLabel}</span>
          ) : visual === 'error' ? (
            <span className="text-danger">PIN incorrecto</span>
          ) : null}
        </div>

        <Button
          block
          size="lg"
          className="mt-2"
          disabled={pin.length !== 4 || isLocked}
          loading={login.isPending}
          onClick={() => login.mutate()}
        >
          Entrar
        </Button>
      </motion.div>
    </div>
  );
}
