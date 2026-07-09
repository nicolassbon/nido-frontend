export interface CompanionInfo {
  name: string;
  desc: string;
}

export const COMPANION_METADATA: Record<number, CompanionInfo> = {
  0: {
    name: 'Compañero Bloqueado',
    desc: 'Completá tu primera tarea para desbloquear a tu compañero y empezar a evolucionarlo.',
  },
  1: {
    name: 'Pichón',
    desc: 'Recién salido del cascarón. Está dando sus primeros pasos en la organización del hogar.',
  },
  2: {
    name: 'Aprendiz',
    desc: '¡Ya sabe usar la escoba! Ayuda con las tareas básicas y tiene muchísima energía.',
  },
  3: {
    name: 'Ayudante',
    desc: 'Un miembro valioso del hogar. Mantiene el orden y la cocina súper limpia.',
  },
  4: {
    name: 'Guardián',
    desc: 'Protector de la alacena y experto en finanzas hogareñas. ¡Nada se le escapa!',
  },
  5: {
    name: 'Maestro',
    desc: 'Leyenda del orden y la convivencia. Ha dominado el arte de mantener un hogar feliz y reluciente.',
  },
};

export function getCompanionInfo(level: number): CompanionInfo {
  const lvl = Math.min(5, Math.max(0, level));
  return COMPANION_METADATA[lvl];
}
