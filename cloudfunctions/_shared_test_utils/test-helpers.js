// 云函数单元测试辅助 · 用于 mock cloud SDK + 提供数据库 stub
module.exports = {
  // 调用云函数前 mock 全局 cloud
  mockCloud(openid = 'test_openid_001') {
    const mockDb = {
      collection: jest.fn(),
      command: { inc: jest.fn(v => ({ $inc: v })) },
    };
    global.mockCloudInstance = {
      DYNAMIC_CURRENT_ENV: 'test',
      init: jest.fn(),
      database: jest.fn(() => mockDb),
      getWXContext: jest.fn(() => ({ OPENID: openid })),
      callFunction: jest.fn(),
    };
    jest.mock('wx-server-sdk', () => global.mockCloudInstance);
    return { mockDb, cloud: global.mockCloudInstance };
  },
};
