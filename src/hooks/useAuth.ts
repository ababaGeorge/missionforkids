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
    let gen = 0; // 帳號切換世代守衛：舊帳號 in-flight 的非同步結果一律作廢

    const unsubAuth = auth().onAuthStateChanged((firebaseUser) => {
      const myGen = ++gen;
      // 切帳號/登出：先解除上一個 user doc 監聽，避免舊帳號 snapshot 污染新 state
      if (unsubUser) {
        unsubUser();
        unsubUser = undefined;
      }

      if (!firebaseUser) {
        setState({ firebaseUser: null, user: null, loading: false });
        return;
      }

      const uid = firebaseUser.uid;
      let snapSeq = 0; // 同世代 snapshot 序號：舊 snapshot 的 fallback continuation 一律作廢

      // 持續監聽 users/{uid}（家長與新流程小孩的 doc ID == auth UID）。
      // 用 onSnapshot 而非一次性 get：註冊兩步流程中 doc 由 CF 稍後補建時，
      // 這裡會自動收到新 snapshot 解除 user=null，不再永久卡在轉圈。
      unsubUser = firestore()
        .collection('users')
        .doc(uid)
        .onSnapshot(
          async (directDoc) => {
            if (myGen !== gen) return; // 帳號已切換 → 作廢
            const mySeq = ++snapSeq;
            if (directDoc && directDoc.exists()) {
              setState({
                firebaseUser,
                user: { id: directDoc.id, ...directDoc.data() } as User,
                loading: false,
              });
              return;
            }

            // fallback：用 authProviderId 查（舊資料的小孩 doc ID ≠ auth UID）。
            // 這類 doc 在登入當下已存在，一次性查詢即可，不需監聽。
            try {
              const querySnap = await firestore()
                .collection('users')
                .where('authProviderId', '==', uid)
                .limit(1)
                .get();
              // 世代守衛＋序號雙重檢查：await 期間若換帳號、或同世代已有更新的
              // snapshot 進來（例：CF 補建 doc 已把 user 設好），過期結果一律作廢，
              // 避免空的 fallback 結果把已載入的 user 蓋回 null。
              if (myGen !== gen || mySeq !== snapSeq) return;
              if (!querySnap.empty) {
                const doc = querySnap.docs[0];
                setState({
                  firebaseUser,
                  user: { id: doc.id, ...doc.data() } as User,
                  loading: false,
                });
                return;
              }
            } catch (err) {
              console.error('[useAuth] fallback query error:', (err as any)?.code);
            }

            if (myGen !== gen || mySeq !== snapSeq) return;
            // 尚無 user doc（bootstrap 進行中/失敗）→ 保持登入狀態等下一次 snapshot
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
      gen++; // unmount 後任何 in-flight 結果作廢
      if (unsubUser) unsubUser();
      unsubAuth();
    };
  }, []);

  const signOut = useCallback(async () => {
    await auth().signOut();
  }, []);

  return { ...state, signOut };
}
