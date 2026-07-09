/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // RNTL v13 has built-in matchers; do NOT add @testing-library/jest-native
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|@react-native-firebase/.*|expo-router|@react-navigation/.*))',
  ],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  // Exclude the functions sub-project — it has its own jest config
  testPathIgnorePatterns: ['/node_modules/', '/functions/'],
};
