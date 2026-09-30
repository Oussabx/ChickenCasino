import { GameId, gameById } from '../lib/data';

/**
 * Game artwork rendered from the actual 3D scenes (see scripts/render-thumbs.mjs).
 * `wide` picks the 4:3 render; otherwise the square one is used.
 */
export default function GameArt({ id, className = '', wide = false }: { id: GameId; className?: string; wide?: boolean }) {
  const positioned = /\babsolute\b/.test(className);
  return (
    <div className={`overflow-hidden bg-ink-900 ${positioned ? '' : 'relative'} ${className}`}>
      <img
        src={`./img/games/${id}-${wide ? 'wide' : 'sq'}.webp`}
        alt={gameById(id)?.name ?? ''}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}
