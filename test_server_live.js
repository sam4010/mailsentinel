import { createApp } from './dist/server/app.js';
import { db } from './dist/server/db/index.js';

const app = createApp();
const PORT = 3099;

const server = app.listen(PORT, async () => {
  console.log(`Live test server listening on http://localhost:${PORT}`);
  let failed = false;

  async function check(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
    } catch (err) {
      console.error(`  ✗ ${name}:`, err.message);
      failed = true;
    }
  }

  try {
    await check('Health endpoint', async () => {
      const res = await fetch(`http://127.0.0.1:${PORT}/health`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (data.status !== 'ok') throw new Error('Status not ok');
    });

    await check('Auth status endpoint', async () => {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/auth/status`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (typeof data.connected !== 'boolean') throw new Error('Missing connected field');
    });

    await check('Overview stats endpoint', async () => {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/overview`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (typeof data.matchedToday !== 'number') throw new Error('Missing matchedToday');
    });

    let createdRuleId = '';
    await check('Create rule endpoint', async () => {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Stanford Admissions Test',
          senders: ['admissions@stanford.edu'],
          domains: ['stanford.edu'],
          keywords: ['offer', 'deadline'],
          priorityThreshold: 'Critical'
        })
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.rule || !data.rule.id) throw new Error('No rule returned');
      createdRuleId = data.rule.id;
    });

    await check('Get rules endpoint', async () => {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/rules`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data.rules) || data.rules.length === 0) throw new Error('Rules list empty');
    });

    await check('Rule evaluation test endpoint', async () => {
      const rule = db.getRule(createdRuleId);
      const res = await fetch(`http://127.0.0.1:${PORT}/api/rules/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rule,
          email: {
            senderEmail: 'admissions@stanford.edu',
            senderName: 'Stanford Admissions',
            subject: 'Important Offer of Admission',
            bodyText: 'We are pleased to extend an offer. Response due within 48 hours.'
          }
        })
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.matched) throw new Error('Rule should have matched');
      if (data.classification.priority !== 'Critical') throw new Error('Should classify as Critical');
    });

    await check('Local test notification endpoint', async () => {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/notifications/test-local`, { method: 'POST' });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error('Notification failed');
    });

    await check('Get notification events history', async () => {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/notifications`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data.events) || data.events.length === 0) throw new Error('No notification events found');
    });

    await check('Settings endpoint', async () => {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/settings`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      if (!data.settings) throw new Error('No settings returned');
    });

    await check('PWA static index.html delivery', async () => {
      const res = await fetch(`http://127.0.0.1:${PORT}/`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const html = await res.text();
      if (!html.includes('MailSentinel')) throw new Error('Missing MailSentinel title in HTML');
    });

    await check('PWA web manifest delivery', async () => {
      const res = await fetch(`http://127.0.0.1:${PORT}/manifest.json`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const manifest = await res.json();
      if (manifest.short_name !== 'MailSentinel') throw new Error('Invalid manifest name');
    });

    await check('PWA service worker delivery', async () => {
      const res = await fetch(`http://127.0.0.1:${PORT}/sw.js`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const sw = await res.text();
      if (!sw.includes('mailsentinel')) throw new Error('Invalid service worker content');
    });

  } finally {
    server.close(() => {
      console.log(`Server closed. Overall test result: ${failed ? 'FAILED' : 'ALL PASSED'}`);
      process.exit(failed ? 1 : 0);
    });
  }
});
