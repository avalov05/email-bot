import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { c, gradient, kbd } from '../theme.js'
import { Spinner } from '../components/Spinner.js'
import { StatusBar } from '../components/StatusBar.js'
import { useInterval } from '../hooks/useInterval.js'
import { db } from '../../lib/db/client.js'
import { accounts } from '../../lib/db/schema.js'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { audit } from '../../lib/audit.js'
import http from 'http'
import { URL } from 'url'
import open from 'open'

interface Props { onNavigate: (screen: string, data?: unknown) => void }

type Step = 'choose' | 'waiting' | 'success' | 'list'
type PendingAction =
  | { kind: 'oauth'; provider: 'gmail' | 'microsoft' }
  | { kind: 'disconnect'; id: string }
  | { kind: 'reload' }
  | null

export function ConnectAccount({ onNavigate }: Props) {
  const [step, setStep] = useState<Step>('list')
  const [selected, setSelected] = useState(0)
  const [accs, setAccs] = useState<typeof accounts.$inferSelect[]>([])
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')
  const [pendingProvider, setPendingProvider] = useState<'gmail' | 'microsoft' | null>(null)
  const [waitDots, setWaitDots] = useState(0)
  const [pendingAction, setPendingAction] = useState<PendingAction>({ kind: 'reload' })

  useInterval(() => setWaitDots(d => (d + 1) % 4), step === 'waiting' ? 400 : null)

  // All async work runs here — never inside useInput
  useEffect(() => {
    if (!pendingAction) return
    const action = pendingAction
    setPendingAction(null)

    if (action.kind === 'reload') {
      db.select().from(accounts).orderBy(accounts.createdAt)
        .then(rows => setAccs(rows))
        .catch(e => setError(e instanceof Error ? e.message : String(e)))
    } else if (action.kind === 'disconnect') {
      db.delete(accounts).where(eq(accounts.id, action.id))
        .then(() => audit('account.disconnected', { entityType: 'account', entityId: action.id }))
        .then(() => db.select().from(accounts).orderBy(accounts.createdAt))
        .then(rows => { setAccs(rows); setMsg('Disconnected') })
        .catch(e => setError(e instanceof Error ? e.message : String(e)))
    } else if (action.kind === 'oauth') {
      startOAuth(action.provider)
    }
  }, [pendingAction])

  // useInput is purely synchronous — only sets state flags
  useInput((input, key) => {
    if (step === 'list') {
      if (key.upArrow)   setSelected(s => Math.max(0, s - 1))
      if (key.downArrow) setSelected(s => Math.min(accs.length, s + 1))
      if (key.return) {
        if (selected === accs.length) { setStep('choose'); setSelected(0); return }
        const acc = accs[selected]
        if (acc) setPendingAction({ kind: 'disconnect', id: acc.id })
      }
      if (input === 'a') { setStep('choose'); setSelected(0); return }
      if (input === '1') { onNavigate('dashboard'); return }
      if (input === '3') { onNavigate('suppression'); return }
      if (input === '4') { onNavigate('logs'); return }
      if (input === '5') { onNavigate('settings'); return }
      if (key.escape) { onNavigate('dashboard'); return }
    }
    if (step === 'choose') {
      if (key.upArrow)   setSelected(s => Math.max(0, s - 1))
      if (key.downArrow) setSelected(s => Math.min(1, s + 1))
      if (key.return)    setPendingAction({ kind: 'oauth', provider: selected === 0 ? 'gmail' : 'microsoft' })
      if (key.escape)    { setStep('list'); setPendingAction({ kind: 'reload' }) }
    }
    if (step === 'success') {
      setStep('list')
      setPendingAction({ kind: 'reload' })
    }
  })

  async function startOAuth(provider: 'gmail' | 'microsoft') {
    const hasEnv = provider === 'gmail'
      ? (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
      : (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET)

    if (!hasEnv) {
      setError(`${provider === 'gmail' ? 'GOOGLE' : 'MICROSOFT'}_CLIENT_ID / CLIENT_SECRET not set in .env  See README for setup.`)
      return
    }

    setPendingProvider(provider); setStep('waiting'); setError('')

    const CALLBACK_PORT = 3847
    const redirectUri = `http://localhost:${CALLBACK_PORT}/oauth/callback`

    try {
      if (provider === 'gmail') {
        // Lazy import — avoids blocking module init (googleapis is very heavy)
        const { google } = await import('googleapis')
        const oauth2 = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          redirectUri
        )
        const url = oauth2.generateAuthUrl({
          access_type: 'offline', prompt: 'consent',
          scope: ['https://www.googleapis.com/auth/gmail.compose','https://www.googleapis.com/auth/gmail.send','https://www.googleapis.com/auth/userinfo.email','https://www.googleapis.com/auth/userinfo.profile'],
        })
        await open(url)
        const code = await waitForCallback(CALLBACK_PORT)
        const { tokens } = await oauth2.getToken(code)
        oauth2.setCredentials(tokens)
        const oauth2info = google.oauth2({ version: 'v2', auth: oauth2 })
        const { data: profile } = await oauth2info.userinfo.get()
        const now = Date.now(); const id = uuidv4()
        await db.insert(accounts).values({
          id, provider: 'gmail', email: profile.email!, displayName: profile.name || profile.email!,
          accessToken: tokens.access_token!, refreshToken: tokens.refresh_token || null,
          expiresAt: tokens.expiry_date || null, scope: tokens.scope || null,
          createdAt: now, updatedAt: now,
        }).onConflictDoNothing()
        await audit('account.connected', { entityType: 'account', entityId: id, details: { provider: 'gmail', email: profile.email } })
      } else {
        const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
        authUrl.searchParams.set('client_id', process.env.MICROSOFT_CLIENT_ID!)
        authUrl.searchParams.set('response_type', 'code')
        authUrl.searchParams.set('redirect_uri', redirectUri)
        authUrl.searchParams.set('scope', 'Mail.ReadWrite Mail.Send offline_access User.Read')
        authUrl.searchParams.set('response_mode', 'query')
        await open(authUrl.toString())
        const code = await waitForCallback(CALLBACK_PORT)
        const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
          method: 'POST',
          body: new URLSearchParams({ client_id: process.env.MICROSOFT_CLIENT_ID!, client_secret: process.env.MICROSOFT_CLIENT_SECRET!, code, redirect_uri: redirectUri, grant_type: 'authorization_code', scope: 'Mail.ReadWrite Mail.Send offline_access User.Read' }),
        })
        const tkns = await tokenRes.json() as Record<string, string & number>
        const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', { headers: { Authorization: `Bearer ${tkns.access_token}` } })
        const profile = await profileRes.json() as Record<string, string>
        const now = Date.now(); const id = uuidv4()
        await db.insert(accounts).values({
          id, provider: 'microsoft', email: profile.mail || profile.userPrincipalName,
          displayName: profile.displayName || profile.mail,
          accessToken: tkns.access_token, refreshToken: tkns.refresh_token || null,
          expiresAt: now + tkns.expires_in * 1000, scope: tkns.scope || null,
          createdAt: now, updatedAt: now,
        }).onConflictDoNothing()
        await audit('account.connected', { entityType: 'account', entityId: id })
      }
      setPendingAction({ kind: 'reload' })
      setStep('success')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStep('choose')
    }
  }

  function waitForCallback(port: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        if (!req.url) return
        const url = new URL(req.url, `http://localhost:${port}`)
        const code = url.searchParams.get('code')
        const err  = url.searchParams.get('error')
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<html><body style="font-family:sans-serif;background:#09090b;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh"><h2>✓ Authenticated! You can close this tab.</h2></body></html>')
        server.close()
        if (err) reject(new Error(err))
        else if (code) resolve(code)
        else reject(new Error('No code received'))
      })
      server.listen(port, () => {})
      setTimeout(() => { server.close(); reject(new Error('OAuth timeout (2 min)')) }, 120000)
    })
  }

  const providers = [
    { icon: 'G', label: 'Gmail / Google Workspace', desc: 'Connect via Google OAuth 2.0  (gmail.com, @yourcompany.com via Google)', color: '#38BDF8' },
    { icon: 'M', label: 'Microsoft 365 / Outlook', desc: 'Connect via Microsoft OAuth 2.0  (outlook.com, hotmail.com, duke.edu, any work/school .edu)', color: '#8B5CF6' },
  ]

  return (
    <Box flexDirection="column" gap={2}>
      <Text>{gradient('  CONNECTED ACCOUNTS', ['#8B5CF6','#38BDF8'])}</Text>

      {error && (
        <Box borderStyle="round" borderColor="#EF4444" paddingX={2} paddingY={1}>
          <Text>{c.danger('✗ ' + error)}</Text>
        </Box>
      )}
      {msg && <Text>{c.success('✓ ' + msg)}</Text>}

      {step === 'list' && (
        <Box flexDirection="column" gap={1}>
          {accs.map((acc, i) => (
            <Box key={acc.id} borderStyle="round" borderColor={i === selected ? '#EF4444' : '#27272A'} paddingX={2} paddingY={0} flexDirection="column">
              <Box gap={2}>
                <Text>{i === selected ? c.danger('▶') : ' '}</Text>
                <Text bold={i === selected}>{acc.provider === 'gmail' ? c.info('G') : c.violet('M')} {acc.displayName || acc.email}</Text>
              </Box>
              <Box paddingLeft={4}><Text>{c.muted(acc.email)}</Text>{i === selected && <Text>{c.muted(' — press Enter to disconnect')}</Text>}</Box>
            </Box>
          ))}
          <Box borderStyle="round" borderColor={selected === accs.length ? '#22C55E' : '#27272A'} paddingX={2} paddingY={0}>
            <Text>{selected === accs.length ? c.success('▶') : ' '} {c.success('+')} {c.muted('Connect new account')}</Text>
          </Box>
          <StatusBar hints={[{ key: '↑↓', label: 'select' }, { key: 'Enter', label: 'action' }, { key: 'a', label: 'add' }, { key: 'Esc', label: 'back' }]} />
        </Box>
      )}

      {step === 'choose' && (
        <Box flexDirection="column" gap={1}>
          <Text>{c.muted('Choose your email provider:')}</Text>
          {providers.map((p, i) => (
            <Box key={p.label} borderStyle="round" borderColor={i === selected ? '#8B5CF6' : '#27272A'} paddingX={3} paddingY={1} flexDirection="column">
              <Box gap={2}>
                <Text>{i === selected ? c.violet('▶') : ' '}</Text>
                <Text bold={i === selected} color={i === selected ? '#A855F7' : undefined}>{c.bright(p.icon)}  {p.label}</Text>
              </Box>
              <Box paddingLeft={4}><Text color="#52525B">{p.desc}</Text></Box>
            </Box>
          ))}
          <Text>{c.muted('This will open your browser for OAuth login. No passwords are stored.')}</Text>
          <StatusBar hints={[{ key: '↑↓', label: 'select' }, { key: 'Enter', label: 'connect' }, { key: 'Esc', label: 'back' }]} />
        </Box>
      )}

      {step === 'waiting' && (
        <Box flexDirection="column" gap={2}>
          <Box gap={2}><Spinner color="#8B5CF6" /><Text>{c.violet('Browser opened for OAuth login')} {'.'.repeat(waitDots + 1)}</Text></Box>
          <Box borderStyle="round" borderColor="#27272A" paddingX={3} paddingY={1} flexDirection="column" gap={0}>
            <Text>{c.muted('1. Your browser should have opened automatically')}</Text>
            <Text>{c.muted('2. Sign in to your ')} {c.bright(pendingProvider === 'gmail' ? 'Google' : 'Microsoft')} {c.muted(' account')}</Text>
            <Text>{c.muted('3. Grant the requested permissions')}</Text>
            <Text>{c.muted('4. Come back here — this screen will update automatically')}</Text>
          </Box>
          <Text>{c.dim('Waiting for callback on port 3847… (timeout: 2 min)')}</Text>
        </Box>
      )}

      {step === 'success' && (
        <Box flexDirection="column" gap={1}>
          <Box borderStyle="round" borderColor="#22C55E" paddingX={3} paddingY={1}>
            <Text bold color="#22C55E">✓ Account connected successfully!</Text>
          </Box>
          <Text>{c.muted('Press any key to continue…')}</Text>
        </Box>
      )}
    </Box>
  )
}
