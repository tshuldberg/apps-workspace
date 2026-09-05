import { Redirect } from 'expo-router';

export default function ForumsIndexRedirect() {
  return <Redirect href="/(forums)/(tabs)/feed" />;
}
