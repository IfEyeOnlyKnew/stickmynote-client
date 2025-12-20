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
};
