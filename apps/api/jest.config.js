/** Unit tests for pricing, coupons and state machines. */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.spec.ts'],
  moduleNameMapper: {
    '^@shopcraft/shared$': '<rootDir>/../../packages/shared/src/index.ts',
  },
};
