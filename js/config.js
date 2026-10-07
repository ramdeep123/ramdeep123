// App configuration. To take real payments, deploy server/server.mjs with your
// Razorpay keys and set payments.mode to 'razorpay' and apiBase to its URL.

export const CONFIG = {
  appName: 'KAYA',
  version: '1.1.0',
  company: 'Relies Production',
  copyrightYear: 2026,
  payments: {
    mode: 'demo', // 'demo' | 'razorpay'
    apiBase: '', // e.g. 'https://kaya-api.example.com'
  },
};

export const COPYRIGHT = `© ${CONFIG.copyrightYear} ${CONFIG.company}. All rights reserved.`;
