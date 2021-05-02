module.exports = {
  verbose: true,
  rootDir: __dirname,
  moduleDirectories: ['<rootDir>/node_modules', '<rootDir>/src'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  testRegex: '/.*\\.spec\\.tsx?$',
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.spec.{ts,tsx}', '!src/index.ts'],
  coverageReporters: ['lcov', 'html']
}
