import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import { FamilyInvite } from '../types/models';

export interface CreateFamilyInviteInput {
  familyId: string;
  email: string;
  childName: string;
  nickname?: string;
  avatarEmoji?: string;
}

export async function createFamilyInvite(
  input: CreateFamilyInviteInput
): Promise<{ inviteId: string; emailSent: boolean }> {
  const fn = functions().httpsCallable('createFamilyInvite');
  const res = await fn(input);
  return res.data as { inviteId: string; emailSent: boolean };
}

// 接受畫面 pre-auth 讀 invite 顯示用（rules 允許單 doc get）
export async function getFamilyInvite(
  inviteId: string
): Promise<FamilyInvite | null> {
  const snap = await firestore().collection('familyInvites').doc(inviteId).get();
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as object) } as FamilyInvite;
}
