import {
  useFonts as useNotoSerifTc,
  NotoSerifTC_800ExtraBold,
} from '@expo-google-fonts/noto-serif-tc';
import {
  NotoSansTC_400Regular,
  NotoSansTC_500Medium,
  NotoSansTC_700Bold,
} from '@expo-google-fonts/noto-sans-tc';
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';

export const fontFamily = {
  display: 'NotoSerifTC_800ExtraBold',
  body: 'NotoSansTC_400Regular',
  bodyMedium: 'NotoSansTC_500Medium',
  bodyBold: 'NotoSansTC_700Bold',
  data: 'DMSans_500Medium',
  dataBold: 'DMSans_700Bold',
} as const;

export function useAppFonts() {
  const [loaded] = useNotoSerifTc({
    NotoSerifTC_800ExtraBold,
    NotoSansTC_400Regular,
    NotoSansTC_500Medium,
    NotoSansTC_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });
  return loaded;
}
