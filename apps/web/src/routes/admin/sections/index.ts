import type { ComponentType } from 'react';
import type { IconType } from 'react-icons';
import {
  FiActivity,
  FiBarChart2,
  FiDroplet,
  FiGift,
  FiGrid,
  FiLayers,
  FiLink,
  FiLock,
  FiTerminal,
  FiTool,
  FiVolume2,
  FiZap,
} from 'react-icons/fi';
import { StateControlSection } from './StateControlSection';
import { CanvasSection } from './CanvasSection';
import { ConnectionSection } from './ConnectionSection';
import { CommandsSection } from './CommandsSection';
import { ColorsSection } from './ColorsSection';
import { GiftsCatalogSection } from './GiftsCatalogSection';
import { GiftActionsSection } from './GiftActionsSection';
import { FiguresSection } from './FiguresSection';
import { SoundsSection } from './SoundsSection';
import { ToolsSection } from './ToolsSection';
import { StatsSection } from './StatsSection';
import { SecuritySection } from './SecuritySection';

export type SectionId =
  | 'estado'
  | 'herramientas'
  | 'estadisticas'
  | 'lienzo'
  | 'conexion'
  | 'comandos'
  | 'colores'
  | 'figuras'
  | 'regalos'
  | 'efectos'
  | 'sonidos'
  | 'seguridad';

export interface SectionDef {
  id: SectionId;
  label: string;
  group: string;
  icon: IconType;
  Component: ComponentType;
}

export const SECTIONS: SectionDef[] = [
  { id: 'estado', label: 'Estado y control', group: 'Partida', icon: FiActivity, Component: StateControlSection },
  { id: 'herramientas', label: 'Herramientas', group: 'Partida', icon: FiTool, Component: ToolsSection },
  { id: 'estadisticas', label: 'Estadísticas', group: 'Partida', icon: FiBarChart2, Component: StatsSection },
  { id: 'lienzo', label: 'Lienzo', group: 'Configuración', icon: FiGrid, Component: CanvasSection },
  { id: 'conexion', label: 'Conexión', group: 'Configuración', icon: FiLink, Component: ConnectionSection },
  { id: 'comandos', label: 'Comandos', group: 'Contenido', icon: FiTerminal, Component: CommandsSection },
  { id: 'colores', label: 'Colores', group: 'Contenido', icon: FiDroplet, Component: ColorsSection },
  { id: 'figuras', label: 'Figuras', group: 'Contenido', icon: FiLayers, Component: FiguresSection },
  { id: 'regalos', label: 'Catálogo de regalos', group: 'Contenido', icon: FiGift, Component: GiftsCatalogSection },
  { id: 'efectos', label: 'Efectos de regalos', group: 'Contenido', icon: FiZap, Component: GiftActionsSection },
  { id: 'sonidos', label: 'Sonidos', group: 'Contenido', icon: FiVolume2, Component: SoundsSection },
  { id: 'seguridad', label: 'Seguridad', group: 'Sistema', icon: FiLock, Component: SecuritySection },
];
