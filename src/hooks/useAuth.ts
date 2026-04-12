import { useState, useEffect, useCallback } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { User } from '../types/models';

interface AuthState {
  firebaseUser: FirebaseAuthTypes.User | null;
  user: User | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    firebaseUser: null,
    user: null,
    loading: true,
  });

  useEffect(() => {
    const unsubAuth = auth().onAuthStateChanged(async (firebaseUser) => {
      if (!firebaseUser) {
        setState({ firebaseUser: null, user: null, loading: false });
        return;
      }

      const uid = firebaseUser.uid;

      // 先試直接用 doc ID 查（家長的 doc ID == auth UID）
      const directDoc = await firestore().collection('users').doc(uid).get();
      if (directDoc.exists) {
        setState({
          firebaseUser,
          user: { id: directDoc.id, ...directDoc.data() } as User,
          loading: false,
        });
        return;
      }

      // 再用 authProviderId 查（孩子透過邀請碼加入後，authProviderId == auth UID）
      const querySnap = await firestore()
        .collection('users')
        .where('authProviderId', '==', uid)
        .limit(1)
        .get();

      if (!querySnap.empty) {
        const doc = querySnap.docs[0];
        setState({
          firebaseUser,
          user: { id: doc.id, ...doc.data() } as User,
          loading: false,
        });
        return;
      }

      // 沒有對應 user doc（可能剛 sign in，還沒建檔）
      setState({ firebaseUser, user: null, loading: false });
    });

    return unsubAuth;
  }, []);

  const signOut = useCallback(async () => {
    await auth().signOut();
  }, []);

  return { ...state, signOut };
}
