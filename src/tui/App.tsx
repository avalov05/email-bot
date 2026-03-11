import React, { useState, useEffect } from 'react'
import { Box, Text, useApp } from 'ink'
import { gradient, c, kbd } from './theme.js'
import { useInterval } from './hooks/useInterval.js'
import { Splash }          from './screens/Splash.js'
import { Dashboard }       from './screens/Dashboard.js'
import { Campaigns }       from './screens/Campaigns.js'
import { CampaignDetail }  from './screens/CampaignDetail.js'
import { NewCampaign }     from './screens/NewCampaign.js'
import { ImportContacts }  from './screens/ImportContacts.js'
import { ConnectAccount }  from './screens/ConnectAccount.js'
import { Settings }        from './screens/Settings.js'
import { Suppression }     from './screens/Suppression.js'
import { AuditLog }        from './screens/AuditLog.js'
import { Help }            from './screens/Help.js'
import { runMigrations }   from '../lib/db/migrate.js'
import { db } from '../lib/db/client.js'
import { accounts } from '../lib/db/schema.js'
import { getQueueState } from '../lib/queue/engine.js'

type Screen =
  | 'splash' | 'dashboard' | 'campaigns' | 'campaign'
  | 'new-campaign' | 'import' | 'connect' | 'settings'
  | 'suppression' | 'logs' | 'help'

interface NavState { screen: Screen; data?: unknown }

const HEADER = [
  '  ╔═╗╦ ╦╔╦╗╦═╗╔═╗╔═╗╔═╗╦ ╦  ╔═╗╔═╗╔╗╔╔═╗╔═╗╦  ╔═╗',
  '  ║ ║║ ║ ║ ╠╦╝║╣ ╠═╣║  ╠═╣  ║  ║ ║║║║╚═╗║ ║║  ║╣ ',
  '  ╚═╝╚═╝ ╩ ╩╚═╚═╝╩ ╩╚═╝╩ ╩  ╚═╝╚═╝╝╚╝╚═╝╚═╝╩═╝╚═╝',
]

const SCREEN_TITLES: Record<Screen, string> = {
  splash: '', dashboard: 'Dashboard', campaigns: 'Campaigns',
  campaign: 'Campaign', 'new-campaign': 'New Campaign',
  import: 'Import Contacts', connect: 'Accounts',
  settings: 'Settings', suppression: 'Suppression', logs: 'Audit Log', help: 'Help',
}

const NAV_TABS: Array<{ screen: Screen; label: string; key: string }> = [
  { screen: 'dashboard',   label: 'Dashboard',   key: '1' },
  { screen: 'connect',     label: 'Accounts',    key: '2' },
  { screen: 'suppression', label: 'Suppression', key: '3' },
  { screen: 'logs',        label: 'Log',         key: '4' },
  { screen: 'settings',    label: 'Settings',    key: '5' },
]

export function App() {
  const [nav, setNav] = useState<NavState>({ screen: 'splash' })
  const [ready, setReady] = useState(false)
  const [account, setAccount] = useState<{ email: string; provider: string } | null>(null)
  const [queueIndicator, setQueueIndicator] = useState('')
  const [dotFrame, setDotFrame] = useState(0)
  const [statusTick, setStatusTick] = useState(0)

  useEffect(() => {
    runMigrations().then(() => setReady(true)).catch(console.error)
  }, [])

  // Poll account + queue status every 3s — async work in useEffect, not in the interval callback
  useInterval(() => setStatusTick(t => t + 1), 3000)
  useEffect(() => {
    db.select({ email: accounts.email, provider: accounts.provider }).from(accounts).limit(1)
      .then(r => r[0] || null)
      .then(acc => {
        setAccount(acc)
        const qs = getQueueState()
        setQueueIndicator(qs.status === 'running' ? '◉ running' : qs.status === 'paused' ? '◐ paused' : '')
      })
      .catch(() => {}) // ignore polling errors silently
  }, [statusTick])

  useInterval(() => setDotFrame(f => (f + 1) % 4), 500)

  function navigate(screen: string, data?: unknown) {
    setNav({ screen: screen as Screen, data })
  }

  if (!ready || nav.screen === 'splash') {
    return <Splash onDone={() => { if (ready) setNav({ screen: 'dashboard' }) }} />
  }

  const isHidden = (s: Screen) => ['splash','new-campaign','import'].includes(s)
  const showNav  = !isHidden(nav.screen)

  return (
    <Box flexDirection="column" minHeight={40}>
      {/* Compact header */}
      <Box justifyContent="space-between" alignItems="center" paddingX={2} paddingY={0}
        borderStyle="single" borderBottom borderTop={false} borderLeft={false} borderRight={false}
        borderColor="#27272A">
        <Text>{gradient('OUTREACH CONSOLE', ['#8B5CF6','#6366F1','#38BDF8'])}</Text>
        <Box gap={3}>
          {queueIndicator && <Text>{c.success(queueIndicator)}</Text>}
          {account
            ? <Text>{c.muted('◉')} {c.dim(account.provider === 'gmail' ? 'G' : 'M')} {c.muted(account.email)}</Text>
            : <Text>{c.muted('◌ no account')}</Text>}
          <Text>{c.muted(SCREEN_TITLES[nav.screen] || '')}</Text>
        </Box>
      </Box>

      {/* Nav tabs */}
      {showNav && !['campaign','campaigns'].includes(nav.screen) && (
        <Box gap={0} borderStyle="single" borderBottom borderTop={false} borderLeft={false} borderRight={false} borderColor="#1C1C1E" paddingX={1}>
          {NAV_TABS.map(t => {
            const active = nav.screen === t.screen
            return (
              <Box key={t.screen} paddingX={2} paddingY={0}
                borderStyle={active ? 'single' : undefined}
                borderBottom={active} borderTop={false} borderLeft={false} borderRight={false}
                borderColor={active ? '#8B5CF6' : undefined}>
                <Text bold={active} color={active ? '#A855F7' : '#52525B'}>{t.key} {t.label}</Text>
              </Box>
            )
          })}
          <Box paddingX={2}><Text color="#3F3F46">? Help</Text></Box>
        </Box>
      )}

      {/* Content area */}
      <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1}>
        {nav.screen === 'dashboard'   && <Dashboard       onNavigate={navigate} />}
        {nav.screen === 'campaigns'   && <Campaigns        onNavigate={navigate} />}
        {nav.screen === 'campaign'    && typeof nav.data === 'string' && <CampaignDetail campaignId={nav.data} onNavigate={navigate} />}
        {nav.screen === 'new-campaign'&& <NewCampaign      onNavigate={navigate} />}
        {nav.screen === 'import'      && typeof nav.data === 'string' && <ImportContacts campaignId={nav.data} onNavigate={navigate} />}
        {nav.screen === 'connect'     && <ConnectAccount   onNavigate={navigate} />}
        {nav.screen === 'settings'    && <Settings         campaignId={typeof nav.data === 'string' ? nav.data : undefined} onNavigate={navigate} />}
        {nav.screen === 'suppression' && <Suppression      onNavigate={navigate} />}
        {nav.screen === 'logs'        && <AuditLog         onNavigate={navigate} />}
        {nav.screen === 'help'        && <Help             onNavigate={navigate} />}
      </Box>
    </Box>
  )
}
