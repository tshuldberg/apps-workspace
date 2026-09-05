import { Redirect } from 'expo-router';

// Route-collision guard (Plan 31 Phase 1, T1.3). The invite wire prefix is
// `meerkat://community/join#...`, so the OS routes the path `community/join`
// here. A STATIC segment wins over the dynamic `[communityId]` route, so 'join'
// never becomes a communityId. The CommunityInviteLinkListener (root layout)
// reads the full URL (with its `#payload` fragment, which route params drop) and
// presents the InvitePreviewSheet; this screen just lands the user back on the
// Communities list and renders nothing else.
export default function CommunityJoinIntake() {
  return <Redirect href="/communities" />;
}
