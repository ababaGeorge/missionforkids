jest.mock('@react-native-firebase/auth', () => {
  const signInWithEmailAndPassword = jest.fn();
  const createUserWithEmailAndPassword = jest.fn();
  const signOut = jest.fn();
  const sendPasswordResetEmail = jest.fn();
  const authMock = () => ({
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    currentUser: null,
    onAuthStateChanged: jest.fn(() => jest.fn()),
  });
  authMock.__mocks = { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail };
  return { __esModule: true, default: authMock };
});
jest.mock('@react-native-firebase/functions', () => {
  const httpsCallable = jest.fn(() => jest.fn(async () => ({ data: {} })));
  const functionsMock = () => ({ httpsCallable });
  functionsMock.__mocks = { httpsCallable };
  return { __esModule: true, default: functionsMock };
});
