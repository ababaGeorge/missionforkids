import auth from '@react-native-firebase/auth';
import functions from '@react-native-firebase/functions';

export interface RegisterChildInput {
  inviteId: string;
  email: string;
  password: string;
}

export async function registerChild(
  input: RegisterChildInput
): Promise<{ familyId: string; childId: string }> {
  await auth().createUserWithEmailAndPassword(input.email, input.password);
  const fn = functions().httpsCallable('acceptFamilyInvite');
  const res = await fn({ inviteId: input.inviteId });
  return res.data as { familyId: string; childId: string };
}
