import React, { useState } from 'react';
import {
  Mail,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  LogOut,
  Info,
  Key,
  Server
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { ConfirmDialog } from '../components/ConfirmDialog.js';
import { safeJson } from '../utils/apiIntercept.js';

export const ConnectedAccountsView: React.FC = () => {
  const {
    account,
    authStatus,
    isSyncing,
    triggerSync,
    refreshAll,
    showToast,
  } = useApp();

  const [copiedUri, setCopiedUri] = useState(false);
  const [isDisconnectDialogOpen, setIsDisconnectDialogOpen] = useState(false);
  const [deleteDataOnDisconnect, setDeleteDataOnDisconnect] = useState(false);

  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem('mailsentinel_server_url') || '');
  const [showServerSetup, setShowServerSetup] = useState(() => !localStorage.getItem('mailsentinel_server_url'));

  const saveServerUrl = () => {
    if (!serverUrl.trim()) {
      localStorage.removeItem('mailsentinel_server_url');
      showToast('Cleared custom server URL', 'info');
      setShowServerSetup(false);
      return;
    }
    const clean = serverUrl.trim().replace(/\/+$/, '');
    localStorage.setItem('mailsentinel_server_url', clean);
    showToast(`Server URL set to ${clean}`, 'success');
    setShowServerSetup(false);
    refreshAll();
  };

  // App Password Form state
  const [appEmail, setAppEmail] = useState('');
  const [appPassword, setAppPassword] = useState('dhrg boxf sycp fjgd');
  const [connectingImap, setConnectingImap] = useState(false);
  const [authMethod, setAuthMethod] = useState<'app_password' | 'oauth'>('app_password');

  const isConnected = Boolean(account);
  const redirectUri = authStatus?.redirectUri || 'http://localhost:3001/api/auth/google/callback';

  const handleConnectAppPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appEmail.trim()) {
      showToast('Please enter your Gmail address', 'error');
      return;
    }
    if (!appPassword.trim()) {
      showToast('Please enter your 16-letter App Password', 'error');
      return;
    }

    setConnectingImap(true);
    try {
      const res = await fetch('/api/auth/imap/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: appEmail.trim(),
          appPassword: appPassword.trim(),
        }),
      });

      const data = await safeJson(res);
      if (res.ok && data.success) {
        showToast(data.message, 'success');
        refreshAll();
      } else {
        showToast(data.error || 'Failed to connect. Please check your credentials.', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error connecting to Gmail', 'error');
    } finally {
      setConnectingImap(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUri(true);
    setTimeout(() => setCopiedUri(false), 2000);
    showToast('Redirect URI copied to clipboard!', 'info');
  };

  const handleConnectGmail = async () => {
    try {
      const res = await fetch('/api/auth/google/url');
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        showToast(data.error || 'Google OAuth is not configured in .env', 'error');
      }
    } catch (e: any) {
      showToast('Error initiating OAuth', 'error');
    }
  };

  const handleDisconnect = async () => {
    try {
      const res = await fetch('/api/auth/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteData: deleteDataOnDisconnect }),
      });
      if (res.ok) {
        showToast('Gmail account disconnected successfully', 'info');
        setIsDisconnectDialogOpen(false);
        refreshAll();
      }
    } catch (e: any) {
      showToast('Failed to disconnect account', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 tracking-tight">Connected Accounts</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Manage Gmail OAuth connections, synchronization cursors, and credential health
        </p>
      </div>

      {/* Account Status Card */}
      {isConnected ? (
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-lg space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sentinel-600 to-sky-400 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-sky-500/20">
                {account?.pictureUrl ? (
                  <img src={account.pictureUrl} alt="Avatar" className="w-full h-full rounded-2xl object-cover" />
                ) : (
                  account?.email?.charAt(0).toUpperCase() || 'G'
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-slate-100">{account?.email}</h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Verified</span>
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Google Gmail OAuth 2.0 Connection</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={triggerSync}
                disabled={isSyncing}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-sentinel-400' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
              </button>
              <button
                onClick={() => setIsDisconnectDialogOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/40 border border-red-800/60 text-red-200 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </button>
            </div>
          </div>

          {/* Sync Health & Cursor Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-500 block mb-1">Sync Checkpoint (historyId)</span>
              <span className="text-slate-200 font-mono font-medium">
                {account?.historyId || 'Initial reconciliation pending'}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-500 block mb-1">Last Successful Sync</span>
              <span className="text-slate-200 font-medium">
                {account?.lastSyncAt
                  ? new Date(account.lastSyncAt).toLocaleString()
                  : 'In progress'}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80">
              <span className="text-slate-500 block mb-1">Total Synced Messages</span>
              <span className="text-slate-200 font-mono font-medium">
                {account?.totalSyncedCount || 0} emails checked
              </span>
            </div>
          </div>

          {/* Scopes & Security notice */}
          <div className="p-4 rounded-2xl bg-sentinel-950/30 border border-sentinel-900/50 flex items-start gap-3 text-xs">
            <ShieldCheck className="w-5 h-5 text-sentinel-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-sentinel-300">Minimum Privilege Security</div>
              <p className="text-slate-400 leading-relaxed text-[11px]">
                MailSentinel only holds the <code className="text-sentinel-300 bg-slate-900 px-1 py-0.5 rounded">https://www.googleapis.com/auth/gmail.readonly</code> scope.
                It has zero ability to compose, send, delete, or modify emails. Tokens are encrypted using AES-256-GCM.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Not connected card with App Password option */
        <div className="p-6 md:p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-lg space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-slate-100">Connect Your Gmail Account</h3>
              <p className="text-xs text-slate-400 mt-1">
                Choose the easiest connection method for your personal account
              </p>
            </div>
            {/* Toggle method tabs */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setAuthMethod('app_password')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  authMethod === 'app_password'
                    ? 'bg-sentinel-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                16-Letter App Password (Fastest)
              </button>
              <button
                type="button"
                onClick={() => setAuthMethod('oauth')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  authMethod === 'oauth'
                    ? 'bg-sentinel-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Google Cloud OAuth
              </button>
            </div>
          </div>

          {authMethod === 'app_password' ? (
            /* App Password Form */
            <form onSubmit={handleConnectAppPassword} className="space-y-4 max-w-lg mx-auto text-left py-2">
              {showServerSetup && (
                <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-700/60 text-xs text-amber-200 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-300">
                    <Server className="w-4 h-4 text-amber-400" />
                    <span>Step 1: Set Backend Server URL</span>
                  </div>
                  <p className="text-[11px] text-amber-300/80">
                    If testing on Wi-Fi with your laptop: use <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-200">http://192.168.0.102:3001</code>.
                    For 24/7 laptop-off monitoring: enter your free Render URL.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={serverUrl}
                      onChange={(e) => setServerUrl(e.target.value)}
                      placeholder="e.g. http://192.168.0.102:3001"
                      className="flex-1 px-3 py-1.5 bg-slate-950 border border-amber-700/80 rounded-lg text-xs text-slate-100 font-mono"
                    />
                    <button
                      type="button"
                      onClick={saveServerUrl}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold whitespace-nowrap"
                    >
                      Save URL
                    </button>
                  </div>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-sentinel-950/40 border border-sentinel-800/60 text-xs text-sentinel-300 flex items-start gap-2.5">
                <Key className="w-4 h-4 text-sentinel-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Zero Google Cloud setup!</strong> Enter your Gmail and paste the 16-letter App Password you generated from{' '}
                  <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="underline font-semibold text-white">
                    myaccount.google.com/apppasswords
                  </a>.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Your Gmail Address</label>
                <input
                  type="email"
                  placeholder="e.g. yourname@gmail.com"
                  value={appEmail}
                  onChange={(e) => setAppEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-sentinel-500"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">16-Letter Google App Password</label>
                <input
                  type="text"
                  placeholder="e.g. dhrg boxf sycp fjgd"
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 font-mono tracking-wider focus:outline-none focus:border-sentinel-500"
                  required
                />
                <span className="text-[11px] text-slate-500 block">
                  Spaces are optional. Encrypted with AES-256-GCM.
                </span>
              </div>

              <button
                type="submit"
                disabled={connectingImap}
                className="w-full py-3 rounded-xl bg-sentinel-600 hover:bg-sentinel-500 text-white font-semibold text-sm transition shadow-lg shadow-sentinel-600/20 flex items-center justify-center gap-2"
              >
                {connectingImap ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying & Connecting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Connect Gmail Instantly</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            /* OAuth Section */
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Mail className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h4 className="text-base font-bold text-slate-100">Google Cloud OAuth</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Connect using Google's OAuth 2.0 flow with a configured Google Cloud project.
                </p>
              </div>

              <div className="pt-2">
                {authStatus?.oauthConfigured ? (
                  <button
                    onClick={handleConnectGmail}
                    className="px-6 py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm transition shadow-xl inline-flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>Connect with Google OAuth</span>
                  </button>
                ) : (
                  <div className="inline-block p-4 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-left max-w-lg">
                    <div className="flex items-center gap-2 text-amber-300 font-semibold text-xs mb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Google Cloud OAuth Credentials Not Yet Configured in .env</span>
                    </div>
                    <p className="text-xs text-amber-200/90 leading-relaxed mb-3">
                      Use the <strong>16-Letter App Password</strong> tab above to connect immediately without any Google Cloud Console setup.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step-by-Step Google Cloud Console Setup Instructions */}
      <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800/80 space-y-4">
        <div className="flex items-center gap-2 text-slate-200 font-bold text-sm">
          <Key className="w-4 h-4 text-sentinel-400" />
          <span>How to Get Free Google OAuth Credentials (5-Minute Guide)</span>
        </div>

        <ol className="list-decimal list-inside space-y-3 text-xs text-slate-300 leading-relaxed">
          <li className="pl-1">
            <strong>Open Google Cloud Console:</strong> Visit{' '}
            <a
              href="https://console.cloud.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sentinel-400 hover:underline inline-flex items-center gap-1"
            >
              console.cloud.google.com <ExternalLink className="w-3 h-3" />
            </a>{' '}
            and create a new project called <em>MailSentinel</em>.
          </li>
          <li className="pl-1">
            <strong>Enable the Gmail API:</strong> In the search bar, search for <em>Gmail API</em> and click <strong>Enable</strong>.
          </li>
          <li className="pl-1">
            <strong>Configure OAuth Consent Screen:</strong> Select <strong>External</strong> user type, fill in your email, and add the read-only scope:
            <code className="block my-1 p-2 rounded-lg bg-slate-950 text-sentinel-300 font-mono text-[11px]">
              https://www.googleapis.com/auth/gmail.readonly
            </code>
            Add your own email under <strong>Test Users</strong> so you can connect.
          </li>
          <li className="pl-1">
            <strong>Create OAuth Client ID:</strong> Go to <strong>Credentials</strong> &rarr; <strong>Create Credentials</strong> &rarr; <strong>OAuth client ID</strong>.
            Select <strong>Web application</strong>.
          </li>
          <li className="pl-1">
            <strong>Add Authorized Redirect URI:</strong> Under <em>Authorized redirect URIs</em>, add:
            <div className="my-1.5 p-2 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-sky-300 flex items-center justify-between">
              <span>{redirectUri}</span>
              <button
                onClick={() => copyToClipboard(redirectUri)}
                className="text-slate-400 hover:text-white"
              >
                {copiedUri ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </li>
          <li className="pl-1">
            <strong>Update .env:</strong> Copy the Client ID and Client Secret into your workspace <code className="text-amber-300 bg-slate-950 px-1 py-0.5 rounded font-mono">.env</code> file:
            <pre className="my-1.5 p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
            </pre>
          </li>
        </ol>
      </div>

      {/* Disconnect Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDisconnectDialogOpen}
        title="Disconnect Gmail Account?"
        message="MailSentinel will stop monitoring incoming emails and remove your stored OAuth credentials."
        confirmLabel="Disconnect Account"
        isDestructive={true}
        onConfirm={handleDisconnect}
        onCancel={() => setIsDisconnectDialogOpen(false)}
      />
    </div>
  );
};
