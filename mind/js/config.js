// App settings that change per build. No secrets here — ever. The AI key
// lives only on the server (handoff §10: "Never put an API key inside the app").

export const config = {
  appName: 'Know Your Mind',
  version: '0.1.0',
  // Base URL of server/server.mjs, e.g. 'https://mind-api.example.com'.
  // Empty = the AI guide is off and the on-phone guide does everything.
  // When the web app is served by server.mjs itself, 'same-origin' works.
  apiBase: '',
  // Optional shared token the server can require (CLIENT_TOKEN). It only
  // slows down casual abuse; it is not a secret once the app ships.
  clientToken: '',
  // Minutes the urge timer runs by default (handoff: 20–30).
  urgeMinutes: 20,
};
