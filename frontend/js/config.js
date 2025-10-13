const CONFIG = {
  API_URL: window.location.hostname === 'localhost' 
    ? 'http://localhost:5000/api' 
    : '/api',
  APP_NAME: 'FarmaFollow',
  VERSION: '1.0.0',
  DEBUG: window.location.hostname === 'localhost'
};

const logger = {
  log: (...args) => CONFIG.DEBUG && console.log('[FarmaFollow]', ...args),
  error: (...args) => console.error('[FarmaFollow Error]', ...args),
  warn: (...args) => CONFIG.DEBUG && console.warn('[FarmaFollow]', ...args)
};