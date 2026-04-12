import firebase from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

// Firebase is auto-initialized by @react-native-firebase via
// google-services.json (Android) and GoogleService-Info.plist (iOS).
// No manual initialization needed.

export { firebase, auth, firestore, storage };
