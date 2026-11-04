import { Link } from 'react-router'

/** Link naar een sectie van de Rekenregels ("Rekenregels → Capaciteit"), opent meteen die tab (`/regels?sectie=`). */
export function RuleLink({ s }: { s: string }) {
  return <Link to={`/regels?sectie=${encodeURIComponent(s)}`}>Rekenregels → {s}</Link>
}
