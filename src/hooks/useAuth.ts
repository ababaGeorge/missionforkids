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
    let unsubUser: (() => void) | undefined;
    let gen = 0; // 帳號切換世代守衛：丟棄前一個帳號 in-flight 的非同步結果

    const unsubAuth = auth().onAuthStateChanged((firebaseUser) => {
      const myGen = ++gen;
      // 切帳號/登出時先解除上一個 user doc 監聽
      if (unsubUser) {
        unsubUser();
        unsubUser = undefined;
      }
      if (!firebaseUser) {
        setState({ firebaseUser: null, user: null, loading: false });
        return;
      }

      const uid = firebaseUser.uid;

      // 直接「監聽」users/{uid}（家長 doc id == uid）。改用 onSnapshot 而非一次性 get：
      // 註冊兩步流程中 doc 稍後才由 CF 補建時，這裡會自動收到並解除 loading，
      // 不再永久卡在轉圈。
      unsubUser = firestore()
        .collection('users')
        .doc(uid)
        .onSnapshot(
          async (directDoc) => {
            if (myGen !== gen) return; // 帳號已切換 → 丟棄
            if (directDoc && directDoc.exists()) {
              setState({
                firebaseUser,
                user: { id: directDoc.id, ...directDoc.data() } as User,
                loading: false,
              });
              return;
            }
            // fallback：用 authProviderId 查自己的 doc（doc id ≠ uid 的舊資料）。
            // 查的是「自己的」doc（authProviderId == 自己 uid），符合 users list 規則。
            try {
              const q = await firestore()
                .collection('users')
                .where('authProviderId', '==', uid)
                .limit(1)
                .get();
              if (myGen !== gen) return;
              if (!q.empty) {
                const d = q.docs[0];
                setState({
                  firebaseUser,
                  user: { id: d.id, ...d.data() } as User,
                  loading: false,
                });
                return;
              }
            } catch (err) {
              console.error('[useAuth] fallback query error:', (err as any)?.code);
            }
            if (myGen !== gen) return;
            // 尚無 user doc（bootstrap 進行中）→ 保持 firebaseUser、user=null，等下次 snapshot
            setState({ firebaseUser, user: null, loading: false });
          },
          (err) => {
            if (myGen !== gen) return;
            console.error('[useAuth] user snapshot error:', (err as any)?.code);
            setState({ firebaseUser, user: null, loading: false });
          }
        );
    });

    return () => {
      if (unsubUser) unsubUser();
      unsubAuth();
    };
  }, []);

  const signOut = useCallback(async () => {
    await auth().signOut();
  }, []);

  return { ...state, signOut };
}
