import { GameEngine } from './engine';
import { CombinedLivePlatform, MockLivePlatform } from './platform';
import { TikTokLivePlatform } from './tiktok-platform';

/**
 * Inyección del adaptador de plataforma. Se usa SIEMPRE el combinado, que envuelve el
 * adaptador real de TikTok y la audiencia simulada. El toggle «Audiencia simulada» de
 * Estado y control (config `platformSimulation`) decide en caliente si convive el simulador:
 *  - OFF → solo el live real (comportamiento por defecto).
 *  - ON  → live real + audiencia simulada, ambos por el mismo pipeline del motor.
 */
export const platform = new CombinedLivePlatform(new TikTokLivePlatform(), new MockLivePlatform());

export const engine = new GameEngine(platform);
