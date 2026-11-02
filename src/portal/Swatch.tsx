/** Kleine illustraties voor de keuzetegels (materiaal en fronttype). Geen externe beelden. */
export function Swatch({ id }: { id: string }) {
  const s = { width: '100%', height: '100%', display: 'block' } as const
  switch (id) {
    case 'uni':
      return <svg viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice" style={s}><rect width="40" height="80" fill="#e9e6df" /><rect x="40" width="40" height="80" fill="#2f3b45" /><rect x="80" width="40" height="80" fill="#9aa891" /></svg>
    case 'woodlook':
      return <svg viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice" style={s}><rect width="120" height="80" fill="#c9a77c" />{[8, 20, 31, 45, 58, 70].map((y, i) => <path key={i} d={`M0 ${y} C30 ${y - 4} 60 ${y + 5} 120 ${y - 2}`} stroke="#a9855a" strokeWidth="1.4" fill="none" />)}</svg>
    case 'veneer':
      return <svg viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice" style={s}><rect width="120" height="80" fill="#8a5a36" />{[6, 14, 23, 33, 44, 52, 63, 72].map((y, i) => <path key={i} d={`M0 ${y} C25 ${y + 6} 50 ${y - 6} 80 ${y + 3} S110 ${y - 3} 120 ${y}`} stroke="#6d4325" strokeWidth={i % 2 ? 0.8 : 1.6} fill="none" />)}<ellipse cx="78" cy="38" rx="9" ry="4" fill="none" stroke="#5c381e" strokeWidth="1.2" /></svg>
    case 'lacquer':
      return <svg viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice" style={s}><defs><linearGradient id="lq" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5d6b62" /><stop offset="1" stopColor="#3e4a43" /></linearGradient></defs><rect width="120" height="80" fill="url(#lq)" /><rect x="10" y="8" width="44" height="64" rx="2" fill="none" stroke="rgba(255,255,255,.15)" /></svg>
    case 'textile':
      return <svg viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice" style={s}><rect width="120" height="80" fill="#d8cfc0" />{Array.from({ length: 30 }, (_, i) => <line key={'h' + i} x1="0" y1={i * 2.7} x2="120" y2={i * 2.7} stroke="#c4b8a5" strokeWidth=".7" />)}{Array.from({ length: 45 }, (_, i) => <line key={'v' + i} x1={i * 2.7} y1="0" x2={i * 2.7} y2="80" stroke="#cbbfad" strokeWidth=".5" />)}</svg>
    case 'metal':
      return <svg viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice" style={s}><defs><linearGradient id="mt" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#b9bec3" /><stop offset=".5" stopColor="#e6e9ec" /><stop offset="1" stopColor="#a7adb3" /></linearGradient></defs><rect width="120" height="80" fill="url(#mt)" />{Array.from({ length: 20 }, (_, i) => <line key={i} x1="0" y1={i * 4 + 1} x2="120" y2={i * 4 + 1} stroke="rgba(255,255,255,.35)" strokeWidth=".5" />)}</svg>
    case 'mix':
      return <svg viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice" style={s}><rect width="120" height="40" fill="#b88b5e" />{[10, 22, 32].map((y, i) => <path key={i} d={`M0 ${y} C40 ${y - 3} 80 ${y + 4} 120 ${y}`} stroke="#9a6f45" strokeWidth="1.2" fill="none" />)}<rect y="40" width="120" height="40" fill="#2f3b45" /></svg>
    case 'handle':
      return <svg viewBox="0 0 120 80" preserveAspectRatio="xMidYMid meet" style={s}><rect width="120" height="80" fill="#ecebe6" /><rect x="14" y="10" width="44" height="60" fill="#fff" stroke="#cfcac0" /><rect x="62" y="10" width="44" height="60" fill="#fff" stroke="#cfcac0" /><rect x="50" y="30" width="3" height="20" rx="1.5" fill="#2b2b2b" /><rect x="67" y="30" width="3" height="20" rx="1.5" fill="#2b2b2b" /></svg>
    case 'profile':
      return <svg viewBox="0 0 120 80" preserveAspectRatio="xMidYMid meet" style={s}><rect width="120" height="80" fill="#ecebe6" /><rect x="14" y="16" width="44" height="54" fill="#fff" stroke="#cfcac0" /><rect x="62" y="16" width="44" height="54" fill="#fff" stroke="#cfcac0" /><rect x="14" y="10" width="92" height="5" fill="#8b8f93" /></svg>
    case 'push':
      return <svg viewBox="0 0 120 80" preserveAspectRatio="xMidYMid meet" style={s}><rect width="120" height="80" fill="#ecebe6" /><rect x="14" y="10" width="44" height="60" fill="#fff" stroke="#cfcac0" /><rect x="66" y="10" width="44" height="60" fill="#fff" stroke="#cfcac0" transform="rotate(-6 66 40)" /><circle cx="40" cy="40" r="6" fill="none" stroke="#c9a24a" strokeWidth="1.5" /><circle cx="40" cy="40" r="2" fill="#c9a24a" /></svg>
    default:
      return <svg viewBox="0 0 120 80" preserveAspectRatio="xMidYMid meet" style={s}><rect width="120" height="80" fill="#ecebe6" /><text x="60" y="50" textAnchor="middle" fontSize="30" fill="#9a958b">?</text></svg>
  }
}
