import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import functions from '@react-native-firebase/functions';
import auth from '@react-native-firebase/auth';
import { pickPhoto } from '../../../lib/photoUpload';
import { useAuth } from '../../../hooks/useAuth';
import AIThinkingAnimation from '../../../components/AIThinkingAnimation';

type AIResult = 'pass' | 'fail' | 'uncertain' | 'timeout' | null;

export default function AIPlayground() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<AIResult>(null);
  const [message, setMessage] = useState('');

  const isZh = i18n.language.startsWith('zh');

  const handleTakePhoto = async () => {
    try {
      const uri = await pickPhoto();
      if (!uri) return;
      setPhotoUri(uri);
      setResult(null);
      setMessage('');
    } catch (error: any) {
      if (error.message === 'CAMERA_PERMISSION_DENIED') {
        Alert.alert(t('common.error'), t('ai.cameraNeeded'));
      }
    }
  };

  const handleAnalyze = async () => {
    if (!photoUri || !user) return;

    setAnalyzing(true);
    setResult(null);
    setMessage('');

    try {
      // 先上傳照片取得公開 URL 供 AI 分析
      const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
      const uid = auth().currentUser?.uid;
      if (!uid) throw new Error('Not signed in');
      const storagePath = `playground/${uid}/${filename}`;
      const storageModule = await import('@react-native-firebase/storage');
      const ref = storageModule.default().ref(storagePath);
      await ref.putFile(photoUri);
      const photoUrl = await ref.getDownloadURL();

      const analyzePhotoFn = functions().httpsCallable('analyzePhoto');
      const response = await analyzePhotoFn({ photoUrl });
      const data = response.data as {
        result: string;
        messageZh: string;
        messageEn: string;
      };

      setResult(data.result as AIResult);
      setMessage(isZh ? data.messageZh : data.messageEn);
    } catch (error: any) {
      Alert.alert(t('common.error'), t('ai.error'));
    } finally {
      setAnalyzing(false);
    }
  };

  const getResultEmoji = () => {
    switch (result) {
      case 'pass':
        return '🎉';
      case 'fail':
        return '🤔';
      case 'uncertain':
        return '🧐';
      case 'timeout':
        return '⏰';
      default:
        return '';
    }
  };

  const getResultColor = () => {
    switch (result) {
      case 'pass':
        return '#34C759';
      case 'fail':
        return '#FF3B30';
      default:
        return '#FF9500';
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <Text style={styles.title}>{t('ai.title')}</Text>
      <Text style={styles.subtitle}>{t('ai.subtitle')}</Text>

      {/* 拍照區 */}
      <TouchableOpacity
        style={styles.photoArea}
        onPress={handleTakePhoto}
        disabled={analyzing}
      >
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.cameraIcon}>📷</Text>
            <Text style={styles.photoHint}>{t('ai.takePhoto')}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* 分析按鈕 */}
      {photoUri && !analyzing && !result && (
        <TouchableOpacity style={styles.analyzeBtn} onPress={handleAnalyze}>
          <Text style={styles.analyzeBtnText}>{t('ai.analyze')}</Text>
        </TouchableOpacity>
      )}

      {/* AI 思考動畫 */}
      <AIThinkingAnimation visible={analyzing} />

      {/* 結果顯示 */}
      {result && (
        <View style={[styles.resultCard, { borderColor: getResultColor() }]}>
          <Text style={styles.resultEmoji}>{getResultEmoji()}</Text>
          <Text style={[styles.resultText, { color: getResultColor() }]}>
            {message}
          </Text>
        </View>
      )}

      {/* 再試一次 */}
      {result && (
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            setPhotoUri(null);
            setResult(null);
            setMessage('');
          }}
        >
          <Text style={styles.retryBtnText}>{t('ai.tryAgain')}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F0' },
  content: { padding: 20, paddingBottom: 40 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#888',
    marginBottom: 24,
  },
  photoArea: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#F0E8DD',
    marginBottom: 20,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIcon: { fontSize: 48, marginBottom: 8 },
  photoHint: { fontSize: 16, color: '#999' },
  analyzeBtn: {
    backgroundColor: '#FF9500',
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
    marginBottom: 8,
  },
  analyzeBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    borderWidth: 2,
    alignItems: 'center',
    marginTop: 8,
  },
  resultEmoji: { fontSize: 48, marginBottom: 12 },
  resultText: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 26,
  },
  retryBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 28,
    alignItems: 'center',
    backgroundColor: '#F0E8DD',
  },
  retryBtnText: {
    color: '#FF9500',
    fontSize: 16,
    fontWeight: '700',
  },
});
