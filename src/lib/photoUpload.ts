import * as ImagePicker from 'expo-image-picker';
import storage from '@react-native-firebase/storage';

/**
 * 開啟相機拍照，回傳本機 URI
 */
export async function pickPhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('CAMERA_PERMISSION_DENIED');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  return result.assets[0].uri;
}

/**
 * 上傳照片到 Firebase Storage
 * 路徑: families/{familyId}/submissions/{timestamp}_{random}.jpg
 * 回傳下載 URL
 */
export async function uploadPhoto(
  familyId: string,
  localUri: string
): Promise<string> {
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const storagePath = `families/${familyId}/submissions/${filename}`;
  const ref = storage().ref(storagePath);

  await ref.putFile(localUri);
  const downloadUrl = await ref.getDownloadURL();
  return downloadUrl;
}
