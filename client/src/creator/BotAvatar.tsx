/**
 * Avatar del copiloto del Creador: un robot dibujado para EduCore, con el azul de la marca.
 * Es decorativo; `thinking` lo anima mientras la IA trabaja.
 */
export function BotAvatar({ thinking = false, className }: { thinking?: boolean; className?: string }) {
  return (
    <svg className={className ? `crt-bot ${className}` : "crt-bot"} data-thinking={thinking ? "" : undefined} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <rect className="crt-bot__tile" width="40" height="40" rx="13" />
      {/* Antena */}
      <path className="crt-bot__stem" d="M20 12.5V9" />
      <circle className="crt-bot__bulb" cx="20" cy="7.6" r="2.2" />
      {/* Orejas y cabeza */}
      <rect className="crt-bot__ear" x="5.6" y="18.5" width="3.2" height="7" rx="1.6" />
      <rect className="crt-bot__ear" x="31.2" y="18.5" width="3.2" height="7" rx="1.6" />
      <rect className="crt-bot__head" x="9" y="12.5" width="22" height="18.5" rx="7" />
      {/* Cara */}
      <g className="crt-bot__eyes">
        <rect x="14" y="18.4" width="3.6" height="5" rx="1.8" />
        <rect x="22.4" y="18.4" width="3.6" height="5" rx="1.8" />
      </g>
      <path className="crt-bot__smile" d="M17.2 26.1c1.7 1.2 3.9 1.2 5.6 0" />
    </svg>
  );
}
