// eslint-disable-next-line ts/no-require-imports
const defineJestConfig = require("@tarojs/test-utils-react/dist/jest.js").default;

module.exports = defineJestConfig({
  testEnvironment: "jsdom",
  testMatch: ["<rootDir>/__tests__/**/*.(spec|test).[jt]s?(x)"],
  moduleNameMapper: {
    "^wx-server-sdk$": "<rootDir>/cloudfunctions/_shared_test_utils/wx-server-sdk-stub.js",
  },
});
