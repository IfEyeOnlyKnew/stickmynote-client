const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  roots: [
    '<rootDir>',
  ],
  moduleDirectories: [
    'node_modules',
    '<rootDir>',
  ],
  setupFiles: [
    '<rootDir>/jest.env-setup.js',
  ],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
  coverageReporters: ['lcov', 'text-summary'],
};
