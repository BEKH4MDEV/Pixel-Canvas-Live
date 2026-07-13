/** Utilidades de formato puras. */

/** Hora local `HH:MM:SS` para la consola de logs. */
export function clock(date: Date = new Date()): string {
  return date.toLocaleTimeString('es-ES', { hour12: false });
}

/** Trunca con elipsis. La clasificacion limita nombres a 20 caracteres. */
export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/** Antepone `@` a un nombre de espectador si no lo trae. */
export function withAt(username: string): string {
  return username.startsWith('@') ? username : `@${username}`;
}

/**
 * Texto de cuenta atras de auto-reinicio. Usa minutos solo si quedan mas de 60 s
 * (documento 05, §6).
 */
export function formatCountdownLong(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s > 60) {
    const minutes = Math.floor(s / 60);
    const seconds = s % 60;
    const mLabel = minutes === 1 ? 'minuto' : 'minutos';
    const sLabel = seconds === 1 ? 'segundo' : 'segundos';
    return `${minutes} ${mLabel} y ${seconds} ${sLabel}`;
  }
  return `${s} ${s === 1 ? 'segundo' : 'segundos'}`;
}

/** Mayúscula inicial. */
export function capitalize(value: string): string {
  return value.length ? value[0]!.toUpperCase() + value.slice(1) : value;
}
