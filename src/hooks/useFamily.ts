import { useState, useEffect } from 'react';
import firestore from '@react-native-firebase/firestore';
import { Family, FamilyMembership } from '../types/models';

export function useFamily(userId: string | undefined) {
  const [family, setFamily] = useState<Family | null>(null);
  const [membership, setMembership] = useState<FamilyMembership | null>(null);
  const [members, setMembers] = useState<FamilyMembership[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const unsubMembership = firestore()
      .collection('familyMemberships')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .limit(1)
      .onSnapshot(async (snap) => {
        if (!snap || snap.empty) {
          setFamily(null);
          setMembership(null);
          setMembers([]);
          setLoading(false);
          return;
        }

        const membershipDoc = snap.docs[0];
        const mem = {
          id: membershipDoc.id,
          ...membershipDoc.data(),
        } as FamilyMembership;
        setMembership(mem);

        const familyDoc = await firestore()
          .collection('families')
          .doc(mem.familyId)
          .get();

        const familyData = familyDoc.data();
        if (familyData) {
          setFamily({ id: familyDoc.id, ...familyData } as Family);
        }

        setLoading(false);
      }, (err: any) => {
        // 查詢失敗（如 permission-denied / 缺索引）不能無聲卡在 loading
        console.error('[useFamily] membership listener error:', err?.code ?? err);
        setFamily(null);
        setMembership(null);
        setMembers([]);
        setLoading(false);
      });

    return unsubMembership;
  }, [userId]);

  useEffect(() => {
    if (!family) {
      setMembers([]);
      return;
    }

    const unsubMembers = firestore()
      .collection('familyMemberships')
      .where('familyId', '==', family.id)
      .where('status', '==', 'active')
      .onSnapshot((snap) => {
        if (!snap) {
          setMembers([]);
          return;
        }
        setMembers(
          snap.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() } as FamilyMembership)
          )
        );
      }, (err: any) => {
        console.error('[useFamily] members listener error:', err?.code ?? err);
        setMembers([]);
      });

    return unsubMembers;
  }, [family?.id]);

  return { family, membership, members, loading };
}
