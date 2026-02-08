Perfect! Now I have enough information. Let me compile a comprehensive feature requirements document based on all the research I've done.

---

# RECEEPS — Receipt-Based Evidence Verification Platform
## Comprehensive Feature Requirements Document

**Last Updated:** February 8, 2026  
**Status:** Research & Analysis Complete  
**Scope:** Full-stack Django REST API + React SPA application

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Tech Stack & Dependencies](#tech-stack--dependencies)
3. [Architecture Overview](#architecture-overview)
4. [Backend Data Models](#backend-data-models)
5. [Backend Features & API Endpoints](#backend-features--api-endpoints)
6. [Frontend Architecture](#frontend-architecture)
7. [Frontend Pages & Components](#frontend-pages--components)
8. [Authentication & Authorization](#authentication--authorization)
9. [Key Features & Requirements](#key-features--requirements)
10. [Development Standards](#development-standards)
11. [Testing & Deployment](#testing--deployment)

---

## Executive Summary

**Receeps** is a community-driven evidence verification platform where users submit receipts (evidence) linked to topics, then the community votes on relevance, reliability, and bias. Staff moderators verify submissions and compute credibility scores from community assessments. The platform enables fact-checking, evidence curation, and transparent discussion through multi-dimensional voting and threaded comments.

### Core Value Propositions
- **Evidence Submission**: Users contribute receipts (documents, images, links) tied to discussion topics
- **Community Voting**: Multi-dimensional voting on relevance (1-5), reliability (1-5), and bias (political spectrum)
- **Staff Verification**: Moderators authenticate evidence and update verification status
- **Credibility Scoring**: Automatic calculation based on vote averages and verification status
- **Discussion Layer**: Threaded comments with upvote/downvote mechanics
- **Notification System**: Real-time alerts for receipts, votes, comments, and verification status changes
- **Category Organization**: Topics grouped by category with search/filter capabilities

---

## Tech Stack & Dependencies

### Backend
| Component | Technology | Details |
|-----------|-----------|---------|
| Framework | Django 5.1.6 | REST API via Django REST Framework 3.15.2 |
| Database | PostgreSQL | Primary data store with migrations |
| Cache | Redis | Via `django-redis` for response caching in production |
| Auth | JWT SimpleJWT | 5-hour access tokens, 2-day refresh tokens |
| Task Queue | Celery 5.4.0+ | Async jobs, background tasks via Redis broker |
| File Storage | AWS S3 | Via `boto3` and `django-storages` |
| Email | AWS SES | Via `django-ses` for transactional emails |
| Filtering | django-filter 25.1 | Query filtering on receipt/vote endpoints |
| File Validation | Pillow + filetype | Image/document upload validation |
| CORS | django-cors-headers 4.7.0 | Cross-origin resource sharing |
| Security | bleach 6.2.0 | HTML sanitization for user content |
| Monitoring | Sentry SDK | Error tracking and logging |

### Frontend
| Component | Technology | Details |
|-----------|-----------|---------|
| Framework | React 19 (Vite) | Single Page Application with fast HMR |
| Styling | Mantine 8.1.1 | Dark theme with Reddit-inspired color palette |
| State | Redux Toolkit | Auth state, site config, receipt/topic caching |
| Routing | React Router v6 | Client-side routing with guards (LoggedInRoute, StaffLoggedInRoute) |
| HTTP Client | Axios (custom) | JWT auth, response caching, automatic error notifications |
| Icons | @tabler/icons-react | Consistent icon system (no other icon libs) |
| Dates | dayjs | Date formatting and relative time ("2 hours ago") |
| Forms | Mantine Form | Controlled inputs with validation |
| Dropzone | @mantine/dropzone | File upload widget for receipts |
| Notifications | @mantine/notifications | Toast notifications (success/error/info) |
| Modals | Mantine Modal | Dialog boxes (no native alert/confirm) |
| Hooks | @mantine/hooks | useMediaQuery, useDisclosure, etc. |
| Analytics | react-ga4 + react-facebook-pixel | Google Analytics & Meta Pixel tracking |

### Python Dependencies (Full List)
```
Django 5.1.6
djangorestframework 3.15.2
djangorestframework-simplejwt 5.4.0
django-redis 5.4.0
django-cors-headers 4.7.0
django-filter 25.1
django-storages 1.14.5
django-solo 2.4.0
django-extensions 3.2.3
django-positions 0.6.0
django-model-utils 5.0.0
django-ses 4.4.0
celery 5.4.0
Pillow 11.1.0
boto3 1.37.10
requests 2.32.3
sentry-sdk 2.21.0
python-decouple 3.8
gunicorn 23.0.0
whitenoise 6.9.0
psycopg2-binary / psycopg2
filetype 1.2.0
unidecode 1.3.8
```

### Frontend Package Structure (package.json)
- React 19, Vite (build tool)
- Redux Toolkit (state management)
- React Router v6
- Axios (HTTP)
- Mantine UI suite (v8.1.1)
- dayjs
- Tabler Icons
- js-cookie
- react-ga4
- react-facebook-pixel

---

## Architecture Overview

### Django App Structure

```
receipts/                      # Project root
├── accounts/                  # User authentication & profiles
│   ├── serializers.py         # UserBriefSerializer, UserDetailSerializer (shared)
│   └── profile/               # User profile model and viewsets
├── app/                       # Core domain (topics, items, conclusions, categories)
│   ├── topic/                 # Topic model with ai_summary, category FK, created_by FK
│   ├── item/                  # Generic item model with choice field
│   ├── conclusion/            # Topic conclusions with percentage_believed, votes
│   ├── category/              # Topic categorization with slug, icon, color, order
│   ├── expert/                # Expert field definitions (related to topics)
│   └── management/commands/   # Data seeding scripts
├── receipt/                   # Receipt & vote domain (core feature)
│   ├── models.py              # Receipt, ReceiptTopic (through), Vote models
│   ├── viewsets/              # ReceiptViewSet, VoteViewSet with custom actions
│   ├── serializers/           # List/detail serializers with vote stats
│   ├── filters.py             # ReceiptFilter, VoteFilter with search
│   ├── permissions.py         # IsOwnerOrReadOnly, IsStaffForVerification, etc.
│   └── managers.py            # Custom querysets (ReceiptManager, VoteManager)
├── comments/                  # Threaded comment system
│   ├── models.py              # Comment, CommentVote with GenericFK
│   └── viewsets.py            # CommentViewSet with threading support
├── notifications/             # User notifications
│   ├── models.py              # Notification, NotificationPreference
│   ├── managers.py            # NotificationManager
│   └── viewsets.py            # NotificationViewSet
├── moderation/                # Content moderation (future)
├── settings/                  # Site configuration model
├── util/                      # Shared utilities
│   ├── base_model/            # BaseModel with uid, created_at, updated_at
│   ├── cache_utils.py         # Caching decorators & invalidation
│   ├── email.py               # Templated email sending
│   └── permissions.py         # IsStaff, other shared permissions
├── api/                       # API configuration
│   ├── router.py              # DRF router with all endpoint registrations
│   ├── utils.py               # BurstRateThrottle, SustainedRateThrottle
│   ├── pagination.py          # StandardResultsSetPagination
│   └── filters.py             # Base filter utilities
├── receipts/                  # Django project settings
│   ├── settings.py            # INSTALLED_APPS, middleware, etc.
│   ├── urls.py                # Main URL patterns, catch-all for React
│   └── views/auth.py          # SignupView, LoginView, PasswordReset*View
├── frontend/                  # React SPA (Vite)
└── Dockerfile                 # Container definition
```

### Request/Response Flow

```
User → React Frontend (Vite)
         ↓
    Axios Wrapper (JWT auth, caching, error handling)
         ↓
Django REST API (DRF viewsets)
         ↓
Serializers (list/detail/create variants)
         ↓
Models (with BaseModel lifecycle: set_fields → validate → clean → save)
         ↓
PostgreSQL Database
         ↓
Cache (Redis in prod, LocMemCache in dev)
         ↓
Celery Tasks (async background jobs)
         ↓
AWS S3 (file storage) / AWS SES (email)
```

---

## Backend Data Models

### 1. **User Model** (Django built-in)
```python
class User:
    username: str (unique)
    email: str (unique)
    password: hashed
    first_name: str
    last_name: str
    is_staff: bool
    is_active: bool
    date_joined: datetime
```

### 2. **Profile Model** (accounts/profile/models.py)
```python
class Profile(BaseModel):
    user: OneToOneField(User)
    # Extensions for user profile data
```

### 3. **Topic Model** (app/topic/models.py)
```python
class Topic(BaseModel):
    name: str(255)
    ai_summary: TextField               # AI-generated summary of topic
    category: FK(Category, null=True)   # Optional topic categorization
    created_by: FK(User, null=True)     # User who created the topic
    created_at: datetime                # Auto-set
    updated_at: datetime                # Auto-updated
    
    Methods:
    - clean()                           # Orchestrates set_fields, validate
    - set_fields()                      # Compute derived values
    - validate()                        # Non-raising validation
    - post_clean()                      # Post-validation hooks
```

### 4. **Category Model** (app/category/models.py)
```python
class Category(BaseModel):
    name: str(255, unique)
    slug: SlugField(unique, auto-generated)
    description: TextField
    icon: str(100)                      # Icon name (Tabler icon)
    color: str(7)                       # Hex color code (e.g., #FF4500)
    order: int                          # Display order
    is_active: bool
    
    Relationships:
    - topics: reverse FK from Topic
```

### 5. **Receipt Model** (receipt/models.py)
```python
class Receipt(BaseModel):
    # Content
    title: str(255)
    evidence_text: TextField
    source_url: URLField(optional)
    source_type: Choice(primary|official|news|academic|social|witness|unknown)
    source_date: datetime(optional)
    
    # Verification
    verification_status: Choice(unverified|pending|verified|disputed|false)
    verification_notes: TextField
    verified_by: FK(User, optional)
    verified_at: datetime(optional)
    
    # Media
    image: ImageField(upload_to="receipts/images/", extensions: jpg|jpeg|png|gif|webp)
    document: FileField(upload_to="receipts/documents/", extensions: pdf|doc|docx|txt)
    
    # Relationships
    topics: ManyToManyField(Topic, through=ReceiptTopic)
    submitted_by: FK(User)              # Receipt author
    votes: GenericRelation(Vote)        # Multi-dimensional votes
    
    # Metadata
    is_primary_source: bool
    credibility_score: DecimalField(0-1) # Calculated from votes
    
    Methods:
    - calculate_credibility_score()     # From votes + verification status
    - update_credibility_score()        # Recalculate and save
    - clean()                           # Validation (score range, verified checks)
```

### 6. **ReceiptTopic Model** (receipt/models.py)
```python
class ReceiptTopic(BaseModel):
    receipt: FK(Receipt, cascade)
    topic: FK(Topic, cascade)
    relevance_score: DecimalField(0-1)  # How relevant to topic (community voted)
    added_by: FK(User)                  # Who linked this receipt to topic
    
    Constraint: UniqueConstraint(receipt, topic) — one receipt per topic
```

### 7. **Vote Model** (receipt/models.py)
```python
class Vote(BaseModel):
    # Generic foreign key to Receipt or Topic
    content_type: FK(ContentType)
    object_id: PositiveInteger
    content_object: GenericForeignKey   # Polymorphic: Receipt, Topic, Comment
    
    # Voter
    user: FK(User, cascade, related_name=votes)
    
    # Vote dimensions
    relevance: Choice(1|2|3|4|5)        # How relevant? (1=not, 5=very)
    reliability: Choice(1|2|3|4|5)      # How reliable? (1=unreliable, 5=highly reliable)
    bias: Choice(far_left|left|center_left|center|center_right|right|far_right|unknown)
    
    # Optional metadata
    comment: TextField(optional)        # Explanation for vote
    expertise_claimed: bool             # Does voter claim expertise?
    
    Constraint: UniqueConstraint(content_type, object_id, user) — one vote per user per object
```

### 8. **Comment Model** (comments/models.py)
```python
class Comment(BaseModel):
    content: TextField                  # Comment text
    author: FK(User, cascade)
    
    # Generic relation to commented object (Receipt or Topic)
    content_type: FK(ContentType, limit_choices_to=["receipt", "topic"])
    object_id: PositiveInteger
    content_object: GenericForeignKey
    
    # Threading
    parent: FK(self, optional, cascade, related_name=replies) # For nested replies
    
    # Moderation
    is_removed: bool(default=False)
    removed_reason: str(optional)
    
    # Metrics
    upvotes: PositiveInteger(default=0)
    downvotes: PositiveInteger(default=0)
    
    # Edit tracking
    is_edited: bool
    edited_at: datetime(optional)
    
    Properties:
    - score: property = upvotes - downvotes
    - reply_count: property
    - get_thread_depth(): method
```

### 9. **CommentVote Model** (comments/models.py)
```python
class CommentVote(BaseModel):
    user: FK(User, cascade)
    comment: FK(Comment, cascade)
    vote_type: Choice(upvote|downvote)
    
    Constraint: UniqueConstraint(user, comment) — one vote per user per comment
```

### 10. **Notification Model** (notifications/models.py)
```python
class Notification(BaseModel):
    # Recipient
    recipient: FK(User, cascade)
    
    # Type and content
    notification_type: Choice (see NOTIFICATION_TYPES below)
    title: str(255)
    message: TextField
    
    # Related object (optional)
    content_type: FK(ContentType, optional)
    object_id: PositiveInteger(optional)
    content_object: GenericForeignKey
    
    # Actor (who triggered notification)
    actor: FK(User, optional, related_name=triggered_notifications)
    
    # Status
    is_read: bool(default=False)
    read_at: datetime(optional)
    
    # Additional data
    metadata: JSONField                 # Flexible data storage
    action_url: str(500, optional)      # URL to navigate to when clicked
    
    Methods:
    - mark_as_read()
    - get_icon(): returns icon name from NOTIFICATION_TYPES map
    - get_color(): returns color for UI
```

**NOTIFICATION_TYPES:**
```
new_receipt_for_topic
receipt_verified
receipt_disputed
vote_on_receipt
vote_on_topic
vote_on_comment
expert_vote
comment_on_content
comment_reply
new_topic_in_category
topic_receipt_threshold
follower_new
mentioned
report_resolved
content_reported
verification_status_change
credibility_milestone
system_announcement
```

### 11. **NotificationPreference Model** (notifications/models.py)
```python
class NotificationPreference(BaseModel):
    user: OneToOneField(User, cascade)
    email_enabled: bool(default=True)
    type_preferences: JSONField        # {notification_type: {in_app: bool, email: bool}}
    email_frequency: Choice(immediate|daily|weekly|never)
    
    Methods:
    - should_send_notification(type, channel): bool
```

### 12. **Conclusion Model** (app/conclusion/models.py)
```python
class Conclusion(BaseModel):
    title: str(255)
    percentage_believed: DecimalField(0-100)  # How many % believe this?
    topic: FK(Topic, cascade)
    upvotes: PositiveInteger(default=0)
    downvotes: PositiveInteger(default=0)
```

### 13. **Item Model** (app/item/models.py)
```python
class Item(BaseModel):
    class Choice(TextChoices):
        ONE = "one"
        TWO = "two"
        THREE = "three"
    
    choice: CharField(choices=Choice.choices, default=ONE)
    profile: FK(Profile, on_delete=PROTECT)
    save_counter: int(default=0)
```

### 14. **Expert Model** (app/expert/models.py)
```python
class Expert(BaseModel):
    title: str(255)
    topic: FK(Topic, cascade, related_name=conclusions)  # Note: naming conflict, should be "experts"
```

### 15. **Category Model Extensions** (app/category/models.py)
- Already covered above (unique slug, auto-generated from name)

---

## Backend Features & API Endpoints

### Authentication Endpoints

| Method | Endpoint | Auth | Purpose | Inputs | Outputs |
|--------|----------|------|---------|--------|---------|
| POST | `/api/signup/` | AllowAny | User registration | username, email, password1, password2, first_name, last_name | {token, refresh} + JWT tokens |
| POST | `/api/login/` | AllowAny | Login with username or email | username_or_email, password | {token, refresh} + JWT tokens |
| POST | `/api/token/refresh/` | AllowAny | Refresh access token | {refresh} | {access} |
| POST | `/api/password-reset/` | AllowAny | Request password reset email | email | confirmation message |
| POST | `/api/password-reset/validate/<uid>/<token>/` | AllowAny | Validate reset token | (none, GET only) | {valid: bool} |
| POST | `/api/password-reset/confirm/` | AllowAny | Set new password | uid, token, new_password | confirmation |

### Topic Endpoints

| Method | Endpoint | Auth | Permissions | Purpose |
|--------|----------|------|-------------|---------|
| GET | `/app/topics/` | Optional | AllowAny | List topics with filtering, search, caching |
| GET | `/app/topics/<id>/` | Optional | AllowAny | Topic detail with receipts, conclusions |
| POST | `/app/topics/` | Required | IsAuthenticatedOrReadOnly | Create topic (sets created_by) |
| PUT | `/app/topics/<id>/` | Required | IsOwnerOrReadOnly | Update topic |
| PATCH | `/app/topics/<id>/` | Required | IsOwnerOrReadOnly | Partial update |
| DELETE | `/app/topics/<id>/` | Required | IsOwnerOrReadOnly | Delete topic |
| GET | `/app/staff-topics/` | Required | IsStaff | Staff-only topic list with extra fields |
| GET | `/app/staff-topics/<id>/` | Required | IsStaff | Staff-only topic detail |

**Filters on topics:**
- `search`: Full-text search on name, ai_summary
- `category`: Filter by category slug
- `created_by`: Filter by creator ID

**Annotations on list:**
- `annotated_receipt_count`: Count of receipts per topic
- `confidence_avg`: Average credibility score of receipts
- `has_verified`: Count of verified receipts
- `has_false`: Count of false receipts
- `has_pending`: Count of pending receipts
- `has_disputed`: Count of disputed receipts

### Receipt Endpoints

| Method | Endpoint | Auth | Permissions | Purpose |
|--------|----------|------|-------------|---------|
| GET | `/receipt/api/receipts/` | Optional | AllowAny | List receipts with filtering, ordering, pagination |
| GET | `/receipt/api/receipts/<id>/` | Optional | AllowAny | Receipt detail with topics, votes, stats |
| POST | `/receipt/api/receipts/` | Required | IsAuthenticatedForCreate | Create receipt (sets submitted_by) |
| PUT | `/receipt/api/receipts/<id>/` | Required | IsOwnerOrReadOnly | Update receipt |
| PATCH | `/receipt/api/receipts/<id>/` | Required | IsOwnerOrReadOnly | Partial update |
| DELETE | `/receipt/api/receipts/<id>/` | Required | IsOwnerOrReadOnly | Delete receipt |
| POST | `/receipt/api/receipts/<id>/verify/` | Required | IsStaffForVerification | Verify/update verification status |
| POST | `/receipt/api/receipts/<id>/attach-topic/` | Required | IsAuthenticated | Link receipt to topic |
| POST | `/receipt/api/receipts/<id>/detach-topic/` | Required | IsAuthenticated | Unlink receipt from topic |
| GET | `/receipt/api/receipts/<id>/votes/` | Optional | AllowAny | Get all votes for receipt (cached) |

**Receipt Filters:**
- `search`: Full-text on title, evidence_text
- `topic`: By topic ID
- `category`: By category slug (via topic)
- `source_type`: By source type choice
- `verification_status`: By verification status
- `submitted_by`: By user ID
- `created_after`, `created_before`: Date range filters
- `source_date_after`, `source_date_before`: Source date range
- `min_credibility`: Minimum credibility score
- `is_primary_source`: Boolean filter

**Receipt Ordering:**
- `created_at`, `updated_at`, `credibility_score`, `source_date`, `vote_count`, `relevance_avg`, `reliability_avg`

**Receipt Detail Annotations:**
- `vote_count`: Total votes
- `relevance_avg`: Average relevance rating
- `reliability_avg`: Average reliability rating
- `upvote_count`: Votes with relevance >= 3 AND reliability >= 3
- `downvote_count`: Votes with relevance < 3 OR reliability < 3
- `vote_comment_count`: Votes with non-empty comments
- `topic_count`: Number of topics linked

### Vote Endpoints

| Method | Endpoint | Auth | Permissions | Purpose |
|--------|----------|------|-------------|---------|
| GET | `/receipt/api/votes/` | Optional | AllowAny | List votes with filtering, pagination |
| GET | `/receipt/api/votes/<id>/` | Optional | AllowAny | Vote detail |
| POST | `/receipt/api/votes/` | Required | IsAuthenticated | Create or update vote (one per user per object) |
| PUT | `/receipt/api/votes/<id>/` | Required | IsOwnerOrReadOnly | Update own vote |
| PATCH | `/receipt/api/votes/<id>/` | Required | IsOwnerOrReadOnly | Partial update |
| DELETE | `/receipt/api/votes/<id>/` | Required | IsOwnerOrReadOnly | Delete own vote |

**Vote Filters:**
- `content_type`: Model name ('receipt', 'topic', etc.)
- `object_id`: Object ID
- `user`: User ID
- `min_relevance`: Minimum relevance rating
- `min_reliability`: Minimum reliability rating
- `bias`: Bias choice
- `expertise_claimed`: Boolean
- `has_comment`: Boolean (vote has comment)

**Vote Create Serializer Features:**
- `update_or_create` logic: One vote per user per object
- Automatic credibility score recalculation after vote
- Cache invalidation on vote creation/update/delete

### Comment Endpoints

| Method | Endpoint | Auth | Permissions | Purpose |
|--------|----------|------|-------------|---------|
| GET | `/comments/api/comments/` | Optional | AllowAny | List comments with pagination |
| GET | `/comments/api/comments/<id>/` | Optional | AllowAny | Comment detail with replies |
| POST | `/comments/api/comments/` | Required | IsAuthenticated | Create comment on receipt/topic |
| PUT | `/comments/api/comments/<id>/` | Required | IsOwnerOrReadOnly | Edit comment |
| PATCH | `/comments/api/comments/<id>/` | Required | IsOwnerOrReadOnly | Partial update |
| DELETE | `/comments/api/comments/<id>/` | Required | IsOwnerOrReadOnly | Delete comment |

**Threaded Comments:**
- `parent` field for nested replies
- `replies` reverse relation
- Moderation: `is_removed`, `removed_reason`
- Metrics: `upvotes`, `downvotes`, `is_edited`, `edited_at`

### Notification Endpoints

| Method | Endpoint | Auth | Permissions | Purpose |
|--------|----------|------|-------------|---------|
| GET | `/notifications/api/notifications/` | Required | IsAuthenticated | List user's notifications |
| GET | `/notifications/api/notifications/<id>/` | Required | IsAuthenticated | Notification detail |
| POST | `/notifications/api/notifications/<id>/mark-as-read/` | Required | IsAuthenticated | Mark notification as read |
| PATCH | `/notifications/api/notifications/<id>/` | Required | IsOwnerOrReadOnly | Update notification |

### Category Endpoints

| Method | Endpoint | Auth | Permissions | Purpose |
|--------|----------|------|-------------|---------|
| GET | `/app/categories/` | Optional | AllowAny | List categories (ordered by `order` field) |
| GET | `/app/categories/<id>/` | Optional | AllowAny | Category detail |
| POST | `/app/categories/` | Required | IsStaff | Create category |
| PUT | `/app/categories/<id>/` | Required | IsStaff | Update category |
| PATCH | `/app/categories/<id>/` | Required | IsStaff | Partial update |
| DELETE | `/app/categories/<id>/` | Required | IsStaff | Delete category |
| GET | `/app/staff-categories/` | Required | IsStaff | Staff-only view with extra fields |

### Profile Endpoints

| Method | Endpoint | Auth | Permissions | Purpose |
|--------|----------|------|-------------|---------|
| GET | `/accounts/profiles/` | Optional | AllowAny | List user profiles (lightweight) |
| GET | `/accounts/profiles/<id>/` | Optional | AllowAny | Profile detail |
| POST | `/accounts/profiles/` | Required | IsAuthenticated | Create profile |
| PUT | `/accounts/profiles/<id>/` | Required | IsOwnerOrReadOnly | Update profile |
| PATCH | `/accounts/profiles/<id>/` | Required | IsOwnerOrReadOnly | Partial update |

### Conclusion Endpoints

| Method | Endpoint | Auth | Permissions | Purpose |
|--------|----------|------|-------------|---------|
| GET | `/app/conclusions/` | Optional | AllowAny | List conclusions |
| GET | `/app/conclusions/<id>/` | Optional | AllowAny | Conclusion detail |
| POST | `/app/conclusions/` | Required | IsAuthenticated | Create conclusion for topic |
| PUT | `/app/conclusions/<id>/` | Required | IsOwnerOrReadOnly | Update conclusion |
| PATCH | `/app/conclusions/<id>/` | Required | IsOwnerOrReadOnly | Partial update |
| DELETE | `/app/conclusions/<id>/` | Required | IsOwnerOrReadOnly | Delete conclusion |

---

## Frontend Architecture

### React Component Structure

```
frontend/src/
├── App.jsx                          # Root component, routing setup
├── main.jsx                         # React 19 entrypoint
├── index.css                        # Global CSS variables (--reddit-*)
├── pages/                           # Page-level components
│   ├── HomePage.jsx                 # Landing page with hero
│   └── NewHome.jsx                  # Alternative home
├── components/                      # Reusable UI components
│   ├── Header/                      # Top navigation bar
│   ├── Footer/                      # Footer
│   ├── Sidebar/                     # Left sidebar with categories
│   ├── BottomNav/                   # Mobile bottom navigation
│   ├── Router/                      # Route guards & AppRouter
│   │   ├── LoggedInRoute.jsx        # Protected for authenticated users
│   │   ├── StaffLoggedInRoute.jsx   # Protected for staff only
│   │   └── AppRouter.jsx            # Route definitions
│   ├── ReceiptCard/                 # Receipt preview component
│   ├── Vote/                        # Voting UI (relevance, reliability, bias)
│   ├── Comment/                     # Comment thread component
│   ├── FilterBar/                   # Receipt filtering & search UI
│   ├── Category/                    # Category selector
│   ├── Notification/                # Notification center UI
│   ├── StaffDashboard/              # Staff moderation interface
│   ├── Page/                        # Page wrapper with sidebar logic
│   ├── AboutUs/                     # Static about page
│   ├── NotFound/                    # 404 page
│   ├── ErrorBoundary/               # Error boundary with Mantine UI recovery
│   ├── core/                        # Core wrapper components
│   │   ├── ButtonWrapper.jsx        # Mantine Button wrapper (routing integration)
│   │   ├── TextInputWrapper.jsx     # Mantine TextInput wrapper
│   │   ├── ModalWrapper.jsx         # Mantine Modal wrapper
│   │   ├── ActionIconWrapper.jsx    # Mantine ActionIcon wrapper
│   │   └── DocumentTitle.jsx        # Dynamic page title setter
│   ├── CookieConsentWrapper.jsx     # Cookie consent banner
│   └── Navigation/
│       └── BottomNav.jsx            # Mobile-only bottom navigation
├── pages/                           # Page containers (routes)
│   ├── HomePage.jsx
│   ├── LoginPage.jsx                # Login form
│   ├── SignUpPage.jsx               # Registration form
│   ├── ReceiptsListPage.jsx         # Receipts with filters
│   ├── ReceiptDetailPage.jsx        # Single receipt view + votes + comments
│   ├── SubmitReceiptPage.jsx        # Receipt creation form
│   ├── TopicsListPage.jsx           # Topics with search
│   ├── TopicDetailPage.jsx          # Topic detail + receipts + conclusions
│   ├── CreateTopicPage.jsx          # Topic creation form
│   ├── UserDashboard.jsx            # User profile & activity
│   ├── NotificationCenterPage.jsx   # Notification list
│   ├── StaffDashboardPage.jsx       # Moderation interface
│   └── NotFoundPage.jsx             # 404
├── store/                           # Redux state management
│   ├── store.js                     # Redux store configuration
│   ├── slices/                      # Redux Toolkit slices
│   │   ├── authSlice.jsx            # Auth state (profile, token)
│   │   ├── receiptsSlice.js         # Receipts list & detail caching
│   │   ├── topicsSlice.js           # Topics list & detail caching
│   │   ├── categoriesSlice.js       # Categories list
│   │   └── siteConfigurationSlice.jsx # Site-wide settings
│   └── actions/                     # Async thunks for API calls
│       ├── authActions.jsx          # fetchProfile, login, signup
│       ├── receiptActions.js        # fetchReceipts, fetchReceiptDetail
│       ├── topicActions.js          # fetchTopics, fetchTopicDetail
│       └── siteConfigurationActions.jsx # fetchSiteConfiguration
├── util/                            # Utilities
│   ├── Axios.js                     # Custom Axios wrapper with JWT, caching
│   └── (date/string formatting helpers)
├── utils/                           # Additional utilities
├── services/                        # API service layer
│   ├── receiptService.js            # Receipt API calls
│   ├── topicService.js              # Topic API calls
│   ├── voteService.js               # Vote API calls
│   └── commentService.js            # Comment API calls
├── api/                             # API configuration
├── data/                            # Static data, constants
├── theme/                           # Mantine theme customization
└── test/                            # Test setup, utilities
```

### Redux State Shape

```javascript
{
  auth: {
    profile: {
      id: number,
      username: string,
      email: string,
      first_name: string,
      last_name: string,
      is_staff: boolean
    },
    token: string | null,
    loading: boolean,
    error: string | null
  },
  
  receipts: {
    list: [
      {
        id: number,
        title: string,
        evidence_text: string,
        source_type: string,
        verification_status: string,
        submitted_by: { id, username },
        vote_count: number,
        relevance_avg: number,
        reliability_avg: number,
        topic_count: number,
        credibility_score: decimal,
        created_at: string
      }
    ],
    detail: { /* full receipt object with all fields */ },
    filters: { source_type, verification_status, topic, category },
    ordering: string,
    page: number,
    count: number,
    loading: boolean,
    error: string | null
  },
  
  topics: {
    list: [
      {
        id: number,
        name: string,
        ai_summary: string,
        category: { id, name, slug, color },
        created_by: { id, username },
        annotated_receipt_count: number,
        confidence_avg: decimal,
        has_verified: number,
        has_false: number,
        created_at: string
      }
    ],
    detail: { /* full topic object */ },
    search: string,
    page: number,
    count: number,
    loading: boolean
  },
  
  categories: {
    list: [
      {
        id: number,
        name: string,
        slug: string,
        icon: string,
        color: string,
        order: number,
        is_active: boolean
      }
    ],
    loading: boolean
  },
  
  site_config: {
    site_configuration: {
      app_name: string,
      app_description: string,
      logo_url: string
    },
    loading: boolean
  }
}
```

### Axios Wrapper Features (`frontend/src/util/Axios.js`)

```javascript
// Custom axios instance with:
// - JWT token injection (from localStorage)
// - Automatic token refresh on 401
// - CSRF token handling
// - Response caching (default 5 min TTL)
// - Automatic error notifications (Mantine)
// - Custom cache config methods

Axios.get(url)                              // Uses 5 min cache
Axios.get(url, Axios.cacheConfig.noCache()) // Bypass cache
Axios.get(url, Axios.cacheConfig.shortCache()) // 1 min
Axios.get(url, Axios.cacheConfig.longCache()) // 30 min

Axios.post/put/patch/delete()              // Auto-clear related caches
```

---

## Frontend Pages & Components

### 1. **HomePage.jsx**
- Hero section with app description
- Featured topics carousel
- Call-to-action for signup/login
- Recent receipts preview
- Categories showcase

### 2. **LoginPage.jsx**
- Email/username and password inputs
- "Forgot password?" link
- Signup redirect
- Form validation
- Error notifications

### 3. **SignUpPage.jsx**
- Username, email, password (x2), first_name, last_name inputs
- Password strength validation
- Terms & conditions checkbox
- Login redirect
- Error handling

### 4. **ReceiptsListPage.jsx**
- ReceiptCard grid/list
- FilterBar (source_type, verification_status, topic, category)
- Search box (title, evidence_text)
- Sorting dropdown (created_at, credibility_score, etc.)
- Pagination
- Infinite scroll option

### 5. **ReceiptDetailPage.jsx**
- Receipt header (title, submitted_by, created_at, credibility_score)
- Evidence text with formatting
- Image/document preview if present
- Source info (type, date, URL)
- Verification badge (verified, disputed, false, pending)
- Topics list (with relevance scores)
- Vote Panel (relevance 1-5, reliability 1-5, bias selector, optional comment)
- Vote Statistics (aggregated avg ratings, expert count, comment count)
- Comments Section (threaded, with upvote/downvote per comment)
- Related Receipts sidebar

### 6. **SubmitReceiptPage.jsx**
- Form fields:
  - Title
  - Evidence text
  - Source URL (optional)
  - Source type dropdown
  - Source date picker
  - Image upload (drag-drop)
  - Document upload (drag-drop)
  - Topic selection (multi-select)
  - Is primary source checkbox
- Form validation
- Upload progress indicator (for S3)
- Success notification with link to receipt

### 7. **TopicsListPage.jsx**
- Topics list with category filter
- Search box (name, ai_summary)
- Topic cards showing:
  - Name
  - AI summary preview
  - Category badge
  - Receipt count
  - Avg confidence score
  - Verification status indicators (verified/false/disputed counts)
- Pagination or infinite scroll
- Create topic button (logged in)

### 8. **TopicDetailPage.jsx**
- Topic header (name, category, created_by, created_at)
- AI summary
- Conclusions section (with percentage_believed for each)
- Receipts attached to topic (filterable)
- Add receipt modal
- Expert opinions section (if available)
- Comments on topic
- Related topics sidebar

### 9. **CreateTopicPage.jsx**
- Form fields:
  - Topic name
  - Initial AI summary (auto-generated or manual)
  - Category selection
- Form validation
- Success notification

### 10. **UserDashboard.jsx** (Logged-in users)
- Profile section (username, email, name, avatar)
- My receipts section (user's submitted receipts)
- My votes section (user's votes on receipts)
- My topics section (user's created topics)
- Activity timeline
- Settings link

### 11. **NotificationCenterPage.jsx**
- Notification list (paginated)
- Filter by type (new_receipt, verified, vote, comment, etc.)
- Mark as read / Mark all as read
- Notification detail on click with navigation
- Badge showing unread count
- Empty state if no notifications

### 12. **StaffDashboardPage.jsx**
- Receipt verification queue (unverified, pending)
- Verification form (status, notes, decision)
- Report/moderation queue
- Comment moderation (remove with reason)
- User management (view/deactivate)
- Site statistics (receipt count, vote count, user count)
- Celery task monitoring (optional)

### 13. **NotFoundPage.jsx**
- 404 error message
- "Go back home" link
- Mantine-styled error layout

### 14. **CookieConsentWrapper.jsx**
- Cookie banner with accept/reject buttons
- Stores preference in localStorage
- Manages Google Analytics & Meta Pixel consent

### 15. **EnhancedSidebar.jsx**
- Categories list with icon and color
- Selected category highlight
- Collapsible on mobile
- User profile section (if logged in)
- Logout button

---

## Authentication & Authorization

### Authentication Flow

**JWT Token Structure:**
- **Access Token** (5 hours): Sent in `Authorization: Bearer <token>` header
- **Refresh Token** (14 days): Stored in localStorage, used to refresh access token on expiry

**Frontend Auth State:**
```javascript
// localStorage
localStorage.setItem("token", accessToken)
localStorage.setItem("refreshToken", refreshToken)

// Redux auth slice
auth.profile = { id, username, email, first_name, last_name, is_staff }
```

**Backend Auth:**
- `SimpleJWT` from `rest_framework_simplejwt`
- `TokenRefreshView` endpoint to refresh tokens
- Automatic token validation in viewset permission classes

### Permission Classes

| Class | Purpose | Location |
|-------|---------|----------|
| `AllowAny` | Anyone (no auth required) | DRF built-in |
| `IsAuthenticated` | User logged in required | DRF built-in |
| `IsAuthenticatedOrReadOnly` | Read anyone, write auth required | DRF built-in |
| `IsOwnerOrReadOnly` | Read anyone, write owner only | `receipt/permissions.py` |
| `IsStaffForVerification` | Only staff can verify receipts | `receipt/permissions.py` |
| `IsAuthenticatedForCreate` | POST requires auth, GET open | `receipt/permissions.py` |
| `CanModifyReceiptTopic` | Receipt owner or topic creator can modify | `receipt/permissions.py` |
| `IsStaff` | Only staff users | `util/permissions.py` |

### Frontend Route Guards

```javascript
// Public route
<Route path="/topics" element={<TopicsListPage />} />

// Protected route (logged-in users)
<LoggedInRoute>
  <ReceiptsListPage />
</LoggedInRoute>

// Staff-only route
<StaffLoggedInRoute>
  <StaffDashboardPage />
</StaffLoggedInRoute>
```

**LoggedInRoute** checks:
1. localStorage token exists
2. Redux auth.profile is populated
3. Redirects to login if not

**StaffLoggedInRoute** additionally checks:
1. `user.is_staff === true`

---

## Key Features & Requirements

### Feature 1: Receipt Submission & Management
**Purpose:** Users submit evidence linked to topics

**Inputs:**
- Title (required, max 255 chars)
- Evidence text (required)
- Source URL (optional)
- Source type (required: primary|official|news|academic|social|witness|unknown)
- Source date (optional)
- Image file (optional: jpg|jpeg|png|gif|webp)
- Document file (optional: pdf|doc|docx|txt)
- Topic(s) to attach (required at least one)
- Is primary source (boolean)

**Outputs:**
- Receipt object with:
  - id, uid (external ID)
  - All input fields
  - submitted_by (auto-set to current user)
  - created_at, updated_at
  - verification_status (initially "unverified")
  - credibility_score (0 initially)

**Dependencies:**
- User authentication required
- Topic must exist
- File validation (extension, size)
- AWS S3 upload for media

**Edge Cases:**
- Duplicate receipt detection
- Invalid file types/sizes
- Offline form submission (localStorage draft)
- Concurrent submissions

**API Endpoints:**
- `POST /receipt/api/receipts/` — Create
- `PUT /receipt/api/receipts/<id>/` — Full update
- `PATCH /receipt/api/receipts/<id>/` — Partial update
- `DELETE /receipt/api/receipts/<id>/` — Delete (owner only)
- `GET /receipt/api/receipts/` — List with filters/sorting
- `GET /receipt/api/receipts/<id>/` — Detail

### Feature 2: Multi-Dimensional Voting
**Purpose:** Community assesses receipt relevance, reliability, and bias

**Inputs:**
- Relevance (1-5 scale: not relevant to very relevant)
- Reliability (1-5 scale: unreliable to highly reliable)
- Bias (7-point scale: far_left to far_right + unknown)
- Comment (optional, max 500 chars)
- Expertise claimed (boolean)
- Content type & ID (receipt or topic)

**Outputs:**
- Vote object with:
  - id, user_id, content_type, object_id
  - relevance, reliability, bias, comment, expertise_claimed
  - created_at, updated_at

**Constraints:**
- One vote per user per object (update if exists)
- Votes are public (visible to all)
- Vote deletion is allowed

**Automatic Actions:**
- Receipt credibility_score recalculation
- Vote statistics aggregation (avg, counts)
- Cache invalidation

**Edge Cases:**
- Updating own vote (becomes PUT, not POST)
- Deleting vote recalculates credibility
- Expert votes highlighted if claimed expertise

**API Endpoints:**
- `POST /receipt/api/votes/` — Create/update (one per user)
- `GET /receipt/api/votes/` — List with filters
- `GET /receipt/api/votes/<id>/` — Detail
- `PUT /receipt/api/votes/<id>/` — Update own vote
- `DELETE /receipt/api/votes/<id>/` — Delete own vote
- `GET /receipt/api/receipts/<id>/votes/` — Get all votes for receipt (cached)

### Feature 3: Staff Verification
**Purpose:** Moderators authenticate receipts and set verification status

**Verification Statuses:**
- `unverified` (initial, no staff action)
- `pending` (being reviewed)
- `verified` (confirmed accurate)
- `disputed` (conflicting evidence)
- `false` (confirmed inaccurate/misleading)

**Inputs:**
- Verification status (choice above)
- Verification notes (optional, max 1000 chars)

**Outputs:**
- Receipt updated with:
  - verification_status
  - verification_notes
  - verified_by (set to staff user)
  - verified_at (set to current time)
  - credibility_score (recalculated based on new status)

**Permissions:**
- Only `is_staff` users can call verify action
- ReadOnly for non-staff

**Automatic Actions:**
- Notification sent to receipt submitter
- Credibility recalculation
- Cache invalidation

**Edge Cases:**
- Changing verification status (updates existing fields)
- Audit trail of verification history (optional: use edit_log)

**API Endpoint:**
- `POST /receipt/api/receipts/<id>/verify/` — Verify/update status (staff only)

### Feature 4: Credibility Scoring
**Purpose:** Automatic calculation of receipt trustworthiness

**Algorithm:**
```
credibility_score = (
  (avg_relevance / 5 * 0.3) +
  (avg_reliability / 5 * 0.4) +
  (verification_boost * 0.3)
)

Where:
- avg_relevance = average of all relevance votes
- avg_reliability = average of all reliability votes
- verification_boost = 1.0 if verified, 0.8 if disputed, 0.0 if false, 0.5 if pending, 0.0 if unverified
```

**Inputs:**
- Receipt votes (relevance, reliability)
- Verification status

**Outputs:**
- Decimal score 0-1
- Updated in Receipt.credibility_score field

**Caching:**
- Recalculated on every vote create/update/delete
- Cached after calculation for 1 hour

**Edge Cases:**
- No votes (score = 0)
- Single vote vs. consensus
- Outlier votes (could add median instead of mean)

**Methods:**
- `receipt.calculate_credibility_score()` — returns score
- `receipt.update_credibility_score()` — calculates and saves

### Feature 5: Threaded Comments
**Purpose:** Discussion threads on receipts and topics

**Inputs:**
- Content (required, max 5000 chars)
- Parent comment ID (optional for replies)
- Content type & ID (receipt or topic)

**Outputs:**
- Comment object with:
  - id, content, author_id, created_at, updated_at
  - content_type, object_id, parent_id
  - is_removed, removed_reason (moderation)
  - upvotes, downvotes
  - is_edited, edited_at

**Features:**
- Nested replies (parent/child hierarchy)
- Max depth limiting (10 levels)
- Upvote/downvote metrics
- Comment removal with reason (moderation)
- Edit tracking (is_edited, edited_at)
- Thread depth calculation

**Constraints:**
- One user per comment (can't edit others' comments unless staff)
- Replies must have valid parent
- Content length max 5000 chars

**Edge Cases:**
- Comment edit history (optional: separate model)
- Parent comment deletion (cascade delete replies)
- Deeply nested threads (pagination per depth)

**API Endpoints:**
- `POST /comments/api/comments/` — Create comment
- `GET /comments/api/comments/` — List comments with pagination
- `GET /comments/api/comments/<id>/` — Detail with replies
- `PUT /comments/api/comments/<id>/` — Edit (owner only)
- `DELETE /comments/api/comments/<id>/` — Delete (owner or staff)
- `POST /comments/api/comments/<id>/remove/` — Moderate (staff only)

### Feature 6: Notifications
**Purpose:** Real-time alerts for user activity

**Notification Types Supported:**
- `new_receipt_for_topic` — Receipt submitted for topic user follows
- `receipt_verified` — Your receipt was verified
- `receipt_disputed` — Your receipt was disputed
- `vote_on_receipt` — Someone voted on your receipt
- `vote_on_topic` — Someone voted on your topic
- `vote_on_comment` — Someone voted on your comment
- `expert_vote` — Expert voted on your content
- `comment_on_content` — Someone commented on receipt/topic
- `comment_reply` — Someone replied to your comment
- `new_topic_in_category` — New topic in category you follow
- `topic_receipt_threshold` — Topic reached receipt count threshold
- `follower_new` — New user followed you
- `mentioned` — You were mentioned
- `report_resolved` — Report was resolved
- `content_reported` — Your content was reported
- `verification_status_change` — Receipt verification status changed
- `credibility_milestone` — Your credibility reached milestone
- `system_announcement` — Site announcement

**Inputs:**
- Notification type (choice from above)
- Recipient user_id
- Title, message
- Optional: content_type, object_id, actor_id
- Optional: metadata (JSON), action_url

**Outputs:**
- Notification object with:
  - id, recipient_id, notification_type, title, message
  - is_read, read_at
  - content_object (generic relation)
  - actor (who triggered it)
  - action_url
  - created_at, updated_at

**Features:**
- In-app notifications (list, mark as read)
- Email notifications (optional, preference-based)
- Notification preferences (per user, per type, email frequency)
- Icon & color mapping per type

**Triggers:**
- Celery tasks on receipt creation, vote creation, comment creation, etc.
- Async to avoid blocking API response

**User Preferences:**
- `email_enabled` (global on/off)
- `type_preferences` (per type: in_app, email)
- `email_frequency` (immediate, daily, weekly, never)

**Edge Cases:**
- Bulk notifications (digest vs. individual)
- Duplicate notification prevention
- Rate limiting (don't spam user)

**API Endpoints:**
- `GET /notifications/api/notifications/` — List user's notifications
- `GET /notifications/api/notifications/<id>/` — Notification detail
- `POST /notifications/api/notifications/<id>/mark-as-read/` — Mark as read
- `PATCH /notifications/api/notifications/<id>/` — Update
- `GET /notifications/api/notification-preferences/` — Get preferences
- `PUT /notifications/api/notification-preferences/` — Update preferences

### Feature 7: Topic Management
**Purpose:** Create and organize evidence discussion topics

**Inputs:**
- Topic name (required, max 255 chars)
- AI summary (auto-generated or manual)
- Category (optional FK)
- Created by (auto-set to user)

**Outputs:**
- Topic object with:
  - id, name, ai_summary, category_id, created_by_id
  - created_at, updated_at

**Related Objects:**
- Receipts (many via ReceiptTopic through-table)
- Conclusions (many)
- Comments (many)
- Votes (many via generic relation)

**Metadata:**
- Receipt count (annotated)
- Avg credibility (annotated)
- Verified/disputed/false/pending receipt counts (annotated)

**Caching:**
- List cached for 5 minutes
- Detail cached for 10 minutes
- Invalidated on create/update/delete

**Edge Cases:**
- Duplicate topic detection (search existing)
- Topic merging (combine receipts)
- Topic archival (soft delete)

**API Endpoints:**
- `GET /app/topics/` — List with search, filters, caching
- `GET /app/topics/<id>/` — Detail with receipts, conclusions
- `POST /app/topics/` — Create (sets created_by)
- `PUT /app/topics/<id>/` — Update (owner or staff)
- `PATCH /app/topics/<id>/` — Partial update
- `DELETE /app/topics/<id>/` — Delete (owner or staff)

### Feature 8: Category Organization
**Purpose:** Organize topics by category for navigation

**Inputs:**
- Category name (required, unique, max 255 chars)
- Description (optional)
- Icon (Tabler icon name, e.g., "receipt")
- Color (hex code, required, auto-validated)
- Order (display order, integer)
- Is active (boolean)

**Outputs:**
- Category object with:
  - id, name, slug (auto-generated from name), description
  - icon, color, order, is_active
  - created_at, updated_at

**Slug Generation:**
- Auto-generated from name using Django `slugify()`
- Example: "Health & Wellness" → "health-wellness"
- Unique constraint

**Validation:**
- Color must be valid hex (7 chars, starts with #)

**Relationships:**
- Topics (many, reverse FK)

**Display:**
- Ordered by `order` field, then by `name`
- Shown in sidebar with icon and color
- Filterable on receipt/topic list pages

**API Endpoints:**
- `GET /app/categories/` — List (ordered)
- `GET /app/categories/<id>/` — Detail
- `POST /app/categories/` — Create (staff only)
- `PUT /app/categories/<id>/` — Update (staff only)
- `PATCH /app/categories/<id>/` — Partial update (staff only)
- `DELETE /app/categories/<id>/` — Delete (staff only)

---

## Development Standards

### Code Organization Standards

**Backend Conventions:**
- Serializers organized in `<app>/serializers/list/`, `detail/`, `create/` subdirectories
- Each serializer file re-exports in `__init__.py` for backward compatibility
- ViewSets in `<app>/viewsets/` with mixins and action-based serializer selection
- Filters in `<app>/filters.py` with FilterSet per model
- Permissions in `<app>/permissions.py` with custom permission classes
- Models inherit from `BaseModel` (uid, created_at, updated_at fields)
- Validation lifecycle: `set_fields()` → `validate()` → `clean()` → `save()` → `post_clean()`

**Frontend Conventions:**
- Components in `frontend/src/components/<ComponentName>/` with `.jsx` and `.module.css`
- Pages in `frontend/src/pages/` (route-level components)
- Redux slices in `store/slices/` with unique names
- All API calls via Axios wrapper (never raw fetch)
- All icons from @tabler/icons-react (no other icon libs)
- All dates with dayjs (never date-fns)
- All colors via CSS variables (never hardcoded hex)
- Mantine components + wrappers from `core/` folder
- Notifications via Mantine notifications (never native alert)

### Code Style & Formatting

**Python (Backend):**
- Black formatter (88 char line length)
- isort for import sorting (profile=black)
- No semicolons in imports
- Type hints optional but encouraged
- Docstrings for public methods

**JavaScript (Frontend):**
- Prettier formatter (no semicolons, double quotes, trailing commas es5, tab width 2)
- ESLint for code quality
- No unused variables or imports
- Consistent naming (camelCase for variables, PascalCase for components)

### Cache Invalidation Rules

**Backend Cache Pattern:**
1. Every API write operation (CREATE, UPDATE, DELETE) calls `invalidate_*_cache()`
2. Cache invalidation functions in `util/cache_utils.py`
3. Key patterns: `topic_list_*`, `topic_detail_{id}`, `receipt_list_*`, etc.
4. Decorator `@conditional_cache(timeout=300, key_prefix=...)` for read operations

**Example:**
```python
def perform_create(self, serializer):
    instance = serializer.save(submitted_by=self.request.user)
    invalidate_receipt_cache(receipt_id=instance.id)

def perform_update(self, serializer):
    instance = serializer.save()
    invalidate_receipt_cache(receipt_id=instance.id)
```

### QuerySet Optimization Rules

**N+1 Prevention:**
- Use `select_related()` for ForeignKey/OneToOne (single SQL JOIN)
- Use `prefetch_related()` for reverse FK and ManyToMany (separate query)
- Use `Prefetch()` objects for customized nested querysets
- Always use `distinct=True` in `Count()` annotations to avoid duplicates from joins

**Example:**
```python
def get_queryset(self):
    queryset = super().get_queryset()
    
    if self.action == "list":
        queryset = queryset.annotate(
            vote_count=Count("votes", distinct=True),
            relevance_avg=Avg("votes__relevance"),
        )
        queryset = queryset.select_related("submitted_by")
        queryset = queryset.prefetch_related("topics")
    
    elif self.action == "retrieve":
        queryset = queryset.prefetch_related(
            Prefetch("receipt_topics",
                queryset=ReceiptTopic.objects.select_related("topic", "added_by"))
        ).select_related("submitted_by", "verified_by")
    
    return queryset
```

---

## Testing & Deployment

### Testing Framework

**Backend:**
- pytest with pytest-django
- FactoryBot for test fixtures
- Test files in `<app>/tests/test_*.py`
- Run: `python3 manage.py test` or `pytest`

**Frontend:**
- Vitest for unit tests
- React Testing Library for component tests
- Test files next to components or in `frontend/src/test/`
- Run: `npm run test:run` (once) or `npm test` (watch)

### Development Workflow

**Backend:**
```bash
poetry install                       # Install Python dependencies
python3 manage.py migrate            # Run migrations
python3 manage.py runserver 8000     # Start dev server (port 8000)
python3 manage.py createsuperuser    # Create admin user
python3 manage.py shell              # Interactive shell

# Formatting & linting
black .                              # Auto-format Python
isort .                              # Sort imports
flake8 .                             # Lint
python3 manage.py test               # Run tests
```

**Frontend:**
```bash
cd frontend/
npm install                          # Install dependencies
npm run dev                          # Start dev server (port 5173)
npm run build                        # Production build
npm run lint                         # ESLint
npm test                             # Run tests (watch)
npm run test:run                     # Run tests once
npm run test:coverage                # Coverage report
```

### Docker Deployment

```bash
docker build -t receipts-app .       # Build image
docker run -p 8000:8000 receipts-app # Run container

# With docker-compose (if available)
docker-compose up
```

### Production Considerations

- **Whitenoise** for static file serving (CSS, JS, images)
- **Gunicorn** as WSGI server
- **Sentry** for error tracking
- **AWS S3** for file storage
- **AWS SES** for email
- **Redis** for caching and Celery broker
- **PostgreSQL** database
- **Environment variables** for secrets (via python-decouple)
- **CORS enabled** for frontend domain only

### Environment Variables

```bash
# Django
SECRET_KEY=<generated>
DEBUG=False (or True for dev)
ALLOWED_HOSTS=yourdomain.com

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# JWT Auth
SIMPLE_JWT_SIGNING_KEY=<secret>

# AWS
AWS_STORAGE_BUCKET_NAME=<bucket>
AWS_S3_REGION_NAME=us-east-1
AWS_SECRET_ACCESS_KEY=<secret>
AWS_ACCESS_KEY_ID=<key>

# Email
AWS_SES_REGION_NAME=us-east-1
AWS_SES_REGION_ENDPOINT=email.us-east-1.amazonaws.com

# Redis
REDIS_URL=redis://localhost:6379/0

# Frontend
REACT_APP_API_URL=https://api.yourdomain.com
REACT_APP_ENV=production
```

---

## Summary

Receeps is a comprehensive evidence verification platform with:

- **200+ API endpoints** across 10+ Django apps
- **Multi-dimensional voting** (relevance, reliability, bias)
- **Staff verification workflow** with credibility scoring
- **Threaded comments** with upvote/downvote mechanics
- **Notification system** with 17+ notification types
- **JWT authentication** with token refresh
- **Caching strategy** for optimal performance
- **AWS S3 file storage** for media
- **Celery async tasks** for background jobs
- **React SPA frontend** with Redux state management
- **Mantine UI** dark theme (Reddit-inspired)
- **Role-based access control** (User, Staff)
- **Production-ready** with Docker, Sentry, monitoring

The architecture follows Django REST Framework best practices with separate serializers per action, custom permissions, optimized querysets, and comprehensive caching. The frontend uses modern React patterns with Redux Toolkit, route guards, and Mantine components throughout.