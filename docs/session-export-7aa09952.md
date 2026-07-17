# Session Export: Receipts Filter Overhaul
**Session ID:** 7aa09952-52af-4e6e-915a-71c1d5a1637a
**Exported:** 2026-02-07 23:18
**Total messages extracted:** 89

---

## User

@SH/automation-hub/docs/shiphawk_filters_findings.md - This app is one point of reference for production filters. But we are building this for @receipts/. Receipts needs a massive filter  overhaul on its pages. Dispatch agents on a team to research designs and filters for how websites like Reddit / X / Tiktok / Instagram / Facebook build their algorithms for feeds and sidebars for categories. We want recepts to almost perfectly resemble reddits navigation bar on the left hand side of its main page. Use multiple agents to ensure we have muiltiple people verifying the deisgn plan so the requirements are extremely clearly

---

## Assistant





---

## Assistant

I'll dispatch a team of agents in parallel to thoroughly research platform designs and the current Receeps codebase. This will give us multiple verified perspectives on the design plan.

---

## Assistant



**Tool calls:**
[Task: Research Reddit sidebar/nav design]

---

## Assistant



**Tool calls:**
[Task: Research X/TikTok feed algorithms]

---

## Assistant





---

## Assistant



**Tool calls:**
[Task: Research Instagram/Facebook navigation]

---

## Assistant



**Tool calls:**
[Task: Explore Receeps frontend codebase]

---

## Assistant



**Tool calls:**
[Task: Research Reddit algorithm/ranking]

---

## Assistant



Good — all 5 agents are now dispatched and working in parallel:

| Agent | Focus Area | Status |
|-------|-----------|--------|
| 1 | Reddit sidebar/navigation design (visual structure) | Running |
| 2 | X (Twitter) + TikTok feed & navigation patterns | Running |
| 3 | Instagram + Facebook sidebar & feed design | Running |
| 4 | Receeps current codebase exploration (frontend + backend) | Running |
| 5 | Reddit ranking algorithms & content discovery | Running |

I'm waiting for all agents to complete their research. Once they all report back, I'll synthesize everything into a unified, verified design requirements document for the Receeps filter overhaul with Reddit-style navigation.

---

## User

<task-notification>
<task-id>acb27f0</task-id>
<status>completed</status>
<summary>Agent "Explore Receeps frontend codebase" completed</summary>
<result>Perfect! Now I have all the information I need. Let me create a comprehensive analysis report:

---

## Comprehensive Receeps Frontend & Backend Architecture Analysis

### CURRENT ROUTING & PAGES

**Frontend Routes (React Router):**
- `/` - Home page
- `/receipts` - Receipts home listing page
- `/receipts/:receiptId` - Receipt detail page  
- `/receipts/:receiptId/comments` - Receipt comments page
- `/topics` - Topics home listing page
- `/topics/:topicId` - Topic detail page
- `/topics/category/:categoryName` - Category-filtered topics
- `/receipts/category/:categoryName` - Category-filtered receipts (redirects to query param)
- `/dashboard` - User dashboard (protected)
- `/staff-dashboard` - Staff dashboard (protected)
- `/receipts/new/` - Create new receipt
- `/topics/new/` - Create new topic
- `/notifications/` - Notifications center (protected)
- `/login/`, `/signup/`, `/forgot-password/`, `/reset-password/:uid/:token/` - Auth pages
- `/privacy/`, `/terms/`, `/cookies/` - Legal pages

**Backend API Endpoints:**
- `GET /app/categories/` - List categories (public, cached, 300s)
- `GET /app/topics/` - List topics (cached 300s, filters: category, created_after, has_receipts, receipt_count_min)
- `GET /app/topics/:id/` - Get topic detail (cached 600s)
- `POST /app/topics/` - Create topic (requires auth)
- `GET /receipt/receipts/` - List receipts (filters: source_type, verification_status, category, topic)
- `GET /receipt/receipts/:id/` - Get receipt detail
- `POST /receipt/receipts/` - Create receipt (requires auth)
- `POST /receipt/receipts/:id/verify/` - Verify receipt (staff only)
- `POST /receipt/receipts/:id/attach-topic/` - Attach receipt to topic
- `POST /receipt/receipts/:id/detach-topic/` - Detach receipt from topic
- `GET /receipt/receipts/:id/votes/` - Get votes on receipt

---

### CURRENT NAVIGATION & SIDEBAR

**Header Navigation (HeaderSearch + Profile + Notifications):**
- Logo/home link on left
- "Receeps" link → `/receipts`
- "Topics" link → `/topics`
- "Staff Dashboard" link (staff only) → `/staff-dashboard`
- Search bar (HeaderSearch component)
- Notification icon
- User profile dropdown
- Mobile hamburger menu

**Left Sidebar (EnhancedSidebar - Desktop Only):**
- Located at `/Users/trey/Desktop/Apps/receipts/frontend/src/components/Sidebar/EnhancedSidebar.jsx`
- **Toggle button** - Collapse/expand sidebar (state saved to localStorage)
- **Categories Section** - Shows active category + all categories with icons/colors/topic counts
  - Uses CategorySidebar component
  - Categories fetched from `/app/categories/` API
  - Maps icons: IconBuildingBank, IconAtom, IconDevices, IconHeartbeat, IconBriefcase, IconLeaf, IconMovie, IconClock
  - Each category has: id, name, slug, icon, color (hex), topic_count
- **Filters Section** (collapsible) - Different per page:
  - **On `/receipts` page**: source_type (select), verification_status (select), topics (multiselect)
  - **On `/topics` page**: has_receipts (select), created_after (select), receipt_count_min (select)
- **Sort Section** (collapsible):
  - **For receipts**: Newest/Oldest, Highest/Lowest Credibility, Most/Least Votes, Most/Oldest Source
  - **For topics**: Newest/Oldest, Most/Least Receipts, Most/Least Votes, Name A-Z/Z-A

**Category Sidebar (CategorySidebar.jsx):**
- Standalone component used in both EnhancedSidebar (embedded) and MainLayout
- Shows "All Topics" + category list
- Fetches from `/app/categories/` API (paginated/non-paginated)
- Each category is clickable, shows selected state with border + background color
- Tooltips on collapsed state

**Bottom Navigation (Mobile Only):**
- BottomNav component for mobile devices

---

### CURRENT FILTERING SYSTEM

**Sidebar Filters (App.jsx manages state):**
```
filters = {
  source_type: string,
  verification_status: string,
  topics: string[] (comma-separated in URL),
  category: string (slug in URL),
  has_receipts: boolean,
  created_after: number (days),
  receipt_count_min: number
}
```

**URL Parameter Tracking:**
- Filters stored in URL searchParams
- `?source_type=primary&verification_status=verified&topics=1,2,3&category=politics&ordering=-created_at`
- EnhancedSidebar listens to URL params and reflects current filters
- Category changes navigate to `/receipts?category=slug` or `/topics?category=slug`

**Backend Filter Support:**

**Receipts Filtering (ReceiptFilter in receipt/filters.py):**
- `search` - Text search in title + evidence_text
- `topic` - Filter by topic ID
- `category` - Filter by category slug
- `source_type` - Choice filter (primary, official, news, academic, social, witness, unknown)
- `verification_status` - Choice filter (unverified, pending, verified, disputed, false)
- `submitted_by` - Filter by user ID
- `created_after/created_before` - DateTime filters
- `source_date_after/source_date_before` - DateTime filters
- `min_credibility` - Minimum credibility score
- `is_primary_source` - Boolean filter

**Topics Filtering (TopicFilter in app/topic/filters.py):**
- `category` - ModelChoice filter
- `category_slug` - Char filter
- `has_receipts` - Boolean filter (custom method)
- `created_after` - Custom method: filter by N days (accepts "7", "30", "90", "365")
- `receipt_count_min` - Custom method: filter topics with ≥N receipts
- `submitted_by` - Filter by created_by user ID
- `created_at` - ISO DateTime range filter

**Sorting:**
- Receipts: `ordering_fields = [created_at, updated_at, credibility_score, source_date, vote_count, relevance_avg, reliability_avg]`
- Topics: Automatic ordering by `-created_at`

---

### COMPONENT LIBRARY & UI FRAMEWORK

**Framework:** Mantine v8.1.1

**Core Mantine Components Used:**
- `Paper` - Container/cards
- `Stack`, `Group` - Layout
- `Text`, `Title`, `Badge` - Typography
- `Select`, `MultiSelect` - Dropdowns
- `TextInput` - Text input
- `Button`, `ActionIcon` - Buttons
- `Modal` - Modals
- `Collapse` - Collapsible sections
- `Loader`, `Center` - Loading/centering
- `Divider` - Dividers
- `Drawer` - Mobile drawer
- `Image` - Images
- `Container`, `Box` - Layout containers
- `Breadcrumbs` - Breadcrumbs
- `Card` - Card component
- `Tooltip` - Tooltips
- `UnstyledButton` - Unstyled buttons
- `notifications` - Toast notifications
- `useMediaQuery` hook - Responsive queries

**Icon Library:** @tabler/icons-react (all icons must use this)

**Wrapper Components (frontend/src/components/core/):**
- `ButtonWrapper` - Button wrapper with routing integration
- `TextInputWrapper` - TextInput wrapper
- `ModalWrapper` - Modal wrapper
- `ActionIconWrapper` - ActionIcon wrapper
- `DropZoneWrapper` - File drop zone
- `FilterPanel` - Custom filter panel
- `SortControl` - Sort control component
- `PaginatedFilteredList` - Main list component with pagination/filtering

---

### STATE MANAGEMENT (Redux Toolkit)

**Store Location:** `/Users/trey/Desktop/Apps/receipts/frontend/src/store/store.jsx`

**Redux Slices:**

1. **authSlice** - Auth state
   - `profile` - Current user profile object
   - Actions: `fetchProfile()`, `logout()`

2. **siteConfigurationSlice** - Site config
   - Site-wide configuration
   - Actions: `fetchSiteConfiguration()`

3. **receiptsSlice** - Receipts state
   - `items: []` - Receipt list
   - `selectedReceipt` - Single receipt detail
   - `status: 'idle' | 'loading' | 'succeeded' | 'failed'`
   - `error: null`
   - `activeCategory: 'All'`
   - `selectedCategories: []` - Multiple category selection
   - Thunks: `fetchAllReceipts()`, `fetchReceiptById()`, `fetchReceiptsByCategory()`, `fetchReceiptsByCategories()`
   - Actions: `setActiveCategory()`, `addSelectedCategory()`, `removeSelectedCategory()`, `clearSelectedCategories()`, `setSelectedCategories()`

4. **topicsSlice** - Topics state
   - `items: []` - Topic list
   - `selectedTopic` - Single topic detail
   - `topicReceipts: []` - Receipts for a topic
   - `status: 'idle' | 'loading' | 'succeeded' | 'failed'`
   - `error: null`
   - Thunks: `fetchAllTopics()`, `fetchTopicById()`, `fetchReceiptsForTopic()`, `createNewTopic()`
   - Actions: `clearTopicSelection()`, `clearErrors()`

5. **categoriesSlice** - Categories state
   - `items: []` - Category list
   - `status: 'idle' | 'loading' | 'succeeded' | 'failed'`
   - `error: null`
   - Thunks: `fetchAllCategories()`
   - Actions: `clearErrors()`

**Note:** The old Redux slices are largely unused; most state is managed via URL params and component state (see App.jsx line 44).

---

### CURRENT FEED/LIST PAGES

**ReceiptsHomePage (`/receipts`):**
- Location: `/Users/trey/Desktop/Apps/receipts/frontend/src/components/Pages/ReceiptsHomePage.jsx`
- Shows list of receipts with cards
- Uses old Redux approach (still imports dispatch, Redux slices)
- Shows receipt info: description, date, source, confidence %, keywords, categories, hashtags
- Category filter buttons displayed
- View options: New, Top, Rising, Controversial (buttons exist but may not be functional)
- Filter badges shown below title
- Receipt cards show all metadata inline

**TopicsHomePage (`/topics`):**
- Location: `/Users/trey/Desktop/Apps/receipts/frontend/src/components/Pages/TopicsHomePage.jsx`
- Shows list of topics with configurable views
- **View modes:** Single column, Double column, Grid
- **Sort controls:** Sort type (hot/newest/etc) + Time range
- **Active filters** shown as badges with X to clear
- Uses HomeLayoutx (old layout component)
- Render individual topics as TopicMiniCardx components
- No Redux state used; all state is local

**ReceiptList (inside Dashboard):**
- Location: `/Users/trey/Desktop/Apps/receipts/frontend/src/components/Dashboard/ReceiptList/ReceiptList.jsx`
- Renders PaginatedFilteredList component
- Builds dataUrl with filters from URL params
- Filter config passed from EnhancedSidebar via App.jsx
- No local filters/sort (managed by sidebar)
- Renders each item as ReceiptListItem component

**TopicList (inside Dashboard):**
- Similar structure but for topics

---

### CATEGORIES/TOPICS SYSTEM

**Category Model (Backend):**
```python
class Category(BaseModel):
    name: CharField (unique)
    slug: SlugField (auto-generated from name)
    description: TextField
    icon: CharField (Tabler icon name)
    color: CharField (hex color, e.g., "#FF4500")
    order: IntegerField (for sorting)
    is_active: BooleanField
    
    # Meta: ordered by order, then name
    # Supports icon mapping: IconBuildingBank, IconAtom, IconDevices, etc.
```

**Topic Model (Backend):**
```python
class Topic(BaseModel):
    name: CharField
    ai_summary: TextField
    category: ForeignKey → Category (optional)
    created_by: ForeignKey → User
    
    # Annotated fields in list view:
    # - annotated_receipt_count
    # - confidence_avg
    # - has_verified, has_false, has_pending, has_disputed (counts)
```

**Frontend Usage:**
- Categories displayed in left sidebar with icons, colors, topic counts
- Category selection filters both receipts and topics
- Each category is a clickable button/link
- Active category highlighted with left border and background color
- "All Topics" option shows all categories

---

### LAYOUT STRUCTURE

**App-Level Layout (App.jsx):**
```
<div className="app-wrapper">
  <Header />  {/* Always visible */}
  
  <div className={showSidebar ? "app-with-sidebar" : "app"}>
    {showSidebar && (
      <aside className="app-sidebar">
        <EnhancedSidebar {...props} />
      </aside>
    )}
    
    <main className="app-content">
      <AppRouter />  {/* Routes */}
      <CookieConsentWrapper />
      <DocumentTitle />
    </main>
  </div>
  
  {!isMobile && <Footer />}
  {isMobile && <BottomNav />}
</div>
```

**Sidebar Display Logic:**
- Desktop only (not on mobile)
- Hidden on `/` (home) and `/login/`
- Visible on all other pages
- Collapsible with localStorage persistence

**PaginatedFilteredList Layout:**
```
<Page>  {/* Wrapper component */}
  <Breadcrumbs />
  <Title + Icon>
  <PrimaryAction button>
  <SearchBar />
  <FilterPanel /> (if filterConfig provided)
  <SortControl /> (if sortOptions provided)
  
  <List of items>
    {objects.map(renderItem)}
  </List>
  
  <Pagination controls>
</Page>
```

---

### CSS/THEMING SYSTEM

**Theme File:** `/Users/trey/Desktop/Apps/receipts/frontend/src/theme/reddit-theme.js`

**CSS Variables (frontend/src/index.css):**
```css
/* Backgrounds */
var(--reddit-bg-primary)        /* #0B1416 */
var(--reddit-bg-secondary)      /* #1A282D */
var(--reddit-bg-hover)          /* #2A3F44 */

/* Text */
var(--reddit-text-primary)      /* #D7DADC */
var(--reddit-text-secondary)    /* #818384 */
var(--reddit-text-tertiary)     /* #565758 */

/* Borders */
var(--reddit-border)            /* #343536 */
var(--reddit-border-secondary)  /* #484A4D */

/* Semantic */
var(--reddit-orange)            /* #FF4500 - brand */
var(--reddit-success)           /* #46D160 */
var(--reddit-warning)           /* #FFB000 */
var(--reddit-error)             /* #EA0027 */
var(--reddit-info)              /* #0079D3 */
var(--reddit-upvote)            /* #FF4500 */
var(--reddit-downvote)          /* #7193FF */
var(--reddit-link)              /* #4FBCFF */
```

**Theme Object (reddit-theme.js):**
```javascript
redditTheme = {
  background: { primary, secondary, hover },
  text: { primary, secondary, tertiary },
  border: { primary, secondary },
  primary: { orange, ... }
}
```

**Mantine Theme Integration:**
- Applied via Mantine theme prop in main.jsx
- Component styles use theme vars + CSS variables

---

### API INTEGRATION

**Axios Wrapper:** `/Users/trey/Desktop/Apps/receipts/frontend/src/util/Axios.js`
- All API calls must use this wrapper
- Handles JWT auth, token refresh, CSRF, error notifications
- Built-in caching (default 5 min TTL)
- Cache control: `noCache()`, `shortCache()` (1 min), `longCache()` (30 min)
- Must NOT use raw `fetch()`

**Window URLs Object:**
- `window.urls.receipts` → API endpoint for receipts list
- `window.urls.topics` → API endpoint for topics list
- `window.urls.categories` → API endpoint for categories list
- Set in index.html or injected by Django

**Example API Calls (from codebase):**
```javascript
// Get categories
Axios.get(window.urls.categories)
  .then(({ data }) => {
    const categories = data.results || data
  })

// Get topics with filtering
const response = await Axios.get(`${window.urls.topics}?category=politics&ordering=-created_at`)

// Post new receipt
Axios.post(window.urls.receipts, receiptData)
```

**Paginated Response Format:**
```json
{
  "results": [{...}, {...}],
  "count": 100,
  "next": "http://api/endpoint/?page=2",
  "previous": null
}
```

---

### BACKEND MODELS

**Core Models:**

1. **Category**
   - name, slug, description, icon, color, order, is_active
   - Related: topics (reverse FK)
   - ViewSet: CategoryViewSet (read-only public), StaffCategoryViewSet (admin CRUD)

2. **Topic**
   - name, ai_summary, category (FK), created_by (FK to User)
   - Related: receipts (M2M through ReceiptTopic), votes (generic relation)
   - ViewSet: TopicViewSet (CRUD), StaffTopicViewSet
   - List annotations: receipt_count, confidence_avg, has_verified/disputed/false/pending counts
   - Filters: category, category_slug, has_receipts, created_after, receipt_count_min, submitted_by

3. **Receipt**
   - title, evidence_text, source_url, source_type (choice), source_date
   - verification_status (choice), verification_notes, verified_by (FK), verified_at
   - image, document (file fields)
   - topics (M2M through ReceiptTopic), submitted_by (FK)
   - is_primary_source, credibility_score (0-1 decimal)
   - votes (generic relation)
   - ViewSet: ReceiptViewSet (full CRUD + verify/attach/detach actions)
   - List annotations: vote_count, relevance_avg, reliability_avg, upvote_count, downvote_count, topic_count
   - Filters: search, topic, category, source_type, verification_status, submitted_by, created_after/before, source_date_after/before, min_credibility, is_primary_source

4. **ReceiptTopic** (Through Model)
   - receipt (FK), topic (FK), relevance_score (0-1), added_by (FK)
   - Unique constraint: (receipt, topic)
   - Ordering: by -relevance_score, -created_at

5. **Vote** (Generic)
   - content_type (FK), object_id, content_object (GenericForeignKey)
   - user (FK), relevance (1-5), reliability (1-5), bias (choice)
   - comment (optional), expertise_claimed (boolean)
   - Unique constraint: (content_type, object_id, user)

---

### KEY OBSERVATIONS & DESIGN PATTERNS

1. **URL Parameter-Based Filtering**
   - All filters/sorts stored in URL searchParams for bookmarkability
   - App.jsx is the central state manager
   - EnhancedSidebar observes URL and reflects current state
   - Changes navigate to new URL and update sidebar

2. **Sidebar as Primary Control**
   - Filters/sort moved from individual pages to sidebar
   - Unified UX across receipts/topics pages
   - Categories always visible for quick navigation

3. **Backend Optimization**
   - Extensive use of `select_related()` and `prefetch_related()` in viewsets
   - Annotations for computed fields (vote counts, averages)
   - Caching: 300s for topic list, 600s for detail, conditional on auth
   - Different serializers for list vs detail views

4. **Pagination & Search**
   - StandardResultsSetPagination (Django default)
   - Search via FilterPanel + URL params
   - PaginatedFilteredList component handles pagination UI

5. **Mobile Responsiveness**
   - Sidebar hidden on mobile (only bottom nav)
   - Hamburger menu in header
   - Media query hooks for breakpoints
   - Responsive grid layouts in TopicsHomePage

6. **Icons & Colors**
   - Categories have custom icons (Tabler) + hex colors
   - UI uses CSS variables for theming
   - Reddit dark theme aesthetic

---

### FRONTEND FILE STRUCTURE

```
frontend/src/
├── components/
│   ├── Router/
│   │   ├── AppRouter.jsx          # Route definitions
│   │   ├── routes.js              # Route constants
│   │   ├── LoggedInRoute.jsx
│   │   └── StaffLoggedInRoute.jsx
│   ├── Layout/
│   │   ├── MainLayout.jsx         # Old layout
│   │   └── HomeLayout.jsx         # Old layout
│   ├── Header/
│   │   ├── Header.jsx             # Main header
│   │   ├── HeaderSearch.jsx
│   │   ├── HeaderProfile.jsx
│   │   └── NotificationIcon.jsx
│   ├── Sidebar/
│   │   ├── EnhancedSidebar.jsx    # Main sidebar (filters+sort+categories)
│   │   └── LeftSidebar/
│   ├── Navigation/
│   │   └── BottomNav.jsx          # Mobile bottom nav
│   ├── Category/
│   │   └── CategorySidebar.jsx    # Category listing
│   ├── Pages/
│   │   ├── ReceiptsHomePage.jsx   # /receipts list
│   │   ├── TopicsHomePage.jsx     # /topics list
│   │   ├── TopicPage.jsx          # /topics/:id
│   │   ├── ReceiptPage.jsx        # /receipts/:id
│   │   └── ...other pages
│   ├── Dashboard/
│   │   ├── ReceiptList/
│   │   │   ├── ReceiptList.jsx    # List with pagination
│   │   │   └── ReceiptListItem.jsx
│   │   ├── TopicList/
│   │   └── UserDashboard.jsx
│   ├── core/
│   │   ├── PaginatedFilteredList/
│   │   │   ├── PaginatedFilteredList.jsx
│   │   │   ├── FilterPanel.jsx
│   │   │   ├── SortControl.jsx
│   │   │   └── ListItemCard/
│   │   ├── FilterPanel/
│   │   ├── SortControl/
│   │   ├── ButtonWrapper.jsx
│   │   ├── TextInputWrapper.jsx
│   │   ├── ModalWrapper.jsx
│   │   ├── ActionIconWrapper.jsx
│   │   └── ...other wrappers
│   └── ...other components
├── store/
│   ├── store.jsx                  # Redux store
│   ├── slices/
│   │   ├── authSlice.jsx
│   │   ├── receiptsSlice.js
│   │   ├── topicsSlice.js
│   │   ├── categoriesSlice.js
│   │   └── siteConfigurationSlice.jsx
│   └── actions/
├── api/
│   └── index.js                   # Mock/real API client (old pattern)
├── util/
│   └── Axios.js                   # Axios wrapper (real API)
├── theme/
│   └── reddit-theme.js            # Theme object
├── App.jsx                        # Main app wrapper
└── main.jsx                       # Entry point
```

---

### BACKEND FILE STRUCTURE (RELEVANT)

```
receipts/
├── receipts/
│   ├── urls.py                    # Main URL router
│   └── settings.py
├── app/
│   ├── models.py
│   ├── urls.py                    # Router for categories/topics/etc
│   ├── router.py                  # DRF router registration
│   ├── category/
│   │   ├── models.py              # Category model
│   │   ├── viewsets/viewsets.py   # CategoryViewSet (read-only)
│   │   ├── serializers/
│   │   │   ├── list/list_serializers.py
│   │   │   └── detail/detail_serializers.py
│   │   └── filters.py             # CategoryFilter
│   └── topic/
│       ├── models.py              # Topic model
│       ├── viewsets/viewsets.py   # TopicViewSet (full CRUD)
│       ├── serializers/
│       │   ├── list/list_serializers.py
│       │   ├── detail/detail_serializers.py
│       │   └── create/create_serializers.py
│       ├── filters.py             # TopicFilter (extensive filters)
│       └── ...other files
├── receipt/
│   ├── models.py                  # Receipt, ReceiptTopic, Vote models
│   ├── router.py                  # DRF router (empty)
│   ├── urls.py                    # Web views URLs
│   ├── viewsets/
│   │   ├── receipt.py             # ReceiptViewSet (full CRUD + custom actions)
│   │   └── vote.py                # VoteViewSet
│   ├── serializers/
│   │   ├── list/list_serializers.py
│   │   └── detail/detail_serializers.py
│   ├── filters.py                 # ReceiptFilter, VoteFilter
│   ├── permissions.py             # IsOwnerOrReadOnly, IsStaffForVerification, etc.
│   └── utils.py
├── accounts/
│   ├── models.py                  # User profile model
│   └── serializers.py             # UserBriefSerializer, UserDetailSerializer
├── comments/
│   ├── models.py                  # Comment model
│   └── viewsets.py
├── api/
│   ├── router.py                  # Main router
│   ├── urls.py                    # API URL patterns (versioned)
│   ├── viewsets.py                # ApiItemViewSet
│   └── utils.py                   # Throttling, pagination
└── util/
    ├── cache_utils.py             # Shared caching (invalidate_*_cache functions)
    └── pagination.py              # StandardResultsSetPagination
```

---

This comprehensive overview covers all major aspects of the Receeps architecture. The system is well-structured with clear separation of concerns between frontend routing, state management (URL params + Redux), sidebar controls, backend filtering, and API integration.</result>
<usage>total_tokens: 130754
tool_uses: 38
duration_ms: 111199</usage>
</task-notification>
Full transcript available at: /private/tmp/claude-501/-Users-trey-Desktop-Apps/tasks/acb27f0.output

---

## Assistant





---

## Assistant

The Receeps codebase agent is done with a very thorough analysis. Waiting on the remaining 4 research agents to finish. Let me check their progress.

---

## Assistant



**Tool calls:**
[TaskOutput]

---

## Assistant



**Tool calls:**
[TaskOutput]

---

## Assistant



**Tool calls:**
[TaskOutput]

---

## Assistant



**Tool calls:**
[TaskOutput]

---

## Assistant

All 4 remaining agents are still actively researching — they're deep into multi-query web searches across all platforms. The codebase exploration agent already completed with a comprehensive Receeps architecture map. I'll wait for the remaining agents to finish before synthesizing.

---

## User

<task-notification>
<task-id>a8659dc</task-id>
<status>completed</status>
<summary>Agent "Research X/TikTok feed algorithms" completed</summary>
<result>Now I have comprehensive information to compile a thorough research report. Here is the complete analysis:

---

# UI/UX Research: X (Twitter) and TikTok Feed Systems and Navigation Design

## 1. X (Twitter) -- Left Sidebar Navigation

### Desktop Sidebar Structure

X's desktop interface uses a fixed left sidebar as the primary navigation mechanism. The current sidebar items (as of early 2026) include:

| Position | Item | Icon | Notes |
|----------|------|------|-------|
| 1 | **Home** | House | Default landing; opens the For You / Following feed |
| 2 | **Explore** | Magnifying glass / # | Trending topics, categories, search |
| 3 | **Notifications** | Bell | Mentions, likes, retweets, follows |
| 4 | **Messages** | Envelope | Direct messages |
| 5 | **Grok** | AI icon | AI chatbot assistant (Premium feature, integrated into sidebar) |
| 6 | **Communities** | People group | Topic-based community forums |
| 7 | **Bookmarks** | Bookmark ribbon | Saved posts |
| 8 | **Premium** | X logo / star | Subscription upsell / management |
| 9 | **Profile** | User avatar | User's own profile page |
| 10 | **More** | Ellipsis (...) | Expands to: Lists, Spaces, Monetization, Settings, etc. |

The sidebar also includes a prominent **"Post" button** at the bottom and the user's avatar/handle for quick account switching. The exact items shown vary by account type (free vs. Premium) -- for instance, Grok and some analytics features are gated behind Premium. The sidebar has continued to evolve; as recently as January 2026, X moved a "Video" tab into the main sidebar, indicating ongoing experimentation with navigation hierarchy.

**Design patterns worth noting:**
- Icon + label format (icons alone on collapsed/narrow views)
- Fixed/sticky positioning -- always visible during scroll
- "More" overflow menu for less-used features (Lists, Spaces, Settings, etc.)
- Badge indicators on Notifications and Messages for unread counts

### Right Sidebar ("What's Happening")

On desktop, X also displays a right sidebar containing:
- **Search bar** at the top
- **"What's happening"** trending section (3-5 trending topics)
- **"Who to follow"** suggestions
- **"Show more"** link to expand into the full Explore page
- Footer links (Terms, Privacy, etc.)

Sources:
- [Building a Twitter Sidebar Clone with Material-UI and React](https://blog.openreplay.com/building-a-twitter-sidebar-clone-with-material-ui-and-react/)
- [X Twitter Front UI Layout | Figma](https://www.figma.com/community/file/1324269900712064861/x-twitter-front-ui-layout)
- [How To Change Twitter Layout](https://inspiretothrive.com/how-to-use-the-new-twitter-layout-to-your-advantage/)
- [X Sidebar Toggler - Chrome Web Store](https://chromewebstore.google.com/detail/x-sidebar-toggler/ildpmodfonkfankkljefgibmoanodcab?hl=en)

---

## 2. X (Twitter) -- "For You" vs "Following" Feed Tabs

### Tab Structure

The Home feed is divided into two horizontal tabs at the top of the main content column:

- **"For You"** (default) -- Algorithmically ranked, mixing in-network and out-of-network content
- **"Following"** -- Originally chronological, now also algorithmically ranked

### Critical Change (2025)

X made a significant and somewhat controversial change: the **"Following" feed is no longer purely chronological**. It now uses AI (Grok-powered) to sort posts based on "predicted engagement and relevance to you." This means neither tab offers a true reverse-chronological experience anymore. The Following tab still restricts content to accounts you follow, but the ordering is algorithmic.

### Behavioral Defaults

- X defaults all users to the **"For You"** tab on login
- Content in the Following tab receives **significantly fewer organic impressions** than content surfaced in For You
- The For You tab blends approximately **50% in-network** (people you follow) and **50% out-of-network** (people you don't follow) content

### Design Pattern Implications

This dual-tab approach is a key UX pattern: it gives users the *perception* of control (algorithmic vs. curated) while both feeds are actually algorithmically ranked. The tab switcher uses a simple horizontal pill/underline indicator pattern.

Sources:
- [X Now Algorithmically Ranks Posts in Following Feed](https://www.socialmediatoday.com/news/x-formerly-twitter-sorts-following-feed-algorithm-ai-grok/806617/)
- [How the Twitter Algorithm Works in 2026 - Tweet Archivist](https://www.tweetarchivist.com/how-twitter-algorithm-works-2025)
- [How the Twitter Algorithm Works in 2025 - Sprout Social](https://sproutsocial.com/insights/twitter-algorithm/)
- [How Does the X (Twitter) Algorithm Work in 2025? - QuickFrame](https://quickframe.mountain.com/blog/the-twitter-algorithm/)

---

## 3. X (Twitter) -- Algorithm Ranking and Filtering

### Three-Stage Pipeline

X's recommendation algorithm (partially open-sourced on [GitHub](https://github.com/twitter/the-algorithm)) operates in three stages:

**Stage 1: Candidate Sourcing**
- Scans ~500 million daily tweets
- Narrows to ~1,500 candidate tweets per user per request
- Sources from two pools:
  - **In-network (50%)**: Posts from accounts you follow, ranked by the **Real Graph** model (predicts engagement likelihood between two specific users based on historical interactions)
  - **Out-of-network (50%)**: Posts from accounts you don't follow, surfaced through **SimClusters** and social graph signals

**Stage 2: Ranking**
- A transformer model (now Grok-powered, replacing the original 48M parameter neural network) analyzes thousands of features per tweet
- Predicts probability of: like, retweet, reply, click, media engagement, read time, negative reaction
- Each action type has a different weight in the final score

**Stage 3: Heuristics and Filters**
- Filters out: blocked users, NSFW content (based on settings), already-seen tweets
- Applies diversity rules (e.g., don't show too many tweets from the same author)
- Injects non-organic content (ads, promoted tweets)

### SimClusters (Community Detection)

SimClusters is a foundational component. Key details:
- Uses custom matrix factorization to discover **145,000 communities** of users with shared interests
- Both users and tweets are represented as **vectors** (embeddings) across these 145K dimensions
- Content is matched to users via **approximate cosine similarity** (nearest neighbor lookup)
- Communities are recalculated every three weeks
- This is how out-of-network content ("posts from people you don't follow but might like") gets surfaced

### Key Ranking Signals

| Signal | Weight | Description |
|--------|--------|-------------|
| **Recency** | High | Fresh content gets higher baseline scores; first 30 minutes are critical |
| **Real Graph Score** | Highest (in-network) | Predicts engagement between specific user pairs |
| **SimCluster similarity** | Highest (out-of-network) | Cosine similarity between user and tweet embeddings |
| **Engagement velocity** | High | Early engagement signals quality; tweets gaining traction quickly get wider distribution |
| **Media type** | Medium | Images and videos generally score higher than text-only |
| **Author reputation** | Medium | Account verification, follower count, historical engagement rates |

### Performance

The entire pipeline runs approximately **5 billion times per day** and completes in **under 1.5 seconds on average**.

Sources:
- [Twitter's Recommendation Algorithm - X Engineering Blog](https://blog.x.com/engineering/en_us/topics/open-source/2023/twitter-recommendation-algorithm)
- [GitHub - twitter/the-algorithm](https://github.com/twitter/the-algorithm)
- [Deep Dive: Inside X's Recommendation Algorithm - Medium](https://thegowtham.medium.com/deep-dive-inside-x-fka-twitter-s-recommendation-algorithm-460b2bd4e26a)
- [How the X (Twitter) Recommendation Algorithm Works - ML Digest](https://ml-digest.com/twitter-x-recommendation-engine/)
- [SimClusters README - GitHub](https://github.com/twitter/the-algorithm/blob/main/src/scala/com/twitter/simclusters_v2/README.md)
- [Dive into Twitter's Recommendation System IV - SimClusters](https://happystrongcoder.substack.com/p/dive-into-twitters-recommendation-b83)

---

## 4. X (Twitter) -- Trending, Categories, and Discovery

### Explore Page Structure

The Explore page is organized with horizontal tabs at the top:

| Tab | Content |
|-----|---------|
| **For You** | Personalized trending topics, events, videos based on your interests |
| **Trending** | Top overall trends across the platform (not personalized) |
| **News** | Curated news stories and related tweets |
| **Sports** | Sports-related trending topics and events |
| **Entertainment** | Entertainment/pop culture trends |

Note: Tab availability varies by region.

### Discovery Mechanisms

1. **"What's Happening" sidebar widget** (desktop right sidebar) -- shows 3-5 trending topics with "Show more" expansion
2. **Category pill filters** on the Explore page -- rounded chips for hot topics (e.g., specific people, events, brands)
3. **"Popular today" feed** below the category pills
4. **Grok AI integration** (2025-2026) -- AI-generated topic summaries on the Explore page, providing context for trending topics
5. **Inspiration tool** (Creator Studio) -- real-time research for what content is performing well, filterable by language, region, and engagement type (most-bookmarked, most-shared, etc.)

### Trending Algorithm

Trending topics are determined by a combination of:
- Volume of tweets mentioning a topic
- Velocity of increase (sudden spikes rank higher)
- Geographic relevance
- User's location and language settings
- Personalization based on who you follow and what you engage with

Sources:
- [How to Find Twitter Trends in 2025](https://stackinfluence.com/how-to-find-twitter-trends-in-2025/)
- [Twitter Explore: All You Need To Know](https://www.tweeteraser.com/resources/twitter-explore/)
- [Explore Recommendations - X Help](https://help.x.com/en/resources/recommender-systems/explore-recommendations)
- [New Features on X - Avenue Z](https://avenuez.com/blog/new-features-on-x-an-innovative-transformation-before-2026/)

---

## 5. X (Twitter) -- Bookmarks, Lists, and Filtering Mechanisms

### Bookmarks

- **Access**: Via left sidebar ("Bookmarks") or via the share/bookmark icon on any tweet
- **Search**: Keyword search for bookmarks was added in late 2024
- **Limitations**: No native tagging, categorization, or folder organization. No filtering by date, media type, or engagement metrics. No Boolean search operators.
- **Premium feature**: Bookmark folders were introduced for Premium subscribers, allowing basic folder-based organization

### Lists

Lists are X's most powerful filtering/curation mechanism:

- **Purpose**: Create custom timelines from hand-picked accounts, independent of your main follow graph
- **Access**: Via "More" menu in sidebar, or directly at `/lists`
- **Types**: Public (discoverable by anyone) or Private (visible only to creator)
- **Limits**: Up to 1,000 lists per account, up to 5,000 members per list
- **Key feature**: You do NOT need to follow someone to add them to a list
- **Feed behavior**: Each list produces its own dedicated timeline, separate from Home
- **Discovery**: Users can search for and subscribe to public lists created by others
- **UX pattern**: Lists function as user-curated "channels" -- a manual alternative to algorithmic curation

### Filtering Options on the Main Feed

Native filtering is minimal:
- **For You / Following** tab toggle
- **Mute words** -- hide tweets containing specific words/phrases
- **Mute accounts** -- hide without blocking
- **Content preferences** -- Topics to follow or unfollow, which influence the algorithm
- **"Not interested in this post"** -- per-post feedback that trains the algorithm
- **"Show fewer posts like this"** -- negative signal to the algorithm

Sources:
- [X / Twitter Lists: The Definitive Guide](https://owlead.com/twitter-lists/)
- [What Are Twitter Lists - TweetDelete](https://tweetdelete.net/resources/what-are-twitter-lists-personalize-your-feed-in-5-minutes/)
- [Twitter Bookmarks Suck? Top 10 Pain Points in 2025](https://www.twillot.com/en/blog/twitter-bookmarks-pain-points-2025)
- [Organize Twitter Bookmarks Guide - Dewey](https://getdewey.co/blog/organize-twitter-bookmarks-your-essential-guide/)

---

## 6. TikTok -- Web Navigation and Sidebar Structure

### Web Sidebar Items

TikTok's desktop web app (`tiktok.com`) features a left sidebar with the following structure:

| Position | Item | Icon | Description |
|----------|------|------|-------------|
| 1 | **For You** | Home/play | Default algorithmic feed |
| 2 | **Explore** | Compass | Search and category-based discovery |
| 3 | **Following** | People | Feed from followed accounts only |
| 4 | **Friends** | People (mutual) | Content from mutual follows |
| 5 | **Upload** | Plus (+) | Upload new video content |
| 6 | **LIVE** | Live icon | Live streams from creators |
| 7 | **Profile** | Avatar | User profile |

Below the main navigation, TikTok's sidebar also shows:
- **Suggested accounts** -- Creators TikTok recommends you follow
- **Following accounts** -- Quick access to recently active followed accounts
- **Footer links** -- About, Newsroom, Contact, Careers, etc.

### Design Characteristics

- The web layout mirrors the mobile experience with a repositioned, optimized modular layout
- Navigation bar minimizes distractions and facilitates immersive viewing
- The refreshed "For You" feed is prominently displayed
- LIVE streaming was recently enhanced for desktop, supporting both portrait and landscape modes
- The sidebar is collapsible to maximize content area

Sources:
- [TikTok releases updated desktop layout features - Spike Digital](https://spike.digital/2025/03/07/tiktok-releases-updated-desktop-layout-features/)
- [TikTok User Interface Guide - Itexus](https://itexus.com/understanding-the-tiktok-user-interface-a-guide-to-its-features-and-functionality/)
- [How to Use TikTok Web Login: 2025 Guide](https://gologin.com/blog/how-to-use-tiktok-web-login/)

---

## 7. TikTok -- "For You Page" Algorithm

### Core Philosophy

TikTok's algorithm is fundamentally different from X's in one critical way: **it prioritizes content relevance over creator popularity**. A brand-new account with zero followers can have content reach millions if the algorithm determines it matches user interests. This is the opposite of X's Real Graph model, which heavily weights existing relationships.

### Three Primary Signal Categories

**1. User Interactions (Strongest Signal)**
- Watch time and completion rate (most important single factor)
- Likes, comments, shares, saves
- Videos you skip or scroll past quickly (negative signal)
- Accounts you follow or hide
- Content you create yourself
- Search queries

**2. Video Information (Medium Signal)**
- Captions and text overlays
- Hashtags and keywords
- Sounds and music used
- Effects and filters applied
- Category tags (wellness, tech, fashion, etc. -- added 2025)

**3. Device and Account Settings (Weak Signal)**
- Language preference
- Country/region setting
- Device type
- Account age

### 2025 Algorithm Changes

Key shifts in TikTok's algorithm for 2025:
- **Greater emphasis on search intent and keywords** (query match weighting increased)
- **Longer watch time more heavily rewarded** than in 2024
- **Session depth matters more** -- the algorithm considers what you've already watched in your current session to diversify recommendations
- **Niche authority rewarded** -- consistent posting in a specific topic area boosts distribution

### Content Distribution Funnel

TikTok uses a **tiered distribution model**:

1. **Tier 1**: New video shown to a small test audience (~300-500 users)
2. **Tier 2**: If engagement metrics (completion rate, likes, shares) exceed threshold, expanded to ~1,000-5,000 users
3. **Tier 3**: Further expansion to 10,000-100,000+ if engagement remains strong
4. **Viral tier**: Continued scaling based on sustained performance

This is fundamentally different from X, where distribution is primarily determined by your follower graph and Real Graph scores.

Sources:
- [How does the TikTok algorithm work in 2025 - Hootsuite](https://blog.hootsuite.com/tiktok-algorithm/)
- [How the TikTok Algorithm Works in 2025 - Sprout Social](https://sproutsocial.com/insights/tiktok-algorithm/)
- [TikTok Algorithm Guide 2026 - Buffer](https://buffer.com/resources/tiktok-algorithm/)
- [TikTok Algorithm 2026: How the FYP Really Works](https://beatstorapon.com/blog/tiktok-algorithm-the-ultimate-guide/)
- [TikTok's new owner puts app's algorithm in the spotlight - The Conversation](https://theconversation.com/tiktoks-new-owner-puts-apps-algorithm-in-the-spotlight-a-social-media-expert-explains-how-the-for-you-page-works-265658)

---

## 8. TikTok -- Content Categories, Discovery, and Filtering

### Explore Page

TikTok's Explore page features:
- **Search bar** at the top
- **Trending hashtags and topics** displayed as clickable pills/chips
- **Category-based browsing** by topic areas
- **Trending videos** grid or feed
- **Sound/music discovery** -- browse trending audio clips

### Content Organization Features

**Collections (Folders for Saved Content)**
- Users can create named collections (up to 30 characters per name)
- Videos can be saved directly to a collection via the bookmark icon
- Videos can be moved between collections
- Organization strategies: by topic, by priority (Watch Urgently, Study Later), or by project
- Example folder names: "Quick Breakfasts," "Dance Trends," "Productive Tips"
- This is significantly more capable than X's native bookmark system

**Smart Keyword Filters (2025)**
- AI-powered content filtering that blocks content matching specified keywords
- Automatically extends to synonyms and related terms
- Users can see which additional keywords are being filtered and selectively enable/disable them

**Manage Topics (2025)**
- New feature allowing users to explicitly declare interest in topic areas (animal history, science, etc.)
- Influences For You page content mix

### Filtering and Sorting

Native filtering is limited compared to traditional content platforms:
- **Feed tabs**: For You / Following / Friends (primary filter mechanism)
- **Content preferences**: Long-press on a video to access "Not interested"
- **Keyword filters**: Smart Keyword Filters for blocking unwanted content
- **Search filters**: When searching, filter by: Top, Users, Videos, Sounds, LIVE, Hashtags
- **No chronological option**: TikTok has never offered a true chronological feed for its For You page

Sources:
- [More ways to discover new content - TikTok Newsroom](https://newsroom.tiktok.com/en-us/more-ways-to-discover-new-content-and-creators-you-love)
- [TikTok Favorites Complete Guide 2025 - Dewey](https://getdewey.co/blog/tiktok-favorites-export/)
- [Organizing TikTok Saved Posts - Dewey](https://getdewey.co/blog/organizing-tiktok-saved-posts/)
- [Social search: How to Optimize for Discoverability on TikTok - SkedSocial](https://skedsocial.com/blog/social-search-how-to-optimize-for-discoverability-on-tiktok-and-instagram-2025)

---

## 9. Cross-Platform Patterns and Extractable Design Insights

### Common Navigation Patterns

| Pattern | X (Twitter) | TikTok | Applicability to Content Verification |
|---------|-------------|--------|--------------------------------------|
| **Left sidebar** | Fixed, icon+label | Collapsible, icon+label | Standard for desktop web apps; well-understood UX |
| **Dual feed tabs** | For You / Following | For You / Following / Friends | Gives users control perception; separates discovery from curation |
| **Explore/Discovery hub** | Explore page with category tabs | Explore page with trending content | Central place for serendipitous discovery |
| **Right sidebar** | Trending + suggestions | Suggested accounts | Secondary discovery surface |
| **Bookmarks/Collections** | Basic (folders for Premium) | Rich (named collections, move between) | Save-for-later is essential; folders/tags improve utility |
| **Search** | Full-text + filters | Search + category filters | Core discovery mechanism |

### Personalization vs. Chronological Ordering

| Aspect | X | TikTok |
|--------|---|--------|
| Default feed | Algorithmic (For You) | Algorithmic (For You) |
| Chronological option | Previously available in Following, now removed | Never offered |
| User control | Mute words, topics, "not interested" feedback | Keyword filters, "not interested," topic management |
| Transparency | Partially open-sourced algorithm | Opaque; only general descriptions published |
| Industry trend | Every major platform has moved away from chronological as default; only Bluesky offers chronological as default in 2025 |

### Key UX Patterns: Discovery vs. Consumption

**Discovery Patterns (finding new content):**
1. **Algorithmic feed as default** -- both platforms make discovery the primary experience, not the followed/subscribed feed
2. **Trending/viral surfaces** -- dedicated sections for what's popular right now (X's "What's Happening," TikTok's Explore)
3. **Category-based browsing** -- X uses Explore tabs (News, Sports, Entertainment); TikTok uses hashtag/topic categories
4. **AI-generated summaries** -- X now uses Grok to summarize trending topics; TikTok uses AI for smart keyword matching
5. **Social proof signals** -- both platforms display engagement counts (likes, shares, comments) as discovery signals
6. **"Who to follow" suggestions** -- sidebar recommendations based on your graph and interests

**Consumption Patterns (engaging with content you've found):**
1. **Infinite scroll** -- both platforms use endless feed pagination
2. **In-line engagement** -- like, reply, share, bookmark without leaving the feed
3. **Save/bookmark for later** -- both platforms support saving; TikTok's collection system is more mature
4. **Quick negative feedback** -- "Not interested" or "Show fewer like this" to train the algorithm
5. **Content type mixing** -- X mixes text, images, video, links; TikTok is video-only but mixes short and long form

### Extractable Patterns for a Content Verification Platform (Receeps)

Based on this research, here are the most relevant patterns that could apply:

**1. Dual-Feed Architecture**
- **"For You" (Discovery)**: Algorithmically surfaced topics/items/conclusions based on user interests, engagement history, and trending verification activity
- **"Following" (Curated)**: Content from users/topics the user explicitly follows, still algorithmically ranked by relevance

**2. Left Sidebar Navigation**
Recommended structure for a verification platform:
- Home (feed)
- Explore/Discover (trending topics, categories)
- Notifications
- Bookmarks/Saved
- My Topics (subscribed topics)
- Profile
- More (settings, etc.)

**3. Trending/Discovery Section**
- "What's Being Verified" -- trending topics with high verification activity
- Category filters (News, Science, Politics, Health, etc.)
- AI-generated summaries of verification consensus

**4. Content Organization**
- Collections/folders for saved items (modeled on TikTok's superior implementation)
- Lists of trusted contributors (modeled on X's Lists feature)
- Topic subscriptions (modeled on both platforms' topic following)

**5. Engagement-Quality Feedback Loop**
- X's Real Graph concept adapted for verification: weight content from users whose verifications you've historically found valuable
- TikTok's tiered distribution concept adapted: new verification claims shown to a small expert audience first, then expanded based on quality signals

**6. Filtering Mechanisms**
- Per-topic filters (verified, disputed, pending)
- Time-range filters (unlike social media, verification benefits from chronological options)
- Confidence-level sorting (unique to verification)
- "Not interested" and "Show fewer like this" feedback mechanisms

**7. Key Differentiation Opportunity**
Both X and TikTok optimize for **engagement** (time on platform, likes, shares). A content verification platform should optimize for **accuracy and trust**. This means:
- Weighting expert engagement over popular engagement
- Providing chronological options (neither X nor TikTok effectively offer this anymore)
- Transparency in ranking (what signals determine content order)
- Quality signals (evidence count, source diversity, expert consensus) over popularity signals (likes, shares)

Sources:
- [Social media algorithm: 2025 guide - Hootsuite](https://blog.hootsuite.com/social-media-algorithm/)
- [Evolution of Social Media Algorithms - Vista Social](https://vistasocial.com/insights/the-evolution-of-social-media-algorithms-a-2025-guide-for-digital-marketers/)
- [The Algorithm Shift: What Social Platforms Are Prioritizing in 2025 - Emfluence](https://emfluence.com/blog/the-algorithm-shift-what-social-platforms-are-prioritizing-in-2025)
- [Better Feeds: Algorithms That Put People First - Georgetown KGI](https://kgi.georgetown.edu/wp-content/uploads/2025/02/Better-Feeds_-Algorithms-That-Put-People-First.pdf)
- [The Evolution of Social Media Algorithms: From Chronological to Intelligent Feeds - SCIP](https://www.scip.org/news/661348/The-Evolution-of-Social-Media-Algorithms-From-Chronological-to-Intelligent-Feeds-.htm)</result>
<usage>total_tokens: 36910
tool_uses: 16
duration_ms: 212684</usage>
</task-notification>
Full transcript available at: /private/tmp/claude-501/-Users-trey-Desktop-Apps/tasks/a8659dc.output

---

## Assistant





---

## Assistant

Agent 2 (X/TikTok) just completed with excellent findings. 3 of 5 agents are now done. Still waiting on:
- Reddit sidebar/navigation design (Agent 1)
- Instagram/Facebook navigation (Agent 3)
- Reddit ranking algorithms (Agent 5)

---

## User

<task-notification>
<task-id>ad2ac97</task-id>
<status>completed</status>
<summary>Agent "Research Instagram/Facebook navigation" completed</summary>
<result>Now I have comprehensive information. Let me compile this into a thorough research document.

---

# Meta Platforms UI/UX Research: Facebook and Instagram Navigation, Feeds, and Filtering Systems

## 1. FACEBOOK DESKTOP SIDEBAR

### 1.1 Sidebar Structure and Sections

Facebook's desktop left sidebar is organized into distinct groupings, top to bottom:

**Top Section (Identity + Primary Navigation):**
- Your profile (avatar + name) -- clicking goes to your profile
- Friends
- Messenger
- Marketplace
- Watch (videos/live streams)
- Memories (On This Day)
- Saved
- Groups
- Events
- Pages (your liked/followed pages)
- Feeds (chronological, non-algorithmic view)

**"See More" Expansion:**
After approximately 8-10 visible items, a blue "See More" link appears. Clicking it reveals additional items such as:
- Fundraisers
- Games / Gaming Video
- Recommendations
- Offers
- Facebook Pay
- Jobs
- Climate Science Center
- Blood Donations
- Other lesser-used features

Clicking "See Less" collapses these back.

**"Your Shortcuts" Section (below main nav):**
- Automatically populated with your most-visited Groups, Pages, and games
- Shows approximately 5 shortcuts by default, with "See More" to expand
- Each shortcut has a circular avatar/icon + label
- Hover reveals a three-dot or dropdown menu with options:
  - "Pin to top" (always show at top of shortcuts)
  - "Sort automatically" (default; ranked by visit frequency)
  - "Hide" (remove from shortcuts list)
- An "Edit" link appears when hovering over the "Your Shortcuts" heading

### 1.2 Grouping and Ordering Strategy

Facebook's sidebar uses a **hybrid static + dynamic** approach:
- **Static items** (News Feed, Friends, Messenger, Marketplace, Watch) are always visible in fixed positions at the top
- **Dynamic items** (Shortcuts) are ordered by usage frequency or explicit pinning
- **Overflow items** use "See More" / "See Less" toggling
- **Customization** via gear icon allows showing/hiding entire sections

### 1.3 Favorites and Feed Filtering

Facebook provides a **Feeds tab** (accessible from sidebar) with sub-tabs at the top:
- **All** -- all posts in chronological order (no algorithmic ranking)
- **Favorites** -- posts from up to 30 accounts you designate as favorites (chronological)
- **Friends** -- only friend posts (chronological)
- **Groups** -- only group posts (chronological)
- **Pages** -- only Page posts (chronological)

The **Home** tab (default landing) uses algorithmic ranking and includes recommended content. The **Feeds** tab is strictly chronological with no recommended/suggested content.

A **Feed Filter Bar** at the top of the Home feed lets you toggle between:
- "Home" (algorithmic, includes recommendations)
- "Favorites" (prioritized accounts)

### 1.4 Facebook Feed Algorithm (2026)

The algorithm uses a four-step process:
1. **Inventory** -- collects all available posts from friends, Pages, Groups, and recommended sources
2. **Signals** -- evaluates hundreds of thousands of signals (who posted, when, relationship strength, content type, device/connection speed)
3. **Predictions** -- predicts likelihood of engagement (like, comment, share, click, hide)
4. **Relevance Score** -- assigns a score to every post; highest scores appear first

Key 2026 developments:
- Up to **50% of Feed** now comes from accounts users do not follow (AI-recommended content)
- **UTIS model** surveys users directly to improve recommendations beyond pure engagement metrics
- Content is categorized as **"Connected"** (friends, followed accounts, joined groups) vs **"Recommended"** (AI-surfaced from unfollowed sources)
- Users can mark posts "Interested" or "Not Interested" to directly train the algorithm
- Feed Preferences allows: prioritize Favorites, Snooze/Unfollow people/Pages/Groups, Reconnect with unfollowed accounts

### 1.5 Group Discovery and Category Browsing

Facebook Groups has a **Discover** section with category-based browsing:
- Categories include: Friends' Groups, Suggested for You, Popular Near You, plus topic categories (Humor, Sports, Tech, Fitness, etc.)
- "See All" link expands to show all available Group categories on a dedicated page
- AI-powered suggestions based on your interests, friends' memberships, and location
- Users can "Hide" suggested groups to train the recommendation system
- Non-personalized discovery available via search in the Feeds tab

### 1.6 Sorting Options

- **Home feed**: Algorithmic (default), no manual sort toggle on the main feed itself
- **Feeds tab**: Chronological by default with sub-filters (All, Favorites, Friends, Groups, Pages)
- **Groups feed**: Individual groups can be sorted by Recent Activity, New Posts
- **No explicit "Top Posts" / "Most Recent" toggle** on the main Home feed anymore; this was replaced by the Home vs Feeds tab distinction

### 1.7 Shortcuts and Pinned Items

- **Your Shortcuts** section in the sidebar shows Groups, Pages, and Games
- Default: 5 most-visited items shown, rest behind "See More"
- Three states per shortcut: **Pinned** (always at top), **Auto-sorted** (by visit frequency), **Hidden**
- Editing is done via hover-to-reveal Edit link or three-dot menu per item
- Pinned items always appear above auto-sorted items

### 1.8 December 2025 Redesign Updates

Major redesign announced December 2025:
- **Bottom tab bar** (mobile) reorganized: Home, Reels, Friends, Marketplace, Notifications, Profile -- all in a single bar
- **Feed format**: Photo galleries now displayed in Instagram-style grid layout
- **Double-tap to like** added (borrowed from Instagram)
- **Search results** displayed in a grid layout with full-screen photo/video viewer
- **Menu design** refreshed for clarity, cleaner notifications
- Overall direction: making Facebook more Instagram-like, targeting Gen Z retention

---

## 2. INSTAGRAM

### 2.1 Desktop Web Sidebar Navigation

Instagram's desktop web version uses a **left sidebar** (introduced in the 2022 web redesign, refined through 2025-2026):

**Sidebar Items (top to bottom):**
1. **Instagram logo** (at top)
2. **Home** (house icon) -- main feed
3. **Search** (magnifying glass icon) -- opens search overlay/panel
4. **Explore** (compass icon) -- discovery grid of content
5. **Reels** (video/clapperboard icon) -- short-form video feed
6. **Messages** (paper plane / chat icon) -- DMs
7. **Notifications** (heart icon) -- activity alerts
8. **Create** (plus icon in square) -- new post creation
9. **Profile** (circular avatar) -- your profile

**Bottom of sidebar:**
10. **Threads** (link to Threads app, when applicable)
11. **More** (hamburger/three-line icon) -- opens menu with:
    - Settings
    - Saved
    - Switch Accounts
    - Log Out

**Sidebar Behavior:**
- The sidebar **collapses to icons only** (no labels) when you are in the Messages section, to give more room to the chat interface
- On narrower browser windows, the sidebar may also collapse to icon-only mode
- **Active state**: The active/selected item uses a **bold/filled icon** compared to the outlined icons for inactive items, plus the label text becomes bold
- Icons are monochrome (black on white / white on dark mode)

### 2.2 Mobile Navigation (2025-2026 "Instagram Tabs" Update)

The mobile bottom navigation was reorganized by Adam Mosseri in late 2025:

**New bottom tab order:**
Home --> Reels --> DMs --> Search --> Profile

Key changes:
- **Create (+) button** moved from bottom bar to **top-left corner**
- **Activity/Notifications (heart)** moved to **top-right corner**
- **DMs moved to center** of bottom bar (previously top-right)
- **Horizontal swipe** between tabs now supported
- Shopping tab removed entirely

### 2.3 Explore and Discovery

**Explore Page Structure:**
- Grid layout of recommended photos and videos
- Mix of large and small tiles (1 large + 4 small in a repeating pattern)
- Category pills/chips at the top for topic filtering (e.g., "Music," "Food," "Travel," "Style," "Sports")
- AI groups content into **micro-niches** rather than broad categories (e.g., "home workout routines for beginners" instead of just "fitness")

**Algorithm for Explore:**
1. **Candidate Generation**: Pulls thousands of posts based on past Explore behavior, engaged topics, and similar users' trends
2. **Ranking**: Each candidate scored on predicted engagement
3. **Filtering**: Removes guideline violations, low-quality content, and overly similar recent content

**Ranking Signals for Explore:**
- Post popularity (likes, comments, shares)
- Similarity to user's established interests
- Timeliness/recency
- Content type preferences

### 2.4 Instagram Feed Algorithm (2026)

Instagram uses **separate algorithms** for each surface (Feed, Stories, Reels, Explore):

**Feed Ranking Signals (in order of importance):**
1. **Your activity** -- what you have liked, shared, saved, commented on
2. **Information about the post** -- popularity, timing, location, duration
3. **Information about the poster** -- your interaction history with them
4. **Your interaction history** -- how often you engage with this person's content

**Key predictions the algorithm makes:**
- How long will you spend looking at the post?
- Will you like, comment, share, or save it?
- Will you tap on the profile?

**Strongest signals in 2026:** Watch time, shares, saves, likes, and meaningful interactions (comments/replies). Speed of initial engagement matters. Return visits amplify ranking.

### 2.5 Feed Filtering Options

Instagram provides three feed views accessible via a dropdown at the top of the Home feed:

1. **For You** (default) -- algorithmically ranked, includes recommended content from unfollowed accounts
2. **Following** -- chronological feed showing only posts from accounts you follow
3. **Favorites** -- chronological feed showing only posts from accounts you have starred as favorites

**Favorites management:**
- Users can mark any followed account as a Favorite
- Favorite accounts get a star badge
- Posts from Favorites also get **priority in the algorithmic "For You" feed**

### 2.6 "Your Algorithm" Controls (December 2025)

A major new feature giving users direct control over algorithmic recommendations:

- Accessible via an icon (two lines with hearts) in the **upper right corner of the Reels tab**
- Shows an **AI-generated summary** of your interests (e.g., "Lately you've been into creativity, sports hype, fitness motivation, and skateboarding")
- Displays a **full list of detected topics** you can:
  - **Boost** (see more of this topic)
  - **Mute** (see less of this topic)
  - **Replace** (swap for a different topic)
  - **Add** new topics manually
- Personalized to each user (not generic categories like TikTok)
- Currently Reels only; planned expansion to Explore and other surfaces
- Users can **share their interest categories to Stories** (social/viral feature)

### 2.7 Stories and Reels Integration in Navigation

**Stories:**
- Appear as circular avatars at the top of the Home feed (both mobile and desktop)
- Your own story creation is the first circle (with a "+" badge)
- Tapping opens full-screen story viewer with tap-to-advance
- No dedicated navigation tab; always pinned to the top of Home

**Reels:**
- Has its own dedicated tab in both mobile bottom bar and desktop sidebar
- Full-screen vertical scroll interface
- "Your Algorithm" controls accessible from Reels tab
- Reels also appear interspersed in the Home feed and Explore grid

---

## 3. KEY PATTERNS APPLICABLE TO A REDDIT-LIKE SIDEBAR

### 3.1 Sidebar Grouping Strategies

| Strategy | Facebook | Instagram | Recommendation |
|----------|----------|-----------|----------------|
| **Static primary nav** | Top section: Profile, Feed, Friends, Marketplace, Watch, Groups | Home, Search, Explore, Reels, Messages, Create, Profile | Use fixed top section for core navigation (Home, Explore, Create, Profile) |
| **Dynamic shortcuts** | "Your Shortcuts" auto-populated by usage frequency | N/A (no equivalent) | Add a "Your Communities" section ranked by visit frequency |
| **Pinned items** | Users can pin Groups/Pages to top of shortcuts | Favorites list for feed filtering | Allow users to pin/favorite subreddit-equivalents |
| **Overflow with See More** | Shows 5 shortcuts, "See More" expands full list | "More" menu at sidebar bottom for Settings, Saved, etc. | Show top 5-8 communities, "See More" for rest |
| **Collapsible sections** | Sections can be shown/hidden via gear icon | Sidebar collapses to icons in Messages view | Allow collapsing sections; auto-collapse on narrow screens |

### 3.2 Personalization vs Discovery Balance

**Facebook's approach:**
- Home feed = algorithmic + recommended (discovery)
- Feeds tab = chronological, no recommendations (control)
- Users explicitly choose which mode they want
- Up to 50% recommended content in Home

**Instagram's approach:**
- "For You" = algorithmic + recommended (discovery)
- "Following" = chronological, only followed accounts (control)
- "Favorites" = chronological, curated subset (focused control)
- "Your Algorithm" = direct topic-level customization

**Pattern for Receeps:** Offer a default algorithmic/trending feed alongside a "Following" (subscribed topics only) and "Favorites" (pinned topics) view. Add topic-level customization similar to Instagram's "Your Algorithm."

### 3.3 Icon + Label Patterns

**Facebook:**
- Colored/branded icons for each section (blue for profile, green for Marketplace, etc.)
- Full text labels always visible on desktop
- Circular avatars for shortcuts (Groups, Pages)

**Instagram:**
- Monochrome outlined icons (inactive) vs filled/bold icons (active)
- Text labels visible on wide screens, hidden on narrow screens (icon-only mode)
- Consistent icon size (24px equivalent)
- Active item: bold text + filled icon

**Recommended pattern:**
- Use outlined icons for inactive, filled icons for active state
- Always show labels on desktop; icon-only on mobile/narrow
- Keep icons monochrome for clean aesthetic

### 3.4 Active State and Selection Indicators

**Facebook:**
- Active sidebar item gets a **light blue/gray background highlight** spanning the full width
- Left border accent (blue vertical bar) on some versions
- Bold text for active item
- Icon may change color to blue

**Instagram:**
- Active item icon becomes **filled/solid** (vs outlined when inactive)
- Label text becomes **bold**
- No background color change
- Subtle but effective -- the filled-vs-outlined icon distinction is immediately recognizable

**Recommended:** Use Instagram's filled-icon approach combined with a subtle background highlight (light tint of brand color). Bold the label text.

### 3.5 "See More" / Overflow Handling

**Facebook:**
- Shows top 5 shortcuts by default (ranked by visit frequency or pinned status)
- Blue "See More" text link at bottom of section
- Expands in-place to show full list
- "See Less" link to collapse back
- Separate "See More" for main nav items (below the fold)

**Instagram:**
- "More" menu (hamburger icon) at sidebar bottom for secondary actions
- No "See More" for main nav (all items always visible -- there are only ~9)
- Explore uses infinite scroll rather than pagination

**Recommended for community/topic list:**
- Show 5-8 most relevant items
- "See More" link expands inline
- Pinned items always visible above the fold
- Consider a "Recently Visited" dynamic section

### 3.6 Mobile-to-Desktop Responsive Navigation

**Facebook:**
- Desktop: Persistent left sidebar + top header bar + right sidebar (contacts/chat)
- Tablet: Sidebar may collapse; header remains
- Mobile: Bottom tab bar (Home, Reels, Friends, Marketplace, Notifications, Profile) replaces sidebar entirely
- No sidebar on mobile -- everything moves to bottom tabs + hamburger menu

**Instagram:**
- Desktop: Persistent left sidebar with icons + labels
- Medium screens: Sidebar collapses to **icon-only mode** (labels hidden, sidebar narrows)
- Mobile: Bottom tab bar (Home, Reels, DMs, Search, Profile) replaces sidebar
- Create button moves from sidebar to top-left on mobile
- Notifications/Activity moves from sidebar to top-right on mobile

**Recommended responsive strategy:**
1. **Desktop (>1200px)**: Full sidebar with icons + labels + community list
2. **Tablet (768-1200px)**: Collapsed sidebar with icons only; community list in expandable panel
3. **Mobile (<768px)**: Bottom tab bar with 4-5 core items; community list in hamburger menu or swipe-to-reveal drawer

---

## 4. SUMMARY TABLE: FEATURE COMPARISON

| Feature | Facebook | Instagram |
|---------|----------|-----------|
| **Primary nav location (desktop)** | Left sidebar | Left sidebar |
| **Primary nav location (mobile)** | Bottom tab bar (6 items) | Bottom tab bar (5 items) |
| **Sidebar items count** | ~10 visible + See More | 9 fixed items + More menu |
| **Dynamic/personalized section** | "Your Shortcuts" (Groups, Pages, Games) | None in sidebar; Favorites in feed |
| **Pinning mechanism** | Pin to top of Shortcuts | Mark as Favorite (feed-level) |
| **Feed sort options** | Home (algorithmic) vs Feeds (chronological with sub-tabs) | For You / Following / Favorites |
| **Discovery surface** | Groups Discover (category browsing) | Explore (grid with topic chips) |
| **Algorithm transparency** | Feed Preferences; Interested/Not Interested | "Your Algorithm" topic controls |
| **Overflow pattern** | "See More" / "See Less" inline expansion | "More" hamburger menu |
| **Active state indicator** | Blue highlight + bold text | Filled icon + bold text |
| **Responsive collapse** | Sidebar disappears on mobile | Sidebar collapses to icons, then bottom bar |
| **Recommended content %** | Up to 50% of Home feed | ~30% of For You feed |

---

## Sources

- [What Is the Facebook Sidebar - AdvertiseMint](https://www.advertisemint.com/what-is-the-facebook-sidebar/)
- [Facebook Rolls Out New Feed, Search, and Navigation Designs - BetaNews](https://betanews.com/2025/12/10/facebook-rolls-out-new-feed-search-and-navigation-designs/)
- [Facebook Redesign Focuses on Friends, Photos, Marketplace - TechCrunch](https://techcrunch.com/2025/12/09/facebook-redesign-focuses-on-friends-photos-marketplace-and-more/)
- [How the Facebook Algorithm Works in 2026 - PostEverywhere](https://posteverywhere.ai/blog/how-the-facebook-algorithm-works)
- [How the Facebook Algorithm Works in 2026 - Metricool](https://metricool.com/facebook-algorithm/)
- [Facebook Algorithm Explained: 2026 Insights - SocialBee](https://socialbee.com/blog/facebook-algorithm/)
- [Our Approach to Facebook Feed Ranking - Meta Transparency Center](https://transparency.meta.com/features/ranking-and-content/)
- [Facebook Suggested Groups - Meta Transparency](https://transparency.meta.com/features/explaining-ranking/fb-suggested-groups/)
- [Introducing Home and Feeds on Facebook - Meta](https://about.fb.com/news/2022/07/home-and-feeds-on-facebook/)
- [Show, Hide, Edit, Change and Manage Facebook Shortcuts - The Windows Club](https://www.thewindowsclub.com/manage-facebook-shortcuts)
- [How to Add and Remove Shortcuts on Facebook - MakeUseOf](https://www.makeuseof.com/how-to-add-remove-shortcuts-facebook/)
- [Instagram New UI 2025 Explained - ClickAnalytic](https://www.clickanalytic.com/instagram-new-ui-2025-explained/)
- [Instagram Launches New App Navigation System - Minter.io](https://minter.io/blog/instagram-launches-new-app-navigation-system-update/)
- [The New Instagram Layout Explained - TheModems](https://themodems.com/lifestyle/new-instagram-layout-explained-tabs/)
- [Instagram New Tabs Layout 2025 - Inro](https://www.inro.social/blog/instagram-tabs-new-layout-2025)
- [How the Instagram Algorithm Works: 2026 Guide - Buffer](https://buffer.com/resources/instagram-algorithms/)
- [Instagram Algorithm Tips 2026 - Hootsuite](https://blog.hootsuite.com/instagram-algorithm/)
- [How Instagram Explore Page Works: Algorithm Guide 2026 - RecurPost](https://recurpost.com/blog/instagram-explore-page/)
- [Instagram's New "Your Algorithm" Tool - TechCrunch](https://techcrunch.com/2025/12/10/instagrams-new-your-algorithm-tool-gives-you-more-control-over-the-reels-you-see/)
- [Control Your Instagram Feed with Favorites and Following - Instagram Blog](https://about.instagram.com/blog/announcements/favorites-and-following)
- [What's New on Instagram in 2026 - NapoleonCat](https://napoleoncat.com/blog/instagram-new-features-and-updates/)
- [Instagram is Updating Its Web Interface - TechCrunch](https://techcrunch.com/2022/11/08/instagram-is-updating-its-web-interface-to-take-advantage-of-large-screens/)
- [How to Use Instagram Web - Metricool](https://metricool.com/instagram-on-web/)
- [Mark Zuckerberg Teases Return to OG Facebook - TechCrunch](https://techcrunch.com/2025/01/30/mark-zuckerberg-teases-a-2025-return-to-og-facebook/)
- [Facebook Debuts Revamped Friends Tab - TechCrunch](https://techcrunch.com/2025/03/27/facebook-debuts-a-revamped-friends-tab-as-part-of-its-return-to-og-facebook/)
- [Bringing the Magic of Friends Back to Facebook - Meta](https://about.fb.com/news/2025/03/bringing-magic-of-friends-back-to-facebook/)
- [Facebook Feed Filter Bar - Pocket-lint](https://www.pocket-lint.com/apps/news/facebook/156384-facebook-feed-filter-bar-how-to-change-news-feed-to-show-recent-posts-chronologically/)</result>
<usage>total_tokens: 41054
tool_uses: 26
duration_ms: 223730</usage>
</task-notification>
Full transcript available at: /private/tmp/claude-501/-Users-trey-Desktop-Apps/tasks/ad2ac97.output

---

## Assistant





---

## Assistant

4 of 5 agents now complete. Still waiting on:
- Reddit sidebar/navigation design (Agent 1)
- Reddit ranking algorithms (Agent 5)

---

## User

<task-notification>
<task-id>a701edf</task-id>
<status>completed</status>
<summary>Agent "Research Reddit algorithm/ranking" completed</summary>
<result>Now I have a comprehensive picture of both the Reddit algorithms and the Receeps data model. Let me compile the full research document.

---

# Reddit Content Ranking, Filtering, and Discovery Algorithms: Comprehensive Research Report

## Applicability Target: Receeps -- Receipt-Based Evidence Verification Platform

---

## PART 1: Reddit's Sorting/Ranking Algorithms

### 1.1 Hot Ranking

Reddit's "Hot" algorithm is the most historically documented because it was open-sourced when Reddit published its codebase. The original source code lives in the [reddit-archive on GitHub](https://github.com/reddit-archive/reddit/blob/master/r2/r2/lib/db/_sorts.pyx).

**The Formula (from actual Reddit source):**

```python
from math import log

epoch = datetime(1970, 1, 1)

def epoch_seconds(date):
    td = date - epoch
    return td.days * 86400 + td.seconds + (float(td.microseconds) / 1000000)

def hot(ups, downs, date):
    s = ups - downs
    order = log(max(abs(s), 1), 10)       # Logarithmic vote magnitude
    sign = 1 if s > 0 else -1 if s < 0 else 0
    seconds = epoch_seconds(date) - 1134028003  # Seconds since Dec 8, 2005
    return round(order + sign * seconds / 45000, 7)
```

**Key Properties:**

- **Logarithmic vote scaling**: `log10(|score|)` means the first 10 upvotes matter as much as the next 90, which matter as much as the next 900. This prevents massively upvoted posts from permanently dominating.
- **Time component is additive, not decay**: The score does not decrease over time. Instead, newer posts get a higher baseline time component. The constant `1134028003` is the Unix timestamp for December 8, 2005 (an early Reddit date). The divisor `45000` means that approximately every 12.5 hours of age difference is equivalent to a 10x difference in votes.
- **Sign matters**: A net negative score produces a negative hot value, pushing downvoted content to the bottom.
- **No retroactive decay**: Once a post is scored, its hot value is fixed unless new votes arrive. Newer posts simply start with a higher time component.

This is documented in detail by [Amir Salihefendic's analysis](https://medium.com/hacking-and-gonzo/how-reddit-ranking-algorithms-work-ef111e33d0d9) and [Evan Miller's mathematical derivation](https://www.evanmiller.org/deriving-the-reddit-formula.html).

### 1.2 Best Ranking (Comments: Wilson Score; Posts: Machine Learning)

Reddit's "Best" means two fundamentally different things depending on context:

**For Comments -- Wilson Score Confidence Interval:**

Reddit adopted this in 2009, based on [Evan Miller's "How Not to Sort by Average Rating"](https://www.evanmiller.org/how-not-to-sort-by-average-rating.html). The algorithm computes the lower bound of the Wilson score confidence interval for the upvote proportion.

**The Formula:**

```
Given:
  p_hat = upvotes / (upvotes + downvotes)   # Observed positive fraction
  n     = upvotes + downvotes                # Total votes
  z     = 1.281551565545                     # z-score for ~80% confidence

Wilson Lower Bound = (p_hat + z^2/(2n) - z * sqrt((p_hat*(1-p_hat) + z^2/(4n)) / n)) / (1 + z^2/n)
```

From the [reddit-archive _sorts.pyx](https://github.com/reddit-archive/reddit/blob/master/r2/r2/lib/db/_sorts.pyx), the confidence sort uses z = 1.281551565545 (approximately 80% confidence level; Reddit previously used 70%, then adjusted).

**Key Properties:**

- Treats each vote as a sample from a binomial distribution
- A comment with 2 upvotes and 0 downvotes scores LOWER than one with 100 upvotes and 1 downvote, because the small sample provides less confidence
- Automatically penalizes low-sample-size items without needing a minimum vote threshold
- This is the mathematically correct way to compare items with different numbers of ratings

**For Posts (Home Feed "Best" Sort) -- Machine Learning (2021+):**

In July 2021, [Reddit overhauled the "Best" sort for home feeds](https://www.socialmediatoday.com/news/reddit-looks-to-improve-content-discovery-with-algorithm-defined-best-lis/603446/) to use machine learning models rather than the traditional formula. The new system:

- Uses ML to predict what content a user may or may not like
- Takes into account engagement signals: upvotes, downvotes, time spent, comment activity, community activity
- Allows users to give feedback ("show more/fewer posts like this")
- Incorporates personalization based on subscriptions, browsing history, and stated interests

### 1.3 Top Ranking (Time-Windowed)

"Top" is conceptually the simplest: it sorts purely by net score (upvotes minus downvotes) within a specified time window.

**Time Windows:** hour, day, week, month, year, all-time.

**Implementation:**

```
Score = upvotes - downvotes
Filter: post.created_at >= (now - time_window)
Sort: ORDER BY score DESC
```

There is no time decay, no logarithmic scaling, no statistical adjustment. A post with 50,000 net upvotes from 11 months ago will rank above one with 49,999 from yesterday when sorted by "Top: This Year."

In 2016, [Reddit overhauled their vote display algorithm](https://techcrunch.com/2016/12/06/reddit-overhauls-upvote-algorithm-to-thwart-cheaters-and-show-the-sites-true-scale/) to show more accurate (higher) vote counts, after years of aggressive vote fuzzing had compressed displayed scores.

### 1.4 New Ranking (Chronological)

Pure reverse-chronological ordering by submission timestamp:

```
Sort: ORDER BY created_at DESC
```

No scoring or algorithmic adjustment whatsoever. This is the only sort that guarantees every post gets visibility (briefly) regardless of vote counts.

### 1.5 Rising Ranking (Velocity-Based)

"Rising" identifies posts that are gaining traction quickly. While the exact formula is not fully open-sourced, the mechanism is well-understood from behavioral analysis and partial code:

**Core Concept:** Rising measures the rate of upvote accumulation relative to post age, favoring posts that receive many votes in a short period.

**Approximate Logic:**

```
velocity = votes_received / age_in_hours
Filter: post.age < threshold (typically a few hours)
Sort: ORDER BY velocity DESC
```

**Key Properties:**

- Only considers relatively new posts (typically under ~12 hours old)
- Engagement velocity (upvotes per hour in the first 60 minutes) is the primary signal
- A post getting 50 upvotes in its first hour dramatically outranks one slowly accumulating 200 over 24 hours
- Rising is essentially the "audition stage" -- posts that perform well here get promoted to Hot
- The first 1-2 hours are critical; Reddit's algorithm makes approximately 90% of its ranking decision in the first 60 minutes

### 1.6 Controversial Ranking (Magnitude x Balance)

From the [reddit-archive source code](https://github.com/reddit-archive/reddit/blob/master/r2/r2/lib/db/_sorts.pyx):

```python
def _controversy(ups, downs):
    if downs <= 0 or ups <= 0:
        return 0
    magnitude = ups + downs
    balance = float(downs) / ups if ups > downs else float(ups) / downs
    return magnitude ** balance
```

**Key Properties:**

- **Magnitude** = total vote volume (ups + downs). More total votes = higher controversy score.
- **Balance** = ratio of minority to majority votes (always between 0 and 1). A perfect 50/50 split gives balance = 1.0.
- The score is `magnitude ^ balance`. When balance = 1 (perfect split), score = magnitude. When balance is low (lopsided vote), the exponent compresses the magnitude significantly.
- A post with 100 ups and 90 downs (balance = 0.9) scores much higher than one with 200 ups and 10 downs (balance = 0.05).
- Requires both upvotes AND downvotes; if either is zero, score is 0.

---

## PART 2: Reddit's Feed Composition

### 2.1 Home Feed Mixing (Subscribed Subreddits)

According to [Reddit's official documentation on content recommendations](https://support.reddithelp.com/hc/en-us/articles/23511859482388-Reddit-s-Approach-to-Content-Recommendations), the home feed pipeline has multiple stages:

1. **Candidate Generation**: Create an initial list of content from subscribed communities and ML-recommended communities
2. **Filtering**: Remove spam, previously seen content, blocked content, and content from blocked users
3. **Predictive Modeling**: ML models predict engagement likelihood (will the user upvote, comment, spend time reading?)
4. **Sorting and Diversity**: Sort by predicted engagement while enforcing diversity constraints

**Signals used for personalization** (from [Reddit Help](https://support.reddithelp.com/hc/en-us/articles/4402284777364-What-are-home-feed-recommendations)):

- Content-related: upvote/downvote counts, community posted in, comment activity, post type, post age, post flairs
- User-related: content and communities engaged with, voting history, time spent on specific communities, recently visited communities, subscriptions, stated topic interests

### 2.2 Subreddit Weighting in Feed

Reddit's [normalized_hot.py](https://github.com/reddit-archive/reddit/blob/master/r2/r2/lib/normalized_hot.py) from the open-source archive reveals the normalization approach:

- Raw hot scores are not directly comparable across subreddits because a post with 10 upvotes in a 500-member community represents much higher relative engagement than a post with 10 upvotes in a 10-million-member community
- The normalization layer adjusts scores so posts from small and large subreddits compete more fairly
- The code defines `AGEWEIGHTS` including `"classic": 0.0` and `"fresh": 0.15`, controlling how much recency is factored into the normalized score
- A `HOT_PAGE_AGE` constant of 1000 days sets the maximum age for eligible posts

In the modern ML-driven feed, subreddit weighting is primarily determined by the user's historical engagement with each community.

### 2.3 Content Diversity (Deduplication / Anti-Flooding)

Reddit explicitly designs for diversity in feeds:

- The official documentation states they "sort content according to predictions, and to ensure a level of diversity of content in your feeds"
- Previously seen content is filtered out
- The ML pipeline includes a diversity constraint that prevents too many posts from a single subreddit appearing in sequence
- The exact threshold (e.g., max N posts per subreddit per page) is not publicly documented, but empirical observation suggests approximately 2-3 posts from a single large subreddit can appear on a single "page" of the feed before diversity rules kick in

### 2.4 Popular vs All Feeds

Per [Reddit's official help](https://support.reddithelp.com/hc/en-us/articles/360043043552-What-s-the-difference-between-r-all-r-popular-and-my-home-feed):

**r/all:**
- Less filtered feed of the most popular posts across Reddit
- Sexually explicit content is filtered out, but other NSFW content is included
- Users can filter specific subreddits from their r/all view
- Not personalized -- same for all users
- Shows a broader, raw view of platform-wide activity

**r/popular:**
- Algorithmically curated selection of popular content
- Factors: upvotes, post age, engagement metrics
- More filtering than r/all: excludes NSFW communities, heavily controversial content
- Default feed for logged-out users
- Designed to be a "safe" representation of Reddit

**Home Feed:**
- Only for logged-in users
- Content from subscribed communities + ML recommendations
- Fully personalized with the Best sort ML model
- Most engagement signals, most personalization

---

## PART 3: Reddit's Filtering and Discovery

### 3.1 Subreddit-Level Filters

**Flair System:**
- Moderators define post flairs (tags/labels) specific to their subreddit
- Users can filter by flair within a subreddit (tap flair tag or use search)
- Flairs are subreddit-specific -- "Discussion" in r/politics is different from "Discussion" in r/gaming
- Some subreddits require flair for all posts

**Wiki System:**
- Each subreddit can have a wiki with curated reference content
- Wikis serve as persistent knowledge bases outside the time-decayed feed
- Moderator-controlled editing permissions

### 3.2 Search and Filter System

Reddit's search supports structured operators from [Reddit's Available Search Features](https://support.reddithelp.com/hc/en-us/articles/19696541895316-Available-search-features):

| Operator | Purpose | Example |
|----------|---------|---------|
| `author:` | Filter by post author | `author:thisisbillgates` |
| `flair:` | Filter by post flair | `flair:nvidia` |
| `site:` | Filter by link domain | `site:nytimes.com` |
| `self:` | Text posts only | `self:true` / `self:false` |
| `nsfw:` | NSFW filter | `nsfw:yes` / `nsfw:no` |
| `subreddit:` | Limit to subreddit | `subreddit:science` |
| `selftext:` | Search post body | `selftext:vaccine data` |
| `url:` | Search in URLs | `url:arxiv.org` |
| `title:` | Search in titles | `title:"climate change"` |

**Boolean operators:** `AND`, `OR`, `NOT` (case-sensitive). Parentheses for grouping. Quotes for multi-word phrases.

**Sort search results by:** relevance, hot, top, new, comments.

### 3.3 Content Type Filtering

Reddit does not have first-party content-type filters in the UI at the subreddit level in the same way Instagram or TikTok does (e.g., "only show images"). However:

- Flairs often serve as de facto content type filters ("Video", "Image", "Discussion", "Link")
- The `self:true/false` search operator separates text posts from link posts
- Third-party tools and browser extensions add content-type filtering
- Reddit's internal classification does distinguish post types (link, self-text, image, video, gallery, poll)

### 3.4 Multireddits / Custom Feeds

Custom feeds (formerly called multireddits) allow users to create curated collections of subreddits:

- A custom feed aggregates posts from multiple specified subreddits into a single feed
- Does NOT require subscribing to those subreddits (unlike the home feed)
- Custom feeds can be public (shared via URL) or private
- Each custom feed applies the standard sort options (hot, new, top, etc.) across all included subreddits
- Users can create multiple custom feeds for different interests
- Effectively serves as a manual "topic" grouping mechanism

---

## PART 4: Reddit's Category/Topic System

### 4.1 Subreddit Categorization

Reddit categorizes subreddits into a topic taxonomy. Based on [research into Reddit's categorization](https://www.joeyoungblood.com/social-media/how-reddit-categorizes-some-major-subreddits/):

- Reddit sent surveys to moderators to categorize subreddits into **15 master categories**
- The advertising system exposes **29 interest categories across 9 verticals**: Lifestyle, Gaming, Business, Tech, Entertainment, Automotive, Family & Relationships, Art & Design, Sports
- During onboarding, new users see popular subreddits organized by human-readable category names (not subreddit names, which can be opaque)
- Categories are used for the Discover tab, ad targeting, and community recommendations

### 4.2 Community Discovery

Reddit's discovery mechanisms:

- **Discover Tab**: Shows topic bubbles below the search bar; tapping one filters content to that topic. Uses browsing history and community membership to suggest relevant content.
- **"Similar Communities" sidebar**: When viewing a subreddit, Reddit suggests related communities based on user overlap and content similarity.
- **Post-based recommendations (2021+)**: Rather than only recommending communities, Reddit now recommends specific posts from communities the user has not joined, inserted into the home feed.
- **Trending communities**: Surfaced based on rapid growth in subscriptions or activity.

### 4.3 Community Recommendation Approach

According to [Reddit's official recommendation documentation](https://support.reddithelp.com/hc/en-us/articles/23511859482388-Reddit-s-Approach-to-Content-Recommendations):

The recommendation pipeline uses:

1. **Collaborative filtering**: Users who engage with subreddit A also tend to engage with subreddit B
2. **Content similarity**: Communities with similar post content, language, and topics
3. **Graph-based methods**: Heterogeneous graph neural networks model relationships between users, communities, and content
4. **Topic clustering**: DBSCAN and similar algorithms cluster subreddits by content similarity
5. **User signals**: Subscriptions, visit frequency, voting patterns, time spent, stated interests during onboarding

For newer accounts with fewer subscriptions, Reddit's models emphasize recommendations more heavily over subscription-based content.

---

## PART 5: Anti-Manipulation and Trust Mechanisms

### 5.1 Vote Fuzzing

Reddit deliberately obfuscates displayed vote counts:

- Displayed scores include random noise ("fuzzing") to prevent reverse-engineering of anti-cheat mechanisms
- The upvote ratio (percentage) is more accurate than the raw score
- Early votes are hidden entirely for the first few hours to prevent bandwagon effects
- Rapid sequential downvoting of one user's profile is detected and ignored

### 5.2 Score Obfuscation

Reddit hides comment scores for a configurable period (set per-subreddit by moderators, typically 1-2 hours) to prevent early voting from biasing subsequent voters. This is directly relevant to verification platforms where anchoring bias could skew assessments.

---

## PART 6: Applicability to Receeps (Receipt Verification Platform)

Having examined the Receeps data model (Topics with Categories, Receipts with multi-dimensional Votes on relevance/reliability/bias, credibility scores, verification statuses), here is a detailed mapping of Reddit's algorithms to Receeps' verification use case.

### 6.1 Mapping Reddit Voting to Verification Confidence

Receeps already has a richer voting model than Reddit (multi-dimensional: relevance 1-5, reliability 1-5, bias classification). Here is how Reddit's algorithms can enhance this:

**Wilson Score for Credibility (replacing simple averaging):**

The `credibility_score` field on Receipt (currently calculated in `receipt/utils.py`) should use the Wilson score lower bound rather than a simple mean:

```python
import math

def wilson_credibility_score(receipt, z=1.281551565545):
    """
    Compute Wilson score lower bound for receipt credibility.
    Treats reliability votes >= 4 as "positive" and < 4 as "negative".
    z = 1.28 gives ~80% confidence (Reddit's value).
    """
    votes = receipt.votes.all()
    n = votes.count()
    if n == 0:
        return 0.0

    positive = votes.filter(reliability__gte=4).count()
    p_hat = positive / n

    denominator = 1 + z**2 / n
    center = p_hat + z**2 / (2 * n)
    spread = z * math.sqrt((p_hat * (1 - p_hat) + z**2 / (4 * n)) / n)

    return (center - spread) / denominator
```

This means a receipt with 3 votes all rating reliability 5 will score LOWER than one with 50 votes where 45 rate reliability 4+, because the small sample provides less statistical confidence. This is exactly the right behavior for a verification platform.

**Multi-Dimensional Wilson Scores:**

Apply Wilson independently to each vote dimension:
- `relevance_confidence`: Wilson score on relevance votes (threshold: >= 4 is "relevant")
- `reliability_confidence`: Wilson score on reliability votes (threshold: >= 4 is "reliable")
- `consensus_score`: How much agreement exists across voters (inverse of controversy)

### 6.2 Mapping Subreddit Categories to Topic Categories

Receeps already has the `Category` model (with name, slug, description, icon, color, order) and `Topic` model with a foreign key to Category. This directly parallels Reddit's subreddit-to-topic-category relationship.

**Recommended Category Taxonomy** (inspired by Reddit's 15 master categories, adapted for evidence verification):

| Category | Receeps Equivalent |
|----------|--------------------|
| Politics | Politics & Government |
| Science | Science & Research |
| Technology | Technology |
| Health | Health & Medicine |
| Business | Business & Economics |
| Environment | Environment & Climate |
| Social Issues | Social Issues |
| Education | Education |
| Legal | Legal & Law |
| Media | Media & Journalism |
| History | Historical Claims |
| International | International Affairs |

### 6.3 Adapted Sort Algorithms for Receeps

Here are the recommended sort options, mapping Reddit's sorts to verification-specific needs:

**"Most Verified" (adapted from Reddit's Top + Wilson):**

```python
def most_verified_score(receipt):
    """
    Combines verification status, credibility score (Wilson-based),
    and vote volume. Equivalent to Reddit's 'Top' but weighted
    by verification confidence.
    """
    status_weights = {
        'verified': 1.0,
        'pending': 0.5,
        'unverified': 0.3,
        'disputed': 0.2,
        'false': 0.0,
    }
    status_weight = status_weights.get(receipt.verification_status, 0.3)
    credibility = wilson_credibility_score(receipt)  # Wilson lower bound
    vote_count = receipt.votes.count()

    return credibility * status_weight * math.log(max(vote_count, 1) + 1)
```

**"Trending" (adapted from Reddit's Hot):**

```python
def trending_score(receipt):
    """
    Reddit-style hot ranking adapted for receipts.
    Newer receipts with strong positive engagement surface first.
    """
    vote_count = receipt.votes.count()
    avg_reliability = receipt.votes.aggregate(avg=Avg('reliability'))['avg'] or 0
    # Net "positive" = votes with reliability >= 4 minus those < 3
    positive = receipt.votes.filter(reliability__gte=4).count()
    negative = receipt.votes.filter(reliability__lte=2).count()
    s = positive - negative

    order = math.log10(max(abs(s), 1))
    sign = 1 if s > 0 else -1 if s < 0 else 0

    epoch_start = datetime(2025, 1, 1)  # Receeps epoch
    seconds = (receipt.created_at - epoch_start).total_seconds()

    return round(order + sign * seconds / 45000, 7)
```

**"Most Debated" (adapted from Reddit's Controversial):**

```python
def debate_score(receipt):
    """
    Surfaces receipts with high vote volume but divided opinion.
    Adapted from Reddit's controversial = magnitude ** balance.
    """
    votes = receipt.votes.all()
    n = votes.count()
    if n < 3:  # Minimum votes for controversy
        return 0

    # Use reliability dimension: high (4-5) vs low (1-2) ratings
    high_reliability = votes.filter(reliability__gte=4).count()
    low_reliability = votes.filter(reliability__lte=2).count()

    if high_reliability == 0 or low_reliability == 0:
        return 0

    magnitude = high_reliability + low_reliability
    balance = min(high_reliability, low_reliability) / max(high_reliability, low_reliability)

    return magnitude ** balance
```

**"Newest Claims" (Reddit's New):**

```python
# Pure chronological -- simplest
Receipt.objects.order_by('-created_at')
```

**"Rising" (Velocity-Based):**

```python
def rising_score(receipt, hours_window=12):
    """
    Receipts gaining votes rapidly. Adapted from Reddit's Rising.
    """
    cutoff = timezone.now() - timedelta(hours=hours_window)
    if receipt.created_at < cutoff:
        return 0  # Only consider recent receipts

    age_hours = max((timezone.now() - receipt.created_at).total_seconds() / 3600, 0.1)
    recent_votes = receipt.votes.filter(created_at__gte=receipt.created_at).count()

    return recent_votes / age_hours  # Votes per hour
```

**"Needs Review" (unique to verification -- no Reddit equivalent):**

```python
def needs_review_score(receipt):
    """
    Surfaces receipts that have engagement but lack verification.
    Prioritizes high-interest unverified content.
    """
    if receipt.verification_status in ('verified', 'false'):
        return 0  # Already resolved

    vote_count = receipt.votes.count()
    age_days = (timezone.now() - receipt.created_at).days + 1

    return vote_count / age_days  # Interest-to-age ratio for unresolved items
```

### 6.4 Feed Composition for Receeps

Drawing from Reddit's feed pipeline, Receeps should implement a multi-stage feed:

**Stage 1 -- Candidate Generation:**
- Receipts from subscribed/followed topics (equivalent to subscribed subreddits)
- Receipts in the user's preferred categories
- Receipts that are trending across the platform (equivalent to r/popular)

**Stage 2 -- Filtering:**
- Remove already-viewed receipts
- Remove receipts the user has already voted on (or surface them differently)
- Apply user-configured filters (categories, verification status, source type)

**Stage 3 -- Scoring and Ranking:**
- Apply the selected sort algorithm (trending, most verified, most debated, etc.)
- Use the Wilson-based credibility score as a quality signal

**Stage 4 -- Diversity Enforcement:**
- Limit to N receipts per topic per feed page (e.g., max 3 from any single topic)
- Ensure category diversity (don't show 10 politics receipts in a row)
- Mix verification statuses (don't show only verified or only unverified)

### 6.5 Category-as-Subreddit Model

Receeps' existing `Category -> Topic -> Receipt` hierarchy maps cleanly to Reddit's `Topic Category -> Subreddit -> Post` hierarchy:

| Reddit Concept | Receeps Equivalent |
|----------------|-------------------|
| Subreddit | Topic |
| Topic Category | Category |
| Post | Receipt |
| Comment | Comment (already exists) |
| Upvote/Downvote | Multi-dimensional Vote (relevance, reliability, bias) |
| Post Karma | Credibility Score (Wilson-based) |
| Post Flair | Source Type + Verification Status |
| Multireddit / Custom Feed | User-curated topic collections (new feature) |
| r/popular | Platform-wide trending feed |
| r/all | All receipts, minimal filtering |
| Home Feed | Personalized feed from followed topics + recommendations |

### 6.6 Verification-Specific Enhancements Beyond Reddit

Several features should go beyond what Reddit offers, given the verification context:

**Expert Weighting:**
The Vote model already has `expertise_claimed`. Votes from users who claim expertise (and whose expertise is verified) could receive higher weight in the Wilson score calculation. This is analogous to Reddit's moderator-distinguished comments but applied to the voting system itself.

**Source Type Weighting:**
Primary sources and academic papers could receive a base credibility bonus in the scoring algorithm, since the Receipt model already tracks `source_type` and `is_primary_source`.

**Verification Status as a Sort Dimension:**
Unlike Reddit where moderator actions (sticky, lock, remove) are binary, Receeps has a rich verification status field (`unverified`, `pending`, `verified`, `disputed`, `false`). This should be a first-class filter and sort parameter.

**Bias Distribution Visualization:**
The Vote model captures `bias` choices across a political spectrum. Displaying the distribution of bias assessments (e.g., "60% of voters rated this Center, 20% rated Left, 20% rated Right") provides transparency that Reddit's simple up/down system cannot.

---

## Summary of Key Formulas

| Sort | Formula | Use in Receeps |
|------|---------|----------------|
| **Hot** | `log10(|score|) + sign * seconds / 45000` | "Trending" receipts |
| **Wilson Score** | Lower bound confidence interval on p_hat | Credibility score calculation |
| **Controversial** | `magnitude ** balance` where balance = min(up,down)/max(up,down) | "Most Debated" receipts |
| **Rising** | `votes_recent / age_hours` | "Rising" receipts gaining traction |
| **Top** | `upvotes - downvotes` within time window | "Most Verified" with time filters |
| **New** | `ORDER BY created_at DESC` | "Newest Claims" |

---

## Sources

- [Reddit Archive: _sorts.pyx (Hot, Controversial, Confidence)](https://github.com/reddit-archive/reddit/blob/master/r2/r2/lib/db/_sorts.pyx)
- [Reddit Archive: normalized_hot.py](https://github.com/reddit-archive/reddit/blob/master/r2/r2/lib/normalized_hot.py)
- [How Reddit Ranking Algorithms Work -- Amir Salihefendic](https://medium.com/hacking-and-gonzo/how-reddit-ranking-algorithms-work-ef111e33d0d9)
- [Deriving the Reddit Formula -- Evan Miller](https://www.evanmiller.org/deriving-the-reddit-formula.html)
- [How Not to Sort by Average Rating -- Evan Miller](https://www.evanmiller.org/how-not-to-sort-by-average-rating.html)
- [Reddit's Approach to Content Recommendations](https://support.reddithelp.com/hc/en-us/articles/23511859482388-Reddit-s-Approach-to-Content-Recommendations)
- [What Are Home Feed Recommendations -- Reddit Help](https://support.reddithelp.com/hc/en-us/articles/4402284777364-What-are-home-feed-recommendations)
- [r/all vs r/popular vs Home Feed -- Reddit Help](https://support.reddithelp.com/hc/en-us/articles/360043043552-What-s-the-difference-between-r-all-r-popular-and-my-home-feed)
- [Reddit Looks to Improve Content Discovery with Algorithm-Defined 'Best' Listing -- Social Media Today](https://www.socialmediatoday.com/news/reddit-looks-to-improve-content-discovery-with-algorithm-defined-best-lis/603446/)
- [Reddit Overhauls Upvote Algorithm -- TechCrunch](https://techcrunch.com/2016/12/06/reddit-overhauls-upvote-algorithm-to-thwart-cheaters-and-show-the-sites-true-scale/)
- [Reddit's Comment Ranking Algorithm -- Possibly Wrong](https://possiblywrong.wordpress.com/2011/06/05/reddits-comment-ranking-algorithm/)
- [Available Search Features -- Reddit Help](https://support.reddithelp.com/hc/en-us/articles/19696541895316-Available-search-features)
- [How Reddit Categorizes Major Subreddits -- Joe Youngblood](https://www.joeyoungblood.com/social-media/how-reddit-categorizes-some-major-subreddits/)
- [Fix "hot" Algorithm PR -- reddit-archive](https://github.com/reddit-archive/reddit/pull/583)
- [Reddit's Ranking Algorithm for Content Curation -- Niruthi Selva](https://medium.com/@niruthiha2000/reddits-ranking-algorithm-for-content-curation-systems-2daa3f33a14f)
- [Wilson Score Interval -- JS Implementation](https://github.com/msn0/wilson-score-interval)
- [Decay: Famous Sorting Algorithms for Node.js](https://github.com/clux/decay)
- [Examining Algorithmic Curation on Social Media: Reddit's r/popular Feed -- arXiv](https://arxiv.org/html/2502.20491v3)
- [Reddit Help: How Voting Works](https://support.reddithelp.com/hc/en-us/articles/7419626610708-How-does-voting-work-on-Reddit)</result>
<usage>total_tokens: 70921
tool_uses: 47
duration_ms: 324399</usage>
</task-notification>
Full transcript available at: /private/tmp/claude-501/-Users-trey-Desktop-Apps/tasks/a701edf.output

---

## Assistant





---

## Assistant

Excellent — Agent 5 (Reddit algorithms) just completed with actual Python implementations. 4 of 5 done. Just waiting on Agent 1 (Reddit sidebar/nav design) to finish.

---

## Assistant



**Tool calls:**
[TaskOutput]

---

## Assistant

All 5 agents are now complete. Let me synthesize everything into the final verified design requirements document.

---

## Assistant



**Tool calls:**
[Write: /Users/trey/Desktop/Apps/receipts/docs/receeps_filter_overhaul_design_plan.md]

---

## Assistant

All 5 research agents have completed and I've synthesized their findings into a comprehensive design plan. Here's what was produced:

## Research Team Results

| Agent | Focus | Key Findings |
|-------|-------|-------------|
| **1** | Reddit sidebar/nav | Full sidebar structure mapped: 8 global feeds, 6 collapsible sections, collapse-to-hide with hover-to-peek, star-to-favorite pattern |
| **2** | X/Twitter + TikTok | X's 3-stage algo pipeline (SimClusters, Real Graph), TikTok's tiered content distribution, dual-tab For You/Following pattern universal |
| **3** | Instagram + Facebook | Facebook's "Your Shortcuts" with See More/See Less, Instagram's "Your Algorithm" controls, responsive sidebar collapse patterns |
| **4** | Receeps codebase | Full architecture mapped: 5 Redux slices, 8 categories with icons/colors, existing filter system via URL params, Mantine v8.1.1 components |
| **5** | Reddit algorithms | Actual Python code for Hot, Wilson Score, Controversial formulas from Reddit's open-source archive, adapted with verification-specific implementations |

## Design Plan Written

**File:** `receipts/docs/receeps_filter_overhaul_design_plan.md`

**Key design decisions:**

1. **Reddit-style sidebar** with 7 sections: Global Feeds, Create Actions, Categories, Recent, Favorites, Followed Topics, Filters
2. **6 sort algorithms** in the feed toolbar: Hot, New, Top (time-windowed), Rising, Most Debated, Most Verified
3. **Wilson Score credibility** replacing simple averaging (statistically robust for small sample sizes)
4. **New `/explore` page** with category chips + topic discovery grid
5. **3 feed tabs**: For You, Following, Trending
6. **Responsive**: Full sidebar > hidden sidebar with hover-peek > mobile bottom tab bar
7. **5-phase implementation roadmap** (~6 weeks)

The plan cross-references all 5 platforms and highlights Receeps' key differentiator: optimizing for verification accuracy rather than engagement.

---

## User

<task-notification>
<task-id>a1c3814</task-id>
<status>completed</status>
<summary>Agent "Research Reddit sidebar/nav design" completed</summary>
<result>Now I have enough comprehensive research data. Let me compile this into a thorough analysis.

---

# Reddit Left-Hand Sidebar Navigation Design -- Comprehensive Research (February 2026)

## 1. Reddit's Left Sidebar Structure

Based on extensive research across Reddit's help documentation, changelogs, and technology reporting, here is the current structure of Reddit's desktop left-hand sidebar navigation, ordered from top to bottom:

### Primary Navigation (Top Section -- Non-collapsible)
These are the main feed navigation links at the top of the sidebar:

| Item | Description |
|------|-------------|
| **Home** | Your personalized feed of posts from joined communities |
| **Popular** | A feed of the most popular posts on Reddit (excluding NSFW). Note: In a December 2025 A/B test, this was demoted to a footnote position buried below communities ([source](https://piunikaweb.com/2025/12/11/reddit-r-popular-buried-ui-test/)) |
| **Explore** | Access to community discovery, trending topics, and category-based browsing |
| **All** | A less-filtered feed of popular posts across all of Reddit (Note: removed from mobile in late 2025 A/B tests, but remains on desktop) |
| **Reddit Answers** | AI-powered conversational search tool, accessible via left sidebar on desktop. Grew from 1M to 15M weekly active users in 2025 ([source](https://support.reddithelp.com/hc/en-us/articles/32026729424916-Reddit-Answers-Currently-in-Beta)) |
| **Reddit Games** | Centralized feed showcasing games built on Reddit's Developer Platform |
| **News** | Curated news content shared by communities across Reddit |
| **Latest** | Content sorted by "new" to stay current with followed communities |

### Collapsible Sections (Below Primary Nav)

| Section | Contents | Default State |
|---------|----------|---------------|
| **RECENT** | Last 3 recently visited subreddits with a "See All" link | Expanded |
| **FAVORITES** | Communities starred/favorited by the user (via star icon) | Expanded |
| **COMMUNITIES** | Alphabetically-sorted list of up to 250 joined communities | Expanded (scrollable) |
| **CUSTOM FEEDS** | User-created multi-reddit/custom feed groupings | Collapsed |
| **FOLLOWING** | List of redditors the user follows | Collapsed |
| **MODERATION** | Communities the user moderates, plus mod feed and mod queue links | Expanded (if applicable) |

### Bottom Items
| Item | Description |
|------|-------------|
| **Create a Community** | Link to create a new subreddit |
| **Reddit Premium** | Upsell link |

Sources:
- [Reddit Help: How do I access r/all, r/popular, news, latest, or my home feed?](https://support.reddithelp.com/hc/en-us/articles/9124397463572-How-do-I-access-r-all-r-popular-news-latest-or-my-home-feed)
- [Reddit Help: How do I access and manage my communities on the Reddit app?](https://support.reddithelp.com/hc/en-us/articles/5590560923156-How-do-I-access-and-manage-my-communities-on-the-Reddit-app)
- [Reddit Help: Accessing communities you moderate](https://support.reddithelp.com/hc/en-us/articles/15484287252244-Accessing-communities-you-moderate)
- [Reddit Help: Where can I find the list of communities I've joined?](https://support.reddithelp.com/hc/en-us/articles/28620705945620-Where-can-I-find-the-list-of-communities-I-ve-joined)

---

## 2. Navigation Hierarchy

The sidebar follows a clear information hierarchy:

1. **Global feeds** (Home, Popular, Explore, All) -- these are universal entry points, always visible at the top regardless of personalization.
2. **Feature entry points** (Answers, Games, News, Latest) -- product-specific feeds that Reddit is promoting.
3. **Personalized content** (Recent, Favorites, Communities, Custom Feeds, Following) -- user-specific navigation organized into collapsible sections with section headers displayed in uppercase gray text.
4. **Moderation tools** (only visible to moderators).
5. **Actions and upsells** (Create a Community, Reddit Premium) -- at the bottom.

Each section has a **section header label** (e.g., "RECENT", "COMMUNITIES") in small uppercase text, and collapsible sections have a **chevron/caret icon** to toggle visibility. Communities within lists show **circular community avatars** (the subreddit icon) alongside the community name (e.g., "r/technology").

The star icon next to each community allows favoriting, which promotes it to the Favorites section at the top of the personalized area.

---

## 3. Community/Subreddit Browsing

### Sidebar Community List
- Displays up to **250 joined communities** in alphabetical order
- Each community shows its **circular avatar icon** and **display name** (r/name format)
- A **star icon** on hover allows favoriting
- Communities can be clicked to navigate directly to that subreddit

### Explore Communities
- Accessible from the sidebar via the "Explore" link
- Presents communities organized by **high-level topic categories**: Technology, Animals, Sports, History, Hobbies, Art, Gaming, Science, and many more
- Categories appear as **filterable bubbles/chips** at the top of the exploration view
- Browsing methods include:
  - Latest global and local trends
  - Communities related to existing favorites
  - Featured handpicked communities
  - Communities by topic category
- Personalized recommendations based on: current subscriptions, time spent in communities, upvote/downvote history, recently visited communities, and post engagement patterns

### Joining Communities
- From the Explore page or any subreddit page, users click a **"Join" button**
- Joined communities automatically appear in the left sidebar Communities section

Sources:
- [Reddit Help: How do I browse and find communities on the Reddit app?](https://support.reddithelp.com/hc/en-us/articles/17881389378196-How-do-I-browse-and-find-communities-on-the-Reddit-app)
- [Reddit Help: How to join or leave a community](https://support.reddithelp.com/hc/en-us/articles/28621027395220-How-to-join-or-leave-a-community)
- [TechCrunch: Reddit app revamp adds a Discover Tab for finding communities](https://techcrunch.com/2022/02/24/reddit-revamps-with-a-new-discover-tab-for-finding-communities/)

---

## 4. Collapsible Sections

### Sidebar-Level Collapse
The **entire left navigation bar is fully collapsible** (released March 2025):
- A **left-pointing arrow** button at the top of the sidebar collapses the entire panel
- The collapsed state **persists** across navigation (clicking posts, profiles, communities does not re-expand it)
- **Hover-to-peek**: While collapsed, hovering over the sidebar area reveals a temporary overlay showing community lists without permanently expanding the sidebar
- This was described as enhancing "content density" and reducing "cognitive load"

### Section-Level Collapse
Within the expanded sidebar, individual sections (Recent, Favorites, Communities, Custom Feeds, Following, Moderation) can each be **independently collapsed/expanded** using chevron icons next to section headers:
- **Default expanded**: Recent, Favorites, Communities, Moderation
- **Default collapsed**: Custom Feeds, Following (these are secondary organizational tools)
- The Games section (experimental) can be collapsed if users don't want to see it

Sources:
- [Reddit Changelog: March 25, 2025](https://support.reddithelp.com/hc/en-us/articles/35947498837012-Changelog-March-25-2025)
- [Reddit Changelog: December 2, 2025](https://support.reddithelp.com/hc/en-us/articles/43910393846420-Changelog-December-2-2025)

---

## 5. "Create" Actions

### Create Post
- The **"Create Post"** button (often shown with a **"+" icon**) is located in the **top header bar** (the global navigation bar at the very top of the page), not in the left sidebar itself
- It is also present in the **right-hand sidebar** when viewing a specific community page
- On the subreddit page, the Create Post widget appears as a prompt in the right sidebar

### Create Community
- The **"Create a Community"** link is located near the **bottom of the left sidebar**, below all the collapsible community sections
- It is a text link (not a prominent button), positioned as a utility action

Sources:
- [Reddit Help: How do I create a community?](https://support.reddithelp.com/hc/en-us/articles/360043044012-How-do-I-create-a-community)

---

## 6. Sorting & Filtering within Feeds

Sorting and filtering controls live in the **feed content area** (the main content column), **not** in the left sidebar. They appear as a **horizontal toolbar/pill bar** at the top of the feed:

### Available Sort Options
| Sort | Description |
|------|-------------|
| **Best** | ML-powered personalized ranking; may include posts from communities you haven't joined |
| **Hot** | Trending posts with recent upvote velocity |
| **New** | Chronologically newest posts regardless of engagement |
| **Top** | Highest upvoted posts, with time filter sub-options: Now, Today, This Week, This Month, This Year, All Time |
| **Rising** | Posts with the most recent views/momentum |

### Feed-Sort Interaction
- The sort bar appears **contextually** depending on which feed you are viewing (Home, Popular, subreddit, etc.)
- The sort selection is **per-feed** -- switching from Home to a subreddit resets to that feed's default sort
- Users can set a **default sort preference** in account settings under Feed Settings
- The **"Latest"** feed (accessible from the sidebar) is essentially a pre-sorted view using "New" ordering across joined communities

Sources:
- [Reddit Help: What filters and sorts are available?](https://support.reddithelp.com/hc/en-us/articles/19695706914196-What-filters-and-sorts-are-available)
- [Reddit Help: What are home feed recommendations?](https://support.reddithelp.com/hc/en-us/articles/4402284777364-What-are-home-feed-recommendations)

---

## 7. Responsive Behavior

### Desktop (>1200px)
- Left sidebar is **fully visible by default** with all sections
- Can be collapsed via the arrow button
- Content feed occupies the center column
- Right sidebar (community info/widgets) visible on subreddit pages

### Desktop Collapsed State
- Sidebar shrinks to a **narrow rail** (no icon-only mode documented -- it fully hides)
- **Hover-to-peek** reveals the full sidebar as a temporary overlay
- Increases content area width for the feed

### October 2025 Experiment (Controversial)
- Reddit tested a layout where the **sidebar collapsed by default**, a **large search bar** dominated the top, and the **content feed was compressed** into a narrow center column (Twitter-like layout)
- Users on large monitors reported **massive blank space** flanking the content
- The right-hand sidebar was removed entirely in some variations
- This experiment lasted 2-6 weeks and was widely criticized ([source](https://piunikaweb.com/2025/10/08/redditors-slam-new-desktop-ui-experiment-wasted-space/))

### Tablet / Narrower Viewports
- The sidebar transitions to a **hamburger menu / drawer** pattern
- Accessed via a menu icon in the top-left of the header
- Opens as a **slide-out overlay** (community drawer) from the left edge

### Mobile Web / App
- No persistent sidebar; replaced entirely by the **community drawer** (swipe right or tap hamburger icon)
- Bottom navigation bar includes: Home, Inbox, Profile, and Games tabs
- Feed sorting accessed via top-of-feed controls

### Logged-Out Users
- See a **sticky sidebar** on desktop to encourage browsing content and communities
- The sticky sidebar remains visible while scrolling through content

Sources:
- [Android Police: Reddit keeps testing desktop UI changes](https://www.androidpolice.com/reddit-testing-desktop-redesign-before-ipo/)
- [Piunikaweb: Redditors slam desktop experiment as 'awful'](https://piunikaweb.com/2025/10/08/redditors-slam-new-desktop-ui-experiment-wasted-space/)
- [Web Designer Depot: Reddit Updates its Design for Logged-out Users](https://webdesignerdepot.com/reddit-updates-its-design-to-improve-the-logged-out-user-experience/)

---

## 8. Visual Design Tokens

### Brand Colors
| Token | Hex | Usage |
|-------|-----|-------|
| **OrangeRed (Primary)** | `#FF4500` | Brand color, upvote arrows, primary action buttons, active states, links |
| **Periwinkle Blue** | `#7193FF` | Downvote arrows, secondary accents |
| **Black** | `#000000` | Text, logos |
| **White** | `#FFFFFF` | Backgrounds (light mode), text on dark backgrounds |

### Light Mode Colors (Approximate)
| Element | Value |
|---------|-------|
| Page background | `#DAE0E6` (light gray-blue) |
| Card/content background | `#FFFFFF` |
| Sidebar background | `#FFFFFF` |
| Sidebar active item | Light orange/red tint (`rgba(255, 69, 0, 0.1)`) |
| Sidebar hover item | `#F6F7F8` (very light gray) |
| Section header text | `#878A8C` (medium gray, uppercase) |
| Primary text | `#1C1C1C` (near black) |
| Secondary text | `#787C7E` (gray) |
| Dividers/borders | `#EDEFF1` |

### Dark Mode Colors (Approximate)
| Element | Value |
|---------|-------|
| Page background | `#030303` |
| Card/content background | `#1A1A1B` |
| Sidebar background | `#1A1A1B` |
| Sidebar hover item | `#272729` |
| Primary text | `#D7DADC` |
| Secondary text | `#818384` |
| Dividers/borders | `#343536` |

### Typography
| Element | Font | Weight | Size (Approximate) |
|---------|------|--------|---------------------|
| Primary UI font | IBM Plex Sans | Regular (400) | 14px (body text) |
| Post body text | Noto Sans | Regular (400) | 14px |
| Sidebar nav items | IBM Plex Sans | Medium (500) | 14px |
| Sidebar section headers | IBM Plex Sans | Bold (700) | 10-11px, uppercase, letter-spacing |
| Community names in sidebar | IBM Plex Sans | Regular/Medium | 14px |
| Sort pills/buttons | IBM Plex Sans | Medium (500) | 12-14px |

### Spacing Patterns
| Element | Value |
|---------|-------|
| Sidebar width (expanded) | ~270px |
| Sidebar item height | ~36-40px |
| Sidebar horizontal padding | 16-24px |
| Sidebar item icon size | 20-24px (community avatars are circular, ~20px) |
| Section header top margin | 16-24px |
| Gap between sidebar items | 0px (items are flush, separated by hover backgrounds) |

### Hover/Active States
- **Hover**: Background fill changes to a subtle gray (`#F6F7F8` light / `#272729` dark), with smooth transition (~150ms)
- **Active/Selected**: Background fill with a faint OrangeRed tint, and the text/icon may shift to OrangeRed (`#FF4500`)
- **Star/Favorite icon**: Gray outline when inactive, filled gold/yellow when favorited
- **Collapse/Expand chevrons**: Rotate 180 degrees with a smooth transition

Sources:
- [BrandColorCode: Reddit](https://www.brandcolorcode.com/reddit)
- [Mobbin: Reddit Brand Color Palette](https://mobbin.com/colors/brand/reddit)
- [SchemeColor: Reddit Logo Colors](https://www.schemecolor.com/reddit.php)
- [Sehyun Jeon: Streamlining Reddit UI Components](https://medium.com/@sehyunjeon/streamlining-reddit-ui-components-the-reddit-design-system-a90189fd9c38)
- [Cruise Ship Cloud: What Font Does Reddit Use](https://cruiseship.cloud/blog/2023/05/18/what-font-does-reddit-use/)

---

## 9. Personalization

The sidebar is heavily personalized for logged-in users:

### Content-Based Personalization
- **Recently Visited**: Automatically tracks and displays the last 3 visited subreddits
- **Favorites**: User-curated via star icons; displayed prominently above the full community list
- **Communities**: Only shows communities the user has explicitly joined (up to 250)
- **Following**: Shows users the account follows
- **Moderation**: Only appears if the user moderates communities

### Algorithm-Driven Personalization
Reddit's recommendation system considers ([source](https://support.reddithelp.com/hc/en-us/articles/23511859482388-Reddit-s-Approach-to-Content-Recommendations)):
- Content and communities previously engaged with
- Upvotes and downvotes
- Time spent on specific communities
- Recently visited communities
- Community subscriptions
- Types of posts the user has asked to see less of

### Logged-Out Experience
- The sidebar shows **default/popular communities** instead of personalized lists
- A **sticky sidebar** encourages content discovery
- Topic-based browsing is emphasized over personalized navigation
- A "Join" CTA is prominent next to community names

### New User Experience
- Content and communities ranked by **popularity and high engagement**
- Explore/Discover features are emphasized to help build subscriptions
- The sidebar progressively fills with personalized content as the user joins communities

---

## 10. Reddit's Topic/Category Discovery

### Explore Communities Page
Accessible via the "Explore" link in the left sidebar, this page provides structured topic-based browsing:

**Topic Categories** (displayed as horizontal scrollable chips/bubbles):
- Technology
- Gaming  
- Sports
- Science
- Art
- Animals
- History
- Hobbies
- Music
- Movies
- Food
- Travel
- News
- Politics
- Business
- Health
- Fashion
- Education
- And many more

### Discovery Methods
1. **Category filtering**: Tap a topic chip to filter communities by that category
2. **Trending communities**: Globally and locally trending subreddits
3. **Related communities**: Suggested based on existing subscriptions
4. **Featured/Handpicked**: Editorially curated community highlights
5. **Growing Communities module**: A dismissible module highlighting growing communities within feeds of related active communities (new 2025 feature)

### In-Feed Discovery
- Reddit occasionally injects **"Discover new communities"** modules into the home feed
- These show community cards with subscriber counts, descriptions, and "Join" buttons
- The "Best" sort option may surface content from communities the user hasn't joined, acting as passive discovery

Sources:
- [Reddit Help: How do I browse and find communities on the Reddit app?](https://support.reddithelp.com/hc/en-us/articles/17881389378196-How-do-I-browse-and-find-communities-on-the-Reddit-app)
- [TechCrunch: Reddit app revamp adds a Discover Tab](https://techcrunch.com/2022/02/24/reddit-revamps-with-a-new-discover-tab-for-finding-communities/)
- [Popular Science: How to use Reddit's new Discover tab](https://www.popsci.com/diy/use-reddit-discover-tab/)
- [Online Optimism: New Reddit Features in 2025](https://onlineoptimism.com/blog/new-reddit-features-in-2025/)

---

## Summary: Key Patterns for Receeps Redesign

Based on this research, the most transferable patterns for a Reddit-like navigation in the Receeps receipt verification platform are:

1. **Three-tier hierarchy**: Global feeds (top) -> Personalized sections (middle, collapsible) -> Utility actions (bottom)
2. **Collapsible sidebar with hover-peek**: The entire sidebar can collapse to maximize content area, with hover-to-reveal for quick access
3. **Section-based organization**: Each group of nav items (Recent, Favorites, Communities) is in a labeled, independently collapsible section
4. **Star-to-favorite pattern**: Users can star items to promote them to a priority section
5. **Recently visited tracking**: Automatic display of last 3 visited items with "See All"
6. **Topic/category discovery**: Horizontal chip filters for browsing by category
7. **Sort controls in content area, not sidebar**: Feed sorting (Hot/New/Top/etc.) stays in the main content toolbar, keeping the sidebar focused on navigation
8. **Personalization gradient**: Logged-out users see popular/default content; logged-in users see personalized lists; power users see moderation tools
9. **Community avatars**: Small circular icons next to each item in the sidebar for visual scanning
10. **IBM Plex Sans typography**: Clean, readable sans-serif with clear weight hierarchy</result>
<usage>total_tokens: 55923
tool_uses: 41
duration_ms: 486502</usage>
</task-notification>
Full transcript available at: /private/tmp/claude-501/-Users-trey-Desktop-Apps/tasks/a1c3814.output

---

## Assistant

All 5 agents are now complete. The final design plan has already been written to `receipts/docs/receeps_filter_overhaul_design_plan.md` — it incorporates findings from all 5 research streams.

Agent 1 (Reddit sidebar) was the last to finish and its findings are fully consistent with what's already in the plan. The key details it confirmed:

- Reddit's sidebar has **8 global feed links** at top (Home, Popular, Explore, All, Answers, Games, News, Latest)
- **6 collapsible sections** below (Recent, Favorites, Communities, Custom Feeds, Following, Moderation)
- **Full collapse with hover-to-peek** (released March 2025)
- **Star-to-favorite** promotes items to a priority section
- Sort controls live in the **feed toolbar, not the sidebar**
- Typography: IBM Plex Sans, 14px nav items, 10-11px uppercase section headers
- Sidebar width: ~270px, item height: ~36-40px

All of these patterns are reflected in the design plan. The document is ready for your review at:

```
receipts/docs/receeps_filter_overhaul_design_plan.md
```

Want me to proceed to implementation, or would you like to review/adjust the plan first?

---

## User

Just the plan first

---

## Assistant





---

## Assistant

The plan is already written at `receipts/docs/receeps_filter_overhaul_design_plan.md`. You can review it there — it covers:

1. **Sidebar structure** — 7 sections mimicking Reddit's hierarchy (Global Feeds → Categories → Recent → Favorites → Followed → Filters → Footer)
2. **6 sort algorithms** — Hot, New, Top, Rising, Debated, Verified (with actual formulas)
3. **Wilson Score credibility** — replacing simple averaging
4. **New `/explore` page** — category chips + topic discovery grid
5. **Feed tabs** — For You / Following / Trending
6. **Responsive behavior** — full sidebar → hidden+peek → mobile bottom bar
7. **5-phase roadmap** — ~6 weeks of implementation
8. **Cross-platform verification table** — comparing our decisions against all 5 platforms

Let me know what you'd like to change, cut, or expand before we start building.

---

## User

Clear as .md files for each sprint or section detailing requiremnts. Make sure agents help organize and expand requirements

---

## Assistant





---

## Assistant

I'll dispatch agents to expand each sprint/section into its own detailed requirements doc.

---

## Assistant



**Tool calls:**
[Bash: mkdir -p /Users/trey/Desktop/Apps/receipts/docs/filter-overhaul]

---

## Assistant



**Tool calls:**
[Task: Write Sprint 1 sidebar requirements]

---

## Assistant



**Tool calls:**
[Task: Write Sprint 2 sort/algorithm reqs]

---

## Assistant





---

## Assistant



**Tool calls:**
[Task: Write Sprint 3 explore page reqs]

---

## Assistant



**Tool calls:**
[Task: Write Sprint 4 favorites/follow reqs]

---

## Assistant



**Tool calls:**
[Task: Write Sprint 5 responsive/polish reqs]

---

## Assistant



Now I'll write the index document that ties all sprints together while the agents work.

---

## Assistant



**Tool calls:**
[Task: Write sprint index and overview doc]

---

## User

This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion of the conversation.

Analysis:
Let me chronologically analyze the conversation:

1. **Initial Request**: User referenced a ShipHawk filters findings document as a point of reference for production filters, but stated the actual work is for the Receeps app. They want a massive filter overhaul on Receeps pages, with the navigation bar resembling Reddit's left-hand sidebar. They requested multiple agents to research designs and filters from Reddit, X, TikTok, Instagram, and Facebook.

2. **Phase 1 - Research Dispatch**: I dispatched 5 parallel research agents:
   - Agent 1 (a1c3814): Reddit sidebar/navigation design
   - Agent 2 (a8659dc): X/Twitter + TikTok feed algorithms
   - Agent 3 (ad2ac97): Instagram + Facebook navigation
   - Agent 4 (acb27f0): Receeps frontend codebase exploration
   - Agent 5 (a701edf): Reddit ranking algorithms

3. **Phase 1 - Results**: All 5 agents completed with extensive findings:
   - Agent 4 (Receeps codebase) completed first - mapped entire frontend/backend architecture
   - Agent 2 (X/TikTok) completed - detailed X's 3-stage pipeline, TikTok's tiered distribution
   - Agent 3 (Instagram/Facebook) completed - Facebook shortcuts, Instagram's "Your Algorithm"
   - Agent 5 (Reddit algorithms) completed - actual Python code for Hot, Wilson Score, Controversial
   - Agent 1 (Reddit sidebar) completed last - full sidebar structure, visual design tokens

4. **Phase 1 - Synthesis**: I wrote the master design plan to `/Users/trey/Desktop/Apps/receipts/docs/receeps_filter_overhaul_design_plan.md` covering:
   - Sidebar structure (7 sections)
   - 6 sort algorithms with Python implementations
   - Wilson Score credibility
   - New /explore page
   - Feed tabs
   - Responsive behavior
   - 5-phase implementation roadmap
   - Cross-platform verification table

5. **User said "Just the plan first"**: User wanted to review the plan before any implementation.

6. **User requested sprint docs**: "Clear as .md files for each sprint or section detailing requirements. Make sure agents help organize and expand requirements"

7. **Phase 2 - Sprint Doc Dispatch**: I dispatched 6 agents to write detailed requirements:
   - Sprint 1 (a4af059): Sidebar Restructure
   - Sprint 2 (acacb85): Sort Toolbar & Algorithms
   - Sprint 3 (a9f4692): Explore Page
   - Sprint 4 (a449127): Favorites & Follow System
   - Sprint 5 (a82c193): Responsive & Polish
   - Index (a6b9863): Overview & Index document

8. **User shared Reddit screenshot**: User provided an actual screenshot of Reddit's current desktop UI showing the left sidebar with Home, Popular, Explore, All, Start a community, Games on Reddit section, Custom Feeds, and Communities sections.

Currently, all 6 sprint doc agents are still running. No agents have completed yet for this phase.

Key technical details from the Receeps codebase exploration:
- Frontend: React, Mantine v8.1.1, Redux Toolkit, @tabler/icons-react
- Backend: Django, DRF, django-filter, PostgreSQL
- Existing sidebar: EnhancedSidebar.jsx with categories, filters, sort
- CSS variables: var(--reddit-*) theme system already in place
- State management: URL params for filters/sort, localStorage for sidebar collapse
- API: Axios wrapper, paginated responses, category/topic/receipt endpoints
- Models: Category, Topic, Receipt, ReceiptTopic, Vote (multi-dimensional)

Files created:
- `/Users/trey/Desktop/Apps/receipts/docs/receeps_filter_overhaul_design_plan.md` - master plan
- `/Users/trey/Desktop/Apps/receipts/docs/filter-overhaul/` - directory created for sprint docs

Files being written by agents (in progress):
- `docs/filter-overhaul/00-overview-and-index.md`
- `docs/filter-overhaul/01-sidebar-restructure.md`
- `docs/filter-overhaul/02-sort-toolbar-and-algorithms.md`
- `docs/filter-overhaul/03-explore-page.md`
- `docs/filter-overhaul/04-favorites-and-follow-system.md`
- `docs/filter-overhaul/05-responsive-and-polish.md`

Summary:
1. Primary Request and Intent:
   The user wants a massive filter overhaul for the Receeps receipt verification platform. The primary goal is to make Receeps' navigation "almost perfectly resemble Reddit's navigation bar on the left hand side of its main page." They referenced `/Users/trey/Desktop/Apps/SH/automation-hub/docs/shiphawk_filters_findings.md` as a point of reference for production filter patterns but clarified the work is for the Receeps app at `/Users/trey/Desktop/Apps/receipts/`. They requested multiple research agents to verify designs across Reddit, X/Twitter, TikTok, Instagram, and Facebook, then wanted the plan broken into clear `.md` files per sprint with detailed requirements. They also provided a screenshot of Reddit's current desktop UI as a visual reference.

2. Key Technical Concepts:
   - Reddit-style left sidebar navigation (3-tier hierarchy: Global feeds → Personalized sections → Utility actions)
   - Collapsible sidebar with hover-to-peek behavior
   - Reddit ranking algorithms: Hot (log-vote + time), Wilson Score (confidence interval), Controversial (magnitude^balance), Rising (velocity), Top (time-windowed)
   - Multi-dimensional voting (relevance 1-5, reliability 1-5, bias classification) vs Reddit's simple up/down
   - Wilson Score Lower Bound for credibility scoring (z=1.281551565545, ~80% confidence)
   - Feed composition pipeline: candidate generation → filtering → scoring → diversity enforcement
   - Dual/triple feed tabs: For You / Following / Trending
   - URL-param-driven filter state for shareability/bookmarkability
   - Category chip horizontal scrollable row for discovery
   - Star-to-favorite pattern for topic prioritization
   - Responsive breakpoints: Desktop >1200px (full sidebar), Tablet 768-1200px (collapsed), Mobile <768px (bottom tab bar)
   - Mantine v8.1.1 UI framework, @tabler/icons-react icons, Redux Toolkit, Axios wrapper
   - Django REST Framework backend with django-filter, PostgreSQL
   - CSS variable theming system: `var(--reddit-*)` tokens already in place

3. Files and Code Sections:
   - `/Users/trey/Desktop/Apps/SH/automation-hub/docs/shiphawk_filters_findings.md`
     - Referenced as point of comparison for production filter patterns (ShipHawk's Elasticsearch/OpenSearch filters)
     - Not modified; used only as context

   - `/Users/trey/Desktop/Apps/receipts/docs/receeps_filter_overhaul_design_plan.md` (CREATED)
     - Master design plan synthesizing all 5 research agents' findings
     - Contains: sidebar structure spec, 6 sort algorithms with Python code, Wilson Score implementation, Explore page layout, feed tabs, responsive breakpoints, visual design tokens, 5-phase implementation roadmap, cross-platform verification table
     - Key Python code included:
       ```python
       def wilson_credibility_score(receipt, z=1.281551565545):
           votes = receipt.votes.all()
           n = votes.count()
           if n == 0: return 0.0
           positive = votes.filter(reliability__gte=4).count()
           p_hat = positive / n
           denominator = 1 + z**2 / n
           center = p_hat + z**2 / (2 * n)
           spread = z * math.sqrt((p_hat * (1 - p_hat) + z**2 / (4 * n)) / n)
           return (center - spread) / denominator
       ```
       ```python
       def hot_score(receipt):
           positive = receipt.votes.filter(reliability__gte=4).count()
           negative = receipt.votes.filter(reliability__lte=2).count()
           s = positive - negative
           order = log10(max(abs(s), 1))
           sign = 1 if s > 0 else -1 if s < 0 else 0
           seconds = (receipt.created_at - datetime(2025, 1, 1)).total_seconds()
           return round(order + sign * seconds / 45000, 7)
       ```
       ```python
       def debate_score(receipt):
           high = receipt.votes.filter(reliability__gte=4).count()
           low = receipt.votes.filter(reliability__lte=2).count()
           if high == 0 or low == 0: return 0
           magnitude = high + low
           balance = min(high, low) / max(high, low)
           return magnitude ** balance
       ```

   - `/Users/trey/Desktop/Apps/receipts/docs/filter-overhaul/` (CREATED - directory)
     - Sprint requirements directory, agents are writing files into it

   - Key existing Receeps files explored by agents:
     - `frontend/src/components/Sidebar/EnhancedSidebar.jsx` — Current sidebar with categories, filters, sort; toggle collapse saved to localStorage
     - `frontend/src/components/Category/CategorySidebar.jsx` — Category listing with icons, colors, topic counts
     - `frontend/src/App.jsx` — Central state manager, sidebar show/hide logic, filter state via URL params
     - `frontend/src/components/Router/AppRouter.jsx` — Current routes (/, /receipts, /topics, /dashboard, etc.)
     - `frontend/src/components/Pages/ReceiptsHomePage.jsx` — Receipt listing with view options (New, Top, Rising, Controversial buttons)
     - `frontend/src/components/Pages/TopicsHomePage.jsx` — Topic listing with configurable views (single/double/grid)
     - `frontend/src/index.css` — CSS variables: `--reddit-bg-primary: #0B1416`, `--reddit-bg-secondary: #1A282D`, `--reddit-orange: #FF4500`, etc.
     - `frontend/src/theme/reddit-theme.js` — Theme object with background, text, border, primary colors
     - `frontend/src/store/slices/` — Redux slices: authSlice, receiptsSlice, topicsSlice, categoriesSlice, siteConfigurationSlice
     - `frontend/src/util/Axios.js` — Axios wrapper with JWT auth, caching (5 min default TTL)
     - `receipt/models.py` — Receipt (title, evidence_text, source_type, verification_status, credibility_score, topics M2M), Vote (relevance 1-5, reliability 1-5, bias choice, expertise_claimed)
     - `receipt/filters.py` — ReceiptFilter (search, topic, category, source_type, verification_status, date ranges, min_credibility)
     - `receipt/viewsets/receipt.py` — ReceiptViewSet with ordering_fields, annotations
     - `app/category/models.py` — Category (name, slug, icon, color, order, is_active)
     - `app/topic/models.py` — Topic (name, ai_summary, category FK, created_by FK)
     - `app/topic/filters.py` — TopicFilter (category, has_receipts, created_after, receipt_count_min)
     - `frontend/src/components/Navigation/BottomNav.jsx` — Mobile bottom nav
     - `frontend/src/components/Header/Header.jsx` — Header with logo, links, search, profile

4. Errors and fixes:
   - No code errors encountered. This has been a research and planning phase, not implementation.

5. Problem Solving:
   - Dispatched 5 independent research agents in parallel to ensure comprehensive, verified cross-platform research
   - Synthesized findings from all 5 agents into a single master design plan
   - Mapped Reddit's voting system to Receeps' multi-dimensional voting (relevance/reliability/bias) using Wilson Score
   - Adapted Reddit's sort algorithms (Hot, Controversial, Rising) to work with Receeps' reliability-based voting instead of simple up/down
   - Identified that Receeps already has a `var(--reddit-*)` CSS variable system aligned with Reddit's dark mode design
   - Determined that filters should stay in sidebar while sort controls move to feed toolbar (matching Reddit's pattern)

6. All user messages:
   - "@SH/automation-hub/docs/shiphawk_filters_findings.md - This app is one point of reference for production filters. But we are building this for @receipts/. Receipts needs a massive filter overhaul on its pages. Dispatch agents on a team to research designs and filters for how websites like Reddit / X / Tiktok / Instagram / Facebook build their algorithms for feeds and sidebars for categories. We want recepts to almost perfectly resemble reddits navigation bar on the left hand side of its main page. Use multiple agents to ensure we have muiltiple people verifying the deisgn plan so the requirements are extremely clearly"
   - "Just the plan first" (when asked if they wanted to proceed to implementation or review plan)
   - "Clear as .md files for each sprint or section detailing requiremnts. Make sure agents help organize and expand requirements"
   - "Here is a nice image of reddit for reference as well." (with screenshot of Reddit's current desktop UI showing sidebar)

7. Pending Tasks:
   - 6 agents are currently running to write sprint requirement docs:
     - Agent a4af059: Writing `docs/filter-overhaul/01-sidebar-restructure.md`
     - Agent acacb85: Writing `docs/filter-overhaul/02-sort-toolbar-and-algorithms.md`
     - Agent a9f4692: Writing `docs/filter-overhaul/03-explore-page.md`
     - Agent a449127: Writing `docs/filter-overhaul/04-favorites-and-follow-system.md`
     - Agent a82c193: Writing `docs/filter-overhaul/05-responsive-and-polish.md`
     - Agent a6b9863: Writing `docs/filter-overhaul/00-overview-and-index.md`
   - User provided a Reddit screenshot that should be acknowledged/referenced once agents complete

8. Current Work:
   All 6 sprint requirement document agents are running in the background. They are reading the master design plan and relevant source code files, then writing detailed `.md` requirement documents for each sprint into `/Users/trey/Desktop/Apps/receipts/docs/filter-overhaul/`. Each document includes user stories, acceptance criteria, component breakdowns, visual specs, state management details, API contracts, and definition of done.

   The user also just shared a screenshot of Reddit's actual desktop UI (dark mode) showing:
   - Top nav: reddit logo, search bar ("Find anything"), Ask button, video/chat/create/notifications icons, user avatar
   - Left sidebar sections: Home (active, highlighted), Popular, Explore, All, "Start a community", GAMES ON REDDIT (Pixelary featured with "NEW" badge, romkerl, Quiz Planet, BattleBirds, "Discover More Gam..."), CUSTOM FEEDS ("+ Create Custom Feed"), COMMUNITIES ("Manage Communities", then alphabetical list with circular avatars and star icons: r/2meirl4meirl, r/adhdmeme, r/AmItheAsshole, r/AskMen, r/AskReddit, r/AstralProjecti..., r/aww, r/BlackPeopleT..., r/buildapcsales)
   - Right sidebar: subreddit recommendation card (r/Streetwear)
   - Feed: posts with vote counts, comment counts, share buttons

9. Optional Next Step:
   Wait for all 6 sprint requirement agents to complete, then acknowledge the user's Reddit screenshot reference, confirm all docs are written, and present a summary of the completed sprint docs directory. The user's most recent explicit request was: "Clear as .md files for each sprint or section detailing requirements. Make sure agents help organize and expand requirements" — all agents are actively working on this.

If you need specific details from before compaction (like exact code snippets, error messages, or content you generated), read the full transcript at: /Users/trey/.claude/projects/-Users-trey-Desktop-Apps/7aa09952-52af-4e6e-915a-71c1d5a1637a.jsonl
Please continue the conversation from where we left it off without asking the user any further questions. Continue with the last task that you were asked to work on.

---

## Assistant





---

## Assistant

Let me check on the status of all 6 sprint requirement document agents.

---

## Assistant



**Tool calls:**
[Glob: docs/filter-overhaul/*.md]

---

## Assistant



**Tool calls:**
[TaskOutput]

---

## Assistant



**Tool calls:**
[TaskOutput]

---

## Assistant



**Tool calls:**
[TaskOutput]

---

## Assistant



**Tool calls:**
[TaskOutput]

---

## Assistant



**Tool calls:**
[TaskOutput]

---

## Assistant



**Tool calls:**
[TaskOutput]

---

## Assistant

All 6 agents are actively working — they've explored the codebase thoroughly and are now writing their respective sprint documents. Let me wait for them to complete.

---

## Assistant



**Tool calls:**
[TaskOutput]

---

## Assistant



**Tool calls:**
[TaskOutput]

---

## Assistant



**Tool calls:**
[TaskOutput]

---

## Assistant



**Tool calls:**
[TaskOutput]

---

## Assistant



**Tool calls:**
[TaskOutput]

---

## Assistant



**Tool calls:**
[TaskOutput]

---

## Assistant

Good progress. 3 of 6 agents completed:
- `00-overview-and-index.md` -- done
- `01-sidebar-restructure.md` -- done
- `03-explore-page.md` -- done

Waiting on the remaining 3 agents (Sprint 2, 4, and 5).

---

## Assistant



**Tool calls:**
[TaskOutput]

---

## Assistant



**Tool calls:**
[TaskOutput]

---

## Assistant



**Tool calls:**
[TaskOutput]

---

## Assistant

All 6 agents have completed successfully. Let me verify the final file listing.

---

## Assistant



**Tool calls:**
[Glob: docs/filter-overhaul/*.md]

---

## Assistant

Prompt is too long

---

## User

<task-notification>
<task-id>a6b9863</task-id>
<status>completed</status>
<summary>Agent "Write sprint index and overview doc" completed</summary>
<result>The document has been written to `/Users/trey/Desktop/Apps/receipts/docs/filter-overhaul/00-overview-and-index.md`. Here is a summary of what was created:

**File:** `/Users/trey/Desktop/Apps/receipts/docs/filter-overhaul/00-overview-and-index.md`

The document contains all 11 requested sections:

1. **Project Title** -- "Receeps Filter Overhaul -- Reddit-Style Navigation & Feed Design"

2. **Project Summary** -- Three paragraphs covering what the project delivers (6-section sidebar, 6 sort algorithms, Explore page, favorites/follow system, mobile responsiveness), why it matters (users lack sort control, no discovery mechanism, naive credibility scoring), and how it is structured (5 sprints over 6 weeks with self-contained docs).

3. **Design Principles** -- Six principles extracted from the cross-platform research: verification-first design, explicit user control, Reddit's 3-tier sidebar hierarchy, mobile-first responsive design, URL-driven filter state, and Wilson score statistical rigor. Each includes a paragraph of explanation grounded in the design plan.

4. **Sprint Index Table** -- Five rows mapping sprints 1-5 to titles, durations, key deliverables, and doc filenames (`01-sidebar-restructure.md` through `05-responsive-and-polish.md`).

5. **Architecture Diagram** -- ASCII diagram showing the browser layer (sidebar sections + main content area with feed tabs, sort toolbar, feed list, and explore page), the URL params bridge, the Django REST Framework layer (ViewSets, score functions, Wilson calculation), and the PostgreSQL/Redis data layer.

6. **Tech Stack Summary** -- Table covering Frontend, Backend, Database, Cache, and State Management layers with specific technologies and version numbers.

7. **Key API Endpoints Summary** -- 17-row table of all endpoints touched or created across all sprints, with method, path, status (existing/modified/new), sprint number, and purpose.

8. **Cross-Cutting Concerns** -- Six subsections covering cache invalidation strategy (extending existing `invalidate_*_cache()` pattern), URL param conventions (full table of all params), error handling, loading state patterns, Mantine component rules, and CSS variable naming conventions.

9. **Risks and Mitigations** -- Five risks in a structured table with impact, likelihood, and mitigation strategy (sort algorithm performance, Wilson score timing, mobile sidebar complexity, backward URL compatibility, feed diversity pagination).

10. **Success Metrics** -- Six metrics with baseline, target, and measurement method (filter usage rate, time to relevant content, sort diversity, mobile engagement parity, explore page adoption, follow/favorite adoption).

11. **Research Sources** -- Table crediting the five research agents (Reddit, X/Twitter, Instagram, Facebook, TikTok) with their specific contributions to the design, plus general UX sources (NNg, UX Planet, Evan Miller).</result>
<usage>total_tokens: 43158
tool_uses: 11
duration_ms: 148684</usage>
</task-notification>
Full transcript available at: /private/tmp/claude-501/-Users-trey-Desktop-Apps/tasks/a6b9863.output

---

## Assistant

Prompt is too long

---

## User

<task-notification>
<task-id>a4af059</task-id>
<status>completed</status>
<summary>Agent "Write Sprint 1 sidebar requirements" completed</summary>
<result>The Sprint 1 requirements document has been written to `/Users/trey/Desktop/Apps/receipts/docs/filter-overhaul/01-sidebar-restructure.md`.

Here is a summary of what the document covers:

**Structure:** The document is organized into 11 major sections plus 3 appendices, totaling approximately 700 lines of detailed specifications.

**Key sections:**

1. **Sprint Goal** -- A single sentence defining the objective: restructure the monolithic `EnhancedSidebar` into a Reddit-style multi-section sidebar with all new navigation elements while preserving existing filter and category functionality.

2. **User Stories (9 total)** -- US-1 through US-9 covering Global Feed Navigation, Create Actions, Collapsible Categories, Recent Topics, Favorites Placeholder, Followed Topics Placeholder, Context-Sensitive Filters, Sidebar Collapse/Peek, and Sidebar Footer. Each story includes detailed acceptance criteria as checkboxes.

3. **Component Breakdown (14 components/hooks)** -- Every component and hook is specified with:
   - Exact file path (`frontend/src/components/Sidebar/...`)
   - TypeScript-style props interface
   - State management approach (localStorage, Redux, component state, or derived from URL)
   - Children composition and rendered JSX structure

4. **Section-by-Section Requirements** -- Tables specifying icons, routes, active state logic, data sources, display limits, and empty states for all 7 sidebar sections.

5. **Sidebar Collapse Behavior** -- Full specification of the three states (Expanded, Collapsed, Peeking), CSS changes to transition from the current 60px icon-rail to full 0px hide, hover-to-peek with 200ms enter / 300ms leave delays, `useSidebarPeek` custom hook, `[` keyboard shortcut, and responsive breakpoints.

6. **Visual Specifications** -- New CSS variables to add to `index.css`, complete typography table (weights, sizes, transforms, colors for every element type), spacing values mapped to Mantine props, active/hover state colors with transition durations, and exact pixel dimensions.

7. **State Management** -- A location map showing exactly where each piece of state lives (URL params, localStorage, Redux, or component state) with rationale, plus a full initialization flow sequence.

8. **Data Flow** -- Four sequence diagrams showing how sidebar interactions propagate through the system: category selection, filter changes, recent topic tracking (with custom DOM event), and global feed navigation.

9. **Migration Notes** -- Exact lists of files to modify (5), create (14), deprecate (1, with rationale for keeping), what to preserve (10 behaviors), and what to remove (5 behaviors including the sort dropdown).

10. **Dependencies** -- Bidirectional dependency mapping showing what this sprint needs from Sprints 2-4 (with mitigations for each) and what it provides to subsequent sprints. Confirms zero new npm dependencies needed.

11. **Definition of Done** -- 50+ checkboxes organized into Functionality, Collapse/Peek, Visual, Responsive, Code Quality, and Testing categories.

**Appendices** provide the placeholder Explore route implementation, file tree after completion, and a temporary sort parameter mapping utility for bridging to Sprint 2.</result>
<usage>total_tokens: 73857
tool_uses: 17
duration_ms: 325524</usage>
</task-notification>
Full transcript available at: /private/tmp/claude-501/-Users-trey-Desktop-Apps/tasks/a4af059.output

---

## Assistant

Prompt is too long

---

## User

<task-notification>
<task-id>a9f4692</task-id>
<status>completed</status>
<summary>Agent "Write Sprint 3 explore page reqs" completed</summary>
<result>The Sprint 3 requirements document has been written to `/Users/trey/Desktop/Apps/receipts/docs/filter-overhaul/03-explore-page.md`.

Here is a summary of what the document covers:

**Sprint 3: Explore Page (Week 3-4)** -- a comprehensive 16-section requirements document with approximately 750 lines of detailed specifications.

**Key sections:**

1. **Sprint Goal** -- Build `/explore` as the primary discovery surface for browsing topics by category, surfacing trending content, recently active discussions, and receipts needing verification.

2. **7 User Stories** with full acceptance criteria checkboxes covering category browsing, trending topics, recently active topics, needs verification, search, route/layout integration, and loading/error states.

3. **Route and Page Setup** -- Exact file paths for the new route constant (`EXPLORE_ROUTE`), the `AppRouter.jsx` addition, and the full component file structure (13 new component files organized in `/frontend/src/components/Explore/`).

4. **Category Chip Row** -- Complete specification including props interface, scrolling behavior (arrows on desktop, swipe on mobile), active/inactive chip styling with exact CSS values mapped to `var(--reddit-*)` variables, icon mapping to `@tabler/icons-react`, skeleton loading state, and keyboard accessibility.

5. **Trending Topics Section** -- API endpoint with exact query parameters (`ordering=-annotated_receipt_count`, `has_receipts=true`, etc.), the `ExploreTopicCard` component props and visual layout, responsive grid (3/2/1 columns), "See All" link behavior, and empty states.

6. **Recently Active Section** -- Differentiates from trending by using `updated_at`/`latest_receipt_at` ordering, reuses `ExploreTopicCard` with `variant="recent"`.

7. **Needs Verification Section** -- Queries `/receipt/api/receipts/` with `verification_status=unverified`, `ordering=-vote_count`. Defines `ExploreReceiptCard` with status badges, credibility score color coding, and parent topic attribution.

8. **Search Integration** -- Debounced (300ms) search bar using `useDebouncedCallback` from `@mantine/hooks`, URL-synced `?search=` parameter, replaces section layout with search results, no-results state.

9. **Backend API Requirements** -- Three specific backend enhancements:
   - `recently_active` ordering via `Max("receipts__created_at")` annotation
   - `receipt_activity_after` filter for the Trending section's 48-hour window
   - `verification_status_in` multi-value filter for the Needs Verification section

10. **State Management** -- Clear delineation: URL params for `activeCategory` and `searchQuery`, Redux for categories (existing slice), local state for section data.

11. **ASCII Mockups** -- Three detailed mockups: desktop (full sidebar + 3-column grid), mobile (single column with bottom nav), and search-active state.

12. **Dependencies** -- Maps Sprint 1 and Sprint 2 dependencies with "Required?" and "Fallback if not ready" columns, plus verification that no new npm packages are needed.

13. **Definition of Done** -- 30+ checkboxes across functional, visual, code quality, backend, testing, and documentation categories.

14. **Implementation Order** -- 19-step task breakdown with effort estimates totaling ~18 hours, structured to minimize blocking between frontend and backend work.</result>
<usage>total_tokens: 91346
tool_uses: 32
duration_ms: 319891</usage>
</task-notification>
Full transcript available at: /private/tmp/claude-501/-Users-trey-Desktop-Apps/tasks/a9f4692.output

---

## Assistant

Prompt is too long

---

## User

<task-notification>
<task-id>acacb85</task-id>
<status>completed</status>
<summary>Agent "Write Sprint 2 sort/algorithm reqs" completed</summary>
<result>The Sprint 2 requirements document has been written to `/Users/trey/Desktop/Apps/receipts/docs/filter-overhaul/02-sort-toolbar-and-algorithms.md`.

Here is a summary of what the document covers:

**Sprint Goal:** Replace client-side-only sort controls with a production-grade, server-side ranking system and a redesigned `FeedSortToolbar` component that persists sort state in URL parameters and supports all six Receeps ranking algorithms plus feed tabs.

**Key sections written:**

1. **Sprint Goal** -- one-sentence objective defining the sprint's deliverable.

2. **10 User Stories** -- covering all sort algorithms (Hot, New, Top, Rising, Debated, Verified), URL persistence, feed tabs (For You/Following/Trending), mobile responsiveness, and Needs Review surfacing.

3. **Acceptance Criteria** -- detailed checkbox-style criteria grouped by FeedSortToolbar, FeedTabs, Backend Algorithms, Wilson Score, and API Contract.

4. **Frontend: FeedSortToolbar Component** -- Full specification including file path (`frontend/src/components/FeedSortToolbar/`), props interface, controlled-component state pattern using `useSearchParams`, pill button definitions with `@tabler/icons-react` icons, complete JSX structure using Mantine components, CSS Module with mobile-responsive breakpoints (icon-only pills below 768px), visual specs table, and URL parameter integration with `dayjs`-based time window conversion.

5. **Frontend: Feed Tabs Component** -- Three tabs (For You/Following/Trending), auth-aware visibility, tab-to-API-query mapping, `buildApiParams()` utility function showing how feed and sort compose.

6. **Backend: 5 Sort Algorithms** -- Each algorithm includes:
   - Full Python implementation using Django ORM annotations (`annotate_hot_score`, `annotate_rising_score`, `annotate_debate_score`, `annotate_verified_score`, `annotate_needs_review_score`)
   - A custom `ReceiptOrderingFilter` class extending DRF's `OrderingFilter`
   - PostgreSQL-specific `RawSQL` for epoch calculations
   - Database index recommendations with migration code
   - Performance analysis and optimization notes

7. **Wilson Score Credibility** -- Complete replacement implementation for `receipt/utils.py` with `wilson_credibility_score()` at z=1.28 (80% confidence), updated `calculate_credibility_score()` using 60/25/15 weighting (Wilson/verification/source), preserved `_v1` function, data migration with chunked `bulk_update`, signal handlers for vote create/update/delete, and a nightly Celery integrity task.

8. **API Contract Changes** -- Full table of `ordering` parameter values (4 new, 8 existing), new `following` and `trending` boolean parameters, unchanged response format, backward compatibility guarantees, and explicit note that internal scores are not exposed in responses.

9. **Testing Requirements** -- 20+ backend unit tests for ranking algorithms, 10+ Wilson score tests (with full `TestCase` code), 11+ API integration tests, 12+ frontend component tests (with test descriptions), and 6 end-to-end integration scenarios.

10. **Dependencies** -- Explicit mapping of Sprint 1 deliverables that Sprint 2 requires, with a note that backend work can begin independently.

11. **Definition of Done** -- 22 checkbox items covering frontend, backend, testing, regressions, and documentation.

**Appendices:** File change summary (19 files: 12 created, 7 modified) and a glossary of ranking terminology.</result>
<usage>total_tokens: 87847
tool_uses: 22
duration_ms: 379195</usage>
</task-notification>
Full transcript available at: /private/tmp/claude-501/-Users-trey-Desktop-Apps/tasks/acacb85.output

---

## Assistant

Prompt is too long

---

## User

<task-notification>
<task-id>a449127</task-id>
<status>completed</status>
<summary>Agent "Write Sprint 4 favorites/follow reqs" completed</summary>
<result>The Sprint 4 requirements document has been written to `/Users/trey/Desktop/Apps/receipts/docs/filter-overhaul/04-favorites-and-follow-system.md`. Here is a summary of what it covers:

**Document structure (16 sections):**

1. **Sprint Goal** -- One-sentence objective focusing on enabling favorites, follows, and the personalized Following feed.

2. **User Stories** -- 10 user stories covering authenticated users (favorite, unfavorite, reorder, follow, unfollow, feed tab, state visibility, sidebar sections) and anonymous users (login prompts).

3. **Acceptance Criteria** -- Detailed checkbox lists organized by Favorites, Follows, Following Feed, and Serializer Integration.

4. **Backend: New Models** -- Full model code for `UserTopicFavorite` (new model with `user`, `topic`, `order`, `created_at`, unique constraint, auto-incrementing order). Documents reusing the existing `Follow` model from `/Users/trey/Desktop/Apps/receipts/follows/models.py` (which already has a generic `GenericForeignKey` approach supporting topic, category, and user follows) and notes that the `follows` app is NOT yet in `INSTALLED_APPS`.

5. **Backend: API Endpoints** -- Seven endpoints with full viewset action code:
   - `POST /app/topics/{id}/favorite/` (toggle/add)
   - `DELETE /app/topics/{id}/favorite/` (remove)
   - `GET /app/topics/favorites/` (list ordered)
   - `POST /app/topics/favorites/reorder/` (reorder)
   - `POST /app/topics/{id}/follow/` (follow)
   - `DELETE /app/topics/{id}/follow/` (unfollow)
   - `GET /app/topics/following/` (list followed)

6. **Backend: Serializer Changes** -- Adds `is_favorited` and `is_followed` boolean fields to both `TopicListSerializer` and `TopicDetailSerializer`, with annotation-based `Exists` subqueries in the viewset's `get_queryset()` to prevent N+1 queries.

7. **Backend: Personalized Feed** -- Adds `feed=following` filter to `ReceiptFilter` that composes with all existing filters.

8. **Frontend: Star/Favorite Interaction** -- `StarButton` component with props, behavior (optimistic UI, animation, login redirect for anonymous), styling (gold fill), and API call patterns using the project's Axios wrapper.

9. **Frontend: Follow Button** -- `FollowButton` component with three visual states (Follow/Following/Unfollow-on-hover), optimistic updates, and placement locations.

10. **Frontend: Sidebar Integration** -- `SidebarFavorites` (with edit mode for drag reorder and remove) and `SidebarFollowed` (with "See More" expansion) components, including implementation sketches and integration with `EnhancedSidebar.jsx`.

11. **Frontend: Feed Tab Integration** -- Makes the "Following" tab functional with `?feed=following` URL params, empty state with Explore link, and authentication gating.

12. **Cache Invalidation** -- Two new functions (`invalidate_favorite_cache`, `invalidate_follow_cache`) following the existing pattern in `/Users/trey/Desktop/Apps/receipts/util/cache_utils.py`, with a full invalidation matrix.

13. **Migration Plan** -- Step-by-step: register `follows` in `INSTALLED_APPS`, add `GenericRelation` to Topic, create `UserTopicFavorite`, run makemigrations/migrate, with rollback instructions.

14. **Testing Requirements** -- 40+ test cases across 9 test files covering models, API endpoints, serializer annotations, feed filtering, and frontend component behavior.

15. **Dependencies** -- Maps each dependency to its source sprint (1-3) and required completion status.

16. **Definition of Done** -- 20 checkbox items covering models, endpoints, serializers, frontend components, caching, tests, formatting, and documentation.</result>
<usage>total_tokens: 95668
tool_uses: 54
duration_ms: 350935</usage>
</task-notification>
Full transcript available at: /private/tmp/claude-501/-Users-trey-Desktop-Apps/tasks/a449127.output

---

## Assistant

Prompt is too long

---

## User

<task-notification>
<task-id>a82c193</task-id>
<status>completed</status>
<summary>Agent "Write Sprint 5 responsive/polish reqs" completed</summary>
<result>The Sprint 5 requirements document has been written to `/Users/trey/Desktop/Apps/receipts/docs/filter-overhaul/05-responsive-and-polish.md`.

Here is a summary of what the document covers:

**Sprint Goal:** Deliver a fully responsive experience across all breakpoints with polished animations, loading/empty/error states, keyboard navigation, and WCAG AA accessibility compliance.

**Structure (18 sections):**

1. **Sprint Goal** -- single-sentence objective covering responsiveness, accessibility, and polish across all Sprint 1-4 features.

2. **User Stories** -- 10 user stories covering mobile navigation, filter drawer, hover-to-peek, keyboard navigation, loading states, empty states, error recovery, screen reader support, motion sensitivity, and tablet behavior.

3. **Acceptance Criteria** -- general checkboxes plus section-specific criteria throughout.

4. **Responsive Breakpoints (Section 1)** -- three canonical breakpoints (mobile <768px, tablet 768-1199px, desktop 1200+) with exact CSS media queries, specific behavior per breakpoint, and a callout about fixing the existing 768px overlap bug in `App.jsx` and `BottomNav.module.css`.

5. **Mobile Bottom Tab Bar (Section 2)** -- detailed comparison of current 5-tab layout (Home/Topics/Receeps/Submit/Profile) vs. new design (Home/Explore/Create/Notifications/Profile). Includes filled icon variants for active states, notification badge with unread count, circular orange Create button, top accent bar indicator, safe area inset handling with `env(safe-area-inset-bottom)`, and `viewport-fit=cover` meta tag requirement.

6. **Mobile Category/Filter Drawer (Section 3)** -- left-anchored Mantine Drawer at 85% width (max 360px), triggered by hamburger icon visible below 1200px. Contains full `EnhancedSidebar` component. Closes on navigation via `useEffect` watching `location.pathname`. Includes overlay, blur, and swipe-to-close specs.

7. **Hover-to-Peek Sidebar (Section 4)** -- 8px trigger zone along left edge, 200ms show delay, 300ms hide delay with flicker prevention. Full component pseudocode for `SidebarPeek.jsx`. Z-index management table covering all layers from content (auto) through header (1000).

8. **Keyboard Navigation (Section 5)** -- `[` key toggle with input-element guard, Tab/Arrow/Enter/Escape/Space handling within sidebar sections, `:focus-visible` outline style, skip-to-content link implementation with CSS.

9. **Animation Polish (Section 6)** -- exact durations for sidebar collapse (250ms), section collapse (200ms), hover states (150ms), sort pill activation (100ms), star bounce (300ms keyframe), and a global `prefers-reduced-motion` rule using the `0.01ms` technique.

10. **Sort Toolbar Responsive (Section 7)** -- horizontal pills on desktop, horizontal scroll with snap on tablet, horizontal scroll with gradient fade indicators on mobile. Time-window selector as dropdown on desktop, bottom-sheet Modal on mobile.

11. **Feed Tabs Responsive (Section 8)** -- full-width tabs at all breakpoints, tighter padding on mobile, exact CSS with active state border.

12. **Loading States (Section 9)** -- sidebar skeleton, feed card skeleton, sort toolbar disabled state with pulse animation, category chip skeletons, explore page section skeletons. Full JSX component code for `SidebarSkeleton` and `FeedCardSkeleton`.

13. **Empty States (Section 10)** -- 5 distinct empty states (no results, no favorites, no followed topics, no receipts in category, no trending topics) with specific icons, headings, descriptions, and actions. Reusable `EmptyState` component with full JSX.

14. **Error States (Section 11)** -- per-section sidebar errors with retry, feed-level errors with retry, manual retry mechanism (no auto-retry), offline banner using `navigator.onLine` with auto-dismiss.

15. **Accessibility (Section 12)** -- 19-row ARIA attributes table, live region announcements for 8 event types, color contrast audit with 3 identified failures and remediation strategies, focus management rules, landmark roles.

16. **Performance Targets (Section 13)** -- 8 measurable targets (sidebar render <50ms, feed load <500ms, etc.) with optimization strategies (React.memo, optimistic UI, lazy loading).

17. **Browser/Device Testing Matrix (Section 14)** -- 4 desktop browsers, 5 mobile browser/OS combinations, 8 viewport sizes, and a 12-point test checklist per viewport.

18. **Dependencies (Section 15)** -- itemized checklist of what must be complete from each of Sprints 1-4, plus external dependency verification.

19. **Definition of Done (Section 16)** -- 35 checkboxes across functionality, loading/empty/error states, accessibility, animation, responsive, and code quality categories.

20. **Appendix A** -- file change summary listing 7 files to create and 13 files to modify with specific change descriptions.

21. **Appendix B** -- new CSS variables to add to `index.css`, including sidebar dimensions, sort pill height, layout constants, and documented breakpoint values.</result>
<usage>total_tokens: 69865
tool_uses: 17
duration_ms: 399734</usage>
</task-notification>
Full transcript available at: /private/tmp/claude-501/-Users-trey-Desktop-Apps/tasks/a82c193.output

---

## Assistant

Prompt is too long

---

## User

<local-command-caveat>Caveat: The messages below were generated by the user while running local commands. DO NOT respond to these messages or otherwise consider them in your response unless the user explicitly asks you to.</local-command-caveat>

---

## User

<command-name>/compact</command-name>
            <command-message>compact</command-message>
            <command-args></command-args>

---

## User

<local-command-stderr>Error: Error during compaction: Error: Conversation too long. Press esc twice to go up a few messages and try again.</local-command-stderr>

---

## User

is timeline updated

---

## Assistant

Prompt is too long

---

