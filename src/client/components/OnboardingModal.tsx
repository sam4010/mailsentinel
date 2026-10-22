import React, { useState } from 'react';
import {
  ShieldCheck,
  Mail,
  Sliders,
  Bell,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  ExternalLink,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { usePushNotifications } from '../hooks/usePushNotifications.js';

export const OnboardingModal: React.FC = () => {
  const {
    isOnboardingOpen,
    setIsOnboardingOpen,
    authStatus,
    account,
    refreshAll,
    showToast,
    setCurrentView,
  } = useApp();

  const {
    permission,
    isSubscribed,
    subscribeUser,
    sendLocalTestNotification,
  } = usePushNotifications();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('university');
  const [testSent, setTestSent] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // App Password Form state in Onboarding
  const [appEmail, setAppEmail] = useState('');
  const [appPassword, setAppPassword] = useState('dhrg boxf sycp fjgd');
  const [connectingImap, setConnectingImap] = useState(false);

  if (!isOnboardingOpen) return null;

  const handleConnectAppPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appEmail.trim()) {
      showToast('Please enter your Gmail address', 'error');
      return;
    }
    setConnectingImap(true);
    try {
      const res = await fetch('/api/auth/imap/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: appEmail.trim(), appPassword: appPassword.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message, 'success');
        refreshAll();
        setCurrentStep(3);
      } else {
        showToast(data.error || 'Connection failed', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Error connecting to Gmail', 'error');
    } finally {
      setConnectingImap(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('mailsentinel_onboarding_dismissed', 'true');
    setIsOnboardingOpen(false);
  };

  const handleConnectGmail = async () => {
    try {
      const res = await fetch('/api/auth/google/url');
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        showToast(data.error || 'Google OAuth is not yet configured in .env', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Error starting OAuth flow', 'error');
    }
  };

  const handleEnablePush = async () => {
    if (authStatus?.vapidPublicKey) {
      const res = await subscribeUser(authStatus.vapidPublicKey);
      if (res.success) {
        showToast('Push notifications successfully enabled!', 'success');
        refreshAll();
      } else {
        showToast(res.error || 'Could not enable push notifications', 'error');
      }
    } else {
      // Local fallback
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') {
          showToast('Browser notifications permitted!', 'success');
        } else {
          showToast('Notification permission was denied', 'error');
        }
      });
    }
  };

  const handleTestNotification = async () => {
    const success = await sendLocalTestNotification(
      '🚨 [CRITICAL] MailSentinel Test Alert',
      'Verified! You will receive instant priority alerts when important emails arrive.'
    );
    setTestSent(true);
    setTestResult({
      success,
      message: success
        ? 'Test notification triggered successfully!'
        : 'Browser blocked notification. Please check browser and device permissions.',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-navy-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl relative flex flex-col max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-6 right-6 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Step indicator */}
        <div className="flex items-center justify-between mb-8 pr-8">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((step) => (
              <div
                key={step}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step === currentStep
                    ? 'w-8 bg-sentinel-500'
                    : step < currentStep
                    ? 'w-4 bg-sentinel-800'
                    : 'w-4 bg-slate-800'
                }`}
              />
            ))}
          </div>
          <span className="text-xs font-mono text-slate-400">Step {currentStep} of 5</span>
        </div>

        {/* STEP 1: Welcome */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sentinel-600 to-sky-400 flex items-center justify-center text-white shadow-xl shadow-sky-500/20">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-100 tracking-tight">
                Never Miss an Important Email Again.
              </h2>
              <p className="text-slate-300 text-sm mt-2 leading-relaxed">
                Whether it's a university admission letter, a job interview offer, a housing deadline, or an urgent bill,
                MailSentinel continuously monitors your inbox and delivers instant priority alerts based on your exact rules.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <div className="text-sentinel-400 font-semibold text-xs mb-1">🎯 Deterministic Rules</div>
                <p className="text-slate-400 text-xs">You specify important senders, domains, and keywords. Zero guesswork.</p>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50">
                <div className="text-emerald-400 font-semibold text-xs mb-1">🔒 Private & Secure</div>
                <p className="text-slate-400 text-xs">Official read-only Gmail OAuth, AES-256 encrypted tokens at rest.</p>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={() => setCurrentStep(2)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sentinel-600 hover:bg-sentinel-500 text-white font-medium text-sm transition shadow-lg shadow-sentinel-600/20"
              >
                <span>Get Started</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Connect Gmail */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center text-white shadow-xl">
              <Mail className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Connect Your Gmail Account</h2>
              <p className="text-slate-300 text-sm mt-1 leading-relaxed">
                Connect directly using your 16-letter Google App Password. No Google Cloud Console needed.
              </p>
            </div>

            {account ? (
              <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/50 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-emerald-200">Connected: {account.email}</div>
                  <div className="text-xs text-emerald-400/80">Gmail connection is verified and active.</div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConnectAppPassword} className="space-y-3.5 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Your Gmail Address</label>
                  <input
                    type="email"
                    placeholder="e.g. yourname@gmail.com"
                    value={appEmail}
                    onChange={(e) => setAppEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-sentinel-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">16-Letter Google App Password</label>
                  <input
                    type="text"
                    placeholder="e.g. dhrg boxf sycp fjgd"
                    value={appPassword}
                    onChange={(e) => setAppPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-sentinel-500"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={connectingImap}
                  className="w-full py-2.5 rounded-xl bg-sentinel-600 hover:bg-sentinel-500 text-white font-semibold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-sentinel-600/20"
                >
                  {connectingImap ? 'Connecting...' : 'Connect Gmail Instantly'}
                </button>
              </form>
            )}

            <div className="pt-4 flex items-center justify-between">
              <button
                onClick={() => setCurrentStep(1)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                onClick={() => setCurrentStep(3)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sentinel-600 hover:bg-sentinel-500 text-white font-medium text-sm transition"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Create First Rule */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sentinel-600 to-indigo-500 flex items-center justify-center text-white shadow-xl">
              <Sliders className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Configure Your First Monitoring Rule</h2>
              <p className="text-slate-300 text-sm mt-2 leading-relaxed">
                Rules specify which senders, domains, and keywords will trigger notifications. Pre-configured starter rules are already initialized for you.
              </p>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300 block">Select a primary rule template to activate:</label>
              
              <div
                onClick={() => setSelectedTemplate('university')}
                className={`p-3.5 rounded-xl border cursor-pointer transition ${
                  selectedTemplate === 'university'
                    ? 'bg-sentinel-950/40 border-sentinel-500 text-slate-100'
                    : 'bg-slate-800/40 border-slate-700/50 text-slate-300 hover:bg-slate-800/70'
                }`}
              >
                <div className="font-semibold text-sm">🎓 University & Housing Deadlines</div>
                <p className="text-xs text-slate-400 mt-1">
                  Domains: <code className="text-sentinel-300">university.edu</code> | Keywords: <code className="text-sentinel-300">application status, offer, deadline</code>
                </p>
              </div>

              <div
                onClick={() => setSelectedTemplate('jobs')}
                className={`p-3.5 rounded-xl border cursor-pointer transition ${
                  selectedTemplate === 'jobs'
                    ? 'bg-sentinel-950/40 border-sentinel-500 text-slate-100'
                    : 'bg-slate-800/40 border-slate-700/50 text-slate-300 hover:bg-slate-800/70'
                }`}
              >
                <div className="font-semibold text-sm">💼 Job Offers & Interview Invitations</div>
                <p className="text-xs text-slate-400 mt-1">
                  Keywords: <code className="text-sentinel-300">interview invitation, offer letter, next steps</code>
                </p>
              </div>

              <div
                onClick={() => setSelectedTemplate('urgent')}
                className={`p-3.5 rounded-xl border cursor-pointer transition ${
                  selectedTemplate === 'urgent'
                    ? 'bg-sentinel-950/40 border-sentinel-500 text-slate-100'
                    : 'bg-slate-800/40 border-slate-700/50 text-slate-300 hover:bg-slate-800/70'
                }`}
              >
                <div className="font-semibold text-sm">🚨 Urgent Action & Financial Notices</div>
                <p className="text-xs text-slate-400 mt-1">
                  Keywords: <code className="text-sentinel-300">urgent action required, payment past due, final notice</code>
                </p>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <button
                onClick={() => setCurrentStep(2)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                onClick={() => setCurrentStep(4)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sentinel-600 hover:bg-sentinel-500 text-white font-medium text-sm transition"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Enable Notifications */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-white shadow-xl">
              <Bell className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Enable Push Alerts</h2>
              <p className="text-slate-300 text-sm mt-2 leading-relaxed">
                Allow browser notifications so MailSentinel can wake your device and alert you when critical emails arrive, even when the tab is closed.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-200">Browser Push Notifications</div>
                  <div className="text-xs text-slate-400">
                    Status: <span className="font-mono text-sentinel-400">{permission}</span>
                  </div>
                </div>
                <button
                  onClick={handleEnablePush}
                  className="px-4 py-2 rounded-xl bg-sentinel-600 hover:bg-sentinel-500 text-white text-xs font-semibold transition"
                >
                  {isSubscribed ? 'Subscribed ✓' : 'Enable Notifications'}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              * Note: Delivery also depends on your operating system focus/do-not-disturb settings and battery saver policies.
            </p>

            <div className="pt-4 flex items-center justify-between">
              <button
                onClick={() => setCurrentStep(3)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                onClick={() => setCurrentStep(5)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sentinel-600 hover:bg-sentinel-500 text-white font-medium text-sm transition"
              >
                <span>Continue to Test</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Test Notification */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shadow-xl">
              <Sparkles className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-100 tracking-tight">Test Your Setup</h2>
              <p className="text-slate-300 text-sm mt-2 leading-relaxed">
                Send a sample notification to verify that your device displays alerts properly.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-4">
              <button
                onClick={handleTestNotification}
                className="w-full py-3 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium text-sm transition flex items-center justify-center gap-2"
              >
                <Bell className="w-4 h-4" />
                <span>Send Local Test Notification</span>
              </button>

              {testSent && testResult && (
                <div
                  className={`p-3 rounded-lg text-xs leading-relaxed ${
                    testResult.success
                      ? 'bg-emerald-950/50 text-emerald-300 border border-emerald-800/50'
                      : 'bg-red-950/50 text-red-300 border border-red-800/50'
                  }`}
                >
                  {testResult.message}
                </div>
              )}
            </div>

            <div className="pt-4 flex items-center justify-between">
              <button
                onClick={() => setCurrentStep(4)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                onClick={handleDismiss}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition shadow-lg shadow-emerald-600/20"
              >
                <span>Launch MailSentinel</span>
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
