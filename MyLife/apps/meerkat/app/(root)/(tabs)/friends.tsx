import { Redirect } from 'expo-router';

// Friends merged into Messages (Plan 31 Phase 0). This route stays one release as
// a redirect so saved links and navigation state never 404; the People section of
// Messages carries the friend list, trust states, SAS verify, and block/unblock.
export default function FriendsRedirect() {
  return <Redirect href="/messages" />;
}
