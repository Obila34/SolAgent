module.exports = {
  preset: "jest-expo",
  testMatch: ["**/tests/**/*.test.ts"],
  collectCoverageFrom: ["utils/**/*.ts", "services/**/*.ts"],
};
