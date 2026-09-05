import { Redirect } from 'expo-router';

export default function JournalIndexRedirect() {
  return <Redirect href="/(journal)/today" />;
}
