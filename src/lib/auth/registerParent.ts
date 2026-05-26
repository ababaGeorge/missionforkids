import auth from '@react-native-firebase/auth';
import functions from '@react-native-firebase/functions';

export interface RegisterParentInput {
  email: string;
  password: string;
  displayName: string;
  familyName: string;
}

export async function registerParent(
  input: RegisterParentInput
): Promise<{ familyId: string }> {
  await auth().createUserWithEmailAndPassword(input.email, input.password);
  const fn = functions().httpsCallable('bootstrapParentAccount');
  const res = await fn({
    displayName: input.displayName,
    familyName: input.familyName,
  });
  return { familyId: (res.data as { familyId: string }).familyId };
}
