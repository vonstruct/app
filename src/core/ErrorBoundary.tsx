import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Foutopvang (7 nov 2026, doorlichting): een onverwacht antwoord of een fout in één pagina laat niet meer de hele app
 * verdwijnen (wit scherm). De pagina toont een melding met "Opnieuw proberen"; het menu blijft bruikbaar.
 * Gebruik met een `key` die verandert bij een andere pagina (Layout: het pad), zodat de fout verdwijnt als je verder klikt.
 */
type Props = { children: ReactNode; title?: string }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Fout in pagina', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="panel error-boundary" role="alert">
        <h2>{this.props.title ?? 'Deze pagina kon niet getoond worden'}</h2>
        <p className="muted">Er ging iets mis bij het tonen van deze gegevens. De rest van de app werkt nog.</p>
        <p className="small muted">{String(this.state.error.message || this.state.error).slice(0, 300)}</p>
        <div className="toolbar">
          <button className="primary" onClick={() => this.setState({ error: null })}>Opnieuw proberen</button>
          <button onClick={() => window.location.reload()}>Pagina herladen</button>
        </div>
      </div>
    )
  }
}
