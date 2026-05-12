// wx-server-sdk stub for jest — replaced by mockCloud() factory at test runtime
module.exports = {
  DYNAMIC_CURRENT_ENV: 'test',
  init: () => {},
  database: () => ({ collection: () => ({}), command: {} }),
  getWXContext: () => ({ OPENID: '' }),
  callFunction: async () => ({}),
};
