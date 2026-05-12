import kirklin from "@kirklin/eslint-config";

export default kirklin({
  ignores: [
    "cloudfunctions/**",
    "dist/**",
  ],
  rules: {
    "node/prefer-global/process": "off",
    "no-console": "off",
    "style/multiline-ternary": "off",
    "e18e/prefer-static-regex": "off",
    "erasable-syntax-only/enums": "off",
  },
  formatters: {
    /**
     * 格式化CSS、LESS、SCSS文件，以及Vue中的`<style>`块
     * 默认情况下使用Prettier
     */
    css: true,
    /**
     * 格式化HTML文件
     * 默认情况下使用Prettier
     */
    html: true,
    /**
     * 格式化Markdown文件
     * 支持Prettier和dprint
     * 默认情况下使用Prettier
     */
    markdown: "prettier",
  },
  unocss: true,
}, {
  // jest test globals for __tests__/cloudfunctions
  files: ["__tests__/cloudfunctions/**/*.{js,ts}"],
  languageOptions: {
    globals: {
      describe: "readonly",
      it: "readonly",
      expect: "readonly",
      beforeEach: "readonly",
      afterEach: "readonly",
      beforeAll: "readonly",
      afterAll: "readonly",
      jest: "readonly",
    },
  },
  rules: {
    "unused-imports/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
});
