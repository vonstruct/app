import { useSearchParams } from 'react-router'
import { MailList } from '../../core/MailList'

/** Mails van info@vonstruct.com met de samenvatting van VON (gevuld door Edge Function mail-sync). */
export function Inbox() {
  const [params] = useSearchParams()
  return <MailList title="Mails" focus={params.get('focus')} limit={80} />
}
