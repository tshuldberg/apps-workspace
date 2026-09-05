# Feature Spec: Voice Channels

## Metadata
- **Module:** forums
- **Priority Score:** 18 / 50 (C-Tier)
- **Scoring Breakdown:** Market [2] x3 + Switching [3] x3 + Complexity [0] x2 + CrossModule [1] x1 + PaidUser [2] x1
- **Sprint:** Backlog
- **Estimated CC Time:** 8-10 hours
- **Depends On:** User profiles (voice needs identity), Real-time updates (presence/signaling infrastructure)
- **Blocks:** none

## Business Context

### Why This Feature Exists
Voice channels transform a text forum into a living, breathing community space. Discord's voice channels are its defining differentiator, used by 150M+ monthly users. No other community platform (Reddit, Lemmy) offers persistent voice rooms. Adding voice channels to MyForums creates a unique competitive advantage in the privacy-first community space: Discord's voice is convenient but all audio routes through Discord servers with no privacy guarantees. MyForums voice channels with E2E encryption would be the first privacy-respecting voice community platform.

### Competitor Landscape

| Competitor | Has Feature? | Behind Paywall? | Their Implementation |
|-----------|-------------|----------------|---------------------|
| Discord | Yes | Partial (Nitro: higher quality, Go Live HD) | Persistent voice channels per server, screen share, Go Live streaming, noise suppression, voice activity/push-to-talk, up to 99 users (500 for stages) |
| Reddit | No | N/A | Reddit Talk (live audio, similar to Twitter Spaces) was discontinued in 2023 |
| Lemmy | No | N/A | No voice capability |

### Target User
Community leaders and active members who want real-time voice interaction. Discord users frustrated with Discord's data practices who want privacy-first voice. Gaming communities, study groups, hobby clubs, and interest-based communities that currently rely on Discord voice channels. The switching score of 3/5 reflects that Discord has a strong lock-in on voice, but privacy-conscious users would switch.

## Technical Context

### Where This Lives in MyLife

```
modules/forums/src/
  types.ts                            -- New Zod schemas: VoiceChannel, VoiceParticipant, VoiceState
  cloud/client.ts                     -- New cloud functions: voice channel CRUD, participant management
  cloud/schema.sql                    -- New tables: fr_voice_channels, fr_voice_participants
  cloud/realtime.ts                   -- MODIFIED: add voice signaling channels
  voice/                              -- NEW directory
    signaling.ts                      -- WebRTC signaling via Supabase Realtime Broadcast
    peer-manager.ts                   -- WebRTC peer connection lifecycle
    audio-engine.ts                   -- Audio capture, noise suppression, VAD

apps/mobile/app/(forums)/
  voice-channel.tsx                   -- NEW: voice channel room screen
  components/VoiceChannelCard.tsx     -- NEW: voice channel entry in community sidebar
  components/VoiceParticipantGrid.tsx -- NEW: grid of active voice participants
  components/VoiceControls.tsx        -- NEW: mute/deafen/disconnect toolbar

apps/web/app/forums/
  voice/[channelId]/page.tsx          -- NEW: voice channel room page
  components/VoiceChannelCard.tsx     -- NEW: web voice channel card
  components/VoiceParticipantGrid.tsx -- NEW: web participant grid
  components/VoiceControls.tsx        -- NEW: web voice controls
```

### Wireframe Position

```
Hub Dashboard
  └── MyForums card
       └── Community Detail
            └── Voice Channels section (below thread list) ← YOU ARE HERE
                 ├── Voice Channel card (name + participant count + join button)
                 │    └── Expanded: participant avatars with speaking indicators
                 └── "Create Voice Channel" (mod/admin only)
                      └── Voice Room screen
                           ├── Participant grid (avatars with speaking rings)
                           └── Control bar (mute, deafen, disconnect)
```

### Data Model

```sql
-- Voice channels (persistent rooms within communities)
CREATE TABLE IF NOT EXISTS fr_voice_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES fr_communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  description TEXT CHECK (char_length(description) <= 200),
  max_participants INTEGER NOT NULL DEFAULT 25 CHECK (max_participants BETWEEN 2 AND 100),
  is_locked BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Active participants (ephemeral -- rows exist only while user is in channel)
CREATE TABLE IF NOT EXISTS fr_voice_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES fr_voice_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_muted BOOLEAN NOT NULL DEFAULT false,
  is_deafened BOOLEAN NOT NULL DEFAULT false,
  is_speaking BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Indexes
CREATE INDEX idx_fr_voice_channels_community ON fr_voice_channels (community_id, position);
CREATE INDEX idx_fr_voice_participants_channel ON fr_voice_participants (channel_id);
CREATE INDEX idx_fr_voice_participants_user ON fr_voice_participants (user_id);

-- RLS
ALTER TABLE fr_voice_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Voice channels readable by community members" ON fr_voice_channels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM fr_community_members
      WHERE community_id = fr_voice_channels.community_id AND profile_id = auth.uid() AND status = 'active'
    ) OR EXISTS (
      SELECT 1 FROM fr_communities
      WHERE id = fr_voice_channels.community_id AND community_type = 'public'
    )
  );
CREATE POLICY "Mods can manage voice channels" ON fr_voice_channels
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM fr_community_members
      WHERE community_id = fr_voice_channels.community_id
        AND profile_id = auth.uid()
        AND role IN ('owner', 'admin', 'moderator')
    )
  );

ALTER TABLE fr_voice_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants are visible to channel members" ON fr_voice_participants
  FOR SELECT USING (true);
CREATE POLICY "Users manage own participation" ON fr_voice_participants
  FOR ALL USING (auth.uid() = user_id);
```

### Dependencies
- **Internal:** `@mylife/auth` (user identity), `@mylife/ui` (avatar, control components), forums User Profiles (fr_profiles for display), forums Real-time (Supabase Realtime for signaling)
- **External:** WebRTC APIs (`RTCPeerConnection`, `RTCSessionDescription`, `RTCIceCandidate`), Supabase Realtime Broadcast (for WebRTC signaling), `expo-av` or `react-native-webrtc` for mobile audio capture, Web Audio API for noise suppression and VAD
- **Cross-Module:** None directly. Future: could integrate with workouts module for "workout together" voice sessions.

## Functional Requirements

### User Stories
1. As a community member, I want to join a voice channel and talk to other members in real-time.
2. As a community mod, I want to create and manage voice channels for my community.
3. As a voice participant, I want to mute/unmute myself and deafen/undeafen so I can control my audio.
4. As a community member, I want to see who is currently in a voice channel before joining.
5. As a voice participant, I want to see visual speaking indicators so I know who is talking.

### Behavior Specification

1. **Voice channel creation:** Community owners, admins, and moderators can create voice channels via community settings. Fields: name (required, 1-50 chars), description (optional), max participants (2-100, default 25). Channels appear in a "Voice Channels" section below the thread list in community detail.
2. **Joining a voice channel:** Tap "Join" on a voice channel card. The app requests microphone permission (first time). A fr_voice_participants row is created. WebRTC peer connections are established with all existing participants via Supabase Realtime Broadcast signaling. Audio capture begins (muted by default on mobile, unmuted on web).
3. **WebRTC signaling flow:** When User A joins a channel with Users B and C already connected:
   - A sends a `join` Broadcast to the channel
   - B and C each create an RTCPeerConnection for A
   - B sends an SDP offer to A via Broadcast (targeted by user_id)
   - A creates an RTCPeerConnection for B, sets remote description, creates answer, sends back
   - ICE candidates are exchanged via Broadcast
   - Same flow for C
   - Mesh topology: each participant has a direct peer connection with every other participant
4. **Audio controls:** Bottom toolbar with three buttons: Mute (toggle mic), Deafen (toggle all incoming audio), Disconnect (leave channel). Mute state is synced to fr_voice_participants.is_muted and broadcast to other participants (muted users show a mute icon on their avatar).
5. **Speaking detection (VAD):** Voice Activity Detection runs locally on the audio stream. When speech is detected, is_speaking flag is broadcast to other participants. Other participants see a glowing ring around the speaker's avatar. VAD threshold is configurable (sensitivity slider in settings).
6. **Participant grid:** Voice room screen shows a grid of participant avatars. Each avatar shows: profile picture, display name, mute icon (if muted), green glowing ring (if speaking). Grid adapts: 2x2 for 2-4 users, 3x3 for 5-9, scrollable for 10+.
7. **Leaving:** Tap Disconnect. RTCPeerConnections are closed. fr_voice_participants row is deleted. Broadcast `leave` event to channel. If the app is force-closed or crashes, a Supabase cron job cleans up stale participants (no heartbeat for 60 seconds).
8. **Channel capacity:** If max_participants is reached, the Join button is disabled with "Channel full (N/N)" text. New users see a "Notify me when a spot opens" option (uses local notification, not pushed).
9. **Locked channels:** Mods can lock a voice channel. Locked channels prevent new joins until unlocked. Existing participants remain.
10. **Noise suppression:** Optional client-side noise suppression using Web Audio API (web) or rnnoise WASM (mobile). Toggle in voice settings.

### Edge Cases

- **Microphone permission denied:** Show a modal explaining why mic access is needed with a "Go to Settings" button. User cannot join without permission.
- **Network drop during voice:** WebRTC has built-in ICE reconnection. If connection fails after 10 seconds, show "Reconnecting..." overlay. After 30 seconds, auto-disconnect and show "Connection lost" toast.
- **User leaves abruptly (crash/close):** Stale fr_voice_participants row remains. Server-side cron (runs every 60 seconds) deletes rows with no heartbeat. Other participants see the user's avatar fade out with "disconnected" label.
- **Mesh topology limits:** WebRTC mesh works well for up to ~8-10 participants. Beyond that, CPU and bandwidth increase quadratically. For v1, set max_participants default to 25 but recommend 10 for best quality. SFU (Selective Forwarding Unit) architecture is a future optimization.
- **Echo cancellation:** Rely on platform AEC (Acoustic Echo Cancellation) built into WebRTC. No custom echo cancellation needed.
- **Mobile background:** When the app is backgrounded on mobile, voice continues (using background audio mode). Show a persistent notification: "In voice: [channel name] -- Tap to return". If the user explicitly disconnects, background audio stops.
- **Simultaneous voice and thread viewing:** Voice connection persists while navigating other forum screens. A floating mini-bar at the top shows "Connected to [channel] -- N participants" with a tap-to-return action.
- **Module disabled while in voice:** Force-disconnect all participants. Clean up fr_voice_participants.

## Acceptance Criteria

### User Experience Criteria
- [ ] **AC-1:** Community mods can create voice channels with name, description, and max participants
- [ ] **AC-2:** Members can see voice channels in the community detail with participant count and names
- [ ] **AC-3:** Tapping "Join" requests mic permission and connects to the voice channel
- [ ] **AC-4:** Participant grid shows avatars with display names for all connected users
- [ ] **AC-5:** Green glowing ring appears around a participant's avatar when they are speaking
- [ ] **AC-6:** Mute button toggles mic and shows mute icon on the user's avatar for all participants
- [ ] **AC-7:** Deafen button silences all incoming audio for the user
- [ ] **AC-8:** Disconnect button leaves the channel and closes all peer connections
- [ ] **AC-9:** Full channel shows "Channel full (N/N)" with join disabled
- [ ] **AC-10:** Floating mini-bar persists while navigating other forum screens during voice
- [ ] **AC-11:** Voice continues in background on mobile with persistent notification

### Technical Criteria
- [ ] **TC-1:** WebRTC signaling uses Supabase Realtime Broadcast (no external TURN/STUN beyond public servers)
- [ ] **TC-2:** Mesh topology establishes peer connections between all participants
- [ ] **TC-3:** Voice Activity Detection runs locally with < 100ms latency for speaking indicators
- [ ] **TC-4:** fr_voice_participants rows are created on join and deleted on disconnect
- [ ] **TC-5:** Stale participants are cleaned up by server cron within 60 seconds of disconnect
- [ ] **TC-6:** Audio latency is < 200ms between participants on the same continent
- [ ] **TC-7:** Client-side noise suppression is available as a toggle
- [ ] **TC-8:** Voice channel RLS restricts creation to moderators and visibility to community members (or public communities)

### Negative Criteria
- [ ] **NC-1:** Voice audio must NOT be recorded or stored server-side (privacy-first)
- [ ] **NC-2:** Non-community-members must NOT be able to join private community voice channels
- [ ] **NC-3:** Voice channels must NOT exceed max_participants limit
- [ ] **NC-4:** Joining voice must NOT be possible without microphone permission

## UI Specification

### Mobile (Expo)

- Background: `#0A0A0F` (background token)
- Voice channel card in community: `rgba(255,255,255,0.04)` glass, voice icon (headphones) in `#F43F5E`, participant count, small stacked avatars of active participants
- Voice room screen: dark background, participant grid centered
- Avatar tiles: 80px circles, `rgba(255,255,255,0.08)` background, display name below
- Speaking ring: 3px `#30D158` (success green) animated glow around avatar
- Muted icon: small mic-off overlay at bottom-right of avatar tile
- Control bar: fixed bottom, `rgba(255,255,255,0.08)` glass background, 3 circular buttons (48px): Mute (mic icon), Deafen (headphones icon), Disconnect (`#FF453A` danger red, phone-off icon)
- Floating mini-bar: `rgba(255,255,255,0.08)` glass, 48px height, fixed at top below status bar, green dot + channel name + participant count + tap target
- Background notification: iOS/Android persistent notification with channel name and "Tap to return"

### Web (Next.js)

- Same tokens via CSS variables
- Voice room at `/forums/voice/[channelId]`
- Participant grid: responsive CSS grid (auto-fill, min 120px tiles)
- Control bar: centered at bottom of voice room
- Floating mini-bar: fixed bottom-left corner, rounded pill shape
- Push-to-talk: spacebar hold (alternative to VAD)

### State Coverage

| State | What User Sees | Trigger |
|-------|---------------|---------|
| Loading | "Connecting to voice..." spinner with waveform animation | Join tapped, signaling in progress |
| Empty | Voice channel card with "0 participants -- Join" | No one in channel |
| Error | "Could not connect to voice. Check your network." with retry | WebRTC failure |
| Success | Participant grid with live speaking indicators and controls | Connected |
| Partial | Connected but some participants show "reconnecting" overlay | Peer connection issues |

## Test Requirements

### Unit Tests
- [ ] Signaling message serialization/deserialization: SDP offer/answer, ICE candidate
- [ ] VAD threshold detection: correctly identifies speech vs silence
- [ ] Participant grid layout: 2x2 for 2-4, 3x3 for 5-9, scroll for 10+
- [ ] Channel capacity check: rejects join when at max_participants
- [ ] Mute state toggle: correctly updates local stream and broadcast

### Integration Tests
- [ ] Full flow: create channel -> User A joins -> User B joins -> both hear each other -> User A disconnects
- [ ] Speaking detection: User A speaks -> User B sees speaking indicator with < 500ms delay
- [ ] Capacity flow: fill channel to max -> next user sees "Channel full" -> someone leaves -> next user can join
- [ ] Reconnection: simulate network drop -> "Reconnecting..." -> network restored -> audio resumes

### QA Verification Script

1. Open the app on two devices (User A is mod, User B is member)
2. User A: navigate to a community, go to community settings
3. User A: create a voice channel named "General Voice" with max 10 participants
4. Verify: voice channel card appears in community detail -- corresponds to AC-1, AC-2
5. User A: tap "Join" on the voice channel
6. Verify: microphone permission dialog appears -- corresponds to AC-3
7. Grant permission
8. Verify: voice room screen opens with User A's avatar in the grid -- corresponds to AC-4
9. User B: navigate to same community, see the voice channel showing "1 participant"
10. User B: tap "Join"
11. Verify: both users appear in the participant grid -- corresponds to AC-4
12. User A: speak into microphone
13. Verify on User B: User A's avatar shows green glowing ring -- corresponds to AC-5
14. User A: tap Mute button
15. Verify: mute icon appears on User A's avatar for both users -- corresponds to AC-6
16. User A: speak while muted
17. Verify: no speaking indicator, no audio heard by User B
18. User A: tap Deafen
19. Verify: User A cannot hear User B -- corresponds to AC-7
20. User A: navigate to another forum screen (e.g., a thread)
21. Verify: floating mini-bar shows "Connected to General Voice -- 2 participants" -- corresponds to AC-10
22. User A: tap the mini-bar
23. Verify: returns to voice room screen
24. On mobile: put User A's app in background
25. Verify: persistent notification appears, voice continues -- corresponds to AC-11
26. User A: tap Disconnect
27. Verify: User A leaves, User B sees participant count drop to 1 -- corresponds to AC-8

## gstack Quality Gates

### Required for ALL features:
- [ ] `/function-gate-runner` -- run after code changes, must pass
- [ ] `/review` -- run on the diff before merge, fix all AUTO-FIX items

### Required if this feature has UI:
- [ ] `/browse` -- navigate to voice channel, join, verify controls and participant grid
- [ ] Batch QA: after 5 features in forums module, run `/qa` on the module URL

### Required if Complexity <= 2 (Large/Complex):
- [ ] `/plan-eng-review` -- run on this spec before building (Complexity = 0, mandatory)

### Required if Complexity <= 1 (Complex/Massive):
- [ ] `/office-hours` (builder mode) -- validate approach before spec finalization (Complexity = 0, mandatory)

### Required if this feature contains business logic / calculation engine:
- [ ] `/domain-engine-benchmarker` -- generate eval suite for signaling and VAD engine

### Post-merge (handled by sprint lead):
- [ ] Sprint-level: `/retro`, `/ship`, `/document-release`

## Handoff State

### Before This Work
No voice capability exists in the forums module. Communities are text-only with threads and replies. Real-time updates (if built) provide the Supabase Realtime infrastructure but no audio.

### After This Work
Full voice channel system: persistent voice rooms per community, WebRTC mesh audio, real-time speaking indicators via VAD, mute/deafen/disconnect controls, participant grid UI, background audio on mobile, floating mini-bar for persistent voice during navigation, and server-side stale participant cleanup.

### Files Changed
- `modules/forums/src/types.ts` -- Added VoiceChannel, VoiceParticipant, VoiceState schemas
- `modules/forums/src/cloud/schema.sql` -- Added fr_voice_channels, fr_voice_participants tables
- `modules/forums/src/cloud/client.ts` -- Added voice channel CRUD and participant management
- `modules/forums/src/cloud/realtime.ts` -- Added voice signaling Broadcast channels
- `modules/forums/src/voice/signaling.ts` -- WebRTC signaling via Supabase Realtime
- `modules/forums/src/voice/peer-manager.ts` -- RTCPeerConnection lifecycle management
- `modules/forums/src/voice/audio-engine.ts` -- Audio capture, noise suppression, VAD
- `modules/forums/src/definition.ts` -- Migration for voice tables
- `apps/mobile/app/(forums)/voice-channel.tsx` -- Voice room screen
- `apps/mobile/app/(forums)/components/VoiceChannelCard.tsx` -- Voice channel entry card
- `apps/mobile/app/(forums)/components/VoiceParticipantGrid.tsx` -- Participant grid
- `apps/mobile/app/(forums)/components/VoiceControls.tsx` -- Mute/deafen/disconnect toolbar
- `apps/web/app/forums/voice/[channelId]/page.tsx` -- Web voice room
- `apps/web/app/forums/components/VoiceChannelCard.tsx` -- Web voice card
- `apps/web/app/forums/components/VoiceParticipantGrid.tsx` -- Web participant grid
- `apps/web/app/forums/components/VoiceControls.tsx` -- Web voice controls

### Known Limitations
- Mesh topology limits practical group size to ~8-10 for good quality; SFU needed for larger groups
- No screen sharing in v1 (audio only)
- No voice recording or transcription
- No push-to-talk on mobile (VAD only; push-to-talk is web-only via spacebar)
- STUN/TURN servers: v1 uses public Google STUN servers (`stun.l.google.com:19302`). For NAT-heavy networks, a self-hosted TURN server will be needed
- No voice moderation tools (server mute, force disconnect) in v1

### Context for Next Agent
WebRTC is the most complex technology in this spec. Key risks: NAT traversal (some corporate networks block peer-to-peer), mobile background audio (iOS is restrictive about background audio), and CPU load with many participants. The mesh topology means each participant runs N-1 audio decoders. For v1, keep the default max_participants low (10-15) and document the SFU migration path for future scaling. The `voice/` directory is intentionally separate from `cloud/` because voice logic is client-heavy and doesn't fit the cloud client pattern.
