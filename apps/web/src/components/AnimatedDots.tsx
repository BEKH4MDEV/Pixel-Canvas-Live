import { useEffect, useState } from 'react';

/** Puntos suspensivos animados, consistentes en toda la app. */
export function AnimatedDots() {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? '' : `${d}.`)), 400);
    return () => clearInterval(id);
  }, []);
  return <span className="inline-block w-[1.1ch] text-left">{dots}</span>;
}
