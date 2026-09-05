# MyCloset - Feature Specification

> **Spec Version:** 1.0
> **Last Updated:** 2026-03-06
> **Status:** Draft
> **Author:** Claude (spec-mycloset agent)
> **Reviewer:** Trey

---

## 1. Product Overview

### 1.1 Product Identity

- **Name:** MyCloset
- **Tagline:** Your wardrobe, on your terms
- **Module ID:** `closet`
- **Feature ID Prefix:** `CL`

### 1.2 Target Users and Personas

| Persona | Description | Primary Goals |
|---------|-------------|---------------|
| Fashion-Conscious Planner | Ages 20-35, curates outfits intentionally, uses phone daily for style reference | Build outfits from existing wardrobe, log daily looks, track cost-per-wear |
| Minimalist/Capsule Dresser | Ages 25-45, owns fewer than 50 items, focused on versatility and sustainability | Maximize rewear potential, identify redundant items, build capsule wardrobes |
| Budget-Minded Shopper | Ages 18-40, wants to justify clothing purchases and avoid waste | Track cost-per-wear, see ROI on purchases, get donation suggestions for unused items |
| Busy Professional | Ages 28-50, limited time for outfit decisions in the morning | Quick daily outfit suggestions, outfit calendar for recurring events, packing lists for travel |
| Privacy-Conscious User | Any age, uncomfortable with fashion apps that upload wardrobe photos to the cloud | Full local storage, no cloud photo uploads, no purchase history shared with third parties |

### 1.3 Core Value Proposition

MyCloset is a privacy-first wardrobe management app that keeps all clothing data, photos, and outfit history entirely on-device. Users catalog their wardrobe with photos, build outfits, track what they wear, and surface insights like cost-per-wear and donation candidates, all without creating an account or uploading a single image to the cloud. Unlike Cladwell ($96/yr, cloud-required), MyCloset is included in the MyLife Pro subscription and never shares your wardrobe data with fashion brands or advertisers.

### 1.4 Competitive Landscape

| Competitor | Strengths | Weaknesses | Our Differentiator |
|-----------|-----------|------------|-------------------|
| Cladwell | AI outfit suggestions, capsule wardrobe coaching, polished onboarding | $96/yr subscription, cloud-only (photos uploaded), partners with fashion brands | Full privacy, $0 extra cost (included in MyLife Pro), all data on-device |
| Stylebook | Comprehensive catalog features, outfit builder, calendar | iOS only, $3.99 one-time but aging UI, no AI suggestions, no cost analytics | Cross-platform, cost-per-wear analytics, donation intelligence, modern UI |
| Acloset | Free tier, outfit builder, clothing stats | Ads in free tier, limited export, cloud sync optional but encouraged | No ads ever, full export, zero network dependency |
| Smart Closet | Large category taxonomy, outfit recommendations | Cloud-dependent, data collection for "personalized" ads, privacy concerns | On-device only, no ad-driven data collection |
| GetWardrobe | Outfit planning, weather integration | Requires account, limited to iOS, sparse analytics | No account needed, cross-platform, deep cost and wear analytics |

### 1.5 Privacy Positioning

This product follows the MyLife privacy-first philosophy:

- All user data is stored locally on the device
- Zero analytics, zero telemetry, zero tracking
- No account required for core functionality
- Users own their data with full export (CSV, JSON) and delete capabilities
- No data ever leaves the device unless the user explicitly initiates an export
- Clothing photos are stored locally and never uploaded to any server
- No purchase history or brand preference data is shared with fashion retailers or advertisers
- AI outfit suggestions (when available) run entirely on-device using local wardrobe data
- Weather data for outfit recommendations is fetched with location-only queries; no user identity is transmitted
- Body measurement data (if entered) never leaves the device under any circumstances

---

## 2. Feature Catalog

| Feature ID | Feature Name | Priority | Category | Dependencies | Status |
|-----------|-------------|----------|----------|--------------|--------|
| CL-001 | Wardrobe Catalog | P0 | Core | None | Not Started |
| CL-002 | Category and Tag Organization | P0 | Data Management | CL-001 | Not Started |
| CL-003 | Outfit Builder | P0 | Core | CL-001 | Not Started |
| CL-004 | Outfit Calendar and Wear Logging | P0 | Core | CL-001, CL-003 | Not Started |
| CL-005 | Wear Count Tracking | P0 | Analytics | CL-001 | Not Started |
| CL-006 | Cost-Per-Wear Analysis | P1 | Analytics | CL-001, CL-005 | Not Started |
| CL-007 | Donation Suggestions | P1 | Analytics | CL-001, CL-005 | Not Started |
| CL-008 | Clothing Statistics | P1 | Analytics | CL-001, CL-005 | Not Started |
| CL-009 | Laundry Tracking | P1 | Core | CL-001 | Not Started |
| CL-010 | Packing List Generator | P1 | Core | CL-001, CL-002 | Not Started |
| CL-011 | AI Outfit Suggestions | P1 | Core | CL-001, CL-002, CL-004 | Not Started |
| CL-012 | Seasonal Rotation Reminders | P2 | Data Management | CL-001, CL-002 | Not Started |
| CL-013 | Shopping Wishlist | P2 | Data Management | None | Not Started |
| CL-014 | Capsule Wardrobe Builder | P2 | Core | CL-001, CL-002, CL-005 | Not Started |
| CL-015 | Color Palette Analysis | P2 | Analytics | CL-001, CL-002 | Not Started |
| CL-016 | Style Board / Mood Board | P2 | Data Management | None | Not Started |
| CL-017 | Data Export (CSV/JSON) | P1 | Import/Export | CL-001 | Not Started |
| CL-018 | Settings and Preferences | P0 | Settings | None | Not Started |
| CL-019 | Onboarding and First-Run | P1 | Onboarding | CL-001 | Not Started |

**Priority Legend:**
- **P0** - MVP must-have. The product does not launch without this.
- **P1** - High-value. Ship shortly after MVP or include if time allows.
- **P2** - Nice-to-have. Adds polish and delight but product is usable without it.
- **P3** - Future/low-priority. Planned for later phases or may be cut.

**Category Legend:**
- **Core** - Fundamental product functionality
- **Data Management** - CRUD operations, organization, search
- **Analytics** - Stats, reports, insights, visualizations
- **Import/Export** - Data portability (import from competitors, export user data)
- **Settings** - User preferences, configuration, customization
- **Onboarding** - First-run experience, tutorials, sample data

---

## 3. Feature Specifications

### CL-001: Wardrobe Catalog

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | CL-001 |
| **Feature Name** | Wardrobe Catalog |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a fashion-conscious planner, I want to photograph and catalog every clothing item I own, so that I can see my entire wardrobe digitally and plan outfits from it.

**Secondary:**
> As a minimalist dresser, I want to see exactly how many items I own at a glance, so that I can track my progress toward a capsule-sized wardrobe.

**Tertiary:**
> As a privacy-conscious user, I want all my clothing photos stored locally on my device, so that no wardrobe images are uploaded to external servers.

#### 3.3 Detailed Description

The Wardrobe Catalog is the foundational feature of MyCloset. It allows users to create a comprehensive digital inventory of every clothing item they own. Each item is represented by a photo (taken via camera or imported from the device photo library) along with structured metadata including name, brand, color, size, purchase price, purchase date, and current condition.

The catalog serves as the central data source that all other features build upon. Without items in the catalog, outfit building, wear tracking, cost analysis, and donation suggestions have no data to operate on. The catalog is designed for rapid item entry to reduce the friction of initial wardrobe digitization, which is the primary onboarding hurdle for wardrobe apps.

Users interact with the catalog through a grid or list view showing item photos with key details. They can add items one at a time via a dedicated "Add Item" flow, or they can batch-add multiple items in a quick-capture mode designed for the initial wardrobe setup. Each item can be viewed in detail, edited, or removed from the catalog entirely.

Unlike Cladwell, which requires uploading every photo to their cloud servers, all photos in MyCloset are stored locally on-device. The catalog also supports items without photos for users who prefer a text-only inventory, though the experience is optimized for photo-based browsing.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (this is the foundational feature)

**External Dependencies:**
- Camera hardware for taking item photos
- Photo library access for importing existing photos
- Local file system storage for persisting item photos
- Local persistent storage for item metadata

**Assumed Capabilities:**
- User can navigate between screens via the module tab bar
- Local database is initialized and writable
- File system has sufficient storage for photos

#### 3.5 User Interface Requirements

##### Screen: Catalog Grid

**Layout:**
- The screen has a top navigation bar showing "My Wardrobe" as the title, with a filter icon on the left and a "+" (add) button on the right
- Below the navigation bar is a summary strip showing total item count and total wardrobe value (e.g., "127 items | $4,280 value")
- Below the summary strip is a toggle control allowing the user to switch between grid view (2 or 3 columns) and list view
- The main content area is a scrollable grid (or list) of item cards
- In grid view, each card shows: item photo (square thumbnail), item name (1 line, truncated), and primary color indicator (small dot)
- In list view, each row shows: item photo (small square thumbnail on the left), item name, brand, category label, and color indicator
- A floating action button in the bottom-right corner opens the Add Item flow
- Pull-to-refresh recalculates summary statistics

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No items in the catalog | Centered illustration of an empty closet, heading "Your closet is empty", subtext "Add your first item to start building your digital wardrobe", prominent "Add First Item" button |
| Loading | Initial database query in progress | Skeleton grid with placeholder rectangles matching card dimensions |
| Populated | 1 or more items exist | Normal grid/list view with item cards |
| Error | Database read fails | Inline message "Could not load your wardrobe. Please try again." with a retry button |
| Filtered | Active filters applied | Grid shows only matching items, a chip bar below the summary strip shows active filters with "x" dismiss buttons, "No items match your filters" message if zero results |

**Interactions:**
- Tap item card: Navigate to Item Detail screen
- Long press item card: Show context menu with options (Edit, Delete, Mark as Worn Today, Add to Outfit)
- Tap "+" button: Open Add Item screen
- Tap filter icon: Open filter/sort bottom sheet (see CL-002)
- Tap grid/list toggle: Switch view mode with a crossfade transition
- Pull down: Refresh summary statistics
- Swipe left on list row (list view only): Reveal "Delete" action

**Transitions/Animations:**
- Grid/list toggle crossfades over 200ms
- New items animate in from the bottom with a fade-up, 250ms duration
- Deleted items shrink and fade out, 200ms duration
- Filter chip appearance uses a horizontal slide-in, 150ms

##### Screen: Add Item

**Layout:**
- Full-screen modal with "Add Item" title and "Cancel" (left) / "Save" (right) buttons in the top bar
- Photo capture area at the top: a large square placeholder with a camera icon. Tapping opens an action sheet with "Take Photo" and "Choose from Library" options. After a photo is captured or selected, it fills the square with a small "retake" button overlaid in the corner
- Below the photo area, a scrollable form with the following fields in order:
  - Name (text input, required, placeholder: "e.g., Navy Blazer")
  - Brand (text input, optional, placeholder: "e.g., Uniqlo")
  - Category (picker/dropdown, required, options: Tops, Bottoms, Dresses, Outerwear, Shoes, Accessories, Activewear, Swimwear, Sleepwear, Underwear, Other)
  - Subcategory (picker/dropdown, optional, options vary by selected Category)
  - Color (multi-select color picker with 20 standard colors plus custom hex entry, required)
  - Size (text input, optional, placeholder: "e.g., M, 32, 10.5")
  - Season (multi-select chips: Spring, Summer, Fall, Winter, All-Season)
  - Occasion (multi-select chips: Casual, Work, Formal, Active, Lounge, Date Night, Outdoor)
  - Purchase Price (currency input, optional, placeholder: "$0.00")
  - Purchase Date (date picker, optional, defaults to blank)
  - Condition (segmented control: New, Good, Fair, Worn Out)
  - Notes (multiline text input, optional, placeholder: "Any additional notes...")
- "Save" button validates required fields, creates the item, and dismisses the modal

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Fresh | Modal just opened | All fields empty, photo placeholder visible, "Save" button disabled |
| Photo Captured | User has taken/selected a photo | Photo fills the capture area, form fields enabled |
| Partially Filled | Some fields completed | "Save" button enabled once all required fields are filled |
| Validation Error | Required field(s) missing on save attempt | Inline error messages below empty required fields, screen scrolls to first error |
| Saving | Save in progress | "Save" button shows loading indicator, all inputs disabled |

**Interactions:**
- Tap photo area: Show action sheet (Take Photo / Choose from Library / Cancel)
- Tap "Save": Validate form, save item, dismiss modal, show success confirmation
- Tap "Cancel": If form has changes, show "Discard changes?" confirmation dialog; if no changes, dismiss immediately
- Tap outside a text field: Dismiss keyboard
- Scroll: Standard vertical scroll for the form

**Transitions/Animations:**
- Modal slides up from the bottom, 300ms duration
- Dismissal slides down, 250ms duration
- Photo capture area crossfades from placeholder to captured photo, 200ms
- Validation errors fade in below fields, 150ms

##### Screen: Item Detail

**Layout:**
- Full-screen with a back button ("<" or "Back to Wardrobe") in the top-left and an "Edit" button in the top-right
- Hero photo at the top, taking approximately 40% of the screen height. If no photo exists, a placeholder icon is shown
- Below the photo, the item name is displayed as a large heading
- Below the name, a horizontal row of metadata chips: category, brand (if set), condition
- A divider, then a "Details" section showing:
  - Color(s) with color dot indicators
  - Size
  - Season(s)
  - Occasion(s)
  - Purchase Price (formatted as currency)
  - Purchase Date (formatted as locale date)
  - Notes (if any)
- A divider, then a "Wear Stats" section showing:
  - Times Worn (integer)
  - Last Worn (date, or "Never" if 0 wears)
  - Cost Per Wear (purchase_price / times_worn, or "N/A" if no price or 0 wears)
  - Days Since Last Worn (integer, or "N/A" if never worn)
- A divider, then an "Outfits" section showing a horizontal scrollable list of outfit thumbnails that include this item (or "Not in any outfits yet" if none)
- At the bottom, a "Delete Item" button styled as a destructive action

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Loaded | Item data retrieved | Full detail layout as described |
| Loading | Data being fetched | Skeleton placeholders for text and photo |
| Error | Item not found or database error | "Item not found" message with a "Go Back" button |
| Confirming Delete | Delete button tapped | Confirmation dialog: "Delete [item name]? This cannot be undone. Outfit references to this item will also be removed." with "Cancel" and "Delete" buttons |

**Interactions:**
- Tap "Edit": Navigate to Add Item screen pre-filled with current values (reused as Edit mode)
- Tap "Delete Item": Show deletion confirmation dialog
- Tap outfit thumbnail: Navigate to that outfit's detail screen
- Tap "Log Wear" quick action: Increment wear count by 1, update last_worn_date to today, animate the wear count change
- Swipe left on the screen (mobile): Navigate back to catalog

**Transitions/Animations:**
- Screen enters with a shared-element transition on the item photo from the grid card
- Wear count increment animates with a number flip effect, 300ms
- Delete confirmation dialog fades in over a dimmed background, 200ms

##### Screen: Quick Capture (Batch Add)

**Layout:**
- Full-screen camera viewfinder that fills the entire screen
- A shutter button at the bottom center for capturing photos
- A small counter badge in the top-right showing the number of items captured in this session (e.g., "3 items")
- A "Done" button at the top-left to finish the batch capture
- After each photo capture, a brief flash animation confirms the capture, and the counter increments
- Tapping "Done" navigates to a batch review screen where each captured photo is shown in a vertical list. Each row has a photo thumbnail, a name text input, and a category picker (required). All other fields default to empty and can be edited later from Item Detail
- A "Save All" button at the bottom of the batch review screen saves all items at once

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Camera Active | Camera viewfinder running | Shutter button enabled, counter shows 0 |
| Photo Captured | Item just captured | Brief shutter flash animation, counter increments |
| Batch Review | "Done" tapped after capturing 1+ photos | Vertical list of captured items with name/category fields |
| Saving Batch | "Save All" tapped | Progress indicator showing "Saving item 3 of 12..." |
| Empty Capture | "Done" tapped with 0 photos | Alert: "No items captured. Take at least one photo or cancel." |

**Interactions:**
- Tap shutter: Capture photo, increment counter, brief flash animation
- Tap "Done": Navigate to batch review (or show alert if 0 captures)
- On batch review, tap photo thumbnail: Full-screen photo preview
- On batch review, swipe left on row: Remove item from batch (not saved yet)
- Tap "Save All": Save all items, show progress, then dismiss to catalog

**Transitions/Animations:**
- Shutter flash effect: white overlay at 50% opacity fading out over 150ms
- Transition from camera to batch review: slide from right, 300ms
- Save progress indicator updates per item

#### 3.6 Data Requirements

##### Entity: ClothingItem

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier for the clothing item |
| name | string | Required, max 200 chars, trimmed | None | User-given name for the item (e.g., "Navy Blazer") |
| brand | string | Optional, max 100 chars, trimmed | null | Brand or manufacturer name |
| category | enum | Required, one of: tops, bottoms, dresses, outerwear, shoes, accessories, activewear, swimwear, sleepwear, underwear, other | None | Primary clothing category |
| subcategory | string | Optional, max 100 chars | null | Further classification within category (e.g., "t-shirt" within "tops") |
| colors | string | Required, comma-separated color values | None | One or more colors (e.g., "navy,white") |
| size | string | Optional, max 20 chars | null | Size label (e.g., "M", "32x30", "10.5") |
| seasons | string | Optional, comma-separated values from: spring, summer, fall, winter, all-season | "all-season" | Seasons when this item is appropriate |
| occasions | string | Optional, comma-separated values from: casual, work, formal, active, lounge, date_night, outdoor | null | Occasions when this item is appropriate |
| purchase_price | float | Optional, min: 0.00, max: 99999.99 | null | Original purchase price in user's currency |
| purchase_date | date | Optional, ISO 8601 date | null | Date the item was purchased |
| condition | enum | One of: new, good, fair, worn_out | "good" | Current physical condition of the item |
| status | enum | One of: active, stored, donated, sold, discarded | "active" | Current lifecycle status |
| photo_path | string | Optional, max 500 chars | null | Local file system path to the item photo |
| photo_thumbnail_path | string | Optional, max 500 chars | null | Local file system path to a compressed thumbnail |
| times_worn | integer | Min: 0 | 0 | Total number of times this item has been logged as worn |
| last_worn_date | date | Optional, ISO 8601 date | null | Most recent date this item was logged as worn |
| notes | string | Optional, max 2000 chars | null | Free-text user notes about the item |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- ClothingItem has many OutfitItem (one-to-many via outfit_items.clothing_item_id)
- ClothingItem has many WearLog (one-to-many via wear_logs.clothing_item_id)
- ClothingItem has many ItemTag (one-to-many via item_tags.clothing_item_id)
- ClothingItem has many LaundryEvent (one-to-many via laundry_events.clothing_item_id)

**Indexes:**
- category - Frequently filtered by category
- status - Filter active vs. donated/sold items
- (category, status) - Composite for filtered grid views
- last_worn_date - Sort by recently worn / donation candidate queries
- created_at - Sort by newest items

**Validation Rules:**
- name: Must not be empty string after trimming whitespace
- name: Maximum 200 characters after trimming
- purchase_price: If provided, must be >= 0.00 and <= 99999.99
- colors: At least one color value must be provided
- category: Must be one of the defined enum values
- condition: Must be one of the defined enum values
- status: Must be one of the defined enum values
- photo_path: If provided, the referenced file must exist on the local file system

**Example Data:**

```
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "name": "Navy Blazer",
  "brand": "Uniqlo",
  "category": "outerwear",
  "subcategory": "blazer",
  "colors": "navy",
  "size": "M",
  "seasons": "fall,winter,spring",
  "occasions": "work,formal,date_night",
  "purchase_price": 89.90,
  "purchase_date": "2025-09-15",
  "condition": "good",
  "status": "active",
  "photo_path": "/local/photos/closet/f47ac10b.jpg",
  "photo_thumbnail_path": "/local/photos/closet/thumbs/f47ac10b.jpg",
  "times_worn": 23,
  "last_worn_date": "2026-03-01",
  "notes": "Slim fit, runs slightly small",
  "created_at": "2025-10-01T08:30:00Z",
  "updated_at": "2026-03-01T07:45:00Z"
}
```

#### 3.7 Business Logic Rules

##### Photo Storage and Thumbnail Generation

**Purpose:** Store item photos locally and generate compressed thumbnails for grid performance.

**Inputs:**
- original_photo: image data from camera or photo library
- item_id: string - the clothing item's unique identifier

**Logic:**

```
1. Receive the original photo from the camera or photo library
2. Generate a unique filename using the item_id
3. Resize the original to a maximum dimension of 1200px (maintaining aspect ratio)
4. Save the resized image to the local photo directory as the primary photo
5. Generate a thumbnail by resizing to a maximum dimension of 300px
6. Save the thumbnail to the local thumbnails directory
7. Store both file paths (photo_path, photo_thumbnail_path) on the ClothingItem record
8. IF the item previously had a photo:
     Delete the old photo and thumbnail files from the file system
9. RETURN the updated file paths
```

**Edge Cases:**
- Camera permission denied: Display a message explaining that camera access is needed and provide a button to open device settings
- Photo library permission denied: Same pattern as camera
- Insufficient storage: Display "Not enough storage to save this photo. Free up space and try again."
- Photo import from an unsupported format: Display "This image format is not supported. Please use JPEG or PNG."

##### Wardrobe Summary Calculation

**Purpose:** Calculate aggregate statistics for the catalog summary strip.

**Inputs:**
- all_items: list of ClothingItem records where status is "active"

**Logic:**

```
1. total_items = COUNT(all_items)
2. wardrobe_value = SUM(purchase_price) for all items WHERE purchase_price IS NOT NULL AND status NOT IN ('donated', 'sold', 'discarded')
3. RETURN { total_items, wardrobe_value }
```

**Edge Cases:**
- No items exist: Display "0 items | $0 value"
- No items have a purchase price: Display total_items count but show "$0 value" for value
- Very large wardrobe (1000+ items): Summary must still compute in under 500ms

##### Item Deletion

**Purpose:** Remove an item and all associated data.

**Inputs:**
- item_id: string - the item to delete

**Logic:**

```
1. Look up the ClothingItem by item_id
2. IF item not found, RETURN error "Item not found"
3. Delete the item's photo file from the file system (if photo_path exists)
4. Delete the item's thumbnail file from the file system (if photo_thumbnail_path exists)
5. Delete all OutfitItem records referencing this item_id
6. Delete all WearLog records referencing this item_id
7. Delete all ItemTag records referencing this item_id
8. Delete all LaundryEvent records referencing this item_id
9. Delete the ClothingItem record
10. Recalculate summary statistics
11. RETURN success
```

**Edge Cases:**
- Item is referenced in multiple outfits: Remove the item from those outfits (OutfitItem records). The outfit remains but has one fewer item.
- Photo file is missing from disk but path exists in the record: Skip file deletion silently, proceed with record deletion
- Concurrent deletion attempt: Second call returns "Item not found" gracefully

**Sort/Filter/Ranking Logic:**
- **Default sort:** Most recently added first (created_at descending)
- **Available sort options:** Name (A-Z, Z-A), Category, Brand, Purchase Price (high to low, low to high), Times Worn (most to least, least to most), Last Worn Date (recent first, oldest first), Date Added (newest first, oldest first)
- **Filter options:** Category (multi-select), Color (multi-select), Season (multi-select), Occasion (multi-select), Condition, Status, Price Range (min/max slider), Has Photo (yes/no)
- **Search:** Name and brand fields are searchable using substring matching (case-insensitive). Minimum 2 characters to trigger search.

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Camera fails to initialize | "Could not access camera. Please check permissions in your device settings." | User opens device settings and grants camera access |
| Photo library access denied | "Photo library access is needed to import photos. Grant access in settings." | User opens device settings and grants library access |
| Database write fails on save | "Could not save this item. Please try again." with a retry button | User taps retry; if persistent, suggest restarting the app |
| Photo file cannot be saved (storage full) | "Not enough storage to save this photo. Free up space and try again." | User frees device storage and retries |
| Required field missing on save | Inline error message below each missing field (e.g., "Name is required", "Category is required") | User fills in the field, error message disappears immediately |
| Item not found on detail view (deleted externally) | "This item no longer exists." with a "Go Back" button | User navigates back to catalog |
| Photo file missing on detail view | Placeholder icon displayed in place of the photo; no error toast | User can re-add a photo via the edit screen |
| Batch save partially fails | "Saved 10 of 12 items. 2 items could not be saved." with option to retry failed items | User retries the failed items or dismisses |

**Validation Timing:**
- Field-level validation runs on blur for text fields (name, brand) and on selection for pickers (category, color)
- Form-level validation runs on save button tap
- Photo validation (file exists, supported format) runs immediately on capture/selection

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the catalog is empty,
   **When** the user taps the "+" button and fills in name ("White T-Shirt"), selects category ("Tops"), selects color ("White"), takes a photo, and taps "Save",
   **Then** the item appears in the catalog grid with the photo thumbnail, the summary strip shows "1 item", and the empty state is no longer visible.

2. **Given** the catalog has 5 items,
   **When** the user taps an item card in the grid,
   **Then** the Item Detail screen opens showing the item's photo, name, all metadata fields, wear statistics, and outfit associations.

3. **Given** the user is on the Add Item screen with a photo captured,
   **When** the user fills in all required fields and taps "Save",
   **Then** the item is persisted to local storage, the photo and thumbnail are saved to the local file system, the modal dismisses, and the new item appears at the top of the catalog grid.

4. **Given** the user is on the Item Detail screen,
   **When** the user taps "Edit", changes the item name, and saves,
   **Then** the updated name is reflected on the detail screen and in the catalog grid.

5. **Given** the catalog has 12 items,
   **When** the user opens Quick Capture, takes 3 photos, taps "Done", fills in names and categories for each, and taps "Save All",
   **Then** all 3 items are added to the catalog, the summary strip shows "15 items", and the user is returned to the catalog grid.

**Edge Cases:**

6. **Given** the user adds an item without a photo,
   **When** the item appears in the catalog grid,
   **Then** a placeholder icon is displayed in place of the photo thumbnail.

7. **Given** the catalog contains 500 items,
   **When** the catalog grid loads,
   **Then** the grid renders and is scrollable within 2 seconds, using thumbnail images for performance.

8. **Given** the user's device has less than 10MB of free storage,
   **When** the user attempts to capture a photo for a new item,
   **Then** the system displays "Not enough storage to save this photo. Free up space and try again."

**Negative Tests:**

9. **Given** the user is on the Add Item screen,
   **When** the user taps "Save" without entering a name or selecting a category,
   **Then** inline error messages appear below the name field ("Name is required") and category field ("Category is required"),
   **And** the item is not saved.

10. **Given** the user is on the Add Item screen with unsaved changes,
    **When** the user taps "Cancel",
    **Then** a confirmation dialog appears asking "Discard changes?",
    **And** no data is saved unless the user explicitly confirms.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates wardrobe value correctly | items with prices [10.00, 25.50, null, 89.90] all active | wardrobe_value: 125.40 |
| calculates wardrobe value excluding non-active | items: [active $50, donated $30, active $20] | wardrobe_value: 70.00 |
| returns zero value for empty catalog | empty items list | { total_items: 0, wardrobe_value: 0 } |
| validates name is required | name: "" | validation error: "Name is required" |
| validates name is required after trim | name: "   " (whitespace only) | validation error: "Name is required" |
| validates name max length | name: 201-character string | validation error: "Name must be 200 characters or fewer" |
| validates category is required | category: null | validation error: "Category is required" |
| validates purchase price minimum | purchase_price: -5.00 | validation error: "Price must be $0.00 or more" |
| validates purchase price maximum | purchase_price: 100000.00 | validation error: "Price must be $99,999.99 or less" |
| validates color is required | colors: "" | validation error: "At least one color is required" |
| generates thumbnail at correct dimensions | 2400x1600 photo | thumbnail max dimension is 300px (300x200) |
| generates primary photo at correct dimensions | 4000x3000 photo | primary max dimension is 1200px (1200x900) |
| handles item with no purchase price in summary | items: [{price: null}, {price: 50}] | wardrobe_value: 50.00 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add item and verify it appears in catalog | 1. Open Add Item, 2. Fill required fields, 3. Save, 4. Return to catalog | New item appears at top of grid, summary strip count increments by 1 |
| Edit item and verify changes persist | 1. Open item detail, 2. Tap Edit, 3. Change name, 4. Save, 5. Reopen detail | Changed name is displayed on detail screen |
| Delete item and verify removal | 1. Open item detail, 2. Tap Delete, 3. Confirm, 4. Return to catalog | Item is no longer in the grid, summary strip count decrements by 1, photo files are removed from file system |
| Batch add 5 items via Quick Capture | 1. Open Quick Capture, 2. Take 5 photos, 3. Tap Done, 4. Fill names/categories, 5. Save All | All 5 items appear in catalog, counter shows correct total |
| Add item without photo | 1. Open Add Item, 2. Skip photo, 3. Fill name + category + color, 4. Save | Item saved with placeholder icon, no photo files created |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New user catalogs first 3 items | 1. Open app (empty state), 2. Tap "Add First Item", 3. Take photo + fill details + save, 4. Repeat 2 more times | Catalog shows 3 items in grid, summary says "3 items | $[total] value", empty state gone |
| User batch-adds wardrobe and browses | 1. Open Quick Capture, 2. Take 10 photos, 3. Fill minimal details, 4. Save All, 5. Scroll grid, 6. Tap one item, 7. View detail | 10 items in catalog, each with photo, detail screen shows correct metadata |
| User deletes an item that is in 2 outfits | 1. Create item, 2. Add to 2 outfits, 3. Delete item from detail screen, 4. Check both outfits | Item removed from catalog, both outfits still exist but no longer contain the deleted item |

---

### CL-002: Category and Tag Organization

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | CL-002 |
| **Feature Name** | Category and Tag Organization |
| **Priority** | P0 |
| **Category** | Data Management |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a fashion-conscious planner, I want to organize my wardrobe by category, color, season, and custom tags, so that I can quickly find items when building outfits.

**Secondary:**
> As a minimalist dresser, I want to see category-level breakdowns of my wardrobe, so that I know if I have too many items in any one category.

**Tertiary:**
> As a budget-minded shopper, I want to filter my wardrobe by occasion, so that I can see whether I need to buy something new for an upcoming event or already own appropriate items.

#### 3.3 Detailed Description

Category and Tag Organization provides the classification layer that makes a large wardrobe manageable. While CL-001 captures item metadata including a primary category, this feature extends that foundation with custom tags, multi-dimensional filtering, and organized browsing views.

Users can apply custom text tags to any item (e.g., "capsule 2026", "donate maybe", "vacation staple"). Tags are user-created, free-form, and unlimited in number. The system also provides built-in organizational dimensions: category, subcategory, color, season, occasion, and condition. All of these dimensions are combinable as filters.

The feature introduces a dedicated category browser that groups items visually by their primary category, showing count badges and allowing drill-down navigation. This complements the flat catalog grid from CL-001 by providing a structured way to explore the wardrobe.

Filter combinations are persistent within a session, meaning the user can set "Tops + Blue + Work" and scroll through results without re-applying filters on every interaction. Filters reset when the user leaves and returns to the catalog.

#### 3.4 Prerequisites

**Feature Dependencies:**
- CL-001: Wardrobe Catalog - Items must exist before they can be tagged or filtered

**External Dependencies:**
- None

**Assumed Capabilities:**
- Local database supports text indexing for tag search
- Catalog grid view from CL-001 is implemented and filterable

#### 3.5 User Interface Requirements

##### Screen: Category Browser

**Layout:**
- Accessible from a "Categories" tab or a segmented control at the top of the catalog screen
- Displays a grid of category cards, one per category
- Each category card shows: the category name, a representative icon or emoji, the count of active items in that category (e.g., "Tops (24)"), and a small collage thumbnail of up to 4 items from that category
- Tapping a category card navigates to the catalog grid pre-filtered to that category
- An "All Items" card at the top shows the total count

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No items in any category | Same empty state as CL-001 catalog |
| Populated | Items exist in at least one category | Category grid with count badges |
| Single Category | All items are in one category | Full grid shown but only one card has a non-zero count |

**Interactions:**
- Tap category card: Navigate to catalog grid pre-filtered to that category
- Long press category card: No action (categories are system-defined, not deletable)

##### Component: Filter/Sort Bottom Sheet

**Layout:**
- Half-screen bottom sheet that slides up from the bottom
- Organized in collapsible sections:
  - **Sort By:** Radio button list (Name A-Z, Name Z-A, Newest First, Oldest First, Most Worn, Least Worn, Price High-Low, Price Low-High, Last Worn Recent, Last Worn Oldest)
  - **Category:** Multi-select chip row showing all categories with item counts
  - **Color:** Multi-select grid of color swatches (20 standard colors)
  - **Season:** Multi-select chips (Spring, Summer, Fall, Winter, All-Season)
  - **Occasion:** Multi-select chips (Casual, Work, Formal, Active, Lounge, Date Night, Outdoor)
  - **Condition:** Multi-select chips (New, Good, Fair, Worn Out)
  - **Status:** Multi-select chips (Active, Stored, Donated, Sold, Discarded)
  - **Price Range:** Dual-handle slider with min/max values
  - **Tags:** Searchable chip list of all user-created tags
- At the bottom: "Reset All" link (left) and "Apply" button (right)
- A count badge on the "Apply" button shows how many items match the current filter combination (e.g., "Show 24 items")

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Default | No filters active | All sections collapsed except Sort By, no chips selected |
| Filters Active | One or more filters selected | Selected chips highlighted, match count updates in real time |
| No Results | Filter combination yields zero items | "Apply" button reads "No items match", button still tappable but navigates to an empty results state |

**Interactions:**
- Tap a chip: Toggle selection, match count updates immediately
- Drag price slider: Filter updates as the user drags
- Tap "Reset All": Clear all filter selections, restore default sort
- Tap "Apply": Dismiss bottom sheet, apply filters to catalog grid
- Tap section header: Expand/collapse that section
- Swipe down on the bottom sheet handle: Dismiss without applying

**Transitions/Animations:**
- Bottom sheet slides up from the bottom, 300ms with spring easing
- Match count updates fade-transition between numbers, 100ms
- Chip selection state toggles with a scale-bounce effect, 100ms

##### Component: Tag Manager (within Item Detail / Edit)

**Layout:**
- Located in the Edit Item form below the Notes field
- Shows a horizontal scrollable row of existing tag chips on this item
- An "Add Tag" button (or "+" chip) at the end of the row
- Tapping "Add Tag" shows a text input with autocomplete suggestions from existing tags across the wardrobe
- Each tag chip has an "x" button to remove it from this item

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Tags | Item has no tags | Only the "Add Tag" button is visible |
| Has Tags | Item has 1+ tags | Horizontal chip row with tag names, each with "x" dismiss |
| Adding | "Add Tag" tapped | Text input with autocomplete dropdown of existing tags |
| Autocomplete Active | User is typing in the tag input | Dropdown shows matching existing tags; at the bottom, a "Create '[input]'" option if the tag does not exist |

**Interactions:**
- Tap "Add Tag": Show text input with autocomplete
- Type in tag input: Autocomplete suggestions filter in real time
- Tap an autocomplete suggestion: Apply that tag, close input
- Tap "Create '[input]'": Create a new tag and apply it
- Tap "x" on a tag chip: Remove that tag from the item (tag still exists globally)
- Press enter/return in tag input: Apply the typed text as a tag (create if new)

#### 3.6 Data Requirements

##### Entity: Tag

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier for the tag |
| name | string | Required, max 50 chars, trimmed, unique (case-insensitive) | None | Tag display name |
| usage_count | integer | Min: 0, computed | 0 | Number of items using this tag (denormalized for display) |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |

##### Entity: ItemTag (Join Table)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier for the join record |
| clothing_item_id | string | Required, references ClothingItem.id | None | The item being tagged |
| tag_id | string | Required, references Tag.id | None | The tag being applied |
| created_at | datetime | Auto-set on creation | Current timestamp | When the tag was applied |

**Relationships:**
- ClothingItem has many Tag through ItemTag (many-to-many)
- Tag has many ClothingItem through ItemTag (many-to-many)

**Indexes:**
- ItemTag: (clothing_item_id, tag_id) - Unique composite, prevents duplicate tagging
- ItemTag: tag_id - Fast lookup of all items with a given tag
- Tag: name - Fast tag lookup and autocomplete

**Validation Rules:**
- Tag name: Must not be empty after trimming whitespace
- Tag name: Maximum 50 characters
- Tag name: Uniqueness is case-insensitive ("Capsule" and "capsule" are the same tag)
- ItemTag: The combination of clothing_item_id and tag_id must be unique (no duplicate assignments)

**Example Data:**

```
Tag:
{
  "id": "t001-uuid",
  "name": "capsule 2026",
  "usage_count": 15,
  "created_at": "2026-01-10T09:00:00Z"
}

ItemTag:
{
  "id": "it001-uuid",
  "clothing_item_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "tag_id": "t001-uuid",
  "created_at": "2026-01-10T09:05:00Z"
}
```

#### 3.7 Business Logic Rules

##### Category Count Calculation

**Purpose:** Compute per-category item counts for the category browser.

**Inputs:**
- all_items: list of ClothingItem records

**Logic:**

```
1. Group all_items by category WHERE status = 'active'
2. For each category, COUNT the number of items
3. Sort categories by a predefined display order: [Tops, Bottoms, Dresses, Outerwear, Shoes, Accessories, Activewear, Swimwear, Sleepwear, Underwear, Other]
4. RETURN list of { category, count, thumbnail_item_ids (up to 4) }
```

**Edge Cases:**
- Category has 0 items: Show the category card with "0" count and a placeholder thumbnail
- Item category is "Other": Always displayed last in the list

##### Filter Combination Logic

**Purpose:** Apply multiple filters simultaneously to produce a filtered item list.

**Inputs:**
- filters: object containing optional arrays for category, color, season, occasion, condition, status, tags, and optional price_min / price_max
- sort_by: string - the selected sort option

**Logic:**

```
1. Start with all ClothingItem records
2. For each active filter dimension:
   a. IF category filter is set: include items WHERE category IN selected_categories
   b. IF color filter is set: include items WHERE any color IN selected_colors
   c. IF season filter is set: include items WHERE any season IN selected_seasons
   d. IF occasion filter is set: include items WHERE any occasion IN selected_occasions
   e. IF condition filter is set: include items WHERE condition IN selected_conditions
   f. IF status filter is set: include items WHERE status IN selected_statuses
   g. IF tag filter is set: include items WHERE item has any of selected_tags
   h. IF price range is set: include items WHERE purchase_price >= price_min AND purchase_price <= price_max (null prices are excluded from price-filtered results)
3. All filter dimensions are combined with AND logic (items must match ALL active dimensions)
4. Within a single dimension, values are combined with OR logic (item matches if it has ANY of the selected values)
5. Apply the selected sort_by ordering
6. RETURN filtered and sorted list
```

**Edge Cases:**
- No filters active: Return all items with default sort
- Filter combination yields 0 results: Return empty list (UI shows "No items match your filters")
- Items with null purchase_price when price filter is active: Exclude from results
- Items with comma-separated multi-values (e.g., colors "navy,white"): Match if ANY value matches the filter

##### Tag Autocomplete

**Purpose:** Suggest existing tags as the user types in the tag input.

**Inputs:**
- query: string - the partial tag name typed by the user
- current_item_tags: list of tag IDs already applied to this item

**Logic:**

```
1. IF query length < 1, RETURN empty list
2. Search all Tag records WHERE name contains query (case-insensitive, substring match)
3. Exclude tags already applied to the current item (WHERE id NOT IN current_item_tags)
4. Sort results by usage_count descending (most popular tags first), then alphabetically
5. Limit to top 10 results
6. RETURN matching tags
```

**Edge Cases:**
- Query matches no existing tags: Return empty list (UI shows "Create '[query]'" option)
- Query exactly matches an existing tag name: Show that tag as the only result (no "Create" option since it already exists)

**Sort/Filter/Ranking Logic:**
- **Default sort:** Categories sorted by predefined display order
- **Tag sort:** By usage count descending, then alphabetically
- **Filter combination:** AND between dimensions, OR within a dimension

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Tag creation fails (database error) | "Could not create tag. Please try again." toast | User retries; if persistent, suggest restarting the app |
| Duplicate tag name entered | Autocomplete shows the existing tag; if user types exact match and taps "Create", the existing tag is applied instead | Automatic deduplication - no error shown |
| Tag deletion fails | "Could not remove tag. Please try again." toast | User retries |
| Filter query is slow (1000+ items) | Show a subtle loading indicator over the grid while filtering | Filtering completes and results appear; if over 3 seconds, show progress text |
| Category count mismatch after item deletion | Counts are recomputed on catalog load | Automatic recovery on next screen visit |

**Validation Timing:**
- Tag name validation runs on submit (enter key or tap "Create")
- Filter changes trigger match count recalculation immediately on selection change
- Category counts are computed on screen load and after any item add/edit/delete

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the catalog has items across 4 categories (Tops: 10, Bottoms: 5, Shoes: 3, Outerwear: 2),
   **When** the user opens the Category Browser,
   **Then** category cards display with correct counts: "Tops (10)", "Bottoms (5)", "Shoes (3)", "Outerwear (2)", and empty categories show "(0)".

2. **Given** the user is viewing the catalog grid,
   **When** the user opens the Filter/Sort bottom sheet, selects "Tops" and "Blue", and taps "Apply",
   **Then** the grid shows only blue tops, and a filter chip bar appears showing "Tops" and "Blue" chips with dismiss buttons.

3. **Given** a clothing item has no tags,
   **When** the user edits the item and types "vacation" in the tag input and taps "Create 'vacation'",
   **Then** a "vacation" tag chip appears on the item, and the tag is available for autocomplete on other items.

4. **Given** the user has created tags "capsule", "capsule 2026", and "casual friday",
   **When** the user types "cap" in the tag input on any item,
   **Then** autocomplete suggestions show "capsule" and "capsule 2026" sorted by usage count.

**Edge Cases:**

5. **Given** two items are tagged "Capsule" (uppercase) and the user types "capsule" (lowercase),
   **When** the user selects the autocomplete suggestion,
   **Then** the existing "Capsule" tag is applied (case-insensitive matching preserves the original casing).

6. **Given** a filter combination of "Dresses + Winter + Formal" yields 0 items,
   **When** the user applies the filter,
   **Then** the grid shows "No items match your filters" with a "Clear Filters" button.

**Negative Tests:**

7. **Given** the user is adding a tag,
   **When** the user submits an empty tag name (blank or whitespace-only),
   **Then** the system rejects the input with "Tag name cannot be empty",
   **And** no tag is created.

8. **Given** a tag named "work" already exists on this item,
   **When** the user attempts to add "work" again to the same item,
   **Then** the duplicate is silently prevented (the tag remains applied once),
   **And** no error is shown to the user.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| groups items by category correctly | 10 tops, 5 bottoms, 3 shoes | { tops: 10, bottoms: 5, shoes: 3, ... rest: 0 } |
| applies single-dimension filter | filter: { category: ["tops"] }, 20 items (10 tops, 10 bottoms) | 10 items returned (all tops) |
| applies multi-dimension AND filter | filter: { category: ["tops"], color: ["blue"] }, items with various combos | only blue tops returned |
| applies OR within dimension | filter: { category: ["tops", "bottoms"] } | tops and bottoms returned |
| excludes null prices from price filter | filter: { price_min: 0, price_max: 50 }, items: [{price:25}, {price:null}] | only the $25 item returned |
| autocomplete returns matching tags | query: "cap", tags: ["capsule", "casual", "captain"] | ["capsule", "captain"] (sorted by usage) |
| autocomplete excludes already-applied tags | query: "cap", tags: ["capsule", "captain"], applied: ["capsule"] | ["captain"] only |
| tag name uniqueness is case-insensitive | existing: "Vacation", new: "vacation" | deduplicates to existing "Vacation" tag |
| validates empty tag name | name: "  " | validation error: "Tag name cannot be empty" |
| validates tag name max length | name: 51-char string | validation error: "Tag name must be 50 characters or fewer" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Filter and verify grid updates | 1. Add 5 tops and 3 bottoms, 2. Open filter sheet, 3. Select "Tops", 4. Apply | Grid shows 5 items, filter chip "Tops" visible |
| Add tag and verify autocomplete on another item | 1. Tag item A with "summer trip", 2. Open item B edit, 3. Type "sum" in tag input | Autocomplete shows "summer trip" as suggestion |
| Category browser drill-down | 1. Add items across 3 categories, 2. Open category browser, 3. Tap "Shoes (3)" | Catalog grid opens pre-filtered to shoes, showing 3 items |
| Clear filters restores full catalog | 1. Apply filter, 2. Verify reduced results, 3. Tap "Clear Filters" | Full catalog is restored |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User organizes wardrobe with tags | 1. Add 10 items, 2. Tag 5 as "capsule", 3. Tag 3 as "donate maybe", 4. Filter by "capsule" tag | Grid shows exactly 5 capsule items |
| User finds outfit for event using filters | 1. Add 20 items with various attributes, 2. Filter: Formal + Winter, 3. Browse results | Only formal winter items shown, user can identify outfit candidates |

---

### CL-003: Outfit Builder

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | CL-003 |
| **Feature Name** | Outfit Builder |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a fashion-conscious planner, I want to combine individual clothing items into complete outfits, so that I can plan and save looks I love without trying everything on.

**Secondary:**
> As a busy professional, I want to browse my saved outfits and pick one quickly in the morning, so that I spend less time deciding what to wear.

**Tertiary:**
> As a minimalist dresser, I want to see which items appear in the most outfits, so that I can identify my most versatile pieces and build a more efficient wardrobe.

#### 3.3 Detailed Description

The Outfit Builder lets users combine individual wardrobe items into named outfits. An outfit is a curated collection of clothing items that work together as a complete look. Users build outfits by selecting items from their catalog, arranging them in a visual layout, and saving the combination with a name, occasion tags, and season tags.

The builder provides a visual canvas that shows selected items layered or arranged to approximate how the outfit would look when worn. Items are displayed as their catalog photos, positioned in a standard layout: top/shirt area at the top, bottoms in the middle, shoes at the bottom, and accessories to the side. Users can rearrange items by dragging them to different positions on the canvas.

Saved outfits appear in an Outfits gallery that can be browsed, filtered by season and occasion, and searched by name. Each outfit card shows a composite thumbnail of all included items. The gallery serves as a personal lookbook that users can reference each morning or when packing for trips.

Unlike Cladwell, which generates outfits algorithmically and charges $96/yr for the privilege, MyCloset puts the creative control in the user's hands with a free-form builder and saves all outfit data locally.

#### 3.4 Prerequisites

**Feature Dependencies:**
- CL-001: Wardrobe Catalog - Items must exist in the catalog before they can be added to outfits

**External Dependencies:**
- None

**Assumed Capabilities:**
- Catalog photos are accessible from local storage
- Touch/drag gestures are supported on the device

#### 3.5 User Interface Requirements

##### Screen: Outfits Gallery

**Layout:**
- The screen has a top navigation bar showing "Outfits" as the title, with a filter icon on the left and a "+" (create outfit) button on the right
- Below the navigation bar is a count line showing the total number of saved outfits (e.g., "32 outfits")
- The main content area is a scrollable grid of outfit cards, 2 columns
- Each outfit card shows: a composite thumbnail of the outfit's items arranged visually, the outfit name (1 line, truncated), and small chips for season and occasion
- Tapping an outfit card navigates to the Outfit Detail screen
- A floating action button in the bottom-right corner opens the Outfit Builder canvas

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No outfits created | Centered illustration, heading "No outfits yet", subtext "Create your first outfit from your wardrobe", "Create Outfit" button |
| Loading | Initial query in progress | Skeleton grid with placeholder rectangles |
| Populated | 1+ outfits exist | Grid of outfit cards |
| Filtered | Active filters applied | Grid shows matching outfits; if 0 results: "No outfits match your filters" |

**Interactions:**
- Tap outfit card: Navigate to Outfit Detail
- Long press outfit card: Context menu (Edit, Duplicate, Delete)
- Tap "+": Open Outfit Builder canvas
- Tap filter icon: Open filter bottom sheet (Season, Occasion, Favorited)
- Pull down: Refresh grid

**Transitions/Animations:**
- Grid items load with a staggered fade-in, 50ms between items
- Deleted outfits shrink and fade, 200ms

##### Screen: Outfit Builder Canvas

**Layout:**
- Full-screen modal with "New Outfit" title (or "Edit [Outfit Name]" in edit mode), "Cancel" (left), and "Save" (right) in the top bar
- The upper 60% of the screen is the outfit canvas, a visual area divided into logical zones:
  - Top zone (headwear, scarves)
  - Upper body zone (tops, jackets, outerwear)
  - Lower body zone (bottoms, skirts)
  - Feet zone (shoes, boots)
  - Side zones (bags, accessories, jewelry)
- Each zone shows a subtle dotted outline when empty, labeled with the zone name in light text
- Items placed on the canvas show as their catalog photos, scaled to fit within the zone. Multiple items can occupy the same zone (e.g., a shirt and a jacket both in the upper body zone, layered)
- Below the canvas is a horizontal scrollable item picker showing the user's catalog items filtered by category. Category tabs (All, Tops, Bottoms, Shoes, etc.) sit above the picker strip
- Tapping an item in the picker adds it to the appropriate zone on the canvas based on its category
- Items on the canvas can be tapped to select them (highlighted border), then tapped again to remove them, or dragged to reposition within the canvas
- Below the item picker (scrolled down) are fields:
  - Outfit Name (text input, required, placeholder: "e.g., Monday Work Look")
  - Season (multi-select chips: Spring, Summer, Fall, Winter, All-Season)
  - Occasion (multi-select chips: Casual, Work, Formal, Active, Lounge, Date Night, Outdoor)
  - Favorite toggle (heart icon)
  - Notes (multiline text, optional)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty Canvas | No items added | Canvas shows empty zone outlines with labels, "Save" disabled |
| Building | 1+ items added to canvas | Items displayed in zones, "Save" enabled if name is also filled |
| Editing | Opened in edit mode | Canvas pre-populated with existing outfit items and metadata |
| Item Selected | Item tapped on canvas | Item has highlighted border, options bar shows "Remove" button |

**Interactions:**
- Tap item in picker: Add to canvas in the appropriate zone (auto-placement by category)
- Tap item on canvas: Select it (highlight border)
- Tap selected item on canvas: Deselect
- Double-tap item on canvas: Remove from outfit
- Drag item on canvas: Reposition within canvas (free-form within bounds)
- Tap category tab in picker: Filter picker to that category
- Tap "Save": Validate, save outfit, dismiss
- Tap "Cancel": Confirm discard if changes exist

**Transitions/Animations:**
- Item addition: photo thumbnail flies from the picker strip to the appropriate zone on canvas, 250ms
- Item removal: shrinks and fades from canvas, 200ms
- Canvas rearrangement: items smoothly animate to new positions, 200ms

##### Screen: Outfit Detail

**Layout:**
- Full-screen with back button and "Edit" button in the top bar
- Hero area showing the outfit canvas arrangement at full width (approximately 50% of screen height)
- Below the hero, the outfit name as a large heading
- A row of metadata chips: season(s), occasion(s), favorite indicator (filled/unfilled heart)
- A divider, then an "Items in this outfit" section showing a vertical list of item rows. Each row shows: item thumbnail (small), item name, item category, and a link arrow to navigate to the item detail
- A divider, then a "Stats" section showing:
  - Times Worn (how many times this outfit has been logged in the outfit calendar)
  - Last Worn (date)
  - Total Outfit Value (sum of purchase prices of all included items)
- Notes section (if notes exist)
- "Delete Outfit" destructive button at the bottom

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Loaded | Outfit data retrieved | Full detail layout |
| Loading | Data being fetched | Skeleton placeholders |
| Item Missing | An item in the outfit was deleted from catalog | That item's slot shows a "Removed item" placeholder with dashed border |

**Interactions:**
- Tap "Edit": Open Outfit Builder canvas in edit mode with current items and metadata pre-loaded
- Tap item row: Navigate to that item's Item Detail screen (CL-001)
- Tap favorite heart: Toggle favorite status
- Tap "Delete Outfit": Confirmation dialog, then delete
- Tap "Log Wear": Mark this outfit as worn today (creates wear log entries for all items in the outfit and an outfit calendar entry)

#### 3.6 Data Requirements

##### Entity: Outfit

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier for the outfit |
| name | string | Required, max 200 chars, trimmed | None | User-given name for the outfit |
| seasons | string | Optional, comma-separated | null | Seasons this outfit is appropriate for |
| occasions | string | Optional, comma-separated | null | Occasions this outfit is appropriate for |
| is_favorite | boolean | - | false | Whether the user has favorited this outfit |
| times_worn | integer | Min: 0 | 0 | Number of times this outfit has been logged as worn |
| last_worn_date | date | Optional, ISO 8601 | null | Most recent date this outfit was worn |
| notes | string | Optional, max 2000 chars | null | Free-text notes about the outfit |
| thumbnail_path | string | Optional, max 500 chars | null | Path to a generated composite thumbnail image |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

##### Entity: OutfitItem (Join Table)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| outfit_id | string | Required, references Outfit.id | None | The outfit this item belongs to |
| clothing_item_id | string | Required, references ClothingItem.id | None | The clothing item in the outfit |
| position_x | float | Min: 0.0, Max: 1.0 | Auto | Normalized horizontal position on canvas (0 = left, 1 = right) |
| position_y | float | Min: 0.0, Max: 1.0 | Auto | Normalized vertical position on canvas (0 = top, 1 = bottom) |
| layer_order | integer | Min: 0 | 0 | Z-order for layered items in the same zone (higher = on top) |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |

**Relationships:**
- Outfit has many ClothingItem through OutfitItem (many-to-many)
- OutfitItem belongs to Outfit (many-to-one)
- OutfitItem belongs to ClothingItem (many-to-one)

**Indexes:**
- OutfitItem: (outfit_id, clothing_item_id) - Unique composite
- OutfitItem: outfit_id - All items for an outfit
- OutfitItem: clothing_item_id - All outfits containing an item
- Outfit: is_favorite - Filter favorited outfits
- Outfit: last_worn_date - Sort by recently worn

**Validation Rules:**
- Outfit name: Must not be empty after trimming
- Outfit name: Maximum 200 characters
- An outfit must contain at least 1 item to be saved
- An outfit can contain a maximum of 15 items
- The same clothing item cannot appear twice in the same outfit (unique clothing_item_id per outfit_id)
- position_x and position_y must be between 0.0 and 1.0 inclusive

**Example Data:**

```
Outfit:
{
  "id": "o001-uuid",
  "name": "Monday Work Look",
  "seasons": "fall,winter",
  "occasions": "work",
  "is_favorite": true,
  "times_worn": 8,
  "last_worn_date": "2026-02-28",
  "notes": "Goes well with the brown leather watch",
  "thumbnail_path": "/local/photos/closet/outfits/o001-thumb.jpg",
  "created_at": "2026-01-05T08:00:00Z",
  "updated_at": "2026-02-28T07:30:00Z"
}

OutfitItem:
{
  "id": "oi001-uuid",
  "outfit_id": "o001-uuid",
  "clothing_item_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "position_x": 0.5,
  "position_y": 0.15,
  "layer_order": 1,
  "created_at": "2026-01-05T08:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Auto-Placement by Category

**Purpose:** Automatically position items on the canvas when added from the picker, based on their category.

**Inputs:**
- item_category: enum - the category of the item being added
- existing_items: list of items already on the canvas with their positions

**Logic:**

```
1. Map category to default canvas zone:
   - tops, activewear (top): position_y = 0.2
   - outerwear: position_y = 0.2, layer_order = highest in zone + 1
   - bottoms, swimwear (bottom): position_y = 0.5
   - dresses: position_y = 0.35 (spans upper and lower)
   - shoes: position_y = 0.8
   - accessories: position_x = 0.85, position_y = 0.3
   - sleepwear: position_y = 0.35
   - underwear: position_y = 0.5 (same as bottoms)
   - other: position_y = 0.6
2. Set position_x = 0.5 (centered) for all non-accessory items
3. IF an item already exists at the same zone position:
   a. Offset the new item slightly (position_x += 0.05) to prevent exact overlap
   b. Set layer_order = max(existing zone items layer_order) + 1
4. RETURN { position_x, position_y, layer_order }
```

**Edge Cases:**
- Two tops added: Second top is layered on top of the first (layer_order incremented) with slight offset
- Dress added after top and bottom: Dress position overlaps both zones, but layer_order places it correctly
- More than 4 accessories: Each subsequent accessory offsets further right and downward

##### Composite Thumbnail Generation

**Purpose:** Generate a single composite image from all items in an outfit for the gallery card.

**Inputs:**
- outfit_items: list of OutfitItem records with their associated ClothingItem photo paths and positions

**Logic:**

```
1. Create a blank canvas at the target thumbnail resolution (600x800 pixels)
2. Sort outfit_items by layer_order ascending (lowest layer drawn first)
3. For each item:
   a. Load the item's thumbnail photo
   b. Scale it to fit within a designated area (approximately 200x200 pixels)
   c. Position it on the canvas using the normalized position_x and position_y coordinates
   d. Draw it onto the canvas
4. Save the composite image to the outfit's thumbnail_path
5. RETURN thumbnail_path
```

**Edge Cases:**
- Item photo is missing: Skip that item in the composite (do not fail)
- Outfit has only 1 item: Composite shows that single item centered
- Outfit has 15 items: All items rendered, some may overlap (layer_order determines visibility)

##### Outfit Value Calculation

**Purpose:** Calculate the total value of all items in an outfit.

**Inputs:**
- outfit_items: list of OutfitItem records with their associated ClothingItem purchase_price values

**Formulas:**
- `total_outfit_value = SUM(purchase_price) for all items WHERE purchase_price IS NOT NULL`

**Edge Cases:**
- No items have a purchase price: Display "$0" or "N/A"
- Some items have prices, some do not: Sum only the priced items, note "(partial)" next to the value

**Sort/Filter/Ranking Logic:**
- **Default sort:** Most recently created first (created_at descending)
- **Available sort options:** Name (A-Z, Z-A), Newest First, Oldest First, Most Worn, Last Worn, Favorited First
- **Filter options:** Season (multi-select), Occasion (multi-select), Favorited (yes/no)
- **Search:** Outfit name, substring match, case-insensitive, minimum 2 characters

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Save fails (database error) | "Could not save outfit. Please try again." toast | User taps retry |
| Item photo missing on canvas | Placeholder icon in the item's canvas position | User can still save; composite thumbnail uses placeholder |
| Outfit exceeds 15-item limit | "An outfit can have up to 15 items" toast when adding the 16th | User removes an item before adding another |
| Save attempted with no items | "Add at least one item to save the outfit" inline error | User adds items from the picker |
| Save attempted without name | "Outfit name is required" inline error below name field | User enters a name |
| Referenced item deleted after outfit created | Item appears as "Removed item" placeholder in outfit detail and canvas | User can edit outfit and remove the placeholder or replace with another item |
| Thumbnail generation fails | Outfit is saved without a thumbnail; gallery card shows a generic outfit icon | Thumbnail regenerates on next outfit edit/save |

**Validation Timing:**
- Item limit is enforced on each add attempt (real-time)
- Name and minimum item count are validated on save
- Canvas positions are auto-calculated, no user validation needed

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 10 items in their wardrobe catalog,
   **When** the user taps "+" on the Outfits Gallery, selects a top, a bottom, and shoes from the picker, enters the name "Friday Casual", selects "Casual" occasion, and taps "Save",
   **Then** the outfit appears in the gallery with a composite thumbnail, the name "Friday Casual", and a "Casual" chip.

2. **Given** a saved outfit with 4 items exists,
   **When** the user taps the outfit card in the gallery,
   **Then** the Outfit Detail screen shows the canvas arrangement, outfit name, metadata, the 4 items listed individually, and wear stats.

3. **Given** the user is on the Outfit Builder canvas with a top and bottom placed,
   **When** the user adds outerwear from the picker,
   **Then** the outerwear item auto-positions in the upper body zone layered on top of the existing top, with a higher layer_order.

4. **Given** the user opens an existing outfit in edit mode,
   **When** the user removes one item and adds two new items, then saves,
   **Then** the outfit is updated to reflect the new item set, and the composite thumbnail regenerates.

**Edge Cases:**

5. **Given** an outfit contains an item that has been deleted from the catalog,
   **When** the user views the outfit detail,
   **Then** the deleted item's position shows a "Removed item" placeholder with a dashed border, and all other items display normally.

6. **Given** the outfit builder canvas already has 15 items,
   **When** the user attempts to add a 16th item from the picker,
   **Then** a toast message displays "An outfit can have up to 15 items" and the item is not added.

**Negative Tests:**

7. **Given** the user is on the Outfit Builder canvas with 3 items placed,
   **When** the user taps "Save" without entering an outfit name,
   **Then** the system shows "Outfit name is required" below the name field,
   **And** the outfit is not saved.

8. **Given** the user is on the Outfit Builder canvas with no items placed,
   **When** the user enters a name and taps "Save",
   **Then** the system shows "Add at least one item to save the outfit",
   **And** the outfit is not saved.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| auto-places top at correct position | category: "tops" | position_y: 0.2, position_x: 0.5 |
| auto-places shoes at correct position | category: "shoes" | position_y: 0.8, position_x: 0.5 |
| auto-places accessories to the side | category: "accessories" | position_x: 0.85, position_y: 0.3 |
| offsets second item in same zone | two tops added | second top has position_x: 0.55, layer_order: 1 |
| calculates outfit value correctly | items with prices [25.00, 89.90, null, 45.00] | total: 159.90 |
| calculates outfit value all null prices | items with prices [null, null] | total: 0 (or "N/A") |
| validates outfit name required | name: "" | validation error: "Outfit name is required" |
| validates minimum 1 item | items: [] | validation error: "Add at least one item" |
| validates maximum 15 items | items: 16 items | validation error: "An outfit can have up to 15 items" |
| prevents duplicate item in outfit | add same item_id twice | second add is rejected silently |
| validates position bounds | position_x: 1.5 | clamped to 1.0 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create outfit and verify gallery | 1. Add 3 items to canvas, 2. Name outfit, 3. Save, 4. Return to gallery | Outfit appears in gallery with composite thumbnail |
| Edit outfit and verify changes persist | 1. Open outfit detail, 2. Tap Edit, 3. Remove 1 item and add 2, 4. Save, 5. Reopen detail | Updated item list and refreshed thumbnail |
| Delete outfit and verify removal | 1. Open outfit detail, 2. Tap Delete, 3. Confirm | Outfit no longer in gallery, outfit count decrements |
| Outfit survives item deletion | 1. Create outfit with items A, B, C, 2. Delete item B from catalog, 3. Open outfit | Outfit shows items A and C normally, item B shows as placeholder |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User creates 5 outfits and browses gallery | 1. Add 15 items to catalog, 2. Create 5 outfits using various items, 3. Browse gallery, 4. Filter by "Work" occasion | Gallery shows all 5 outfits unfiltered, filtered view shows only work outfits |
| User builds outfit for tomorrow | 1. Open Outfit Builder, 2. Pick top + bottom + shoes + accessory, 3. Name "Tomorrow's Look", 4. Save, 5. View detail | Outfit saved with 4 items, composite thumbnail visible, detail shows all items with links |

---

### CL-004: Outfit Calendar and Wear Logging

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | CL-004 |
| **Feature Name** | Outfit Calendar and Wear Logging |
| **Priority** | P0 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a fashion-conscious planner, I want to log what I wear each day on a calendar, so that I can look back and see my style patterns over time.

**Secondary:**
> As a busy professional, I want to see what I wore recently at a glance, so that I can avoid repeating the same outfit too soon for recurring meetings.

**Tertiary:**
> As a budget-minded shopper, I want a visual log of daily outfits, so that I can see whether I actually wear the things I buy.

#### 3.3 Detailed Description

The Outfit Calendar provides a calendar-based interface where each day can have one or more outfits logged. Users record what they wore on a given day either by selecting a pre-built outfit from their Outfits gallery (CL-003) or by quick-selecting individual items for an ad-hoc outfit. The calendar displays small outfit thumbnails on each day that has a logged outfit.

Wear logging is the act of recording that an outfit (or individual items) was worn on a specific date. Each wear log entry automatically increments the wear count for every item in the outfit, updates the item's last_worn_date, and updates the outfit's own wear statistics. This data flows into cost-per-wear calculations (CL-006), donation suggestions (CL-007), and clothing statistics (CL-008).

Users can log outfits for today, for past dates (backdating is supported for users catching up on their wardrobe log), and can remove logged outfits from a date if they made a mistake. Future date logging is supported for planning purposes but does not increment wear counts until the date arrives (or the user confirms the planned outfit was actually worn).

The calendar view supports month-by-month navigation and includes a weekly strip view for quick access to the current week. Tapping a day with a logged outfit shows the outfit detail inline or as a bottom sheet.

#### 3.4 Prerequisites

**Feature Dependencies:**
- CL-001: Wardrobe Catalog - Items must exist to be logged as worn
- CL-003: Outfit Builder - Saved outfits can be selected for logging (but ad-hoc logging of individual items is also supported without pre-built outfits)

**External Dependencies:**
- Device clock for determining the current date
- Local persistent storage

**Assumed Capabilities:**
- Calendar UI component is available or can be built
- Date arithmetic is available for computing streaks, gaps, and date ranges

#### 3.5 User Interface Requirements

##### Screen: Outfit Calendar

**Layout:**
- The screen has a top navigation bar showing the current month and year (e.g., "March 2026"), with left/right arrows for month navigation
- Below the navigation bar is a week strip view showing the current 7-day week with small circular day indicators. Days with logged outfits show a small dot indicator below the date number. The current day is highlighted with an accent ring
- Below the week strip is the full month calendar grid (standard 7-column layout, Sun-Sat). Each day cell contains:
  - The date number
  - If an outfit is logged: a small composite thumbnail (or the first item's thumbnail if ad-hoc) taking up most of the cell
  - If multiple outfits are logged for a day: a small "2" or "3" badge in the corner
  - If no outfit is logged: the cell is empty (just the date number)
- Below the calendar grid is a "Today's Log" section showing:
  - If today has logged outfits: a card for each logged outfit with name, thumbnail, and item list
  - If today has no logged outfit: a "Log Today's Outfit" button
- A floating action button labeled "Log Outfit" in the bottom-right corner opens the logging flow

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty Month | No outfits logged for the displayed month | Calendar grid with empty day cells, "Log Today's Outfit" prompt in the bottom section |
| Populated Month | One or more days have logged outfits | Day cells show outfit thumbnails, days without logs show empty |
| Day Detail Active | User tapped on a day with a logged outfit | Bottom sheet slides up showing the outfit(s) logged for that day |
| Planning Mode | User has logged a future date outfit | Future day cell shows the outfit thumbnail with a subtle dashed border indicating "planned" |
| Loading | Calendar data loading | Skeleton calendar grid |

**Interactions:**
- Tap left/right arrow: Navigate to previous/next month with a horizontal slide transition
- Tap a day with a logged outfit: Show day detail bottom sheet with outfit thumbnail(s), item list, and options (View Outfit, Remove Log)
- Tap a day without a logged outfit: Open the Log Outfit flow pre-set to that date
- Tap "Log Outfit" FAB: Open the Log Outfit flow for today
- Swipe left/right on calendar grid: Navigate months
- Tap a day in the week strip: Scroll the calendar to that week and show the day detail

**Transitions/Animations:**
- Month navigation slides horizontally, 250ms
- Day detail bottom sheet slides up, 300ms
- Outfit thumbnail in day cell fades in on first load, 150ms

##### Modal: Log Outfit Flow

**Layout:**
- Bottom sheet or full-screen modal with title "Log Outfit" and a date selector at the top (defaulting to today)
- Two tabs below the date selector:
  - **Saved Outfits:** A scrollable grid of the user's saved outfits from CL-003. Tapping one selects it (highlighted border). Shows outfit name, thumbnail, and season/occasion chips.
  - **Quick Pick:** A catalog item picker (similar to the Outfit Builder picker) allowing the user to tap individual items to create an ad-hoc outfit. Selected items appear in a small strip at the top of the picker area.
- Below the tabs:
  - Selected outfit summary: thumbnail and name (if saved outfit) or count of selected items (if quick pick)
  - Notes field (optional, multiline, placeholder: "What was the occasion?")
  - "Log Outfit" confirmation button
- The date selector allows choosing any past or future date. Future dates are marked as "Planned" and do not increment wear counts.

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Selection | Nothing selected | "Log Outfit" button disabled |
| Outfit Selected | A saved outfit is selected | Outfit thumbnail and name shown in summary, button enabled |
| Items Picked | 1+ items selected in Quick Pick | Selected items shown in strip, button enabled |
| Date Changed | User picked a different date | Date selector reflects new date; if future, a "Planned" label appears |
| Saving | "Log Outfit" tapped | Button shows loading indicator |

**Interactions:**
- Tap saved outfit card: Select it (deselect any previously selected)
- Tap item in Quick Pick: Toggle selection (add/remove from strip)
- Tap date selector: Open date picker
- Tap "Log Outfit": Save the log entry, dismiss modal, update calendar
- Tap outside the modal or swipe down: Dismiss (with discard confirmation if selections exist)

##### Component: Day Detail Bottom Sheet

**Layout:**
- Shows the date as a heading (e.g., "Friday, March 6, 2026")
- Lists each logged outfit for that day as a card:
  - Outfit thumbnail (or composite of ad-hoc items)
  - Outfit name (or "Ad-hoc outfit" for quick picks)
  - List of item names
  - Notes (if any)
  - "Remove" button (red text, removes this specific log entry)
- "Log Another Outfit" button at the bottom (for users who changed outfits during the day)

#### 3.6 Data Requirements

##### Entity: WearLog

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier for the wear log entry |
| date | date | Required, ISO 8601 date | Today | The date the outfit was worn (or planned to be worn) |
| outfit_id | string | Optional, references Outfit.id | null | The saved outfit that was logged (null if ad-hoc) |
| is_planned | boolean | - | false | True if this is a future-date plan, false if confirmed worn |
| notes | string | Optional, max 1000 chars | null | User notes about the day's outfit |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

##### Entity: WearLogItem (Join Table for ad-hoc items)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| wear_log_id | string | Required, references WearLog.id | None | The wear log this item belongs to |
| clothing_item_id | string | Required, references ClothingItem.id | None | The clothing item that was worn |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |

**Relationships:**
- WearLog optionally belongs to Outfit (many-to-one, nullable)
- WearLog has many ClothingItem through WearLogItem (for ad-hoc logging)
- If outfit_id is set, the items are derived from OutfitItem; WearLogItem records are also created for denormalized tracking

**Indexes:**
- WearLog: date - Calendar queries by date
- WearLog: (date, outfit_id) - Lookup specific outfit on a date
- WearLogItem: wear_log_id - All items for a wear log
- WearLogItem: clothing_item_id - All wear logs for a given item
- WearLog: is_planned - Separate planned from confirmed entries

**Validation Rules:**
- date: Must be a valid date (not null, parseable)
- At least one of outfit_id or WearLogItem records must be present (cannot log an empty outfit)
- For non-planned entries (past or today), is_planned must be false
- For future dates, is_planned must be true

**Example Data:**

```
WearLog:
{
  "id": "wl001-uuid",
  "date": "2026-03-06",
  "outfit_id": "o001-uuid",
  "is_planned": false,
  "notes": "Client meeting day",
  "created_at": "2026-03-06T07:30:00Z",
  "updated_at": "2026-03-06T07:30:00Z"
}

WearLogItem:
{
  "id": "wli001-uuid",
  "wear_log_id": "wl001-uuid",
  "clothing_item_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "created_at": "2026-03-06T07:30:00Z"
}
```

#### 3.7 Business Logic Rules

##### Wear Log Creation

**Purpose:** Record that a user wore an outfit on a specific date, updating all related counters.

**Inputs:**
- date: date - the date the outfit was worn
- outfit_id: string (optional) - the saved outfit, or null for ad-hoc
- item_ids: list of string - the clothing items worn (derived from outfit or quick-picked)
- notes: string (optional)

**Logic:**

```
1. Determine if this is a planned entry: is_planned = (date > today)
2. Create a WearLog record with the given date, outfit_id, is_planned, and notes
3. Create WearLogItem records for each item_id
4. IF is_planned = false:
   a. For each item in item_ids:
      - INCREMENT ClothingItem.times_worn by 1
      - SET ClothingItem.last_worn_date = MAX(date, current last_worn_date)
   b. IF outfit_id is not null:
      - INCREMENT Outfit.times_worn by 1
      - SET Outfit.last_worn_date = MAX(date, current last_worn_date)
5. RETURN the created WearLog record
```

**Edge Cases:**
- Logging the same outfit twice on the same day: Allowed (user may have changed and changed back). Each log creates separate WearLog and increments counts independently.
- Backdating a wear log to 3 months ago: Allowed. is_planned = false, counters increment normally. last_worn_date updates only if the backdate is more recent than the current last_worn_date.
- Future date logging: is_planned = true, no counter increments. A scheduled job or user confirmation later converts planned to confirmed.

##### Planned Outfit Confirmation

**Purpose:** Convert a planned (future-date) wear log to a confirmed entry when the date arrives.

**Inputs:**
- wear_log_id: string - the planned entry to confirm
- confirmed: boolean - true if the user actually wore this outfit, false to cancel the plan

**Logic:**

```
1. Look up the WearLog by wear_log_id
2. IF is_planned = false, RETURN error "This entry is already confirmed"
3. IF confirmed = true:
   a. SET is_planned = false
   b. INCREMENT wear counts for all items (same logic as step 4 in Wear Log Creation)
   c. INCREMENT outfit wear count if outfit_id is set
4. IF confirmed = false:
   a. DELETE the WearLog and associated WearLogItem records
   b. No counter changes
5. RETURN updated or deleted status
```

**Edge Cases:**
- User never confirms a planned entry: Entry remains as "planned" indefinitely until manually removed or confirmed
- Planned date has passed: The system does not auto-confirm; user must explicitly confirm or remove

##### Wear Log Removal

**Purpose:** Remove a logged outfit from a date and reverse counter increments.

**Inputs:**
- wear_log_id: string - the wear log to remove

**Logic:**

```
1. Look up the WearLog by wear_log_id
2. IF is_planned = false (was a confirmed entry):
   a. For each WearLogItem:
      - DECREMENT ClothingItem.times_worn by 1 (minimum 0)
      - Recalculate ClothingItem.last_worn_date by querying remaining WearLogItem records for this item
   b. IF outfit_id is set:
      - DECREMENT Outfit.times_worn by 1 (minimum 0)
      - Recalculate Outfit.last_worn_date by querying remaining WearLog records for this outfit
3. DELETE all WearLogItem records for this wear_log_id
4. DELETE the WearLog record
5. RETURN success
```

**Edge Cases:**
- Removing the only wear log for an item: times_worn becomes 0, last_worn_date becomes null
- Removing a log from 6 months ago when item was also worn yesterday: last_worn_date remains yesterday (recalculated from remaining logs)

**Sort/Filter/Ranking Logic:**
- **Calendar default view:** Current month, current day highlighted
- **Day detail sort:** Multiple outfits on the same day sorted by created_at ascending (order they were logged)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on log creation | "Could not log outfit. Please try again." toast | User taps retry |
| Referenced outfit was deleted | If the user tries to log a deleted outfit: "This outfit no longer exists. Create a new one or use Quick Pick." | User selects a different outfit or uses Quick Pick |
| Referenced item was deleted (in ad-hoc log) | Item is skipped during counter increment; WearLogItem still references the deleted item for historical record | No user action needed; history is preserved |
| Date picker allows invalid date | Date picker restricts to valid calendar dates; no free-text date entry | Automatic prevention |
| Wear log removal fails | "Could not remove this entry. Please try again." toast | User taps retry |
| Counter goes below 0 on removal | Counter is floored at 0; no negative wear counts | Automatic prevention |

**Validation Timing:**
- Date is validated on selection (must be a valid calendar date)
- At least one outfit or item must be selected before the "Log Outfit" button enables (real-time)
- Future date detection is immediate on date selection (toggles "Planned" label)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has a saved outfit "Monday Work Look",
   **When** the user taps "Log Outfit", selects "Monday Work Look" from the Saved Outfits tab, and taps "Log Outfit",
   **Then** today's date on the calendar shows the outfit thumbnail, each item's wear count increments by 1, and the outfit's times_worn increments by 1.

2. **Given** the user is viewing March 2026 on the calendar,
   **When** the user taps the left arrow,
   **Then** the calendar slides to February 2026 showing any logged outfits for that month.

3. **Given** the user taps a day that has a logged outfit,
   **When** the day detail bottom sheet appears,
   **Then** it shows the outfit name, thumbnail, item list, notes, and a "Remove" button.

4. **Given** the user selects the Quick Pick tab in the Log Outfit flow,
   **When** the user taps 4 individual items and taps "Log Outfit",
   **Then** an ad-hoc wear log is created for today with those 4 items, and each item's wear count increments by 1.

5. **Given** the user taps on a future date (March 15),
   **When** the user selects an outfit and logs it,
   **Then** the entry is saved with is_planned = true, no wear counts are incremented, and the day cell shows the outfit thumbnail with a dashed "planned" border.

**Edge Cases:**

6. **Given** the user has already logged one outfit for today,
   **When** the user logs a second outfit for the same day,
   **Then** both outfits appear in the day detail bottom sheet, the day cell shows a "2" badge, and all items across both outfits have their wear counts incremented.

7. **Given** the user logged an outfit for today and then removes it,
   **When** the removal completes,
   **Then** the day cell becomes empty, all item wear counts decrement by 1, and the outfit's times_worn decrements by 1.

**Negative Tests:**

8. **Given** the user opens the Log Outfit flow,
   **When** the user taps "Log Outfit" without selecting any outfit or items,
   **Then** the button is disabled and nothing happens.

9. **Given** the user attempts to log a saved outfit that was deleted moments ago,
   **When** the system tries to create the wear log,
   **Then** the system shows "This outfit no longer exists. Create a new one or use Quick Pick.",
   **And** no wear log is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates wear log with correct date | date: "2026-03-06", outfit_id: "o001" | WearLog created with date "2026-03-06", is_planned: false |
| marks future date as planned | date: "2026-04-01" (future), outfit_id: "o001" | WearLog created with is_planned: true |
| increments item wear count on confirmed log | item.times_worn: 5, log confirmed | item.times_worn: 6 |
| does not increment wear count on planned log | item.times_worn: 5, log planned | item.times_worn: 5 (unchanged) |
| decrements wear count on log removal | item.times_worn: 5, remove confirmed log | item.times_worn: 4 |
| floors wear count at 0 on removal | item.times_worn: 0, remove log | item.times_worn: 0 (not -1) |
| recalculates last_worn_date on removal | logs on Mar 1 and Mar 5, remove Mar 5 | last_worn_date: "2026-03-01" |
| sets last_worn_date to null when last log removed | single log removed | last_worn_date: null |
| updates last_worn_date only if more recent | existing last_worn: Mar 5, backdate log to Feb 1 | last_worn_date stays Mar 5 |
| allows multiple logs on same day | 2 logs for same date | both WearLog records created, counts increment for both |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Log outfit and verify calendar | 1. Log "Monday Work Look" for today, 2. View calendar | Today's cell shows outfit thumbnail, day detail shows outfit name and items |
| Remove log and verify counters revert | 1. Log outfit (item had 5 wears), 2. Remove log | Item shows 4 wears, calendar cell is empty |
| Log ad-hoc items and verify | 1. Open Quick Pick, 2. Select 3 items, 3. Log for today | WearLog created without outfit_id, 3 WearLogItem records created, all 3 items incremented |
| Plan future outfit then confirm | 1. Log outfit for next week, 2. Wait for date, 3. Confirm | Counts increment only after confirmation |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User logs outfits for a full week | 1. Log a different outfit each day for Mon-Fri, 2. View calendar week strip | All 5 days show outfit thumbnails, item wear counts reflect usage |
| User reviews last month's outfits | 1. Log outfits over the past 30 days, 2. Navigate to last month on calendar, 3. Tap various days | Each day shows the correct logged outfit in the day detail |

---

### CL-005: Wear Count Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | CL-005 |
| **Feature Name** | Wear Count Tracking |
| **Priority** | P0 |
| **Category** | Analytics |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a budget-minded shopper, I want to see how many times I have worn each item, so that I can identify which pieces are workhorses and which are collecting dust.

**Secondary:**
> As a minimalist dresser, I want to quickly see my least-worn items, so that I can decide what to donate or sell.

**Tertiary:**
> As a fashion-conscious planner, I want to see my most-worn items, so that I can build outfits around my proven favorites.

#### 3.3 Detailed Description

Wear Count Tracking surfaces the accumulated wear data from the Outfit Calendar (CL-004) into actionable views. While CL-004 handles the act of logging, CL-005 is about visualizing and analyzing that data at the item level.

This feature adds a "Wear Stats" section to each item's detail screen showing the total times worn, last worn date, days since last worn, and a wear frequency trend. It also introduces sorted views in the catalog that allow users to browse items by most worn, least worn, and most recently worn.

The feature provides a "Most Worn" and "Least Worn" leaderboard view accessible from the analytics tab or a dedicated section on the hub dashboard. The top 10 most-worn items and bottom 10 least-worn items (with at least 1 wear) are highlighted. Items with 0 wears are surfaced in a separate "Never Worn" list.

Wear count data is the foundation for cost-per-wear analysis (CL-006) and donation suggestions (CL-007). Accurate tracking depends on consistent logging in CL-004.

#### 3.4 Prerequisites

**Feature Dependencies:**
- CL-001: Wardrobe Catalog - Items must exist to track wear counts
- CL-004 provides the logging mechanism, but CL-005 reads from the same ClothingItem.times_worn and WearLog/WearLogItem data

**External Dependencies:**
- None

**Assumed Capabilities:**
- ClothingItem.times_worn and last_worn_date fields are populated by CL-004
- WearLog records exist for historical wear queries

#### 3.5 User Interface Requirements

##### Component: Item Wear Stats (within Item Detail, CL-001)

**Layout:**
- A dedicated "Wear Stats" section on the Item Detail screen (CL-001)
- Displays the following metrics in a 2x2 card grid:
  - **Times Worn:** Large number (e.g., "23") with label "times worn"
  - **Last Worn:** Formatted date (e.g., "Mar 1, 2026") or "Never" if 0 wears, with label "last worn"
  - **Days Since Last Worn:** Integer (e.g., "5 days ago") or "N/A" if never worn, with label "since last wear"
  - **Wear Frequency:** A textual description (e.g., "About once a week", "About twice a month", "Rarely worn") based on the average interval between wears
- Below the cards, a "Wear History" expandable section that, when tapped, shows a chronological list of all dates this item was worn (most recent first), limited to the last 20 entries with a "Show All" link

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Never Worn | times_worn = 0 | Times Worn: 0, Last Worn: "Never", Days Since: "N/A", Frequency: "Never worn" |
| Low Wear | 1-5 total wears | Normal display with all metrics calculated |
| Regular Wear | 6+ total wears | Normal display; frequency text becomes meaningful |
| High Wear | 50+ total wears | Normal display; consider a "Workhorse" badge or indicator |

**Interactions:**
- Tap "Wear History" expander: Toggle the chronological wear list open/closed
- Tap "Show All" in wear history: Navigate to a full wear history screen (scrollable list of all dates)
- Tap "Log Wear" quick action button: Same as CL-004 log for today with this item pre-selected

##### Screen: Wear Leaderboard

**Layout:**
- Accessible from the analytics tab or a "Wear Stats" card on the module dashboard
- Three sections displayed vertically:
  1. **Most Worn** (top 10): Numbered list showing rank, item thumbnail, item name, and times_worn count. The top item has a crown/star icon.
  2. **Least Worn** (bottom 10, excluding 0 wears): Same format, ranked from fewest wears to most (among items with at least 1 wear).
  3. **Never Worn** (all items with 0 wears): Grid of item thumbnails with names. Count badge shows total (e.g., "12 items never worn").
- Each section is collapsible. "Most Worn" is expanded by default.

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Wear Data | All items have 0 wears | "Start logging outfits to see your wear stats here!" message |
| Partial Data | Some items worn, some not | All three sections populated |
| All Items Worn | Every item has 1+ wears | "Never Worn" section shows "All items have been worn at least once!" |

**Interactions:**
- Tap item row in any leaderboard: Navigate to that item's detail screen
- Tap section header: Collapse/expand the section
- Pull down: Refresh leaderboard data

#### 3.6 Data Requirements

This feature does not introduce new entities. It reads from:

- **ClothingItem.times_worn** (integer, maintained by CL-004)
- **ClothingItem.last_worn_date** (date, maintained by CL-004)
- **WearLog** and **WearLogItem** records (for historical date listings and frequency calculations)

##### Derived Data

| Metric | Formula | Description |
|--------|---------|-------------|
| days_since_last_worn | today - last_worn_date | Days elapsed since the item was last worn (null if never worn) |
| wear_frequency_text | Textual categorization based on average_interval | Human-readable frequency description |
| average_interval | (last_worn_date - first_worn_date) / (times_worn - 1) | Average days between wears (requires 2+ wears) |

**Example Derived Data:**

```
{
  "item_id": "f47ac10b",
  "times_worn": 23,
  "last_worn_date": "2026-03-01",
  "days_since_last_worn": 5,
  "average_interval": 7.2,
  "wear_frequency_text": "About once a week"
}
```

#### 3.7 Business Logic Rules

##### Wear Frequency Classification

**Purpose:** Convert raw wear count and interval data into a human-readable frequency label.

**Inputs:**
- times_worn: integer
- first_worn_date: date (earliest WearLog date for this item)
- last_worn_date: date
- today: date

**Logic:**

```
1. IF times_worn = 0, RETURN "Never worn"
2. IF times_worn = 1, RETURN "Worn once"
3. Calculate total_days = last_worn_date - first_worn_date (in days)
4. IF total_days = 0, RETURN "Worn [times_worn] times today"
5. Calculate average_interval = total_days / (times_worn - 1)
6. Classify based on average_interval:
   - average_interval <= 2: "Almost daily"
   - average_interval <= 4: "Several times a week"
   - average_interval <= 8: "About once a week"
   - average_interval <= 15: "About twice a month"
   - average_interval <= 35: "About once a month"
   - average_interval <= 90: "Every few months"
   - average_interval > 90: "Rarely worn"
7. RETURN the classification text
```

**Edge Cases:**
- Item worn twice on the same day: total_days could be 0 between first and last wear; handle by returning "Worn [N] times" without interval calculation when first_worn_date = last_worn_date
- Item worn only once: Return "Worn once" regardless of when
- Item worn 100 times in 10 days: Returns "Almost daily" correctly

##### Days Since Last Worn Calculation

**Purpose:** Calculate how many days have passed since the item was last worn.

**Inputs:**
- last_worn_date: date (nullable)
- today: date

**Logic:**

```
1. IF last_worn_date IS NULL, RETURN null (display "N/A")
2. Calculate days = today - last_worn_date
3. IF days = 0, RETURN "Today"
4. IF days = 1, RETURN "Yesterday"
5. IF days < 7, RETURN "[days] days ago"
6. IF days < 30, RETURN "[weeks] weeks ago" (rounded down)
7. IF days < 365, RETURN "[months] months ago" (rounded down)
8. RETURN "[years] years ago" (rounded down)
```

**Edge Cases:**
- last_worn_date is in the future (planned outfit that was confirmed early): Return "Today" or "In [N] days" depending on implementation
- last_worn_date is exactly 1 year ago: Returns "12 months ago" (not "1 years ago")

##### Leaderboard Ranking

**Purpose:** Rank items by wear count for the Most Worn and Least Worn leaderboards.

**Inputs:**
- all_items: list of ClothingItem records where status = "active"

**Logic:**

```
1. Filter to items with times_worn > 0 for Most Worn and Least Worn lists
2. Most Worn: Sort by times_worn DESC, then by last_worn_date DESC as tiebreaker. Take top 10.
3. Least Worn: Sort by times_worn ASC, then by created_at ASC as tiebreaker (oldest items with fewest wears first). Take bottom 10.
4. Never Worn: Filter to items with times_worn = 0. Sort by created_at ASC (oldest unworn items first).
5. RETURN { most_worn, least_worn, never_worn }
```

**Edge Cases:**
- Fewer than 10 items with wears: Show as many as exist (e.g., 3 items in "Most Worn" if only 3 have been worn)
- All items have the same wear count: Tiebreaker by last_worn_date, then by created_at
- Catalog has only 1 item: That item appears in both Most Worn and Least Worn (as rank 1 in each)

**Sort/Filter/Ranking Logic:**
- **Leaderboard sort:** See ranking logic above
- **Wear history sort:** Most recent date first (descending)
- **Never Worn sort:** Oldest items first (created_at ascending, highlighting items that have been in the wardrobe longest without being worn)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Wear data query fails | "Could not load wear stats. Pull down to refresh." inline message in the Wear Stats section | User pulls to refresh |
| Wear history query fails | "Could not load wear history." message in the expandable section | User taps to collapse and re-expand |
| Item has inconsistent data (times_worn > number of WearLogItem records) | Display the times_worn value as-is; the discrepancy is logged internally | System self-corrects on next full data reconciliation (e.g., app restart or manual refresh) |
| Leaderboard query is slow (2000+ items) | Show a subtle loading spinner; results appear within 3 seconds | Automatic |
| Division by zero in frequency calculation | Return "Worn once" or appropriate label for times_worn = 1 | Automatic |

**Validation Timing:**
- Wear stats are computed on Item Detail screen load
- Leaderboard is computed on screen load and cached for the session
- Days since last worn is computed in real time (relative to the current date)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** an item has been worn 23 times with the most recent wear on March 1,
   **When** the user opens the Item Detail screen on March 6,
   **Then** the Wear Stats section shows "23 times worn", "Mar 1, 2026", "5 days ago", and a frequency label based on the average interval.

2. **Given** the wardrobe has 50 items, 30 of which have been worn at least once,
   **When** the user opens the Wear Leaderboard screen,
   **Then** the "Most Worn" section shows the top 10 items ranked by times_worn descending, the "Least Worn" section shows the bottom 10, and "Never Worn" shows 20 items.

3. **Given** an item has been worn 14 times over 90 days (roughly once a week),
   **When** the wear frequency is calculated,
   **Then** the frequency text reads "About once a week".

4. **Given** an item was worn for the first time today,
   **When** the user views the item detail,
   **Then** the Wear Stats show "1 time worn", "Today", "Today", and "Worn once".

**Edge Cases:**

5. **Given** an item has never been worn (times_worn = 0),
   **When** the user views the item detail,
   **Then** the Wear Stats show "0 times worn", "Never", "N/A", and "Never worn".

6. **Given** all items in the wardrobe have been worn at least once,
   **When** the user opens the Wear Leaderboard,
   **Then** the "Never Worn" section shows "All items have been worn at least once!".

7. **Given** the wardrobe has only 3 items with wears,
   **When** the user opens the Wear Leaderboard,
   **Then** the "Most Worn" section shows 3 items (not 10), and "Least Worn" shows 3 items.

**Negative Tests:**

8. **Given** wear data fails to load due to a database error,
   **When** the user views the Item Detail screen,
   **Then** the Wear Stats section shows "Could not load wear stats. Pull down to refresh.",
   **And** no incorrect data is displayed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| classifies never worn | times_worn: 0 | "Never worn" |
| classifies worn once | times_worn: 1 | "Worn once" |
| classifies almost daily | interval: 1.5 days avg | "Almost daily" |
| classifies about once a week | interval: 7 days avg | "About once a week" |
| classifies about twice a month | interval: 14 days avg | "About twice a month" |
| classifies about once a month | interval: 30 days avg | "About once a month" |
| classifies every few months | interval: 60 days avg | "Every few months" |
| classifies rarely worn | interval: 120 days avg | "Rarely worn" |
| calculates days since last worn today | last_worn: today | "Today" |
| calculates days since last worn yesterday | last_worn: yesterday | "Yesterday" |
| calculates days since last worn 3 days | last_worn: 3 days ago | "3 days ago" |
| calculates weeks since last worn | last_worn: 14 days ago | "2 weeks ago" |
| calculates months since last worn | last_worn: 90 days ago | "3 months ago" |
| returns null for never worn days since | last_worn: null | null ("N/A") |
| ranks most worn correctly | items: [{worn:10}, {worn:5}, {worn:20}] | order: [20, 10, 5] |
| ranks least worn correctly | items: [{worn:10}, {worn:5}, {worn:20}] | order: [5, 10, 20] |
| handles tie in ranking | items: [{worn:10, last: Mar5}, {worn:10, last: Mar1}] | tiebreaker: Mar 5 first (more recent last_worn) |
| limits leaderboard to 10 | 25 worn items | most_worn: 10 items, least_worn: 10 items |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Log wear and verify stats update | 1. Check item detail (5 wears), 2. Log outfit with this item, 3. Reopen item detail | Times Worn shows 6, Last Worn shows today |
| Remove wear and verify stats revert | 1. Check item detail (6 wears), 2. Remove today's log, 3. Reopen detail | Times Worn shows 5, Last Worn shows previous date |
| Leaderboard reflects new wear | 1. View leaderboard, 2. Log wear for a low-ranked item 20 times, 3. Refresh leaderboard | Item moves up in Most Worn ranking |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User tracks wear over 2 weeks | 1. Add 10 items, 2. Log outfits daily for 14 days, 3. View leaderboard | Most Worn shows items worn most frequently, Never Worn shows any items not logged |
| User identifies underused items | 1. Add 20 items, 2. Log outfits using only 8 of them, 3. View Never Worn list | 12 items appear in Never Worn, giving user clear donation candidates |

---

### CL-006: Cost-Per-Wear Analysis

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | CL-006 |
| **Feature Name** | Cost-Per-Wear Analysis |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a budget-minded shopper, I want to see the cost-per-wear for each item, so that I can understand the true value of my clothing purchases.

**Secondary:**
> As a minimalist dresser, I want to identify my best and worst value items, so that I can make smarter purchasing decisions in the future.

**Tertiary:**
> As a fashion-conscious planner, I want to see which expensive items have a low cost-per-wear, so that I feel justified keeping them and can share the insight with skeptical partners.

#### 3.3 Detailed Description

Cost-Per-Wear Analysis calculates the effective cost of each clothing item based on how often it has been worn. The formula is straightforward: divide the purchase price by the number of times the item has been worn. A $100 jacket worn 50 times has a cost-per-wear of $2.00, making it a far better value than a $20 shirt worn once ($20.00 cost-per-wear).

This metric reframes clothing purchases from a one-time expense into a per-use value proposition. It helps budget-minded users justify quality purchases that get heavy use and identify impulse buys that sit unworn.

The feature adds cost-per-wear data to each item's detail screen, introduces a dedicated "Best Value" and "Worst Value" leaderboard, and provides a wardrobe-level summary showing average cost-per-wear across all items. Items without a recorded purchase price are excluded from cost calculations but flagged with a prompt to add a price.

No competitor in the wardrobe app space surfaces cost-per-wear data. This is a unique differentiator for MyCloset.

#### 3.4 Prerequisites

**Feature Dependencies:**
- CL-001: Wardrobe Catalog - Items must have purchase_price data
- CL-005: Wear Count Tracking - times_worn data must be available

**External Dependencies:**
- None

**Assumed Capabilities:**
- ClothingItem.purchase_price and ClothingItem.times_worn fields are populated
- Currency formatting follows the user's locale

#### 3.5 User Interface Requirements

##### Component: Cost-Per-Wear Card (within Item Detail)

**Layout:**
- Part of the "Wear Stats" section on the Item Detail screen (added alongside the metrics from CL-005)
- Displays a prominent cost-per-wear value formatted as currency (e.g., "$3.91")
- Below the value, a progress indicator showing how the cost-per-wear has trended over time (e.g., "Started at $89.90, now $3.91 after 23 wears")
- A color-coded indicator: green for excellent value (cost-per-wear < $5), yellow for moderate ($5-$20), red for poor value (> $20). Thresholds are configurable in settings.
- If purchase_price is not set: "Add a purchase price to see cost-per-wear" with a link to edit the item
- If times_worn is 0 but purchase_price exists: Display the full purchase price as the cost-per-wear with text "Wear it once to start tracking value!"

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Price | purchase_price is null | "Add a purchase price to see cost-per-wear" link |
| Never Worn With Price | purchase_price set, times_worn = 0 | Shows full price as cost-per-wear with encouragement to wear |
| Active Tracking | purchase_price set, times_worn > 0 | Cost-per-wear value with color indicator and trend line |

**Interactions:**
- Tap "Add a purchase price" link: Navigate to edit item screen, focused on price field
- Tap cost-per-wear card: Expand to show a simple line chart of cost-per-wear over time (each wear reduces it)

##### Screen: Value Leaderboard

**Layout:**
- Accessible from the analytics tab or a "Cost Analysis" card on the module dashboard
- Top section: Wardrobe-level summary cards:
  - Total Wardrobe Value: sum of all purchase prices for active items
  - Average Cost-Per-Wear: average of all items' cost-per-wear values (excluding items without prices)
  - Items Without Prices: count of items missing purchase_price, with a "Fix" link
- Two leaderboard sections:
  1. **Best Value** (top 10 lowest cost-per-wear): Ranked list showing item thumbnail, name, purchase_price, times_worn, and cost-per-wear. All items shown have at least 1 wear and a purchase price.
  2. **Worst Value** (top 10 highest cost-per-wear): Same format. Items with 0 wears and a price are included (their cost-per-wear is the full purchase price).
- Each section is collapsible.

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Price Data | No items have purchase prices | "Add purchase prices to your items to see value analysis" message |
| No Wear Data | Items have prices but 0 wears | Worst Value shows all priced items at full price; Best Value is empty |
| Full Data | Items have both prices and wears | Both leaderboards populated |

**Interactions:**
- Tap item row: Navigate to that item's detail screen
- Tap "Fix" link on "Items Without Prices" count: Navigate to a filtered catalog view showing only items without prices
- Tap section header: Collapse/expand

#### 3.6 Data Requirements

This feature does not introduce new entities. It reads from:

- **ClothingItem.purchase_price** (float, nullable)
- **ClothingItem.times_worn** (integer)
- **ClothingItem.status** (enum)

##### Derived Data

| Metric | Formula | Description |
|--------|---------|-------------|
| cost_per_wear | purchase_price / times_worn | Cost per use of the item |
| wardrobe_value | SUM(purchase_price) WHERE status NOT IN ('donated', 'sold', 'discarded') | Total current wardrobe value |
| average_cost_per_wear | AVG(cost_per_wear) for all items with price and times_worn > 0 | Wardrobe-wide average |
| items_without_prices | COUNT(*) WHERE purchase_price IS NULL AND status = 'active' | Count of items missing price data |

**Example Derived Data:**

```
{
  "item_id": "f47ac10b",
  "purchase_price": 89.90,
  "times_worn": 23,
  "cost_per_wear": 3.91,
  "value_rating": "excellent"
}
```

#### 3.7 Business Logic Rules

##### Cost-Per-Wear Calculation

**Purpose:** Calculate the effective per-use cost of a clothing item.

**Inputs:**
- purchase_price: float (nullable)
- times_worn: integer

**Logic:**

```
1. IF purchase_price IS NULL, RETURN null (display "No price set")
2. IF times_worn = 0, RETURN purchase_price (the full price is the current cost-per-wear)
3. cost_per_wear = purchase_price / times_worn
4. Round to 2 decimal places
5. RETURN cost_per_wear
```

**Formulas:**
- `cost_per_wear = purchase_price / times_worn`

**Edge Cases:**
- purchase_price is 0.00 (free item / gift): cost_per_wear = 0.00 regardless of times_worn. Display "$0.00" with label "Free item!"
- purchase_price is null: Exclude from calculations, prompt user to add price
- times_worn is 0 with price: cost_per_wear equals the full purchase_price
- Very small cost-per-wear (e.g., $0.01): Display as "$0.01", do not round to zero

##### Value Rating Classification

**Purpose:** Assign a color-coded value rating to each item's cost-per-wear.

**Inputs:**
- cost_per_wear: float
- thresholds: { excellent_max: float, moderate_max: float } (configurable, defaults: excellent_max = 5.00, moderate_max = 20.00)

**Logic:**

```
1. IF cost_per_wear IS NULL, RETURN "unknown"
2. IF cost_per_wear <= thresholds.excellent_max, RETURN "excellent" (green)
3. IF cost_per_wear <= thresholds.moderate_max, RETURN "moderate" (yellow)
4. RETURN "poor" (red)
```

**Edge Cases:**
- Cost-per-wear is exactly on a threshold boundary (e.g., $5.00): Classified as the better tier ("excellent")
- Free items ($0.00 cost-per-wear): Always "excellent"
- User adjusts thresholds to extreme values: Honor the user's settings regardless

##### Wardrobe Value Calculation

**Purpose:** Sum the total value of the user's active wardrobe.

**Inputs:**
- all_items: list of ClothingItem records

**Logic:**

```
1. Filter items WHERE status NOT IN ('donated', 'sold', 'discarded')
2. wardrobe_value = SUM(purchase_price) for filtered items WHERE purchase_price IS NOT NULL
3. RETURN wardrobe_value
```

**Formulas:**
- `wardrobe_value = SUM(purchase_price) WHERE status NOT IN ('donated', 'sold', 'discarded')`

**Edge Cases:**
- No items have prices: wardrobe_value = 0, display "$0" with note "(no prices recorded)"
- All items are donated/sold: wardrobe_value = 0
- Mix of priced and unpriced items: Sum only priced items, note how many items are excluded

##### Average Cost-Per-Wear Calculation

**Purpose:** Calculate the wardrobe-wide average cost-per-wear.

**Inputs:**
- all_items: list of ClothingItem records where purchase_price IS NOT NULL AND times_worn > 0

**Logic:**

```
1. Filter to items with both a purchase_price and times_worn > 0
2. Calculate cost_per_wear for each filtered item
3. average_cost_per_wear = SUM(all cost_per_wear values) / COUNT(filtered items)
4. Round to 2 decimal places
5. RETURN average_cost_per_wear
```

**Edge Cases:**
- No items qualify (all have null price or 0 wears): Return null, display "N/A"
- Only 1 item qualifies: Average equals that item's cost-per-wear
- Very large disparity (one item at $500 cost-per-wear, rest under $5): Average is heavily skewed; display is still the mathematical average

**Sort/Filter/Ranking Logic:**
- **Best Value sort:** cost_per_wear ascending (lowest first), tiebreaker: times_worn descending
- **Worst Value sort:** cost_per_wear descending (highest first), tiebreaker: purchase_price descending
- **Items without prices:** sorted by created_at ascending (oldest items first, encouraging users to fill in prices for items they have had longest)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Cost calculation returns NaN or Infinity | Display "N/A" instead of the broken value | Automatic (division guard) |
| Purchase price is negative (data corruption) | Display "$0.00" and log the anomaly internally | Automatic clamping to 0 |
| Currency formatting fails | Display the raw number with "$" prefix (e.g., "$3.91") | Automatic fallback |
| Value leaderboard query is slow | Show loading spinner; results within 3 seconds | Automatic |
| No items have prices or wears | "Add purchase prices and log outfits to see cost analysis" empty state | User adds prices and logs outfits |

**Validation Timing:**
- Cost-per-wear is calculated on Item Detail screen load (real-time from current data)
- Leaderboard is computed on screen load
- Wardrobe value is calculated on screen load and on any item add/edit/delete

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** an item has a purchase price of $89.90 and has been worn 23 times,
   **When** the user views the item detail,
   **Then** the cost-per-wear displays "$3.91" with a green "excellent" indicator.

2. **Given** the wardrobe has 10 items with prices and wears,
   **When** the user opens the Value Leaderboard,
   **Then** the Best Value section shows the 10 items sorted by cost-per-wear ascending, and the Worst Value section shows them sorted by cost-per-wear descending.

3. **Given** an item was purchased for $0.00 (a gift),
   **When** the user views the item detail,
   **Then** the cost-per-wear displays "$0.00" with a "Free item!" label and a green indicator.

4. **Given** 5 out of 20 items have no purchase price,
   **When** the user views the Value Leaderboard,
   **Then** the "Items Without Prices" badge shows "5" with a "Fix" link.

**Edge Cases:**

5. **Given** an item has a purchase price of $50.00 and 0 wears,
   **When** the user views the cost-per-wear,
   **Then** it displays "$50.00" (the full purchase price) with the text "Wear it once to start tracking value!".

6. **Given** no items in the wardrobe have a purchase price,
   **When** the user opens the Value Leaderboard,
   **Then** the screen shows "Add purchase prices to your items to see value analysis".

7. **Given** an item's cost-per-wear is exactly $5.00 (on the threshold boundary),
   **When** the value rating is calculated,
   **Then** it is classified as "excellent" (green), not "moderate".

**Negative Tests:**

8. **Given** the database returns corrupted data where times_worn is negative,
   **When** the cost-per-wear is calculated,
   **Then** the system displays "N/A" instead of a negative or infinite value,
   **And** no crash occurs.

9. **Given** an item has purchase_price = null,
   **When** the system calculates the wardrobe average cost-per-wear,
   **Then** the item is excluded from the average calculation,
   **And** the average reflects only items with valid prices and wears.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates cost-per-wear correctly | price: 89.90, worn: 23 | 3.91 |
| returns full price when worn 0 times | price: 50.00, worn: 0 | 50.00 |
| returns null when no price | price: null, worn: 10 | null |
| returns 0 for free item | price: 0.00, worn: 5 | 0.00 |
| rounds to 2 decimal places | price: 100.00, worn: 3 | 33.33 |
| handles very small cost-per-wear | price: 1.00, worn: 100 | 0.01 |
| classifies excellent value | cost_per_wear: 4.99 | "excellent" |
| classifies moderate value | cost_per_wear: 15.00 | "moderate" |
| classifies poor value | cost_per_wear: 25.00 | "poor" |
| classifies boundary as excellent | cost_per_wear: 5.00 | "excellent" |
| calculates wardrobe value excluding donated | items: [active $50, donated $30, active $20] | 70.00 |
| calculates average cost-per-wear | items: [{cpw: 2.00}, {cpw: 6.00}, {cpw: 4.00}] | 4.00 |
| excludes null prices from average | items: [{cpw: 2.00}, {price: null}] | 2.00 |
| returns null average when no qualifying items | items: [{price: null}, {worn: 0}] | null |
| counts items without prices | items: [{price: 50}, {price: null}, {price: null}] | 2 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Log wear and verify cost-per-wear updates | 1. Item: $100, 4 wears ($25 CPW), 2. Log another wear, 3. Reopen detail | CPW now shows $20.00 |
| Add price and verify cost-per-wear appears | 1. Item has no price (CPW shows "Add price"), 2. Edit item, add $60 price, 3. Reopen detail | CPW shows $60.00 (0 wears) or calculated value if worn |
| Value leaderboard updates after wear | 1. View leaderboard, 2. Log wears for worst-value item, 3. Refresh leaderboard | Item moves from Worst Value toward Best Value |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User evaluates wardrobe value | 1. Add 15 items with prices, 2. Log outfits for 2 weeks, 3. View Value Leaderboard | Best/Worst Value lists populated, wardrobe value shown, average CPW calculated |
| User identifies worst purchases | 1. Add 20 items, 2. Wear 15 of them regularly, 3. View Worst Value list | Unworn expensive items appear at top of Worst Value list at full purchase price |

---

### CL-007: Donation Suggestions

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | CL-007 |
| **Feature Name** | Donation Suggestions |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a minimalist dresser, I want the app to flag items I have not worn in over a year, so that I can decide whether to donate or sell them.

**Secondary:**
> As a budget-minded shopper, I want periodic nudges about unused items, so that I stay intentional about what I keep.

**Tertiary:**
> As a privacy-conscious user, I want donation suggestions computed entirely on-device from my local wear data, so that no third party knows what I own or plan to get rid of.

#### 3.3 Detailed Description

Donation Suggestions analyzes each item's wear history and surfaces items that are candidates for donation, sale, or removal from the wardrobe. The primary trigger is time-based: any item not worn for 365 days (configurable) is flagged as a donation candidate. Secondary signals include items with high cost-per-wear relative to their category average and items in "worn_out" condition.

The feature presents a dedicated "Declutter" screen that lists all donation candidates with actionable options: Donate, Sell, Keep (with a reminder to revisit later), or Dismiss (remove from suggestions permanently). When a user marks an item as "Donated" or "Sold", the item's status changes accordingly, and it is moved out of the active wardrobe but preserved in history for statistics.

The declutter screen also shows the potential value being freed (sum of purchase prices for suggested items) and the number of items suggested. Users can optionally set a recurring reminder (weekly, monthly, or quarterly) to revisit their donation candidates.

This feature is unique to MyCloset. No competitor surfaces donation intelligence, making it a compelling differentiator for users focused on intentional wardrobes.

#### 3.4 Prerequisites

**Feature Dependencies:**
- CL-001: Wardrobe Catalog - Items must exist with status and metadata
- CL-005: Wear Count Tracking - times_worn and last_worn_date data must be available

**External Dependencies:**
- Device notification system (for optional recurring reminders)

**Assumed Capabilities:**
- Date arithmetic is available for computing days-since-last-worn
- Device supports local notifications for reminders

#### 3.5 User Interface Requirements

##### Screen: Declutter Suggestions

**Layout:**
- Accessible from the analytics tab or a "Declutter" card on the module dashboard. When donation candidates exist, a badge shows the count on the card/tab.
- Top summary bar showing:
  - Total candidates count (e.g., "8 items to review")
  - Potential value (sum of purchase prices for all candidates, e.g., "$340 of unused clothing")
  - Last reviewed date (e.g., "Last reviewed: Feb 15, 2026")
- Below the summary, a vertically scrollable list of candidate items. Each row shows:
  - Item thumbnail (left)
  - Item name and category
  - Days since last worn (e.g., "Not worn in 400 days")
  - Purchase price (if available)
  - Cost-per-wear (if available)
  - Reason for suggestion (e.g., "Not worn in over a year", "Condition: Worn Out", "Never worn since added 8 months ago")
- Each row has swipe actions:
  - Swipe right: "Keep" (green) - dismisses from current suggestions with an optional "Remind me in [30/60/90] days" picker
  - Swipe left: "Donate" (blue) or "Sell" (orange) - marks item status accordingly
- At the bottom of the list: a "Review Complete" button that marks the current review as done and records the date
- A settings gear icon in the top bar opens donation threshold settings

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No items qualify as donation candidates | Celebratory illustration, heading "Your wardrobe is well-loved!", subtext "No items need decluttering right now. Check back later." |
| Candidates Exist | 1+ items qualify | List of candidate items with summary bar |
| All Reviewed | User has actioned all candidates in this session | "All caught up! Come back in [X days] for your next review." |
| Loading | Computing candidates | Skeleton list with loading indicator |

**Interactions:**
- Swipe right on item row: Mark as "Keep" with optional reminder picker
- Swipe left on item row: Show action sheet with "Donate" and "Sell" options
- Tap item row: Navigate to item detail
- Tap "Review Complete": Record review date, dismiss suggestions view
- Tap settings gear: Open threshold configuration
- Pull down: Refresh candidate list

**Transitions/Animations:**
- Swiped items animate out (slide + fade), 200ms
- When all items are swiped, the "All caught up" state fades in, 300ms
- Candidate count in summary bar animates down as items are actioned

##### Modal: Donation Threshold Settings

**Layout:**
- Bottom sheet with title "Declutter Settings"
- **Unworn Threshold:** Slider from 30 to 730 days, default 365. Label updates in real time (e.g., "Flag items not worn in 365 days")
- **Include Never Worn:** Toggle switch. When on, items that have never been worn and were added more than [threshold] days ago are included. Default: on.
- **Include Worn Out:** Toggle switch. When on, items with condition "worn_out" are always included regardless of wear recency. Default: on.
- **Recurring Reminder:** Picker with options: Off, Weekly, Monthly, Quarterly. Default: Off.
- "Save" button at the bottom

**Interactions:**
- Drag threshold slider: Label updates in real time, preview count updates
- Toggle switches: Immediate visual change
- Tap "Save": Persist settings, recalculate candidates, dismiss modal
- Swipe down: Dismiss without saving (with discard confirmation if changes exist)

#### 3.6 Data Requirements

##### Entity: DonationDismissal

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| clothing_item_id | string | Required, references ClothingItem.id, unique | None | The item that was dismissed from suggestions |
| remind_after_date | date | Optional, ISO 8601 | null | Date after which the item should reappear in suggestions (null = dismissed permanently) |
| created_at | datetime | Auto-set on creation | Current timestamp | When the dismissal was recorded |

##### Entity: DeclutterReview

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| review_date | date | Required, ISO 8601 | Today | Date the review was completed |
| items_reviewed | integer | Min: 0 | 0 | Number of items actioned in this review session |
| items_donated | integer | Min: 0 | 0 | Number marked as donated |
| items_sold | integer | Min: 0 | 0 | Number marked as sold |
| items_kept | integer | Min: 0 | 0 | Number kept (dismissed) |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |

**Relationships:**
- DonationDismissal belongs to ClothingItem (many-to-one)
- DeclutterReview is standalone (no foreign keys, acts as a log)

**Indexes:**
- DonationDismissal: clothing_item_id - Unique, fast lookup
- DonationDismissal: remind_after_date - Query for expired dismissals
- DeclutterReview: review_date - Sort reviews chronologically

**Validation Rules:**
- clothing_item_id in DonationDismissal must reference an existing ClothingItem
- remind_after_date, if set, must be a future date at the time of creation
- items_reviewed must equal items_donated + items_sold + items_kept

**Example Data:**

```
DonationDismissal:
{
  "id": "dd001-uuid",
  "clothing_item_id": "f47ac10b",
  "remind_after_date": "2026-06-06",
  "created_at": "2026-03-06T10:00:00Z"
}

DeclutterReview:
{
  "id": "dr001-uuid",
  "review_date": "2026-03-06",
  "items_reviewed": 8,
  "items_donated": 3,
  "items_sold": 1,
  "items_kept": 4,
  "created_at": "2026-03-06T10:15:00Z"
}
```

#### 3.7 Business Logic Rules

##### Donation Candidate Detection

**Purpose:** Identify items that are candidates for donation or removal based on wear patterns and condition.

**Inputs:**
- all_items: list of ClothingItem records where status = "active"
- threshold_days: integer (default: 365)
- include_never_worn: boolean (default: true)
- include_worn_out: boolean (default: true)
- today: date
- dismissed_items: list of DonationDismissal records

**Logic:**

```
1. Initialize candidates = empty list
2. Build a set of dismissed_item_ids from DonationDismissal records WHERE:
   a. remind_after_date IS NULL (permanently dismissed), OR
   b. remind_after_date > today (reminder not yet due)
3. For each item in all_items WHERE item.id NOT IN dismissed_item_ids:
   a. Calculate days_since_last_worn:
      - IF last_worn_date IS NOT NULL: days_since = today - last_worn_date
      - IF last_worn_date IS NULL: days_since = today - created_at (days since item was added)
   b. Determine if candidate:
      - IF days_since >= threshold_days AND last_worn_date IS NOT NULL:
        ADD to candidates with reason "Not worn in [days_since] days"
      - ELSE IF include_never_worn AND times_worn = 0 AND (today - created_at) >= threshold_days:
        ADD to candidates with reason "Never worn since added [days_since_added] days ago"
      - ELSE IF include_worn_out AND condition = "worn_out":
        ADD to candidates with reason "Condition: Worn Out"
4. Sort candidates by days_since_last_worn descending (most neglected first)
5. RETURN candidates
```

**Formulas:**
- `donation_suggestion_threshold = 365 days unworn` (configurable)
- Days since worn: `today - last_worn_date` (or `today - created_at` if never worn)

**Edge Cases:**
- Item was added yesterday and never worn: Not a candidate (added less than threshold_days ago)
- Item was worn 364 days ago: Not a candidate at default threshold (365). Becomes a candidate tomorrow.
- Item is dismissed with a reminder set for 90 days from now: Excluded from candidates for 90 days
- Item is dismissed permanently: Never appears in candidates again (unless dismissal is deleted)
- Item marked as "worn_out" but worn yesterday: Still a candidate if include_worn_out is true (condition-based, not time-based)

##### Mark as Donated

**Purpose:** Change an item's status to "donated" and remove it from the active wardrobe.

**Inputs:**
- item_id: string
- donation_date: date (default: today)

**Logic:**

```
1. Look up ClothingItem by item_id
2. SET status = "donated"
3. SET updated_at = now
4. Remove any DonationDismissal for this item (no longer needed)
5. The item remains in the database for historical statistics but no longer appears in the active catalog grid, outfits, or leaderboards
6. RETURN updated item
```

**Edge Cases:**
- Item is in active outfits: Item is removed from outfit references (same as deletion in CL-001), but outfits themselves are preserved
- Item has wear logs: Wear logs are preserved for historical data

##### Mark as Sold

**Purpose:** Change an item's status to "sold".

**Inputs:**
- item_id: string
- sale_price: float (optional)
- sale_date: date (default: today)

**Logic:**

```
1. Look up ClothingItem by item_id
2. SET status = "sold"
3. IF sale_price is provided, store it in a notes field or dedicated field
4. SET updated_at = now
5. Remove any DonationDismissal for this item
6. RETURN updated item
```

**Edge Cases:**
- Sale price exceeds purchase price: No special handling; the user made a profit
- Sale price is $0: Treated as given away for free (valid)

**Sort/Filter/Ranking Logic:**
- **Candidate sort:** Days since last worn descending (most neglected items first)
- **Tiebreaker:** Purchase price descending (most expensive neglected items first, emphasizing the financial incentive)
- **Review history sort:** review_date descending (most recent review first)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Candidate computation fails | "Could not load declutter suggestions. Pull down to refresh." | User pulls to refresh |
| Status change fails on donate/sell | "Could not update this item. Please try again." toast | User retries the swipe action |
| Notification permission denied (for reminders) | "Enable notifications in device settings to receive declutter reminders." with link to settings | User grants notification permission |
| Threshold slider set to extreme value (30 days) | Allow it; many items may appear as candidates. Show a note: "A 30-day threshold may surface items you recently wore." | User adjusts slider as needed |
| Dismissed item is deleted from catalog | DonationDismissal record becomes orphaned; cleaned up silently on next candidate query | Automatic |

**Validation Timing:**
- Candidates are computed on screen load
- Threshold changes take effect on next screen load (or immediately if "Save" triggers a recomputation)
- Donation/Sell status changes are immediate on swipe confirmation

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 3 items not worn in over 365 days,
   **When** the user opens the Declutter Suggestions screen,
   **Then** the summary shows "3 items to review" with the total potential value, and the list shows all 3 items sorted by most neglected first.

2. **Given** the user swipes left on an item and selects "Donate",
   **When** the action completes,
   **Then** the item's status changes to "donated", it is removed from the active catalog, the candidate count decrements by 1, and the item animates out of the suggestion list.

3. **Given** the user swipes right on an item and selects "Keep - Remind in 90 days",
   **When** the action completes,
   **Then** the item is removed from the current suggestion list, a DonationDismissal record is created with remind_after_date = today + 90 days, and the item reappears in suggestions after 90 days.

4. **Given** the user opens threshold settings and changes the unworn threshold from 365 to 180 days,
   **When** the user taps "Save" and returns to the suggestions screen,
   **Then** the candidate list includes items not worn for 180+ days (more items than before).

**Edge Cases:**

5. **Given** no items qualify as donation candidates,
   **When** the user opens the Declutter Suggestions screen,
   **Then** the celebratory empty state is shown: "Your wardrobe is well-loved!".

6. **Given** an item was added 400 days ago and never worn, and include_never_worn is enabled,
   **When** the candidate list is computed,
   **Then** the item appears with reason "Never worn since added 400 days ago".

7. **Given** an item was dismissed permanently 6 months ago,
   **When** the candidate list is computed,
   **Then** the item does not appear in the list regardless of its wear history.

**Negative Tests:**

8. **Given** an item was last worn 364 days ago (1 day short of the 365-day threshold),
   **When** the candidate list is computed,
   **Then** the item does NOT appear as a candidate,
   **And** it will appear tomorrow when the threshold is met.

9. **Given** the candidate computation fails due to a database error,
   **When** the user views the Declutter screen,
   **Then** an error message "Could not load declutter suggestions. Pull down to refresh." is shown,
   **And** no misleading or partial data is displayed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| flags item not worn in 365+ days | last_worn: 400 days ago, threshold: 365 | candidate with reason "Not worn in 400 days" |
| does not flag item worn 364 days ago | last_worn: 364 days ago, threshold: 365 | not a candidate |
| flags never-worn item added 365+ days ago | times_worn: 0, created_at: 400 days ago, include_never_worn: true | candidate with reason "Never worn since added 400 days ago" |
| does not flag never-worn item added recently | times_worn: 0, created_at: 30 days ago | not a candidate |
| flags worn-out item regardless of wear date | condition: "worn_out", last_worn: today, include_worn_out: true | candidate with reason "Condition: Worn Out" |
| excludes permanently dismissed items | item dismissed with remind_after_date: null | not in candidates |
| excludes recently dismissed items with future reminder | remind_after_date: 30 days from now | not in candidates |
| includes dismissed items past reminder date | remind_after_date: 10 days ago | included in candidates |
| sorts by most neglected first | items: [400 days, 500 days, 370 days] | order: [500, 400, 370] |
| calculates potential value correctly | candidates with prices [$50, null, $120, $30] | potential_value: $200 |
| marks item as donated | item status: "active" | status becomes "donated" |
| marks item as sold | item status: "active", sale_price: $25 | status becomes "sold" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Donate item and verify catalog updated | 1. View candidate, 2. Swipe left and donate, 3. Open catalog | Item no longer appears in active catalog |
| Dismiss with reminder and verify reappearance | 1. Dismiss item with 1-day reminder, 2. Check candidates next day | Item reappears in candidates |
| Change threshold and verify candidates update | 1. Set threshold to 180 days, 2. Save, 3. View candidates | More items appear (those not worn for 180+ days) |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Quarterly wardrobe declutter | 1. Add 50 items, 2. Wear 30 regularly for 1 year, 3. Open Declutter Suggestions | ~20 items appear as candidates, sorted by neglect, user can donate/sell/keep each |
| User donates 5 items | 1. View 10 candidates, 2. Donate 5, keep 3, sell 2, 3. Tap "Review Complete" | Catalog shows 5 fewer active items, review log records 10 items reviewed |

---

### CL-008: Clothing Statistics

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | CL-008 |
| **Feature Name** | Clothing Statistics |
| **Priority** | P1 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a fashion-conscious planner, I want a dashboard of wardrobe statistics, so that I can understand my style patterns and wardrobe composition at a glance.

**Secondary:**
> As a minimalist dresser, I want to track my wardrobe diversity score over time, so that I can measure whether I am wearing a wider range of my clothing.

**Tertiary:**
> As a budget-minded shopper, I want to see spending breakdowns by category and time period, so that I can set and track clothing budgets.

#### 3.3 Detailed Description

Clothing Statistics provides a comprehensive analytics dashboard showing insights derived from wardrobe data, wear logs, and cost information. The dashboard presents summary metrics, visual breakdowns, and trend data that help users understand their clothing habits.

Key metrics include: wardrobe size (total active items), wardrobe value, average cost-per-wear, wardrobe diversity score (percentage of items that have been worn in the selected time period), most active category, and seasonal distribution. Visual charts show category distribution (pie/donut chart), color distribution, monthly spending trend, and wear frequency distribution.

The statistics screen supports time-period selection (Last 30 Days, Last 90 Days, Last 6 Months, Last Year, All Time) to allow users to analyze trends and changes. Some metrics are always "all time" (wardrobe size, total value), while wear-related metrics respect the selected time period.

The diversity score is a unique metric that encourages users to wear a broader range of their wardrobe. It is calculated as: `diversity_score = (unique_items_worn / total_active_items) * 100`. A score of 100% means every item has been worn in the period; a score of 20% means only 1 in 5 items saw any use.

#### 3.4 Prerequisites

**Feature Dependencies:**
- CL-001: Wardrobe Catalog - Items and metadata
- CL-005: Wear Count Tracking - Wear data
- CL-006: Cost-Per-Wear Analysis (optional, enriches statistics with cost data)

**External Dependencies:**
- None

**Assumed Capabilities:**
- Chart/visualization rendering is available (bar, pie/donut, line)
- Date arithmetic and aggregation are available

#### 3.5 User Interface Requirements

##### Screen: Statistics Dashboard

**Layout:**
- The screen has a top navigation bar showing "Statistics" as the title
- Below the title, a time period selector with segmented chips: 30 Days, 90 Days, 6 Months, 1 Year, All Time. Default: All Time.
- The main content is a vertically scrollable dashboard with cards arranged in sections:

**Section 1: Overview Cards (horizontal scrollable row of metric cards)**
- Wardrobe Size: total active items count (always all-time)
- Wardrobe Value: sum of purchase prices for active items (always all-time)
- Avg Cost-Per-Wear: wardrobe-wide average (respects time period for wear data)
- Diversity Score: percentage of items worn in the selected period, with a visual progress ring
- Total Wears: count of wear log entries in the selected period
- Items Donated/Sold: count in the selected period

**Section 2: Category Distribution**
- A donut chart showing the proportion of items in each category (e.g., Tops 30%, Bottoms 20%, Shoes 15%, etc.)
- Legend with category names, counts, and percentages below the chart
- Tapping a segment highlights it and shows the count and percentage in the center of the donut

**Section 3: Color Distribution**
- A horizontal bar chart showing the top 10 colors in the wardrobe
- Each bar is colored with the corresponding color and shows the item count

**Section 4: Wear Frequency Distribution**
- A bar chart showing how many items fall into each wear frequency bucket (Never Worn, 1-5 times, 6-15 times, 16-30 times, 31-50 times, 50+ times)
- Bars are vertically oriented with item counts labeled on each bar

**Section 5: Monthly Activity (respects time period)**
- A line chart showing the number of wears logged per month over the selected time period
- X-axis: months, Y-axis: wear count
- If the period is "30 Days", show daily data points instead of monthly

**Section 6: Spending by Category**
- A horizontal bar chart showing total spending (sum of purchase_price) per category
- Only items with purchase_price are included
- Sorted by spending amount descending

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No items in wardrobe | "Add items to your wardrobe to see statistics" empty state |
| No Wear Data | Items exist but 0 wears | Overview shows item counts and values, wear-related charts show "Log outfits to see wear statistics" |
| Partial Data | Some items have prices, some worn | Charts render with available data, missing-data sections show explanatory text |
| Full Data | Items with prices and wear data | Full dashboard rendered |
| Loading | Computing statistics | Skeleton cards and chart placeholders |

**Interactions:**
- Tap time period chip: Recalculate all time-dependent metrics and charts for the selected period
- Tap donut chart segment: Highlight segment, show count in center
- Tap any chart data point: Show tooltip with exact values
- Tap diversity score card: Navigate to a detail view showing which items were worn vs. unworn in the period
- Pull down: Refresh all statistics

**Transitions/Animations:**
- Time period change: Charts animate from old data to new data with a smooth transition, 400ms
- Donut chart segments draw in clockwise on first load, 600ms
- Bar charts grow from zero height on first load, 400ms staggered
- Metric cards count up from 0 to the final value on first load, 500ms

#### 3.6 Data Requirements

This feature does not introduce new persistent entities. All statistics are computed from existing data:

- **ClothingItem** (catalog data, prices, categories, colors, status, times_worn, created_at)
- **WearLog** + **WearLogItem** (wear history with dates)
- **Tag** + **ItemTag** (for tag-based analysis)

##### Derived Data

| Metric | Formula | Description |
|--------|---------|-------------|
| wardrobe_size | COUNT(*) WHERE status = 'active' | Total active items |
| wardrobe_value | SUM(purchase_price) WHERE status NOT IN ('donated','sold','discarded') | Total current wardrobe value |
| diversity_score | (unique_items_worn / total_active_items) * 100 | Percentage of wardrobe actually worn in the period |
| total_wears_in_period | COUNT(WearLogItem) WHERE WearLog.date within period | Total wear events in the selected period |
| category_distribution | GROUP BY category, COUNT(*) | Item count per category |
| color_distribution | Parsed from colors field, COUNT per unique color | Item count per color |
| wear_frequency_buckets | GROUP items by times_worn ranges | Distribution of items across wear frequency buckets |
| monthly_activity | GROUP WearLog.date by month, COUNT(*) | Wears per month |
| spending_by_category | GROUP BY category, SUM(purchase_price) | Total spending per category |

**Example Derived Data:**

```
{
  "wardrobe_size": 87,
  "wardrobe_value": 4280.50,
  "diversity_score": 65.5,
  "total_wears_in_period": 142,
  "category_distribution": {
    "tops": 28,
    "bottoms": 15,
    "shoes": 12,
    "outerwear": 8,
    "accessories": 14,
    "other": 10
  },
  "top_colors": [
    {"color": "black", "count": 22},
    {"color": "white", "count": 18},
    {"color": "navy", "count": 14}
  ]
}
```

#### 3.7 Business Logic Rules

##### Diversity Score Calculation

**Purpose:** Measure what percentage of the wardrobe is actually being worn.

**Inputs:**
- total_active_items: integer - count of items where status = "active"
- period_start: date
- period_end: date (typically today)

**Logic:**

```
1. Query all unique clothing_item_id values from WearLogItem
   WHERE the associated WearLog.date is between period_start and period_end
   AND WearLog.is_planned = false
2. unique_items_worn = COUNT(distinct clothing_item_id)
3. IF total_active_items = 0, RETURN 0
4. diversity_score = (unique_items_worn / total_active_items) * 100
5. Round to 1 decimal place
6. Cap at 100.0 (in case of data inconsistency where worn items exceed total)
7. RETURN diversity_score
```

**Formulas:**
- `diversity_score = unique_items_worn / total_items * 100`

**Edge Cases:**
- No items in wardrobe: diversity_score = 0 (not division by zero)
- No wear data in the period: diversity_score = 0 (0 items worn / N items = 0%)
- All items worn in the period: diversity_score = 100.0
- An item was worn but later deleted: It is counted in unique_items_worn if WearLogItem still exists (historical accuracy)
- Period is "All Time": All WearLog records are included

##### Category Distribution Calculation

**Purpose:** Compute the breakdown of items by category.

**Inputs:**
- all_items: list of ClothingItem records where status = "active"

**Logic:**

```
1. Group all_items by category
2. For each category:
   a. count = number of items in the group
   b. percentage = (count / total_items) * 100, rounded to 1 decimal
3. Sort by count descending
4. RETURN list of { category, count, percentage }
```

**Edge Cases:**
- All items in one category: That category shows 100%
- Category has 0 items: Not included in results (no empty segments in donut chart)

##### Color Distribution Calculation

**Purpose:** Analyze the color composition of the wardrobe.

**Inputs:**
- all_items: list of ClothingItem records where status = "active"

**Logic:**

```
1. For each item, split the colors field by comma to get individual colors
2. Count occurrences of each unique color across all items
3. Sort by count descending
4. Take top 10 colors
5. RETURN list of { color, count }
```

**Edge Cases:**
- Items with multiple colors: Each color is counted independently (an item that is "navy,white" adds 1 to both "navy" and "white")
- Duplicate color values after trimming/lowercase normalization: Merge counts
- Fewer than 10 unique colors: Return all unique colors

##### Wear Frequency Buckets

**Purpose:** Group items by how many times they have been worn.

**Inputs:**
- all_items: list of ClothingItem records where status = "active"

**Logic:**

```
1. Define buckets: Never Worn (0), 1-5, 6-15, 16-30, 31-50, 50+
2. For each item, place into the appropriate bucket based on times_worn
3. Count items in each bucket
4. RETURN list of { bucket_label, count }
```

**Edge Cases:**
- All items never worn: Only the "Never Worn" bucket has items
- Single item with 100 wears: Falls into "50+" bucket

**Sort/Filter/Ranking Logic:**
- **Charts:** Sorted as specified per chart type (descending for distributions, chronological for trends)
- **Time period filtering:** Only wear-related metrics change with period; item counts and values are always all-time

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Statistics computation fails | "Could not load statistics. Pull down to refresh." inline message | User pulls to refresh |
| Single chart computation fails | That specific chart shows "Data unavailable" while other charts render normally | Individual chart retry on next refresh |
| Extremely large dataset (5000+ items) | Statistics compute within 5 seconds; loading indicator shown | Automatic |
| Time period change is slow | Previous data remains visible with a subtle loading overlay until new data is ready | Automatic |
| Division by zero in diversity score | Score displays 0% (total_active_items is 0) | Automatic guard |

**Validation Timing:**
- All statistics are computed on screen load
- Time period change triggers a full recomputation
- Statistics are not cached between screen visits (always reflect current data)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 87 active items with various categories, colors, and wear data,
   **When** the user opens the Statistics Dashboard with "All Time" selected,
   **Then** all overview cards display correct values, the donut chart shows category distribution, the color chart shows top 10 colors, and the wear frequency chart shows item distribution across buckets.

2. **Given** the user has worn 57 of 87 items in the last 90 days,
   **When** the user selects "90 Days" period,
   **Then** the diversity score shows 65.5% (57/87 * 100), the total wears card updates to reflect the period, and the monthly activity chart shows only the last 3 months.

3. **Given** the user has spending data across categories,
   **When** the spending by category chart is viewed,
   **Then** categories are sorted by total spending descending, showing exact dollar amounts per category.

4. **Given** the user taps a donut chart segment for "Tops (28)",
   **When** the segment is tapped,
   **Then** the segment highlights and the center of the donut displays "28 items - 32.2%".

**Edge Cases:**

5. **Given** the wardrobe is empty (0 items),
   **When** the user opens the Statistics Dashboard,
   **Then** the empty state message "Add items to your wardrobe to see statistics" is displayed.

6. **Given** items exist but no wear logs exist,
   **When** the user opens the Statistics Dashboard,
   **Then** overview cards show item count and wardrobe value, but wear-related sections show "Log outfits to see wear statistics".

7. **Given** the user selects "30 Days" as the period,
   **When** the monthly activity chart renders,
   **Then** it shows daily data points instead of monthly aggregation (since the period is only 30 days).

**Negative Tests:**

8. **Given** the statistics computation encounters a database error,
   **When** the screen loads,
   **Then** the error message "Could not load statistics. Pull down to refresh." is shown,
   **And** no partial or stale data is displayed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates diversity score correctly | 57 unique worn out of 87 total | 65.5 |
| diversity score is 0 when nothing worn | 0 worn, 87 total | 0.0 |
| diversity score is 100 when all worn | 87 worn, 87 total | 100.0 |
| diversity score is 0 when no items | 0 worn, 0 total | 0.0 (no division by zero) |
| caps diversity score at 100 | 90 worn, 87 total (data anomaly) | 100.0 |
| computes category distribution | 28 tops, 15 bottoms, 12 shoes out of 87 | tops: 32.2%, bottoms: 17.2%, shoes: 13.8% |
| handles single category | all 87 items are tops | tops: 100.0% |
| counts colors across multi-color items | ["navy,white", "navy", "black,white"] | navy: 2, white: 2, black: 1 |
| limits colors to top 10 | 15 unique colors | returns only top 10 by count |
| groups items into wear frequency buckets | times_worn: [0,0,3,7,20,55] | {never:2, 1-5:1, 6-15:1, 16-30:1, 50+:1} |
| computes spending by category | tops: [$30,$20], bottoms: [$50] | tops: $50, bottoms: $50, sorted by amount |
| filters wears by time period | wears on Jan 1, Feb 1, Mar 1; period: Feb 1 - Mar 6 | 2 wears in period |
| uses daily aggregation for 30-day period | period: last 30 days | 30 data points (daily) |
| uses monthly aggregation for 1-year period | period: last 12 months | 12 data points (monthly) |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Statistics update after wear log | 1. View stats (10 wears), 2. Log an outfit, 3. Refresh stats | Total wears increments, diversity score may change |
| Statistics update after item addition | 1. View stats (87 items), 2. Add new item, 3. Refresh stats | Wardrobe size shows 88, category distribution updates |
| Time period change updates charts | 1. View "All Time" stats, 2. Switch to "90 Days" | Wear-related metrics recalculate, item counts remain the same |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User reviews monthly statistics | 1. Use the app for 30 days, logging outfits daily, 2. Open Statistics with "30 Days" period | Daily activity chart shows wear pattern, diversity score reflects usage, all charts populated |
| User identifies wardrobe color gaps | 1. Add 50 items, 2. View color distribution chart | Chart shows dominant colors and absence of certain colors, informing future purchase decisions |

---

### CL-009: Laundry Tracking

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | CL-009 |
| **Feature Name** | Laundry Tracking |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a busy professional, I want to mark items as dirty after wearing them and clean after washing, so that I know which items are available for outfit planning.

**Secondary:**
> As a fashion-conscious planner, I want to see how many wears an item gets between washes, so that I can plan laundry days around my outfit calendar.

**Tertiary:**
> As a minimalist dresser, I want to batch-mark items as clean on laundry day, so that the process is fast and not tedious.

#### 3.3 Detailed Description

Laundry Tracking adds a cleanliness state to each clothing item, allowing users to know which items are clean and ready to wear versus dirty and awaiting laundry. This seemingly simple feature has significant practical value: it prevents the outfit builder from suggesting items that are in the laundry, it helps users plan when they need to do laundry (running low on clean items in a category), and it enables tracking of wear-between-wash cycles.

Each item has a laundry_status of "clean" or "dirty". Logging a wear event (CL-004) automatically sets the item to "dirty" (configurable; some items like jackets are not washed after every wear). Users can manually toggle status on individual items or use a "Laundry Day" batch flow to mark multiple items as clean at once.

The Laundry Day flow shows all currently dirty items grouped by wash type (machine wash, hand wash, dry clean, delicate). Users can check off items as they put them in the wash and mark them clean when done. This encourages users to add care instructions to their items (a secondary benefit of tracking).

#### 3.4 Prerequisites

**Feature Dependencies:**
- CL-001: Wardrobe Catalog - Items must exist with laundry-related fields

**External Dependencies:**
- None

**Assumed Capabilities:**
- ClothingItem record supports laundry_status and care_instructions fields

#### 3.5 User Interface Requirements

##### Component: Laundry Status Indicator (within Item Detail and Catalog Grid)

**Layout:**
- On the Item Detail screen: a toggle button showing "Clean" (with a sparkle icon) or "Dirty" (with a hamper icon) that the user can tap to switch
- On the Catalog Grid: a small status dot on each item card (green for clean, orange for dirty)
- In the filter bottom sheet: a new filter option "Laundry Status" with chips for Clean, Dirty, and All

**Interactions:**
- Tap clean/dirty toggle on Item Detail: Switch status immediately with a brief animation
- Filter by laundry status in catalog: Show only clean or only dirty items

##### Screen: Laundry Day

**Layout:**
- Accessible from a "Laundry Day" button on the module dashboard or via the floating action menu
- Title: "Laundry Day" with the total count of dirty items (e.g., "14 dirty items")
- Items grouped by care_instruction:
  - Machine Wash (default group for items without care instructions)
  - Hand Wash
  - Dry Clean Only
  - Delicate
- Each group is collapsible with a count badge (e.g., "Machine Wash (8)")
- Each item row shows: checkbox, item thumbnail, item name, times worn since last wash
- At the bottom: "Mark All Clean" button (marks all checked items as clean) and "Mark Group Clean" buttons per group

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Dirty Items | All items are clean | "Everything is clean! No laundry needed." with a celebratory illustration |
| Dirty Items Exist | 1+ items are dirty | Grouped list of dirty items with checkboxes |
| Partial Selection | Some items checked | "Mark Selected Clean" button enabled with count (e.g., "Mark 5 Clean") |
| All Selected | All items checked | "Mark All Clean" button highlighted |

**Interactions:**
- Tap checkbox: Toggle item selection
- Tap group header: Collapse/expand group, or long press to select all in group
- Tap "Mark Selected Clean" or "Mark All Clean": Change laundry_status to "clean" for selected items, create LaundryEvent records, animate items out of the list
- Tap item row (not checkbox): Navigate to item detail

**Transitions/Animations:**
- Items marked clean animate out with a sparkle effect and fade, 300ms
- Group count badges update in real time as items are marked clean
- When all items are cleaned, the celebratory empty state fades in, 400ms

#### 3.6 Data Requirements

##### New fields on ClothingItem

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| laundry_status | enum | One of: clean, dirty | "clean" | Current cleanliness state |
| care_instructions | enum | Optional, one of: machine_wash, hand_wash, dry_clean, delicate | "machine_wash" | How this item should be cleaned |
| auto_dirty_on_wear | boolean | - | true | Whether logging a wear automatically sets status to dirty |
| wears_since_wash | integer | Min: 0 | 0 | Number of wears since the item was last marked clean |

##### Entity: LaundryEvent

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| clothing_item_id | string | Required, references ClothingItem.id | None | The item that was washed |
| event_type | enum | One of: washed, dry_cleaned | "washed" | Type of cleaning event |
| event_date | date | Required, ISO 8601 | Today | Date the cleaning happened |
| wears_before_wash | integer | Min: 0 | 0 | Number of wears since the previous wash (snapshot at wash time) |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |

**Relationships:**
- LaundryEvent belongs to ClothingItem (many-to-one)
- ClothingItem has many LaundryEvent (one-to-many)

**Indexes:**
- LaundryEvent: clothing_item_id - All wash events for an item
- LaundryEvent: event_date - Sort by wash date
- ClothingItem: laundry_status - Filter clean/dirty items

**Validation Rules:**
- laundry_status must be "clean" or "dirty"
- care_instructions must be one of the defined enum values
- wears_since_wash must be >= 0
- wears_before_wash must be >= 0

**Example Data:**

```
ClothingItem (laundry fields):
{
  "laundry_status": "dirty",
  "care_instructions": "machine_wash",
  "auto_dirty_on_wear": true,
  "wears_since_wash": 3
}

LaundryEvent:
{
  "id": "le001-uuid",
  "clothing_item_id": "f47ac10b",
  "event_type": "washed",
  "event_date": "2026-03-05",
  "wears_before_wash": 3,
  "created_at": "2026-03-05T19:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Auto-Dirty on Wear

**Purpose:** Automatically set an item's laundry status to "dirty" when it is logged as worn.

**Inputs:**
- clothing_item_id: string
- auto_dirty_on_wear: boolean (from the item's settings)

**Logic:**

```
1. When a WearLog is created for a clothing item:
2. IF the item's auto_dirty_on_wear = true:
   a. SET laundry_status = "dirty"
   b. INCREMENT wears_since_wash by 1
3. IF auto_dirty_on_wear = false:
   a. INCREMENT wears_since_wash by 1 (track wears but do not change status)
4. RETURN updated item
```

**Edge Cases:**
- Item is already dirty: Status remains dirty, wears_since_wash still increments
- Outerwear with auto_dirty_on_wear = false: Status stays clean after wearing, but wears_since_wash tracks usage for eventual cleaning

##### Mark as Clean (Single or Batch)

**Purpose:** Mark one or more items as clean and record the cleaning event.

**Inputs:**
- item_ids: list of string - items to mark as clean
- event_type: enum - "washed" or "dry_cleaned"
- event_date: date (default: today)

**Logic:**

```
1. For each item_id in item_ids:
   a. Look up ClothingItem
   b. Create a LaundryEvent with:
      - clothing_item_id = item_id
      - event_type = event_type
      - event_date = event_date
      - wears_before_wash = item's current wears_since_wash
   c. SET item.laundry_status = "clean"
   d. SET item.wears_since_wash = 0
2. RETURN count of items updated
```

**Edge Cases:**
- Item is already clean: Still creates a LaundryEvent (user may be re-washing), resets wears_since_wash to 0
- Batch of 50 items: All processed in a single transaction for atomicity
- Item was never worn (wears_since_wash = 0): LaundryEvent records wears_before_wash = 0 (the user washed an unworn item, which is valid)

##### Average Wears Between Washes

**Purpose:** Calculate how many times an item is typically worn between washes.

**Inputs:**
- item_id: string
- laundry_events: list of LaundryEvent for this item

**Logic:**

```
1. IF laundry_events is empty, RETURN null ("No wash data")
2. Collect all wears_before_wash values from laundry_events
3. average_wears = SUM(wears_before_wash) / COUNT(laundry_events)
4. Round to 1 decimal place
5. RETURN average_wears
```

**Edge Cases:**
- Only 1 wash event: Average is that event's wears_before_wash
- All events have wears_before_wash = 0: Average is 0 (item is washed without being worn)

**Sort/Filter/Ranking Logic:**
- **Laundry Day sort:** Grouped by care_instructions, within each group sorted by wears_since_wash descending (dirtiest first)
- **Filter:** Catalog grid can filter by laundry_status (Clean / Dirty / All)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Batch clean operation partially fails | "Marked 8 of 10 items clean. 2 could not be updated." | User retries for the 2 failed items |
| Database write fails on status toggle | "Could not update laundry status. Please try again." toast | User retries the toggle |
| LaundryEvent creation fails | Status change rolls back; item remains in previous state | User retries |

**Validation Timing:**
- Status toggle is immediate on tap (optimistic UI with rollback on failure)
- Batch operations validate all items exist before starting the batch
- Auto-dirty triggers immediately on wear log creation

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user logs wearing an item that has auto_dirty_on_wear enabled,
   **When** the wear log is created,
   **Then** the item's laundry_status changes to "dirty", wears_since_wash increments by 1, and the dirty indicator appears on the catalog grid.

2. **Given** the user has 14 dirty items,
   **When** the user opens the Laundry Day screen,
   **Then** all 14 items are displayed grouped by care instructions, with counts per group.

3. **Given** the user selects 8 items on the Laundry Day screen and taps "Mark Selected Clean",
   **When** the operation completes,
   **Then** 8 LaundryEvent records are created, the 8 items' laundry_status is set to "clean", wears_since_wash resets to 0, and the items animate out of the dirty list.

4. **Given** all dirty items have been cleaned,
   **When** the Laundry Day screen refreshes,
   **Then** the celebratory "Everything is clean!" empty state is displayed.

**Edge Cases:**

5. **Given** a jacket has auto_dirty_on_wear disabled,
   **When** the user logs wearing it,
   **Then** the laundry_status remains "clean", but wears_since_wash increments by 1.

6. **Given** an item has been washed 5 times with wears_before_wash values of [3, 4, 2, 5, 3],
   **When** the average wears between washes is calculated,
   **Then** the result is 3.4.

**Negative Tests:**

7. **Given** a batch clean operation encounters a database error on 2 of 10 items,
   **When** the error is reported,
   **Then** the user sees "Marked 8 of 10 items clean. 2 could not be updated.",
   **And** the 8 successful items are clean and the 2 failed items remain dirty.

8. **Given** the user toggles an item to "clean" but the database write fails,
   **When** the failure is detected,
   **Then** the toggle reverts to "dirty" and a "Could not update laundry status" toast appears,
   **And** no LaundryEvent is created.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| sets item to dirty on wear (auto_dirty on) | auto_dirty: true, wear logged | laundry_status: "dirty", wears_since_wash: +1 |
| does not set dirty on wear (auto_dirty off) | auto_dirty: false, wear logged | laundry_status: unchanged, wears_since_wash: +1 |
| marks item clean and resets counter | laundry_status: dirty, wears_since: 5 | laundry_status: clean, wears_since: 0 |
| creates LaundryEvent on clean | wears_since: 3, mark clean | LaundryEvent.wears_before_wash: 3 |
| handles already-clean item being washed | laundry_status: clean, mark clean | laundry_status: clean, LaundryEvent created, wears_since: 0 |
| calculates average wears between washes | wears_before: [3, 4, 2, 5, 3] | average: 3.4 |
| returns null for no wash events | no LaundryEvent records | null |
| groups dirty items by care instructions | items: [2 machine, 1 hand, 1 dry_clean] | groups: {machine: 2, hand: 1, dry_clean: 1} |
| sorts within group by wears desc | machine items: [wears: 5, wears: 2, wears: 8] | order: [8, 5, 2] |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Wear item and verify dirty status | 1. Item is clean, 2. Log wear, 3. Check item | Status is dirty, catalog shows dirty indicator |
| Laundry day batch clean | 1. 10 items dirty, 2. Open Laundry Day, 3. Select 5, 4. Mark clean | 5 items clean with events, 5 remain dirty |
| Filter catalog by laundry status | 1. Mix of clean and dirty items, 2. Filter to "Clean" only | Only clean items shown |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Full laundry cycle | 1. Mark 3 items clean (start clean), 2. Wear all 3 over the week, 3. Open Laundry Day, 4. Mark all clean | Items cycle through clean -> dirty -> clean, LaundryEvents record wash history |
| User identifies over-washed items | 1. Track laundry for 2 months, 2. View item detail wash history | Average wears-between-washes shows per item, identifying items washed too frequently |

---

### CL-010: Packing List Generator

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | CL-010 |
| **Feature Name** | Packing List Generator |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a busy professional, I want to generate a packing list for an upcoming trip from my wardrobe, so that I do not forget essential items or overpack.

**Secondary:**
> As a fashion-conscious planner, I want to plan outfits for each day of a trip and have the app generate a consolidated packing list, so that every outfit is accounted for without duplicates.

**Tertiary:**
> As a minimalist dresser, I want to see the minimum number of items I need for a trip, so that I can travel light and still be prepared for each occasion.

#### 3.3 Detailed Description

The Packing List Generator helps users create trip-specific packing lists drawn from their wardrobe catalog. Users specify trip parameters (destination, duration, occasion types, and season) and the generator produces a suggested packing list organized by category. Users can manually add or remove items from the suggestion, and the final list serves as a checklist during packing.

The generator can work in two modes. In "Quick List" mode, the system suggests a number of items per category based on trip duration and occasion (e.g., a 5-day business trip suggests 5 tops, 3 bottoms, 2 pairs of shoes, 5 sets of underwear). In "Outfit Planning" mode, the user plans specific outfits for each day of the trip, and the system consolidates all unique items across those outfits into a single packing list (avoiding duplicates for items reused across outfits).

Packing lists are saved and can be revisited for reference or reused for future similar trips. Each item in the list has a checkbox for tracking packing progress.

#### 3.4 Prerequisites

**Feature Dependencies:**
- CL-001: Wardrobe Catalog - Items must exist to populate packing lists
- CL-002: Category and Tag Organization - Category-based item suggestions

**External Dependencies:**
- None (weather integration is optional and covered by CL-011)

**Assumed Capabilities:**
- Calendar or date range picker is available
- Checklist UI component is available

#### 3.5 User Interface Requirements

##### Screen: Packing Lists

**Layout:**
- List of saved packing lists, sorted by trip start date (upcoming first)
- Each list card shows: trip name, date range, occasion tags, item count, and packing progress (e.g., "12/18 packed")
- A "+" button to create a new packing list
- Completed trips (past end date) are shown in a "Past Trips" section below active lists

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No packing lists created | "Plan your first trip" prompt with a "Create Packing List" button |
| Active Lists | 1+ future/current trip lists exist | List of packing list cards |
| Mixed | Active and past lists exist | Active lists at top, "Past Trips" collapsible section below |

**Interactions:**
- Tap list card: Open packing list detail
- Long press list card: Context menu (Edit Trip, Duplicate, Delete)
- Tap "+": Open new packing list creation flow

##### Modal: Create Packing List

**Layout:**
- Full-screen modal with "New Packing List" title
- Form fields:
  - Trip Name (text input, required, placeholder: "e.g., NYC Business Trip")
  - Start Date (date picker, required)
  - End Date (date picker, required, must be >= start date)
  - Occasion Types (multi-select chips: Casual, Work, Formal, Active, Lounge, Date Night, Outdoor)
  - Season (auto-detected from dates but editable: Spring, Summer, Fall, Winter)
  - Mode selector: "Quick List" or "Outfit Planning"
- "Generate List" button at the bottom

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Fresh | Modal just opened | Empty form fields |
| Filled | All required fields completed | "Generate List" button enabled |
| Generating | "Generate List" tapped | Loading indicator, "Building your packing list..." |

**Interactions:**
- Fill in trip details and tap "Generate List"
- For "Outfit Planning" mode: after generation, navigate to a day-by-day outfit selection flow

##### Screen: Packing List Detail

**Layout:**
- Title shows the trip name and date range
- Summary bar: total items count, packed count, progress percentage bar
- Items grouped by category (Tops, Bottoms, Shoes, etc.)
- Each item row shows: checkbox (packed/unpacked), item thumbnail, item name, quantity (default 1)
- Within each category group: a "+ Add Item" link to add another item from the catalog
- Below the wardrobe items: a "Custom Items" section for non-wardrobe items (toiletries, electronics, documents) with a text input to add custom items
- "Share List" button to export the list as plain text
- "Mark All Packed" / "Unpack All" button

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Unpacked | 0 items checked | Full list with empty checkboxes, progress bar at 0% |
| Partially Packed | Some items checked | Checked items show checkmark, progress bar reflects percentage |
| Fully Packed | All items checked | All checkboxes checked, progress bar at 100%, celebratory banner "All packed! Have a great trip!" |

**Interactions:**
- Tap checkbox: Toggle packed status
- Tap "+ Add Item": Open catalog item picker filtered by the relevant category
- Swipe left on item row: Remove from packing list
- Tap "Share List": Generate plain text and open the device share sheet
- Tap category header: Collapse/expand category section
- Drag item rows: Reorder within a category

**Transitions/Animations:**
- Checkbox check: fill animation with haptic feedback, 150ms
- Progress bar: smooth fill animation, 300ms
- "All packed!" banner: slides down from top, 300ms

#### 3.6 Data Requirements

##### Entity: PackingList

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| name | string | Required, max 200 chars, trimmed | None | Trip name |
| start_date | date | Required, ISO 8601 | None | Trip start date |
| end_date | date | Required, ISO 8601, >= start_date | None | Trip end date |
| occasions | string | Optional, comma-separated | null | Occasion types for the trip |
| season | enum | One of: spring, summer, fall, winter | Auto-detected | Season of the trip |
| mode | enum | One of: quick_list, outfit_planning | "quick_list" | How the list was generated |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

##### Entity: PackingListItem

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| packing_list_id | string | Required, references PackingList.id | None | The packing list this item belongs to |
| clothing_item_id | string | Optional, references ClothingItem.id | null | Wardrobe item (null for custom items) |
| custom_name | string | Optional, max 200 chars | null | Name for non-wardrobe items |
| category_group | string | Required, max 50 chars | None | Display group (e.g., "Tops", "Toiletries") |
| quantity | integer | Min: 1, Max: 20 | 1 | Number of this item to pack |
| is_packed | boolean | - | false | Whether the item has been packed |
| sort_order | integer | Min: 0 | Auto | Display order within category group |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |

**Relationships:**
- PackingList has many PackingListItem (one-to-many)
- PackingListItem optionally belongs to ClothingItem (nullable)

**Indexes:**
- PackingListItem: packing_list_id - All items for a list
- PackingList: start_date - Sort by trip date
- PackingListItem: (packing_list_id, clothing_item_id) - Prevent duplicate wardrobe items in a list

**Validation Rules:**
- end_date must be >= start_date
- Trip duration (end_date - start_date) must be between 1 and 90 days
- Either clothing_item_id or custom_name must be provided (not both null)
- quantity must be between 1 and 20

**Example Data:**

```
PackingList:
{
  "id": "pl001-uuid",
  "name": "NYC Business Trip",
  "start_date": "2026-04-10",
  "end_date": "2026-04-14",
  "occasions": "work,formal,casual",
  "season": "spring",
  "mode": "quick_list",
  "created_at": "2026-03-20T10:00:00Z",
  "updated_at": "2026-03-20T10:05:00Z"
}

PackingListItem:
{
  "id": "pli001-uuid",
  "packing_list_id": "pl001-uuid",
  "clothing_item_id": "f47ac10b",
  "custom_name": null,
  "category_group": "Outerwear",
  "quantity": 1,
  "is_packed": false,
  "sort_order": 0,
  "created_at": "2026-03-20T10:05:00Z"
}
```

#### 3.7 Business Logic Rules

##### Quick List Generation

**Purpose:** Automatically suggest items to pack based on trip parameters.

**Inputs:**
- duration_days: integer (end_date - start_date + 1)
- occasions: list of string
- season: enum
- wardrobe_items: list of ClothingItem where status = "active"

**Logic:**

```
1. Calculate suggested quantities per category based on duration:
   - Tops: MIN(duration_days, 7)
   - Bottoms: CEIL(duration_days / 2), MAX 5
   - Underwear: duration_days + 1 (one extra)
   - Socks: duration_days + 1 (if applicable)
   - Sleepwear: MIN(CEIL(duration_days / 3), 3)
   - Shoes: 2-3 (based on occasion variety)
   - Outerwear: 1-2 (based on season)
   - Accessories: 2-5 (based on occasions)
   - Activewear: 1-2 per "active" occasion day
2. For each category with a suggested quantity:
   a. Filter wardrobe_items by category AND season AND occasion match
   b. Sort by times_worn DESC (prefer user's favorites)
   c. Filter to items with laundry_status = "clean" (if CL-009 is enabled)
   d. Take the top N items matching the suggested quantity
   e. IF not enough items exist in the category, note the shortage
3. Compile all selected items into a PackingList with PackingListItem records
4. Add standard custom items: "Toiletries", "Chargers", "Travel Documents"
5. RETURN the generated packing list
```

**Edge Cases:**
- User has fewer items than suggested in a category: Include all available items, show a note "You may want [N] more [category] items for this trip"
- Trip spans two seasons: Include items for both seasons
- All items in a category are dirty: Include them anyway but note "These items need washing before the trip"
- 1-day trip: Minimal list (1 outfit + essentials)
- 90-day trip: Cap suggestions to prevent excessively large lists (weekly rotation approach)

##### Outfit Planning Mode Consolidation

**Purpose:** Consolidate per-day outfit selections into a unified packing list without duplicates.

**Inputs:**
- day_outfits: map of date to list of clothing_item_ids (one outfit per day)

**Logic:**

```
1. Collect all unique clothing_item_ids across all day_outfits
2. For each unique item:
   a. Count how many days it appears in
   b. Create a PackingListItem with quantity = 1 (the item is packed once, worn multiple times)
3. Group items by category
4. RETURN consolidated packing list
```

**Edge Cases:**
- Same item used on 3 different days: Appears once in the packing list with a note "Planned for 3 days"
- Day without an outfit planned: Skipped; no items added for that day

##### Season Auto-Detection

**Purpose:** Determine the trip season from the start date.

**Inputs:**
- start_date: date

**Logic:**

```
1. Extract the month from start_date
2. Map to season:
   - March, April, May: spring
   - June, July, August: summer
   - September, October, November: fall
   - December, January, February: winter
3. RETURN season
```

**Formulas:**
- `seasonal_rotation: spring = Mar-May, summer = Jun-Aug, fall = Sep-Nov, winter = Dec-Feb`

**Edge Cases:**
- Trip spans season boundary (e.g., late August to early September): Default to the start date's season, but allow user to override or select both

**Sort/Filter/Ranking Logic:**
- **Packing list sort:** Active lists first (sorted by start_date ascending), then past lists (sorted by start_date descending)
- **Items within list:** Grouped by category, sorted by sort_order within each group
- **Item suggestions:** Most-worn items first (favorites prioritized)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Generation fails | "Could not generate packing list. Please try again." | User retries |
| Insufficient wardrobe items for suggestion | List is generated with available items; shortages noted per category | User can manually add items or accept a lighter list |
| Database write fails on pack/unpack | "Could not update packing status." toast | User retries the checkbox tap |
| Share fails | "Could not share the list." toast | User retries or manually copies the text |
| End date set before start date | Inline validation: "End date must be on or after start date" | User corrects the date |
| Trip duration exceeds 90 days | Inline validation: "Maximum trip duration is 90 days" | User adjusts dates |

**Validation Timing:**
- Date validation on selection (start_date vs. end_date)
- Required fields validated on "Generate List" tap
- Pack/unpack toggles are immediate (optimistic UI)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has a wardrobe with items across all categories,
   **When** the user creates a new packing list for a 5-day business trip in spring and taps "Generate List" in Quick List mode,
   **Then** the system generates a packing list with approximately 5 tops, 3 bottoms, 6 underwear, 2 pairs of shoes, and 1 outerwear item, all filtered to spring-appropriate items with work/formal occasion tags.

2. **Given** a generated packing list with 18 items,
   **When** the user checks off items as they pack them,
   **Then** the progress bar updates in real time, and when all 18 are checked, the "All packed!" banner appears.

3. **Given** the user plans outfits for each of 5 trip days using Outfit Planning mode,
   **When** the consolidated packing list is generated,
   **Then** duplicate items across days appear only once in the list, and the total item count is less than or equal to the sum of items across all daily outfits.

4. **Given** a completed packing list,
   **When** the user taps "Share List",
   **Then** a plain-text version of the list is generated (grouped by category, with packed checkmarks) and the device share sheet opens.

**Edge Cases:**

5. **Given** the user has only 2 tops but the trip suggests 5,
   **When** the Quick List is generated,
   **Then** the 2 available tops are included, and a note reads "You may want 3 more tops for this trip."

6. **Given** a trip spans from August 28 to September 3 (summer to fall),
   **When** the season is auto-detected,
   **Then** "summer" is the default season (based on start date), but the user can override to include fall items.

**Negative Tests:**

7. **Given** the user sets the end date before the start date,
   **When** the date is selected,
   **Then** inline validation shows "End date must be on or after start date",
   **And** the "Generate List" button is disabled.

8. **Given** the user sets a trip duration of 91 days,
   **When** the duration is calculated,
   **Then** inline validation shows "Maximum trip duration is 90 days",
   **And** the "Generate List" button is disabled.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| suggests correct top count for 5-day trip | duration: 5 | tops_suggested: 5 |
| suggests correct bottom count for 5-day trip | duration: 5 | bottoms_suggested: 3 |
| suggests extra underwear | duration: 5 | underwear_suggested: 6 |
| caps tops at 7 for long trips | duration: 14 | tops_suggested: 7 |
| auto-detects spring season | start_date: 2026-04-10 | season: spring |
| auto-detects winter season | start_date: 2026-12-20 | season: winter |
| consolidates duplicate items across days | day1: [A, B], day2: [B, C], day3: [A, C] | unique items: [A, B, C] |
| handles 1-day trip | duration: 1 | tops: 1, bottoms: 1, shoes: 1 |
| validates end date >= start date | start: Apr 10, end: Apr 8 | validation error |
| validates max 90 day duration | start: Jan 1, end: Apr 15 (105 days) | validation error |
| filters items by season | items: [summer top, winter top], season: summer | suggests only summer top |
| prefers most-worn items | items with wears [10, 2, 8, 5] | order: [10, 8, 5, 2] |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Generate quick list and pack items | 1. Create 5-day trip, 2. Generate, 3. Pack all items | Progress reaches 100%, all checkboxes checked |
| Generate outfit planning list | 1. Create 3-day trip, 2. Select outfits per day with overlapping items, 3. Generate consolidated list | No duplicate items, total less than sum of daily outfits |
| Add custom item to list | 1. Generate list, 2. Add "Laptop" as custom item | Custom item appears in "Custom Items" section with checkbox |
| Duplicate packing list | 1. Save list for NYC trip, 2. Long press, 3. Duplicate | New list created with same items, all unchecked, new name "[Original Name] (copy)" |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User packs for a week-long vacation | 1. Create 7-day casual summer trip, 2. Generate quick list, 3. Add custom items, 4. Pack all items, 5. Share list with partner | Complete packed list shared as text, all items checked |
| User reuses a past trip list | 1. Create list for recurring business trip, 2. After trip, 3. Open past trips, 4. Duplicate for next trip | New list with same items, unpacked, ready for next trip |

---

### CL-011: AI Outfit Suggestions

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | CL-011 |
| **Feature Name** | AI Outfit Suggestions |
| **Priority** | P1 |
| **Category** | Core |
| **Estimated Complexity** | High |

#### 3.2 User Stories

**Primary:**
> As a busy professional, I want the app to suggest today's outfit based on the weather, my schedule, and what I have not worn recently, so that I spend less than 30 seconds on the decision.

**Secondary:**
> As a fashion-conscious planner, I want outfit suggestions that avoid repeating recent looks, so that I keep my style varied without manual tracking.

**Tertiary:**
> As a privacy-conscious user, I want all outfit intelligence to run entirely on my device, so that my wardrobe data never leaves my phone for processing.

#### 3.3 Detailed Description

AI Outfit Suggestions provides intelligent, daily outfit recommendations based on multiple signals: current weather, occasion/calendar events, recent wear history, item availability (clean items only), and seasonal appropriateness. The feature aims to eliminate "what should I wear?" decision fatigue by presenting 3-5 outfit options each morning.

The suggestion engine runs entirely on-device using a rule-based algorithm (not a cloud ML model). The algorithm scores potential outfits based on weighted criteria: weather appropriateness (heaviest weight), occasion match, item freshness (prefer items not worn recently), color harmony (bonus for complementary colors), and laundry availability.

Weather data is the only network-dependent input. The app fetches the daily weather forecast (temperature and conditions) using a privacy-respecting API call that sends only the device's approximate location (city level) and receives temperature and condition data. No user identity, wardrobe data, or browsing history is transmitted.

Users can thumbs-up or thumbs-down suggestions to refine future recommendations. The thumbs signals are stored locally and feed back into the scoring algorithm (upvoted combinations get a preference boost, downvoted combinations get a penalty).

Cladwell charges $96/yr for AI outfit suggestions that require full cloud access to the user's wardrobe. MyCloset provides a comparable experience entirely on-device at no additional cost.

#### 3.4 Prerequisites

**Feature Dependencies:**
- CL-001: Wardrobe Catalog - Items with category, color, season, and occasion data
- CL-002: Category and Tag Organization - Season and occasion metadata
- CL-004: Outfit Calendar and Wear Logging - Recent wear history for freshness scoring

**External Dependencies:**
- Network access for weather forecast API (optional; suggestions degrade gracefully without weather)
- Device location services for weather (city-level only; optional)

**Assumed Capabilities:**
- Weather API is available and returns temperature and conditions
- Scoring algorithm can run on-device within 2 seconds for a 500-item wardrobe
- Local storage for feedback (thumbs) data

#### 3.5 User Interface Requirements

##### Screen: Today's Suggestions

**Layout:**
- Accessible from the module dashboard as a prominent "Today's Outfit" card, or from a dedicated tab
- At the top: weather summary showing current temperature, condition icon (sunny, cloudy, rainy, snowy), and high/low temperatures for the day. If weather is unavailable, show "Weather unavailable - suggestions based on season only."
- Below weather: a horizontally swipeable carousel of 3-5 outfit suggestion cards
- Each suggestion card shows:
  - A composite thumbnail of the outfit items arranged visually (similar to Outfit Builder canvas)
  - The outfit "name" (auto-generated, e.g., "Casual Friday Look", "Rainy Day Layers")
  - A row of the individual item thumbnails (small, horizontal)
  - A weather-match indicator (icon showing temperature suitability)
  - Thumbs up and thumbs down buttons at the bottom of the card
  - A "Wear This" button that logs the outfit for today (creates a WearLog) and optionally saves it as a named outfit
- Below the carousel: a "Refresh Suggestions" button to generate a new set
- Below the refresh button: a "Suggestion History" link showing past suggestions and feedback

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Loading | Generating suggestions | Skeleton carousel with "Finding your perfect outfit..." text |
| Suggestions Ready | 3-5 suggestions generated | Carousel of suggestion cards |
| No Items Available | All items are dirty or wardrobe is too small | "Not enough clean items for suggestions. Do some laundry first!" message |
| Weather Unavailable | Weather API failed or location denied | Suggestions generated without weather scoring; weather bar shows "Suggestions based on season and history" |
| Insufficient Data | Fewer than 5 items in wardrobe | "Add more items to get better suggestions. You need at least 5 items." |

**Interactions:**
- Swipe left/right on carousel: Browse through suggestions
- Tap thumbs up: Record positive feedback, brief animation (thumb fills with color)
- Tap thumbs down: Record negative feedback, card fades slightly, next card auto-scrolls into view
- Tap "Wear This": Log the outfit for today, show confirmation, save as named outfit (optional prompt)
- Tap "Refresh Suggestions": Generate 3-5 new suggestions
- Tap an item thumbnail within a suggestion: Navigate to that item's detail

**Transitions/Animations:**
- Carousel cards enter with a staggered slide-in from the right, 200ms between cards
- Thumbs feedback: icon fills with color and bounces, 200ms
- "Wear This" confirmation: checkmark animation over the card, 300ms
- Refresh: cards slide out left, new cards slide in from right, 400ms total

#### 3.6 Data Requirements

##### Entity: OutfitSuggestion

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| suggestion_date | date | Required, ISO 8601 | Today | Date this suggestion was generated for |
| item_ids | string | Required, comma-separated ClothingItem IDs | None | Items in the suggested outfit |
| score | float | Min: 0.0 | 0.0 | Overall outfit score from the suggestion algorithm |
| weather_temp | float | Optional | null | Temperature at time of suggestion (celsius) |
| weather_condition | string | Optional, max 50 chars | null | Weather condition (sunny, cloudy, rainy, etc.) |
| feedback | enum | Optional, one of: thumbs_up, thumbs_down, null | null | User feedback on this suggestion |
| was_worn | boolean | - | false | Whether the user chose to wear this suggestion |
| auto_name | string | Optional, max 100 chars | null | Auto-generated outfit name |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |

##### Entity: SuggestionFeedback (for long-term preference learning)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| item_pair | string | Required, two ClothingItem IDs sorted and joined (e.g., "id1:id2") | None | Pair of items in the feedback |
| positive_count | integer | Min: 0 | 0 | Times this pair was in a thumbs-up suggestion |
| negative_count | integer | Min: 0 | 0 | Times this pair was in a thumbs-down suggestion |
| net_score | integer | Computed | 0 | positive_count - negative_count |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last update time |

**Relationships:**
- OutfitSuggestion references ClothingItem IDs via item_ids (denormalized for performance)
- SuggestionFeedback tracks pairwise item compatibility

**Indexes:**
- OutfitSuggestion: suggestion_date - Query suggestions by date
- OutfitSuggestion: feedback - Query by feedback type for learning
- SuggestionFeedback: item_pair - Unique, fast lookup for scoring
- SuggestionFeedback: net_score - Sort by most/least compatible pairs

**Validation Rules:**
- item_ids must contain at least 2 item IDs
- feedback must be null, "thumbs_up", or "thumbs_down"
- item_pair must contain exactly 2 sorted IDs separated by ":"

**Example Data:**

```
OutfitSuggestion:
{
  "id": "os001-uuid",
  "suggestion_date": "2026-03-06",
  "item_ids": "f47ac10b,a23bc456,d89ef012",
  "score": 0.87,
  "weather_temp": 15.0,
  "weather_condition": "partly_cloudy",
  "feedback": "thumbs_up",
  "was_worn": true,
  "auto_name": "Smart Casual Layers",
  "created_at": "2026-03-06T07:00:00Z"
}

SuggestionFeedback:
{
  "id": "sf001-uuid",
  "item_pair": "a23bc456:f47ac10b",
  "positive_count": 3,
  "negative_count": 0,
  "net_score": 3,
  "updated_at": "2026-03-06T07:05:00Z"
}
```

#### 3.7 Business Logic Rules

##### Outfit Suggestion Generation Algorithm

**Purpose:** Generate 3-5 scored outfit suggestions for the user.

**Inputs:**
- available_items: list of ClothingItem where status = "active" AND laundry_status = "clean"
- weather: { temp: float, condition: string } (nullable)
- current_season: enum (derived from today's date)
- recent_wears: list of WearLogItem from the last 14 days
- feedback_pairs: list of SuggestionFeedback records

**Logic:**

```
1. IF available_items count < 5, RETURN insufficient data
2. Generate candidate outfits:
   a. Create 20-30 random outfit combinations by selecting:
      - 1 top (from category "tops")
      - 1 bottom (from category "bottoms" or "dresses")
      - 1 shoes (from category "shoes")
      - 0-1 outerwear (based on temperature)
      - 0-2 accessories (random)
   b. Ensure no duplicate items within an outfit
3. Score each candidate (0.0 to 1.0):
   a. Weather Score (weight: 0.30):
      - IF weather is available:
        - temp < 5°C: prefer outerwear, layers, boots (score items tagged winter)
        - temp 5-15°C: prefer layers, light jackets (spring/fall items)
        - temp 15-25°C: prefer light clothing (spring/summer items)
        - temp > 25°C: prefer breathable, light clothing (summer items)
        - IF condition = "rainy": boost waterproof/outerwear items
      - IF weather unavailable: use season-based scoring only (0.5 base)
   b. Freshness Score (weight: 0.25):
      - For each item in the outfit, calculate days_since_last_worn
      - Items not worn in 14+ days: 1.0
      - Items not worn in 7-13 days: 0.7
      - Items worn 3-6 days ago: 0.4
      - Items worn in the last 2 days: 0.1
      - Average across all items in the outfit
   c. Occasion Score (weight: 0.20):
      - Score based on the most common occasion tag across items
      - All items matching the same occasion: 1.0
      - Mixed occasions: 0.5
      - No occasion data: 0.5
   d. Feedback Score (weight: 0.15):
      - For each pair of items in the outfit, look up SuggestionFeedback
      - Average net_score across all pairs, normalized to 0.0-1.0
      - No feedback data: 0.5 (neutral)
   e. Color Harmony Score (weight: 0.10):
      - Neutral colors (black, white, gray, navy, beige) pair well with everything: 1.0
      - Complementary color pairs: 0.8
      - Analogous color pairs: 0.7
      - Clashing colors: 0.3
      - Average across all item color pairs
4. Rank candidates by total weighted score
5. Take the top 3-5 candidates, ensuring variety:
   a. No two suggestions should share more than 50% of items
   b. If top candidates are too similar, replace with the next-highest-scored distinct option
6. Auto-generate a name for each suggestion based on its dominant attributes
7. Save as OutfitSuggestion records
8. RETURN the top suggestions
```

**Edge Cases:**
- Fewer than 20 viable combinations possible: Generate as many unique combinations as possible
- No tops available but dresses are available: Use dresses as the primary item (skip bottom)
- All items worn in the last 2 days: Freshness score is low for all; suggestions still generated but flagged as "Limited fresh options"
- Weather API timeout: Fall back to season-only scoring
- No feedback data: Feedback score defaults to 0.5 (neutral)

##### Feedback Processing

**Purpose:** Update pairwise preference data when the user gives thumbs up or thumbs down.

**Inputs:**
- suggestion_id: string
- feedback_type: "thumbs_up" or "thumbs_down"

**Logic:**

```
1. Look up OutfitSuggestion by suggestion_id
2. SET feedback = feedback_type
3. Parse item_ids into a list
4. Generate all pairwise combinations of items
5. For each pair:
   a. Sort the two IDs alphabetically to create a canonical pair key
   b. Look up or create SuggestionFeedback for this pair
   c. IF feedback_type = "thumbs_up": INCREMENT positive_count
   d. IF feedback_type = "thumbs_down": INCREMENT negative_count
   e. RECALCULATE net_score = positive_count - negative_count
6. RETURN success
```

**Edge Cases:**
- User changes feedback from thumbs_up to thumbs_down: Decrement positive_count, increment negative_count (or track the state change to avoid double-counting)
- Outfit has 5 items: 10 unique pairs generated (5 choose 2)

##### Auto-Name Generation

**Purpose:** Generate a descriptive name for a suggested outfit.

**Inputs:**
- items: list of ClothingItem in the suggestion
- weather: { temp, condition }
- dominant_occasion: string

**Logic:**

```
1. Determine the primary descriptor:
   - IF weather condition is notable: use weather term ("Rainy Day", "Sunny", "Cold Weather")
   - ELSE IF dominant_occasion exists: use occasion ("Work Ready", "Date Night", "Weekend Casual")
   - ELSE: use a generic descriptor ("Daily Pick", "Fresh Look")
2. Determine the style modifier:
   - IF outerwear present: "Layers", "Bundled Up"
   - IF all items are neutral colors: "Minimalist"
   - IF bright colors present: "Bold"
   - ELSE: "Classic"
3. Combine: "[Style Modifier] [Primary Descriptor]" or "[Primary Descriptor] [Style Modifier]"
4. RETURN the name (e.g., "Classic Work Ready", "Bold Weekend Casual", "Rainy Day Layers")
```

**Sort/Filter/Ranking Logic:**
- **Suggestions sort:** By total weighted score descending
- **Suggestion history sort:** By suggestion_date descending, then by score descending within a date

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Weather API call fails | Suggestions generated without weather data; weather bar shows "Weather unavailable" | User can try refreshing later; suggestions are still useful |
| Location permission denied | Suggestions generated with season-only weather scoring; prompt to enable location for better suggestions | User grants location permission in settings |
| Algorithm takes > 5 seconds | Show progress indicator: "Finding your perfect outfit..." | Algorithm completes; if > 10 seconds, timeout and show "Could not generate suggestions. Try with fewer items or refresh." |
| Not enough clean items | "Not enough clean items for suggestions. Do some laundry first!" | User washes items and refreshes |
| Not enough items in wardrobe | "Add at least 5 items to get outfit suggestions." | User adds items to catalog |
| Feedback save fails | Thumbs animation still plays; feedback is retried silently on next app session | Automatic silent retry |

**Validation Timing:**
- Suggestions are generated on screen open or manual refresh
- Weather is fetched fresh on each generation (cached for 1 hour)
- Feedback is recorded immediately on tap

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 30+ items in their wardrobe and the weather is 18 degrees C and partly cloudy,
   **When** the user opens Today's Suggestions,
   **Then** 3-5 outfit suggestions are displayed, each featuring seasonally appropriate items, with a weather summary showing the current conditions.

2. **Given** the user thumbs-up a suggestion containing a navy blazer and gray pants,
   **When** the user refreshes suggestions the next day,
   **Then** the scoring algorithm gives a slight preference boost to outfits containing the navy blazer + gray pants combination.

3. **Given** the user taps "Wear This" on a suggestion,
   **When** the action completes,
   **Then** a WearLog entry is created for today with all items in the suggestion, each item's wear count increments, and laundry status updates (if auto_dirty_on_wear is enabled).

4. **Given** the user has worn item A every day for the last 3 days,
   **When** suggestions are generated,
   **Then** item A is deprioritized (low freshness score) and appears in fewer or no suggestions.

**Edge Cases:**

5. **Given** the weather API is unavailable,
   **When** the user opens Today's Suggestions,
   **Then** suggestions are generated based on the current season and wear history only, with a note "Weather unavailable - suggestions based on season only."

6. **Given** only 5 items are clean and in the wardrobe,
   **When** suggestions are generated,
   **Then** at least 1 suggestion is provided using the available items, even if variety is limited.

7. **Given** the user has fewer than 5 items in the wardrobe,
   **When** the user opens Today's Suggestions,
   **Then** the message "Add at least 5 items to get outfit suggestions" is shown instead of the carousel.

**Negative Tests:**

8. **Given** all items in the wardrobe have laundry_status = "dirty",
   **When** the user opens Today's Suggestions,
   **Then** the message "Not enough clean items for suggestions. Do some laundry first!" is shown,
   **And** no suggestions are generated.

9. **Given** the suggestion algorithm encounters an internal error,
   **When** the error is caught,
   **Then** the user sees "Could not generate suggestions. Try refreshing.",
   **And** no partial or broken suggestions are displayed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| scores weather appropriateness for cold day | temp: 2°C, items: winter jacket + sweater | weather_score: high (0.9+) |
| scores weather appropriateness for hot day | temp: 32°C, items: tank top + shorts | weather_score: high (0.9+) |
| penalizes mismatched weather | temp: 32°C, items: winter jacket | weather_score: low (0.2) |
| scores freshness for unworn items | all items last worn 20+ days ago | freshness_score: 1.0 |
| penalizes recently worn items | all items worn yesterday | freshness_score: 0.1 |
| neutral feedback score when no data | no SuggestionFeedback records | feedback_score: 0.5 |
| boosts score for positively paired items | pair net_score: +5 | feedback_score: > 0.5 |
| penalizes negatively paired items | pair net_score: -3 | feedback_score: < 0.5 |
| generates variety in top 5 | candidates share 80% items | replace with more distinct candidates |
| auto-names rainy day outfit | weather: rainy, outerwear present | name contains "Rainy" or "Layers" |
| auto-names work outfit | occasion: work, neutral colors | name contains "Work" |
| handles no weather data | weather: null | uses season-based scoring, weather_score: 0.5 |
| excludes dirty items | 10 items, 5 dirty | only 5 clean items used |
| requires minimum 5 items | 4 items | returns insufficient data |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Generate suggestions and wear one | 1. Open suggestions, 2. Tap "Wear This" on first card | WearLog created, items increment wear count |
| Thumbs up and verify future boost | 1. Generate suggestions, 2. Thumbs up one, 3. Refresh next day | Pair scores updated, similar combinations appear |
| Weather fallback | 1. Disable network, 2. Open suggestions | Suggestions generated with season-only scoring, weather bar shows unavailable |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Morning outfit selection workflow | 1. Open app in morning, 2. View suggestions, 3. Swipe through options, 4. Tap "Wear This" | Outfit logged, items marked dirty, wear history updated |
| User trains preferences over a week | 1. Get suggestions daily for 7 days, 2. Thumbs up/down various suggestions, 3. Check week 2 suggestions | Week 2 suggestions align better with past thumbs-up patterns |

---

### CL-012: Seasonal Rotation Reminders

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | CL-012 |
| **Feature Name** | Seasonal Rotation Reminders |
| **Priority** | P2 |
| **Category** | Data Management |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a busy professional, I want the app to remind me when it is time to swap out seasonal clothing, so that I always have weather-appropriate items accessible.

**Secondary:**
> As a minimalist dresser, I want to see which items belong to the upcoming season, so that I can plan my rotation and identify gaps before the season starts.

**Tertiary:**
> As a fashion-conscious planner, I want a seasonal overview of my wardrobe, so that I can ensure I have enough variety for each season.

#### 3.3 Detailed Description

Seasonal Rotation Reminders help users transition their wardrobe between seasons by suggesting when to swap out-of-season items (to storage or a different closet section) and bring in-season items to the forefront. The feature uses the season metadata from each clothing item (CL-001/CL-002) to group items by their seasonal appropriateness.

At the start of each new season (configurable: 1 week before, on the first day, or 2 weeks after), the app surfaces a rotation reminder showing items to put away (outgoing season) and items to bring forward (incoming season). Items tagged as "all-season" are never included in rotation suggestions.

The feature also provides a "Seasonal Overview" screen where users can see their wardrobe broken down by season, identifying gaps (e.g., "You only have 3 winter items") and surpluses.

Seasonal boundaries follow Northern Hemisphere defaults (spring: March-May, summer: June-August, fall: September-November, winter: December-February) but can be customized by the user for different climates or hemispheres.

#### 3.4 Prerequisites

**Feature Dependencies:**
- CL-001: Wardrobe Catalog - Items with season metadata
- CL-002: Category and Tag Organization - Season tags on items

**External Dependencies:**
- Device notification system for reminders

**Assumed Capabilities:**
- Local notifications can be scheduled
- Date/calendar arithmetic is available

#### 3.5 User Interface Requirements

##### Screen: Seasonal Overview

**Layout:**
- Accessible from the analytics tab or a "Seasons" card on the module dashboard
- A horizontal row of 4 season cards: Spring, Summer, Fall, Winter. Each card shows:
  - Season name and representative icon (flower, sun, leaf, snowflake)
  - Item count for that season (e.g., "24 items")
  - The currently active season is highlighted with an accent border
- Below the season cards, a detail view for the selected/tapped season showing:
  - A grid of items tagged with that season, grouped by category
  - Count per category (e.g., "Tops: 8, Bottoms: 4, Shoes: 3")
  - A "Gaps" section noting categories with fewer than 2 items for the season (e.g., "You have no winter shoes")
  - Items tagged "all-season" are shown in a separate "Year-Round" row
- At the bottom: a "Rotate Now" button to start the seasonal rotation flow

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| No Season Data | No items have season tags | "Add season tags to your items to use seasonal features" message |
| Full Data | Items have season metadata | Season cards with counts, detail view for selected season |
| Unbalanced | One season has significantly fewer items | Gaps section highlights the shortage |

**Interactions:**
- Tap season card: Select that season, update the detail view below
- Tap "Rotate Now": Open the rotation flow for the current seasonal transition
- Tap item in the season grid: Navigate to item detail

##### Modal: Rotation Reminder

**Layout:**
- Triggered automatically at season boundaries or when user taps "Rotate Now"
- Title: "Time to rotate! [Outgoing Season] to [Incoming Season]"
- Two sections:
  1. **Put Away** (outgoing season items not tagged for the incoming season): List of items with thumbnails, names, and categories. Checkbox to mark each as "stored" (changes status to "stored").
  2. **Bring Out** (incoming season items currently with status "stored"): List of items to activate. Checkbox to mark as "active" (changes status back to "active").
- At the bottom: "Complete Rotation" button

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Items to Rotate | Both outgoing and incoming items exist | Both sections populated |
| Nothing to Rotate | No items need rotation (all are all-season or already rotated) | "Your wardrobe is already set for [season]!" message |

**Interactions:**
- Tap checkbox next to item: Toggle selection for put-away/bring-out
- Tap "Complete Rotation": Process all selected items (change statuses), dismiss modal
- Tap "Remind Me Later": Dismiss and reschedule the reminder for 3 days later
- Swipe down: Dismiss without action

#### 3.6 Data Requirements

This feature does not introduce new entities beyond what is needed for preferences:

##### Entity: SeasonalSettings (part of UserPreferences or standalone)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | "seasonal_settings" | Singleton settings record |
| reminder_timing | enum | One of: week_before, first_day, two_weeks_after | "first_day" | When to trigger rotation reminders |
| spring_start_month | integer | 1-12 | 3 | Month when spring starts (March) |
| summer_start_month | integer | 1-12 | 6 | Month when summer starts (June) |
| fall_start_month | integer | 1-12 | 9 | Month when fall starts (September) |
| winter_start_month | integer | 1-12 | 12 | Month when winter starts (December) |
| last_rotation_date | date | Optional, ISO 8601 | null | Date of the most recent completed rotation |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Validation Rules:**
- start months must be valid (1-12)
- Seasons must not overlap (each month assigned to exactly one season)
- reminder_timing must be one of the defined enum values

**Example Data:**

```
{
  "id": "seasonal_settings",
  "reminder_timing": "first_day",
  "spring_start_month": 3,
  "summer_start_month": 6,
  "fall_start_month": 9,
  "winter_start_month": 12,
  "last_rotation_date": "2025-12-01",
  "updated_at": "2025-12-01T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Current Season Detection

**Purpose:** Determine the current season based on today's date and user settings.

**Inputs:**
- today: date
- settings: SeasonalSettings

**Logic:**

```
1. Extract the month from today
2. IF month >= settings.winter_start_month OR month < settings.spring_start_month: RETURN "winter"
3. IF month >= settings.spring_start_month AND month < settings.summer_start_month: RETURN "spring"
4. IF month >= settings.summer_start_month AND month < settings.fall_start_month: RETURN "summer"
5. IF month >= settings.fall_start_month AND month < settings.winter_start_month: RETURN "fall"
```

**Formulas:**
- `seasonal rotation: spring = Mar-May, summer = Jun-Aug, fall = Sep-Nov, winter = Dec-Feb` (with defaults)

**Edge Cases:**
- Winter wraps around the year (December to February): Logic handles the OR condition
- User in the Southern Hemisphere with reversed seasons: Customize start months (e.g., summer_start_month = 12)

##### Rotation Reminder Trigger

**Purpose:** Determine if a rotation reminder should be shown.

**Inputs:**
- today: date
- settings: SeasonalSettings
- last_rotation_date: date (nullable)

**Logic:**

```
1. Calculate the upcoming season transition date based on reminder_timing:
   - week_before: transition_date = next season start - 7 days
   - first_day: transition_date = next season start
   - two_weeks_after: transition_date = next season start + 14 days
2. IF today >= transition_date AND (last_rotation_date IS NULL OR last_rotation_date < transition_date):
   RETURN true (show reminder)
3. ELSE: RETURN false
```

**Edge Cases:**
- User opens the app months after a season change: Reminder is still triggered (better late than never)
- User completes rotation and reopens: Reminder is not triggered again (last_rotation_date is set)
- Multiple season changes missed: Only the most recent transition is surfaced

##### Seasonal Gap Detection

**Purpose:** Identify categories with insufficient items for a given season.

**Inputs:**
- season: enum
- all_items: list of ClothingItem where status = "active" AND seasons includes the given season

**Logic:**

```
1. Group items by category
2. For each category, count items
3. Identify categories with fewer than 2 items as "gaps"
4. Identify categories with 0 items as "missing"
5. RETURN { gaps: list of { category, count }, missing: list of category names }
```

**Edge Cases:**
- All categories have 2+ items: No gaps reported
- Category exists in other seasons but not this one: Reported as "missing" for this season
- "Other" category has 0 items: Not flagged as a gap (it is a catch-all)

**Sort/Filter/Ranking Logic:**
- **Season card sort:** Fixed order: Spring, Summer, Fall, Winter
- **Items within season:** Grouped by category, sorted by times_worn descending within each category

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Notification permission denied | "Enable notifications to receive seasonal reminders. You can still check the Seasonal Overview manually." | User grants permission or checks manually |
| Rotation status update fails | "Could not update item status. Please try again." toast | User retries |
| Seasonal settings save fails | "Could not save settings. Please try again." toast | User retries |
| No items have season tags | "Add season tags to your items to use seasonal features" on the Seasonal Overview screen | User edits items to add season tags |

**Validation Timing:**
- Season detection runs on app launch (to determine if a reminder should be triggered)
- Gap detection runs on Seasonal Overview screen load
- Status changes are immediate on checkbox interaction during rotation flow

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** today is March 1 (the first day of spring) and the user has not rotated since December,
   **When** the user opens MyCloset,
   **Then** a rotation reminder modal appears showing winter items to put away and spring items to bring out.

2. **Given** the user is viewing the Seasonal Overview with "Summer" selected,
   **When** the detail view renders,
   **Then** it shows all items tagged with "summer", grouped by category, with count badges per category.

3. **Given** the user has 0 winter shoes and 1 winter outerwear item,
   **When** the user views the winter season detail,
   **Then** the Gaps section shows "No winter shoes" and "Only 1 winter outerwear item."

4. **Given** the user completes the rotation flow by checking off items to put away and bring out,
   **When** the user taps "Complete Rotation",
   **Then** put-away items change status to "stored", bring-out items change status to "active", last_rotation_date is updated, and the reminder is dismissed.

**Edge Cases:**

5. **Given** all items are tagged "all-season",
   **When** the rotation reminder triggers,
   **Then** the modal shows "Your wardrobe is already set for [season]!" with no items to rotate.

6. **Given** the user is in the Southern Hemisphere and has set summer_start_month to 12,
   **When** the current season is detected in January,
   **Then** the system correctly identifies the current season as "summer".

**Negative Tests:**

7. **Given** the user has already completed rotation for the current season,
   **When** the app opens again,
   **Then** no rotation reminder is shown,
   **And** the Seasonal Overview shows the post-rotation state.

8. **Given** notification permissions are denied,
   **When** the user sets a recurring reminder,
   **Then** the system informs the user "Enable notifications to receive seasonal reminders",
   **And** the setting is saved but no notifications are scheduled until permission is granted.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| detects spring season | month: 4, defaults | "spring" |
| detects summer season | month: 7, defaults | "summer" |
| detects fall season | month: 10, defaults | "fall" |
| detects winter season (December) | month: 12, defaults | "winter" |
| detects winter season (January) | month: 1, defaults | "winter" |
| detects winter season (February) | month: 2, defaults | "winter" |
| handles southern hemisphere | summer_start: 12, fall_start: 3, winter_start: 6, spring_start: 9, month: 1 | "summer" |
| triggers reminder on first day | today: Mar 1, timing: first_day, last_rotation: Dec 1 | true |
| does not trigger if already rotated | today: Mar 1, last_rotation: Mar 1 | false |
| triggers week-before reminder | today: Feb 22, timing: week_before, spring_start: March | true |
| detects gaps correctly | winter items: {tops: 5, bottoms: 3, shoes: 0, outerwear: 1} | gaps: [outerwear (1)], missing: [shoes] |
| no gaps when all categories covered | all categories have 2+ items | gaps: [] |
| excludes all-season from rotation | item seasons: "all-season" | not included in put-away or bring-out lists |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Complete rotation flow | 1. Trigger rotation, 2. Check put-away items, 3. Check bring-out items, 4. Complete | Statuses updated, last_rotation_date set, reminder dismissed |
| Seasonal overview updates after rotation | 1. View summer overview, 2. Complete fall rotation (put away summer items), 3. View summer overview | Summer items show as "stored" (not active), counts reflect rotation |
| Reminder suppression after completion | 1. Complete rotation, 2. Reopen app | No rotation reminder shown |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User rotates wardrobe from winter to spring | 1. Open app on March 1, 2. See rotation reminder, 3. Put away heavy coats, 4. Bring out spring jackets, 5. Complete | Winter coats stored, spring jackets active, overview reflects new season |
| User identifies seasonal gaps | 1. View Seasonal Overview, 2. Select "fall" season, 3. Review gaps | Clear list of missing/underrepresented categories for fall, informing shopping decisions |

---

### CL-013: Shopping Wishlist

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | CL-013 |
| **Feature Name** | Shopping Wishlist |
| **Priority** | P2 |
| **Category** | Data Management |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a budget-minded shopper, I want to keep a wishlist of clothing items I plan to buy, so that I can compare prices, avoid impulse purchases, and track what I actually need.

**Secondary:**
> As a fashion-conscious planner, I want to attach notes and target prices to wishlist items, so that I can make informed decisions when sales happen.

**Tertiary:**
> As a minimalist dresser, I want to link wishlist items to wardrobe gaps (categories/seasons with low item counts), so that I buy intentionally rather than emotionally.

#### 3.3 Detailed Description

The Shopping Wishlist gives users a dedicated space to track clothing items they intend to buy. Each wishlist entry captures the item name, category, target price, store or brand, an optional photo (from camera or image gallery), a priority level, a link to a relevant URL (product page), and free-form notes.

This feature works hand-in-hand with donation suggestions (CL-007) and seasonal gap detection (CL-012). When the user identifies wardrobe gaps (e.g., "no winter shoes") or sees donation candidates ("you have 4 rarely-worn blazers"), the wishlist provides a natural next step: "I should buy winter boots" or "I can replace those blazers with one versatile option."

Users can mark wishlist items as "purchased" to track what they have acquired over time. Purchased items can optionally be converted into a new wardrobe catalog entry (CL-001) with pre-filled data, reducing duplicate data entry.

Unlike shopping apps that track prices across retailers and send alerts, MyCloset's wishlist is a simple, privacy-first planning tool. No network calls are made for price tracking. The user manually updates prices and notes. This keeps the feature aligned with the zero-network, zero-telemetry philosophy.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (wishlist is a standalone list feature)

**External Dependencies:**
- Camera or photo library access for attaching reference photos (optional)
- Local persistent storage for wishlist data

**Assumed Capabilities:**
- User can navigate between screens via the module tab bar
- Local database is initialized and writable
- Currency formatting is available based on device locale

#### 3.5 User Interface Requirements

##### Screen: Wishlist

**Layout:**
- Accessible from the module dashboard as a "Wishlist" card or from a dedicated tab/section
- The screen has a top navigation bar showing "Shopping Wishlist" as the title, with a sort/filter icon on the left and a "+" (add) button on the right
- Below the navigation bar, a summary strip shows: total wishlist count, total estimated cost (sum of all target_prices), and a "Purchased" count badge
- The main content area is a scrollable vertical list of wishlist cards
- Each card shows: item name (bold), category tag, target price (formatted as currency), store/brand (if set), priority indicator (dot: red for high, yellow for medium, gray for low), and a reference photo thumbnail (if attached)
- Tapping a card navigates to the Wishlist Item Detail screen
- A floating action button in the bottom-right corner opens the Add Wishlist Item modal
- A segmented control at the top toggles between "Active" (unpurchased) and "Purchased" views

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No wishlist items exist | Centered illustration of a shopping bag, heading "Your wishlist is empty", subtext "Add items you are thinking about buying", prominent "Add First Item" button |
| Populated | 1 or more items exist | Normal list view with wishlist cards |
| All Purchased | Only purchased items exist, none active | "Active" tab shows "Nothing on your list right now. Tap + to add items." |
| Filtered | Filters or search active | Matching items shown; "No items match your filters" if zero results |

**Interactions:**
- Tap card: Navigate to Wishlist Item Detail
- Long press card: Show context menu (Edit, Mark as Purchased, Delete)
- Swipe left on card: Reveal "Delete" action
- Swipe right on card: Reveal "Mark Purchased" action (with a green checkmark)
- Tap "+" button: Open Add Wishlist Item modal
- Tap sort/filter icon: Open sort/filter bottom sheet (sort by: priority, date added, price high-to-low, price low-to-high; filter by: category, priority)
- Toggle Active/Purchased: Switch between unpurchased and purchased lists

**Transitions/Animations:**
- Items marked as purchased slide out of the Active list and into the Purchased list with a checkmark animation, 300ms
- New items animate in from the bottom with a fade-up, 250ms
- Deleted items shrink and fade out, 200ms

##### Modal: Add Wishlist Item

**Layout:**
- Full-screen modal with "Add to Wishlist" title and "Cancel" (left) / "Save" (right) buttons in the top bar
- Photo capture area at the top: a medium square placeholder with a camera icon. Tapping opens an action sheet with "Take Photo", "Choose from Library", and "Paste URL" options
- Below the photo area, a scrollable form:
  - Name (text input, required, placeholder: "e.g., Leather Chelsea Boots")
  - Category (picker/dropdown, required, same options as Wardrobe Catalog)
  - Target Price (currency input, optional, placeholder: "$0.00")
  - Store / Brand (text input, optional, placeholder: "e.g., Nordstrom, Nike")
  - Priority (segmented control: Low, Medium, High, default: Medium)
  - URL (text input, optional, placeholder: "https://...")
  - Notes (multiline text input, optional, placeholder: "Size notes, color preference, sale timing...")
- "Save" button validates required fields, creates the item, and dismisses the modal

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Fresh | Modal just opened | All fields empty, photo placeholder visible, "Save" button disabled |
| Partially Filled | Some fields completed | "Save" enabled once Name and Category are filled |
| Validation Error | Required field missing on save | Inline error below the empty required field |
| Saving | Save in progress | "Save" button shows loading indicator |

**Interactions:**
- Tap photo area: Show action sheet for photo capture or import
- Tap "Save": Validate, save, dismiss, show success toast
- Tap "Cancel": Discard confirmation if form has changes; dismiss immediately if clean

**Transitions/Animations:**
- Modal slides up from the bottom, 300ms
- Dismissal slides down, 250ms

##### Screen: Wishlist Item Detail

**Layout:**
- Full-screen with back button and "Edit" button in the top bar
- Reference photo at the top (if attached), or a placeholder icon
- Item name as a large heading
- Below the name: metadata row showing category tag, priority dot, and store/brand
- "Target Price" displayed prominently (formatted currency)
- URL displayed as a tappable link (opens in external browser)
- Notes section (if any)
- A divider, then action buttons:
  - "Mark as Purchased" button (green) - transitions the item to purchased status
  - "Add to Wardrobe" button (only visible on purchased items) - creates a new CL-001 catalog entry pre-filled with the wishlist item's name, category, and price
  - "Delete" button (destructive style)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Active | Item not yet purchased | "Mark as Purchased" button visible |
| Purchased | Item marked as purchased | Green "Purchased" badge, "Add to Wardrobe" button visible, purchase_date displayed |

**Interactions:**
- Tap "Mark as Purchased": Set status to purchased, set purchase_date to today, show confirmation animation
- Tap "Add to Wardrobe": Navigate to Add Item screen (CL-001) pre-filled with name, category, and purchase_price from the wishlist entry
- Tap "Delete": Show deletion confirmation dialog
- Tap URL: Open link in device browser

#### 3.6 Data Requirements

##### Entity: WishlistItem

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| name | string | Required, max 255 chars | None | Item name |
| category | enum | Required, one of: Tops, Bottoms, Dresses, Outerwear, Shoes, Accessories, Activewear, Swimwear, Sleepwear, Underwear, Other | None | Clothing category |
| target_price | float | Optional, min: 0.0 | null | Desired purchase price |
| store_brand | string | Optional, max 255 chars | null | Store name or brand |
| priority | enum | One of: low, medium, high | "medium" | Purchase priority |
| url | string | Optional, max 2048 chars | null | Product page URL |
| photo_path | string | Optional, max 1024 chars | null | Local file path to reference photo |
| notes | string | Optional, max 2000 chars | null | Free-form notes |
| status | enum | One of: active, purchased | "active" | Whether the item has been bought |
| purchase_date | date | Optional, ISO 8601 | null | Date the item was purchased |
| converted_to_item_id | string | Optional, references ClothingItem.id | null | ID of the wardrobe catalog item created from this wishlist entry |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- WishlistItem optionally references ClothingItem via converted_to_item_id (one-to-one, nullable)

**Indexes:**
- status - Filter by active vs purchased
- priority - Sort by priority
- category - Filter by category
- created_at - Sort by date added

**Validation Rules:**
- name must not be empty after trimming whitespace
- category must be a valid enum value
- target_price must be non-negative if provided
- url must be a valid URL format if provided (starts with http:// or https://)
- If status is "purchased", purchase_date must not be null
- converted_to_item_id must reference a valid ClothingItem if set

**Example Data:**

```
{
  "id": "wl001-uuid",
  "name": "Leather Chelsea Boots",
  "category": "Shoes",
  "target_price": 189.99,
  "store_brand": "Thursday Boot Co.",
  "priority": "high",
  "url": "https://thursdayboots.com/products/duke-chelsea",
  "photo_path": "/photos/wishlist/wl001.jpg",
  "notes": "Size 10. Wait for end-of-season sale. Black or brown.",
  "status": "active",
  "purchase_date": null,
  "converted_to_item_id": null,
  "created_at": "2026-03-01T10:00:00Z",
  "updated_at": "2026-03-01T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Wishlist Summary Calculation

**Purpose:** Compute summary statistics for the wishlist.

**Inputs:**
- all_wishlist_items: list of WishlistItem

**Logic:**

```
1. active_items = all_wishlist_items WHERE status = "active"
2. purchased_items = all_wishlist_items WHERE status = "purchased"
3. total_active_count = COUNT(active_items)
4. total_estimated_cost = SUM(active_items.target_price) WHERE target_price IS NOT NULL
5. purchased_count = COUNT(purchased_items)
6. total_spent = SUM(purchased_items.target_price) WHERE target_price IS NOT NULL
7. RETURN { total_active_count, total_estimated_cost, purchased_count, total_spent }
```

**Edge Cases:**
- No items have target_price set: total_estimated_cost = 0, display "No prices set"
- All items are purchased: active count is 0, active tab shows empty state

##### Wishlist-to-Catalog Conversion

**Purpose:** Create a new ClothingItem from a purchased wishlist entry.

**Inputs:**
- wishlist_item: WishlistItem (status = "purchased")

**Logic:**

```
1. Create a new ClothingItem with:
   - name = wishlist_item.name
   - category = wishlist_item.category
   - purchase_price = wishlist_item.target_price
   - purchase_date = wishlist_item.purchase_date
   - brand = wishlist_item.store_brand
   - photo = wishlist_item.photo_path (copied to catalog photo directory)
   - condition = "New"
   - All other fields = empty/default
2. SET wishlist_item.converted_to_item_id = new ClothingItem.id
3. Navigate user to the new ClothingItem detail to complete remaining fields
4. RETURN new_item_id
```

**Edge Cases:**
- Wishlist item already converted (converted_to_item_id is set): Show "Already added to wardrobe" message and navigate to the existing item
- Photo path is invalid or file missing: Create the catalog item without a photo, prompt user to add one

**Sort/Filter/Ranking Logic:**
- **Default sort:** Priority descending (high first), then created_at descending (newest first)
- **Available sort options:** Priority, Date Added (newest/oldest), Price (high-to-low / low-to-high), Name (A-Z)
- **Filter options:** Category (multi-select), Priority (multi-select)
- **Search:** Name and store_brand fields, substring matching

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on save | "Could not save wishlist item. Please try again." toast | User retries |
| Photo cannot be saved (storage full) | "Could not save photo. Free up storage and try again." | User frees storage or skips photo |
| Invalid URL format | Inline validation: "Enter a valid URL starting with http:// or https://" | User corrects the URL |
| Conversion fails (catalog write error) | "Could not add to wardrobe. Please try again." toast | User retries the conversion |
| Wishlist item not found (deleted externally) | "Item not found" with "Go Back" button | User returns to the list |

**Validation Timing:**
- Name and category are validated on save attempt
- URL format is validated on blur (when user leaves the field)
- Price format is validated on input (only numeric and decimal allowed)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has no wishlist items,
   **When** the user taps "+" and fills in "Leather Chelsea Boots" with category "Shoes" and target price $189.99,
   **Then** the item appears in the Active wishlist with the name, category tag, and formatted price.

2. **Given** the user has 5 active wishlist items totaling $450,
   **When** the user views the Wishlist screen,
   **Then** the summary strip shows "5 items | $450.00 estimated."

3. **Given** the user swipes right on a wishlist item,
   **When** the "Mark Purchased" action completes,
   **Then** the item moves from the Active list to the Purchased list, purchase_date is set to today, and the active count decrements by 1.

4. **Given** the user views a purchased wishlist item,
   **When** the user taps "Add to Wardrobe",
   **Then** the Add Item screen (CL-001) opens pre-filled with the wishlist item's name, category, and price, and after saving, the wishlist entry's converted_to_item_id is set.

**Edge Cases:**

5. **Given** a wishlist item has no target_price,
   **When** the item is displayed in the list,
   **Then** the price area shows "No price set" instead of "$0.00".

6. **Given** a wishlist item has already been converted to a wardrobe item,
   **When** the user taps "Add to Wardrobe" again,
   **Then** the system shows "Already added to wardrobe" and navigates to the existing catalog item.

**Negative Tests:**

7. **Given** the user attempts to save a wishlist item with no name,
   **When** the save is triggered,
   **Then** an inline error "Name is required" appears below the name field,
   **And** the item is not saved.

8. **Given** the user enters an invalid URL like "not-a-url",
   **When** the user leaves the URL field,
   **Then** an inline validation message "Enter a valid URL starting with http:// or https://" is displayed,
   **And** the save button remains enabled but save is blocked until corrected or cleared.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates wishlist summary with prices | 3 items: $50, $100, $200 | total: 3, estimated: $350 |
| calculates summary with missing prices | 3 items: $50, null, $200 | total: 3, estimated: $250 |
| calculates summary with zero items | empty list | total: 0, estimated: $0 |
| separates active from purchased | 3 active, 2 purchased | active_count: 3, purchased_count: 2 |
| validates name is required | name: "" | validation error |
| validates name with whitespace only | name: "   " | validation error |
| validates URL format (valid) | url: "https://example.com" | passes validation |
| validates URL format (invalid) | url: "not-a-url" | validation error |
| validates price is non-negative | price: -10.00 | validation error |
| prevents double conversion | converted_to_item_id: "abc" | returns "already converted" |
| conversion pre-fills catalog fields | wishlist with name, category, price | new ClothingItem has matching fields |
| default sort by priority then date | 3 items: high/old, low/new, medium/middle | order: high, medium, low |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Add and view wishlist item | 1. Tap +, 2. Fill name and category, 3. Save, 4. View list | New item appears in Active list with correct data |
| Mark as purchased | 1. Swipe right on item, 2. Confirm | Item moves to Purchased list, purchase_date set |
| Convert to wardrobe item | 1. View purchased item, 2. Tap "Add to Wardrobe", 3. Save catalog entry | New ClothingItem created, wishlist item linked |
| Filter by category | 1. Open filters, 2. Select "Shoes", 3. Apply | Only shoe wishlist items displayed |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User tracks and purchases a wishlist item | 1. Add "Winter Boots" to wishlist, 2. Set target price $150, 3. Later mark purchased, 4. Convert to wardrobe | Boots appear in wardrobe catalog with $150 price, wishlist shows 1 purchased |
| User manages a seasonal shopping list | 1. Identify fall gaps from CL-012, 2. Add 3 fall items to wishlist with priorities, 3. Purchase 1, 4. View summary | 2 active items, 1 purchased, summary reflects costs |

---

### CL-014: Capsule Wardrobe Builder

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | CL-014 |
| **Feature Name** | Capsule Wardrobe Builder |
| **Priority** | P2 |
| **Category** | Core |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a minimalist dresser, I want to build a capsule wardrobe of 33 or fewer versatile items for the current season, so that I can simplify my daily clothing decisions and reduce wardrobe clutter.

**Secondary:**
> As a fashion-conscious planner, I want the app to suggest which items from my wardrobe are the best candidates for my capsule, so that I pick the most versatile and well-worn pieces.

**Tertiary:**
> As a budget-minded shopper, I want to see cost-per-wear data alongside capsule candidates, so that I prioritize items that deliver the most value per dollar.

#### 3.3 Detailed Description

The Capsule Wardrobe Builder helps users curate a focused, minimal wardrobe for a given season or time period. A capsule wardrobe is a limited collection of interchangeable clothing items (typically 33 items, following the Project 333 standard) that can be mixed and matched to create a wide variety of outfits.

The builder guides users through a structured selection process: choose a season (or "year-round"), set a target item count (default: 33, adjustable from 10 to 50), and then pick items from their existing wardrobe to include. The system provides smart suggestions by ranking wardrobe items based on versatility (how many outfits include the item), wear frequency (prefer items the user actually wears), color neutrality (neutral colors are more mixable), and cost-per-wear (prioritize items that deliver value).

Once a capsule is built, the user can see a dashboard showing the capsule's outfit potential (how many distinct outfits can be formed), category balance (e.g., "8 tops, 5 bottoms, 3 dresses, 4 outerwear, 5 shoes, 4 accessories, 4 other"), and estimated cost-per-wear for the entire capsule.

The builder also surfaces items NOT in the capsule as "rest" items, helping users identify what can be stored, donated, or sold. This connects naturally to donation suggestions (CL-007) and seasonal rotation (CL-012).

Users can save multiple capsules (e.g., "Spring 2026 Capsule", "Travel Capsule", "Work Capsule") and compare them. Each capsule is a named, saved configuration - not a destructive operation. Items in a capsule remain in the main catalog unchanged.

Cladwell charges $96/yr for capsule wardrobe coaching. MyCloset provides a comparable builder with data-driven suggestions at no extra cost.

#### 3.4 Prerequisites

**Feature Dependencies:**
- CL-001: Wardrobe Catalog - Source items for the capsule
- CL-002: Category and Tag Organization - Category, season, and occasion data for smart suggestions
- CL-005: Wear Count Tracking - Wear frequency data for versatility scoring

**External Dependencies:**
- None (fully offline)

**Assumed Capabilities:**
- Local persistent storage for capsule configurations
- Combinatorial calculation can run within 3 seconds for a 200-item wardrobe

#### 3.5 User Interface Requirements

##### Screen: Capsule List

**Layout:**
- Accessible from the module dashboard as a "Capsule Wardrobes" card or from the analytics tab
- The screen has a top navigation bar showing "Capsule Wardrobes" as the title, with a "+" (create) button on the right
- The main content area is a vertical list of saved capsule cards
- Each capsule card shows: capsule name (bold), season/label, item count (e.g., "28 of 33 items"), creation date, and a small grid preview of 4-6 item thumbnails
- Tapping a capsule card navigates to the Capsule Detail screen

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No capsules created | Centered illustration of a minimalist closet, heading "Build your first capsule", subtext "A capsule wardrobe is a curated set of 33 items that create endless outfit combinations", "Create Capsule" button |
| Populated | 1 or more capsules exist | List of capsule cards |

**Interactions:**
- Tap card: Navigate to Capsule Detail
- Long press card: Show context menu (Edit, Duplicate, Delete)
- Tap "+": Open Create Capsule flow
- Swipe left on card: Reveal "Delete" action

**Transitions/Animations:**
- Cards enter with staggered fade-up, 150ms between cards
- Deleted cards shrink and fade, 200ms

##### Screen: Create/Edit Capsule

**Layout:**
- Full-screen flow with a multi-step progression:
- **Step 1 - Setup:** Capsule name (text input, required, placeholder: "e.g., Spring 2026 Capsule"), Season (picker: Spring, Summer, Fall, Winter, Year-Round), Target Count (stepper: default 33, range 10-50)
- **Step 2 - Select Items:** A grid of all wardrobe items tagged for the selected season (or all items for "Year-Round"). Each item card shows a thumbnail, name, a "Suggested" badge (if the item ranks in the top N by versatility score), and a checkbox to include it in the capsule. A running counter at the top shows "X of Y items selected" where Y is the target count. Items are sorted by suggestion score by default.
- **Step 3 - Review:** Summary showing category breakdown (bar chart), total cost-per-wear for the capsule, outfit potential estimate, and a "Rest Items" list showing wardrobe items NOT included in the capsule. A "Save Capsule" button at the bottom.
- Navigation: "Back" and "Next" buttons at the bottom of each step. "Save" on the final step.

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Step 1 Fresh | Flow just started | Empty name, default settings |
| Step 2 No Matches | No items match the selected season | "No items tagged for [season]. Add season tags to your wardrobe items." |
| Step 2 Over Target | Selected items exceed target count | Counter turns red: "38 of 33 items (5 over target)", user can still save |
| Step 2 Under Target | Fewer items selected than target | Counter shows in default color: "20 of 33 items" |
| Step 3 Review | Items selected, ready to save | Full summary with stats and rest items |

**Interactions:**
- Tap item card checkbox: Toggle inclusion in the capsule, update running counter
- Tap "Suggested" badge: Show tooltip explaining why the item was suggested (e.g., "Worn 12 times, used in 5 outfits, neutral color")
- Tap "Next": Advance to next step
- Tap "Back": Return to previous step
- Tap "Save Capsule": Save configuration, navigate to Capsule Detail
- Tap category in the bar chart (Step 3): Highlight items of that category in the selection list

**Transitions/Animations:**
- Steps transition with a horizontal slide, 250ms
- Item selection toggles with a checkmark scale-in animation, 150ms
- Counter changes animate with a number flip, 200ms

##### Screen: Capsule Detail

**Layout:**
- Full-screen with back button and "Edit" / "Share" buttons in the top bar
- Capsule name as the large heading, season label below
- A stats row: item count, outfit potential, average cost-per-wear
- Category breakdown bar chart (horizontal bars showing count per category)
- A grid of included items (tappable, navigates to item detail)
- A collapsible "Rest Items" section showing items NOT in the capsule
- An "Outfit Ideas" button that filters the Outfit Builder (CL-003) to only use capsule items

**Interactions:**
- Tap item in grid: Navigate to item detail (CL-001)
- Tap "Edit": Return to Create/Edit flow with current selections
- Tap "Outfit Ideas": Open Outfit Builder filtered to capsule items only
- Tap "Rest Items" header: Expand/collapse the rest items list
- Tap rest item: Navigate to item detail

#### 3.6 Data Requirements

##### Entity: CapsuleWardrobe

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| name | string | Required, max 255 chars | None | Capsule name |
| season | enum | One of: spring, summer, fall, winter, year_round | "year_round" | Season this capsule targets |
| target_count | integer | Min: 10, max: 50 | 33 | Target number of items |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

##### Entity: CapsuleItem (join table)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| capsule_id | string | Required, references CapsuleWardrobe.id | None | Parent capsule |
| item_id | string | Required, references ClothingItem.id | None | Included wardrobe item |
| added_at | datetime | Auto-set on creation | Current timestamp | When the item was added to this capsule |

**Relationships:**
- CapsuleWardrobe has many ClothingItem through CapsuleItem (many-to-many)
- CapsuleItem belongs to CapsuleWardrobe (many-to-one via capsule_id)
- CapsuleItem belongs to ClothingItem (many-to-one via item_id)

**Indexes:**
- CapsuleItem: (capsule_id, item_id) - Unique composite, prevent duplicates
- CapsuleItem: capsule_id - Fast lookup of all items in a capsule
- CapsuleWardrobe: season - Filter capsules by season
- CapsuleWardrobe: created_at - Sort by creation date

**Validation Rules:**
- name must not be empty after trimming whitespace
- target_count must be between 10 and 50 inclusive
- A ClothingItem can appear in multiple capsules (different seasons/themes)
- Duplicate (capsule_id, item_id) pairs are rejected

**Example Data:**

```
CapsuleWardrobe:
{
  "id": "cap001-uuid",
  "name": "Spring 2026 Capsule",
  "season": "spring",
  "target_count": 33,
  "created_at": "2026-03-01T09:00:00Z",
  "updated_at": "2026-03-01T09:30:00Z"
}

CapsuleItem:
{
  "id": "ci001-uuid",
  "capsule_id": "cap001-uuid",
  "item_id": "f47ac10b-uuid",
  "added_at": "2026-03-01T09:15:00Z"
}
```

#### 3.7 Business Logic Rules

##### Capsule Suggestion Scoring

**Purpose:** Rank wardrobe items by suitability for a capsule to help users pick the most versatile pieces.

**Inputs:**
- candidate_items: list of ClothingItem (filtered by season)
- outfits: list of Outfit from CL-003
- wear_logs: list of WearLog from CL-005

**Logic:**

```
1. For each candidate item, calculate a suggestion_score (0.0 to 1.0):
   a. Versatility Score (weight: 0.35):
      - Count the number of saved outfits that include this item
      - Normalize: outfit_count / max_outfit_count_among_candidates
      - If no outfits exist for any item: 0.5 (neutral)
   b. Wear Frequency Score (weight: 0.25):
      - times_worn for this item
      - Normalize: times_worn / max_times_worn_among_candidates
      - If no items have been worn: 0.5 (neutral)
   c. Color Neutrality Score (weight: 0.20):
      - Neutral colors (black, white, gray, navy, beige, cream, brown, olive, burgundy): 1.0
      - Earth tones and muted colors: 0.7
      - Bright or statement colors: 0.4
   d. Cost-Per-Wear Score (weight: 0.20):
      - IF times_worn > 0 AND purchase_price is set:
        cost_per_wear = purchase_price / times_worn
        Lower cost_per_wear = higher score
        Normalize inversely against max_cost_per_wear
      - IF times_worn = 0 OR no purchase_price: 0.5 (neutral)
2. suggestion_score = (versatility * 0.35) + (wear_freq * 0.25) + (neutrality * 0.20) + (cpw * 0.20)
3. Sort candidates by suggestion_score descending
4. Mark the top target_count items as "Suggested"
5. RETURN sorted list with scores and suggestion badges
```

**Edge Cases:**
- No outfits or wear data exist: All items score 0.5 on those factors; suggestions are driven by color neutrality alone
- All items are the same color: Color neutrality score is equal for all; other factors determine ranking
- Wardrobe has fewer items than target_count: All items are suggested, no rest items

##### Outfit Potential Estimation

**Purpose:** Estimate how many distinct outfits can be formed from the capsule items.

**Inputs:**
- capsule_items: list of ClothingItem in the capsule

**Logic:**

```
1. Group capsule_items by category:
   - tops_count = count of Tops
   - bottoms_count = count of Bottoms + Dresses
   - shoes_count = count of Shoes
   - outerwear_count = count of Outerwear (treat as optional layer)
   - accessories_count = count of Accessories (treat as optional)
2. base_combinations = tops_count * bottoms_count * shoes_count
3. IF outerwear_count > 0: outerwear_multiplier = outerwear_count + 1 (includes "no outerwear")
   ELSE: outerwear_multiplier = 1
4. outfit_potential = base_combinations * outerwear_multiplier
5. IF outfit_potential = 0 (missing a required category): Show "Add [missing category] to unlock outfit combinations"
6. RETURN outfit_potential
```

**Formulas:**
- `outfit_potential = tops * (bottoms + dresses) * shoes * (outerwear + 1)`
- `capsule_cost_per_wear = SUM(item.purchase_price) / SUM(item.times_worn)` where both values are known
- `capsule_wardrobe_size = 33 items max (standard capsule)`

**Edge Cases:**
- No tops in capsule: outfit_potential = 0, show "Add tops to see outfit combinations"
- Only dresses (no separate tops/bottoms): Dresses count as complete outfits: outfit_potential = dresses_count * shoes_count * (outerwear + 1)
- Large capsule (50 items): Calculation may yield thousands of combinations; display as "500+" for values exceeding 500

**Sort/Filter/Ranking Logic:**
- **Capsule list sort:** Most recently updated first
- **Item selection sort (Step 2):** Suggestion score descending (suggested items first)
- **Rest items sort:** Times worn ascending (least worn first, natural donation candidates)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Database write fails on save | "Could not save capsule. Please try again." toast | User retries |
| Item deleted from catalog while in capsule | Item silently removed from capsule; count updated | Capsule count decrements; user notified on next capsule view |
| Suggestion scoring takes > 5 seconds | Progress indicator: "Analyzing your wardrobe..." | Algorithm completes; if > 10 seconds, show results without scores |
| Target count exceeds wardrobe size | Info message: "Your wardrobe has [X] items, which is fewer than your target of [Y]" | User adjusts target or adds items |
| Capsule name is duplicate | Inline validation: "A capsule with this name already exists" | User picks a different name |

**Validation Timing:**
- Name uniqueness is validated on save
- Target count bounds are validated on stepper interaction (prevents out-of-range values)
- Suggestion scoring runs when Step 2 loads

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 80 items in their wardrobe with season tags,
   **When** the user creates a new capsule for "Spring" with a target of 33 items,
   **Then** Step 2 shows spring-tagged items sorted by suggestion score, with the top 33 marked "Suggested."

2. **Given** the user selects 30 items for a capsule,
   **When** the user reaches the Review step,
   **Then** the summary shows 30 items, category breakdown bar chart, outfit potential estimate, and the rest items list.

3. **Given** a saved capsule has 33 items including 8 tops, 6 bottoms, and 4 shoes,
   **When** the user views the Capsule Detail,
   **Then** the outfit potential shows 8 * 6 * 4 = 192 combinations (plus outerwear multiplier if applicable).

4. **Given** the user taps "Outfit Ideas" on a capsule,
   **When** the Outfit Builder opens,
   **Then** only the items in the capsule are available for outfit creation.

**Edge Cases:**

5. **Given** the user selects 38 items for a capsule with a target of 33,
   **When** the counter updates,
   **Then** it shows "38 of 33 items (5 over target)" in red, but the user can still save.

6. **Given** the user has only 15 wardrobe items,
   **When** the user creates a capsule with a target of 33,
   **Then** all 15 items are marked "Suggested" and the info message "Your wardrobe has 15 items, fewer than your target of 33" is shown.

**Negative Tests:**

7. **Given** the user attempts to save a capsule with no name,
   **When** the save is triggered,
   **Then** an inline error "Name is required" appears,
   **And** the capsule is not saved.

8. **Given** the user sets the target count to 5 (below minimum of 10),
   **When** the stepper decrements,
   **Then** the stepper stops at 10 and does not go lower.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| scores versatility based on outfit count | item in 5 outfits, max is 10 | versatility_score: 0.5 |
| scores versatility with no outfits | no outfits exist | versatility_score: 0.5 (neutral) |
| scores neutral color highly | color: "black" | neutrality_score: 1.0 |
| scores bright color lower | color: "hot pink" | neutrality_score: 0.4 |
| scores wear frequency | worn 20 times, max is 40 | frequency_score: 0.5 |
| calculates outfit potential (basic) | 8 tops, 6 bottoms, 4 shoes, 0 outerwear | potential: 192 |
| calculates outfit potential with outerwear | 8 tops, 6 bottoms, 4 shoes, 3 outerwear | potential: 192 * 4 = 768 |
| calculates potential with dresses only | 0 tops, 0 bottoms, 5 dresses, 3 shoes | potential: 5 * 3 = 15 (plus outerwear) |
| returns zero potential when missing category | 8 tops, 0 bottoms, 4 shoes | potential: 0 with message |
| validates target count minimum | target: 5 | validation error: minimum is 10 |
| validates target count maximum | target: 60 | validation error: maximum is 50 |
| rejects duplicate capsule names | name: "Spring 2026", existing: ["Spring 2026"] | validation error: duplicate name |
| calculates capsule cost per wear | items: [$100/10 wears, $200/20 wears] | capsule_cpw: $300/30 = $10 |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create capsule end to end | 1. Enter name, 2. Select season, 3. Pick items, 4. Save | Capsule saved, appears in list with thumbnail grid |
| Suggestion scoring reflects wear data | 1. Create items with varying wear counts, 2. Start capsule builder | Items with higher wear counts rank higher in suggestions |
| Edit existing capsule | 1. View capsule, 2. Tap Edit, 3. Add/remove items, 4. Save | Capsule updated, counts and stats recalculated |
| Item deleted from catalog | 1. Create capsule with item X, 2. Delete item X from catalog, 3. View capsule | Item X removed from capsule, count decremented |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| Minimalist builds spring capsule | 1. Create "Spring 2026 Capsule", 2. Review suggestions, 3. Select 33 items, 4. Save, 5. View outfit potential | 33-item capsule saved, outfit potential calculated, rest items visible |
| User compares seasonal capsules | 1. Build spring capsule, 2. Build summer capsule, 3. View capsule list | Both capsules shown with separate item counts and thumbnail previews |

---

### CL-015: Color Palette Analysis

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | CL-015 |
| **Feature Name** | Color Palette Analysis |
| **Priority** | P2 |
| **Category** | Analytics |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a fashion-conscious planner, I want to see the color distribution of my wardrobe as a visual palette, so that I can identify dominant colors, gaps, and redundancies in my collection.

**Secondary:**
> As a minimalist dresser, I want to know what percentage of my wardrobe is neutral vs statement colors, so that I can maintain a versatile, mixable wardrobe.

**Tertiary:**
> As a budget-minded shopper, I want color analysis to inform my next purchase, so that I buy colors that complement my existing wardrobe rather than duplicating what I already have.

#### 3.3 Detailed Description

Color Palette Analysis provides a visual breakdown of the user's wardrobe by color distribution. The feature aggregates color data from all items in the Wardrobe Catalog (CL-001) and presents it as an interactive visualization: a donut chart showing color proportions, a ranked list of colors by frequency, and optional filtering to see color distribution by category (e.g., "80% of your tops are black or white") or by season.

The analysis surface three key insights:

1. **Dominant Colors:** The top 3-5 colors in the wardrobe, with percentage breakdowns. Users can see at a glance whether their wardrobe is neutral-heavy, color-heavy, or balanced.

2. **Color Gaps:** Colors that are underrepresented compared to a balanced wardrobe benchmark. If the user's wardrobe is 60% black and has zero greens, the gap analysis highlights this.

3. **Color Harmony Assessment:** A simple evaluation of how well the wardrobe's colors work together, based on color theory (complementary, analogous, monochromatic). This helps users understand whether their wardrobe "flows" as a cohesive collection.

The feature also supports a "What Color Should I Buy Next?" recommendation. Based on existing color distribution and color theory, the system suggests 2-3 colors that would complement the current wardrobe. This connects naturally to the Shopping Wishlist (CL-013) by pre-filling a color filter when the user decides to act on the recommendation.

All analysis runs locally using the color metadata entered during item creation (CL-001). No image analysis or network activity is involved. The feature relies entirely on the user-assigned color values.

#### 3.4 Prerequisites

**Feature Dependencies:**
- CL-001: Wardrobe Catalog - Items with color metadata
- CL-002: Category and Tag Organization - Category data for per-category color breakdowns

**External Dependencies:**
- None (fully offline, uses structured color data from catalog entries)

**Assumed Capabilities:**
- Local database can aggregate color counts efficiently
- Color rendering (displaying color swatches) is supported on the platform

#### 3.5 User Interface Requirements

##### Screen: Color Analysis Dashboard

**Layout:**
- Accessible from the analytics tab or a "Colors" card on the module dashboard
- At the top: a donut chart showing color proportions. Each segment is colored with the actual color it represents. Tapping a segment highlights it and shows the count and percentage. The center of the donut shows the total item count.
- Below the donut chart: a filter bar with toggles for "All Items", "By Category" (dropdown: Tops, Bottoms, etc.), and "By Season" (dropdown: Spring, Summer, Fall, Winter)
- Below the filter bar: a "Top Colors" ranked list showing each color as a horizontal bar with:
  - A color swatch (circle)
  - Color name
  - Item count
  - Percentage of total (e.g., "Black - 28 items - 22%")
  - The bar width proportional to the count
- Below the ranked list: a "Color Gaps" section showing 2-3 colors that are underrepresented with a suggestion message (e.g., "Consider adding olive or burgundy to diversify your palette")
- At the bottom: a "Color Harmony" card showing the wardrobe's harmony type (e.g., "Predominantly Neutral with Earth Tone Accents") and a brief explanation

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No items in wardrobe or no color data | "Add items with color data to see your palette analysis" message |
| Loaded | Color data available | Full analysis dashboard |
| Single Color | All items are the same color | Donut shows one segment at 100%, gap analysis highlights diversity opportunity |
| Filtered | Category or season filter active | Chart and list update to reflect filtered subset; filter label shown |

**Interactions:**
- Tap donut segment: Highlight the segment, show count and percentage in a tooltip
- Tap color bar in ranked list: Navigate to a filtered view of the Wardrobe Catalog showing only items of that color
- Tap filter toggle (Category/Season): Update the chart and list for the selected filter
- Tap "Color Gaps" suggestion: Navigate to Shopping Wishlist (CL-013) with the suggested color pre-selected as a filter hint
- Scroll: Standard vertical scroll for the full dashboard

**Transitions/Animations:**
- Donut chart animates in with a clockwise fill, 500ms total
- Color bars animate in from the left with staggered timing, 100ms between bars
- Filter changes crossfade the chart, 200ms
- Segment highlight scales up slightly with a bounce, 150ms

#### 3.6 Data Requirements

This feature does not introduce new persistent entities. It operates as a read-only aggregation layer over the existing ClothingItem color data from CL-001.

##### Computed View: ColorDistribution (in-memory, not persisted)

| Field | Type | Description |
|-------|------|-------------|
| color_name | string | The color value (e.g., "Black", "Navy") |
| hex_value | string | Hex color code for rendering (e.g., "#000000") |
| item_count | integer | Number of items with this color |
| percentage | float | Percentage of total items (0.0 to 100.0) |
| category_breakdown | object | Optional: counts per category for this color |

##### Reference: Standard Color Map

| Color Name | Hex Value | Category |
|------------|-----------|----------|
| Black | #000000 | Neutral |
| White | #FFFFFF | Neutral |
| Gray | #808080 | Neutral |
| Navy | #000080 | Neutral |
| Beige | #F5F5DC | Neutral |
| Cream | #FFFDD0 | Neutral |
| Brown | #8B4513 | Neutral |
| Olive | #808000 | Earth Tone |
| Burgundy | #800020 | Earth Tone |
| Tan | #D2B48C | Earth Tone |
| Red | #FF0000 | Bold |
| Blue | #0000FF | Bold |
| Green | #008000 | Bold |
| Yellow | #FFD700 | Bold |
| Pink | #FFC0CB | Bold |
| Purple | #800080 | Bold |
| Orange | #FFA500 | Bold |
| Teal | #008080 | Bold |
| Coral | #FF7F50 | Bold |
| Multicolor | #GRADIENT | Special |

**Validation Rules:**
- Items with no color set are excluded from the analysis
- Items with multiple colors contribute one count per color (e.g., an item tagged "Black" and "White" counts once for each)
- Percentages are calculated as: (items_with_color / total_color_assignments) * 100, rounded to 1 decimal place

**Example Data:**

```
[
  { "color_name": "Black", "hex_value": "#000000", "item_count": 28, "percentage": 22.0 },
  { "color_name": "White", "hex_value": "#FFFFFF", "item_count": 18, "percentage": 14.2 },
  { "color_name": "Navy", "hex_value": "#000080", "item_count": 15, "percentage": 11.8 },
  { "color_name": "Gray", "hex_value": "#808080", "item_count": 12, "percentage": 9.4 },
  { "color_name": "Brown", "hex_value": "#8B4513", "item_count": 8, "percentage": 6.3 }
]
```

#### 3.7 Business Logic Rules

##### Color Distribution Calculation

**Purpose:** Aggregate color data across all wardrobe items and produce a ranked distribution.

**Inputs:**
- items: list of ClothingItem (optionally filtered by category or season)

**Logic:**

```
1. Filter items to those with at least one color assigned
2. For each item, extract its color(s) (multi-color items contribute to each color's count)
3. Group by color_name, count occurrences
4. total_assignments = SUM of all color counts (may exceed item count due to multi-color items)
5. For each color:
   percentage = (color_count / total_assignments) * 100, rounded to 1 decimal
6. Sort by item_count descending
7. RETURN list of ColorDistribution records
```

**Edge Cases:**
- All items are the same color: One segment at 100%
- Items with no color: Excluded from analysis (not counted in total)
- Multi-color items: Counted once per assigned color (an item with Black + White adds 1 to Black and 1 to White)

##### Color Gap Detection

**Purpose:** Identify colors that would diversify the wardrobe palette.

**Inputs:**
- distribution: list of ColorDistribution
- standard_colors: the 20 standard colors from the color map

**Logic:**

```
1. Identify colors from standard_colors with 0 items as "missing colors"
2. Identify colors with item_count < 2% of total items as "underrepresented colors"
3. Classify the wardrobe's dominant profile:
   - neutral_percentage = SUM(percentage) for Neutral category colors
   - bold_percentage = SUM(percentage) for Bold category colors
   - earth_percentage = SUM(percentage) for Earth Tone category colors
4. IF neutral_percentage > 70%: suggest 1-2 Bold or Earth Tone colors
5. IF bold_percentage > 50%: suggest 1-2 Neutral colors for balance
6. IF the wardrobe has fewer than 5 distinct colors: suggest 2-3 colors for variety
7. RETURN { missing: list, underrepresented: list, suggestions: list of 2-3 colors }
```

**Edge Cases:**
- Only 1 item in wardrobe: Gap detection returns "Add more items for meaningful color analysis"
- All 20 colors represented: No missing colors; suggestions focus on balance ("Your palette is well-diversified")
- Custom hex colors not in standard map: Grouped under "Other" for analysis purposes

##### Color Harmony Classification

**Purpose:** Classify the wardrobe's overall color harmony style.

**Inputs:**
- distribution: list of ColorDistribution (top 5 colors)

**Logic:**

```
1. Extract the top 5 colors by item_count
2. Classify:
   - IF 4+ of top 5 are Neutral: "Predominantly Neutral"
   - IF 3+ of top 5 are Bold: "Bold and Expressive"
   - IF 3+ of top 5 are Earth Tone: "Earthy and Natural"
   - IF top 5 includes a mix of Neutral + Bold: "Neutral Base with Color Accents"
   - IF top 5 includes a mix of Neutral + Earth Tone: "Neutral Base with Earth Tone Accents"
   - ELSE: "Eclectic Mix"
3. Generate a brief description (1-2 sentences) explaining the harmony type
4. RETURN { harmony_type: string, description: string }
```

**Edge Cases:**
- Fewer than 5 distinct colors: Classify based on available colors
- Tie in counts: Use alphabetical order as tiebreaker for classification purposes

**Sort/Filter/Ranking Logic:**
- **Default sort for color list:** Item count descending (most common first)
- **Filter options:** All Items, By Category, By Season
- **Donut chart segment order:** Largest segment first (clockwise from top)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No items have color data | "Add color data to your items to see palette analysis" message | User edits items to add colors |
| Database aggregation fails | "Could not load color analysis. Please try again." with retry button | User retries |
| Filter returns zero items | "No [category/season] items have color data" message | User selects a different filter or adds color data |
| Only 1 item in wardrobe | Show basic color display with message: "Add more items for detailed analysis" | User adds more items |

**Validation Timing:**
- Color aggregation runs on screen load
- Filter changes trigger a re-aggregation (debounced at 300ms)
- Gap detection runs after distribution is calculated

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 100 items with color data,
   **When** the user opens the Color Analysis Dashboard,
   **Then** a donut chart shows color proportions, and a ranked list shows all colors sorted by item count with percentages.

2. **Given** the user's wardrobe is 60% black and white with no green or orange items,
   **When** the gap analysis runs,
   **Then** the Color Gaps section shows "Missing: Green, Orange" and suggests "Consider adding green or orange to diversify your palette."

3. **Given** the user taps the "Tops" category filter,
   **When** the dashboard updates,
   **Then** the donut chart and list reflect only the color distribution of items in the "Tops" category.

4. **Given** the user's top 5 colors are Black (30%), White (20%), Gray (15%), Navy (10%), Beige (8%),
   **When** the Color Harmony card renders,
   **Then** it shows "Predominantly Neutral" with a description explaining the neutral-heavy palette.

**Edge Cases:**

5. **Given** all items are tagged "Black",
   **When** the analysis runs,
   **Then** the donut chart shows one segment at 100%, and gaps suggest adding any non-black color.

6. **Given** an item has two colors (Black and White),
   **When** the distribution is calculated,
   **Then** both Black and White counts increment by 1 each.

**Negative Tests:**

7. **Given** no items in the wardrobe have color data,
   **When** the user opens Color Analysis,
   **Then** the screen shows "Add color data to your items to see palette analysis",
   **And** no chart or list is rendered.

8. **Given** only 1 item exists in the wardrobe,
   **When** the user opens Color Analysis,
   **Then** the basic color is shown with the message "Add more items for detailed analysis",
   **And** no gap detection or harmony classification is performed.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates color percentages correctly | Black: 28, White: 18, total: 127 | Black: 22.0%, White: 14.2% |
| handles multi-color items | item with [Black, White] | Black count +1, White count +1 |
| excludes items with no color | 10 items, 3 without color | analysis uses 7 items |
| detects missing colors | wardrobe has Black, White, Gray only | missing includes Red, Blue, Green, etc. |
| detects underrepresented colors | Red: 1 out of 127 items (0.8%) | Red in underrepresented list |
| classifies neutral-heavy harmony | top 5: Black, White, Gray, Navy, Beige | harmony: "Predominantly Neutral" |
| classifies bold-heavy harmony | top 5: Red, Blue, Green, Yellow, Black | harmony: "Bold and Expressive" |
| classifies mixed harmony | top 5: Black, White, Red, Blue, Brown | harmony: "Neutral Base with Color Accents" |
| suggests bold colors for neutral wardrobes | neutral: 75%, bold: 10%, earth: 15% | suggests 1-2 Bold colors |
| handles single-color wardrobe | all items: Black | 100% Black, suggests any other color |
| returns empty for no color data | 0 items with color | empty result with message |
| sorts by count descending | Black: 28, White: 18, Navy: 15 | order: Black, White, Navy |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full analysis with filters | 1. Open analysis, 2. View all items, 3. Filter by Tops, 4. Filter by Winter | Chart updates for each filter, counts change |
| Tap color bar to view items | 1. Open analysis, 2. Tap "Black" bar | Wardrobe Catalog opens filtered to Black items only |
| Gap suggestion to wishlist | 1. View gap suggestions, 2. Tap "Consider adding olive" | Shopping Wishlist opens (if CL-013 enabled) |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User audits wardrobe colors | 1. Open Color Analysis, 2. Review donut chart, 3. Check gaps, 4. Read harmony | Full understanding of wardrobe color composition, actionable gap suggestions |
| User discovers neutral dominance | 1. View analysis showing 80% neutrals, 2. See "add color" suggestion, 3. Add suggested color to wishlist | Wishlist has a new entry for a suggested color category |

---

### CL-016: Style Board / Mood Board

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | CL-016 |
| **Feature Name** | Style Board / Mood Board |
| **Priority** | P2 |
| **Category** | Data Management |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a fashion-conscious planner, I want to create themed mood boards by saving inspiration images from my camera roll, so that I can capture and organize style ideas alongside my wardrobe.

**Secondary:**
> As a budget-minded shopper, I want to attach wardrobe items to a mood board, so that I can see which items I already own that match my style goals and which pieces are missing.

**Tertiary:**
> As a minimalist dresser, I want to define a target aesthetic for each season, so that my capsule wardrobe and new purchases align with a cohesive vision.

#### 3.3 Detailed Description

The Style Board feature gives users a visual canvas to collect and organize fashion inspiration. Each style board is a named collection of images (imported from the device photo library or camera) and optional references to existing wardrobe items. Boards serve as mood boards for seasonal planning, event preparation, or general style exploration.

Users create boards with a name, optional description, and optional season or occasion tag. They add inspiration images by importing photos, and they can link existing wardrobe items from the catalog (CL-001) to show which pieces they already own that match the board's theme. This linkage surfaces a "coverage" metric: if a board has 10 inspiration looks and the user owns items matching 6 of them, the coverage is 60%.

Style boards are a planning and visualization tool. They do not modify wardrobe data, outfit data, or any other module state. They are purely additive and informational.

The feature does not involve any network activity. All images are imported from the local photo library and stored on-device. No image search, no Pinterest integration, no cloud sync. This aligns with the privacy-first philosophy.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (style boards are a standalone planning feature)

**External Dependencies:**
- Photo library access for importing inspiration images
- Local file system storage for board images

**Assumed Capabilities:**
- User can navigate between screens via the module tab bar
- Local database is initialized and writable
- File system has sufficient storage for images (similar to CL-001 photo storage)

#### 3.5 User Interface Requirements

##### Screen: Board List

**Layout:**
- Accessible from the module dashboard as a "Style Boards" card or from a dedicated section
- The screen has a top navigation bar showing "Style Boards" as the title, with a "+" button on the right
- The main content area is a vertical list of board cards displayed in a masonry or standard grid layout (2 columns)
- Each board card shows: a hero image (the first image added to the board), board name (overlaid on the bottom of the hero image with a semi-transparent background), image count badge (e.g., "12 images"), and season/occasion tag (if set)
- Tapping a board card navigates to the Board Detail screen

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty | No boards exist | Centered illustration of a collage/moodboard, heading "Create your first style board", subtext "Collect inspiration images and match them to your wardrobe", "Create Board" button |
| Populated | 1 or more boards exist | Grid of board cards |

**Interactions:**
- Tap board card: Navigate to Board Detail
- Long press board card: Show context menu (Edit Name, Duplicate, Delete)
- Tap "+": Open Create Board modal
- Swipe left on card: Reveal "Delete" action

**Transitions/Animations:**
- Cards enter with staggered fade-up, 100ms between cards
- Deleted cards shrink and fade, 200ms

##### Modal: Create Board

**Layout:**
- Bottom sheet modal with:
  - Board Name (text input, required, placeholder: "e.g., Summer Boho Vibes")
  - Description (multiline text input, optional, placeholder: "What is this board about?")
  - Season (optional picker: Spring, Summer, Fall, Winter, None)
  - Occasion (optional picker: Casual, Work, Formal, Active, Date Night, Travel, None)
  - "Create" button

**Interactions:**
- Tap "Create": Validate name, create board, navigate to the new Board Detail screen
- Tap outside modal: Dismiss if no changes; confirm discard if name is entered

##### Screen: Board Detail

**Layout:**
- Full-screen with back button and "Edit" (kebab menu) in the top bar
- Board name as the heading, description below (if set), season/occasion tag badges
- A "Coverage" indicator showing how many board images have linked wardrobe items (e.g., "4 of 10 looks matched - 40% coverage")
- Below the coverage indicator: a masonry grid of images. Each image card shows:
  - The inspiration image
  - An optional overlay icon if a wardrobe item is linked (small closet icon in the corner)
  - Tapping opens the Image Detail view
- At the bottom: two action buttons:
  - "Add Image" (opens photo library picker, allows multi-select up to 20 images per batch)
  - "Link Item" (opens a picker to associate a wardrobe item with the currently selected board image)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Empty Board | Board created but no images added | "Add your first inspiration image" message with camera icon, "Add Image" button |
| Populated | 1 or more images added | Masonry grid of images |
| High Coverage | 80%+ of images have linked items | Green coverage indicator: "Great match! 80% coverage" |
| Low Coverage | < 30% of images have linked items | Neutral coverage indicator: "4 of 14 looks matched - 29% coverage" |

**Interactions:**
- Tap image: Open full-screen Image Detail with linked item information
- Long press image: Show context menu (Link/Unlink Item, Set as Cover, Delete)
- Tap "Add Image": Open photo library multi-select picker
- Tap "Link Item": Show a bottom sheet with the wardrobe catalog grid; tapping an item links it to the selected board image
- Pinch-to-zoom on image: Zoom into the inspiration image (standard photo viewer behavior)

**Transitions/Animations:**
- New images appear with a scale-up from center animation, 200ms
- Coverage indicator animates the percentage fill, 400ms
- Linked item icon fades in on the image card, 150ms

##### Screen: Image Detail

**Layout:**
- Full-screen photo viewer with the inspiration image centered
- Below the image: a "Linked Items" section showing thumbnails of any wardrobe items linked to this image (tappable, navigates to item detail)
- If no items linked: "No wardrobe items linked. Tap 'Link Item' to match this look." message
- Action bar at the bottom: "Link Item", "Set as Cover", "Delete Image"

**Interactions:**
- Tap linked item thumbnail: Navigate to ClothingItem detail (CL-001)
- Tap "Link Item": Open wardrobe catalog picker
- Tap "Delete Image": Confirm and delete
- Swipe left/right: Navigate to previous/next image in the board

#### 3.6 Data Requirements

##### Entity: StyleBoard

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| name | string | Required, max 255 chars | None | Board name |
| description | string | Optional, max 1000 chars | null | Board description |
| season | enum | Optional, one of: spring, summer, fall, winter, null | null | Season association |
| occasion | enum | Optional, one of: casual, work, formal, active, date_night, travel, null | null | Occasion association |
| cover_image_id | string | Optional, references BoardImage.id | null | ID of the image used as the board cover |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

##### Entity: BoardImage

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| board_id | string | Required, references StyleBoard.id | None | Parent board |
| photo_path | string | Required, max 1024 chars | None | Local file path to the image |
| sort_order | integer | Min: 0 | 0 | Display order within the board |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |

##### Entity: BoardImageItemLink (join table)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key, auto-generated UUID | Auto | Unique identifier |
| board_image_id | string | Required, references BoardImage.id | None | The inspiration image |
| item_id | string | Required, references ClothingItem.id | None | The linked wardrobe item |
| created_at | datetime | Auto-set on creation | Current timestamp | Record creation time |

**Relationships:**
- StyleBoard has many BoardImage (one-to-many via board_id)
- BoardImage has many ClothingItem through BoardImageItemLink (many-to-many)
- StyleBoard optionally references BoardImage via cover_image_id (one-to-one, nullable)

**Indexes:**
- BoardImage: board_id - Fast lookup of images in a board
- BoardImage: (board_id, sort_order) - Ordered retrieval
- BoardImageItemLink: board_image_id - Fast lookup of linked items for an image
- BoardImageItemLink: (board_image_id, item_id) - Unique composite, prevent duplicate links
- StyleBoard: created_at - Sort boards by creation date

**Validation Rules:**
- name must not be empty after trimming whitespace
- photo_path must reference a valid local file
- Duplicate (board_image_id, item_id) pairs in BoardImageItemLink are rejected
- A board can hold a maximum of 100 images
- Each image can be linked to a maximum of 20 wardrobe items

**Example Data:**

```
StyleBoard:
{
  "id": "sb001-uuid",
  "name": "Summer Boho Vibes",
  "description": "Relaxed, flowy pieces with earth tones",
  "season": "summer",
  "occasion": "casual",
  "cover_image_id": "bi001-uuid",
  "created_at": "2026-03-01T14:00:00Z",
  "updated_at": "2026-03-01T14:30:00Z"
}

BoardImage:
{
  "id": "bi001-uuid",
  "board_id": "sb001-uuid",
  "photo_path": "/photos/boards/bi001.jpg",
  "sort_order": 0,
  "created_at": "2026-03-01T14:05:00Z"
}

BoardImageItemLink:
{
  "id": "bil001-uuid",
  "board_image_id": "bi001-uuid",
  "item_id": "f47ac10b-uuid",
  "created_at": "2026-03-01T14:10:00Z"
}
```

#### 3.7 Business Logic Rules

##### Coverage Calculation

**Purpose:** Calculate what percentage of a board's images have at least one linked wardrobe item.

**Inputs:**
- board_images: list of BoardImage for a given board
- links: list of BoardImageItemLink

**Logic:**

```
1. total_images = COUNT(board_images)
2. IF total_images = 0: RETURN { coverage: 0, matched: 0, total: 0 }
3. matched_images = COUNT of board_images where at least one BoardImageItemLink exists
4. coverage_percentage = (matched_images / total_images) * 100, rounded to nearest integer
5. RETURN { coverage: coverage_percentage, matched: matched_images, total: total_images }
```

**Formulas:**
- `coverage = (images_with_linked_items / total_images) * 100`

**Edge Cases:**
- Board has 0 images: Coverage is 0%, display "Add images to start"
- All images have linked items: Coverage is 100%
- An image has multiple linked items: Still counts as 1 matched image (not double-counted)

##### Image Limit Enforcement

**Purpose:** Prevent boards from exceeding the 100-image limit.

**Inputs:**
- board_id: string
- new_image_count: integer (number of images being added in this batch)
- current_image_count: integer

**Logic:**

```
1. remaining_capacity = 100 - current_image_count
2. IF new_image_count > remaining_capacity:
   a. IF remaining_capacity > 0: Allow adding up to remaining_capacity images, warn user
   b. IF remaining_capacity = 0: Block addition entirely
3. RETURN { allowed_count: MIN(new_image_count, remaining_capacity), blocked: remaining_capacity <= 0 }
```

**Edge Cases:**
- User selects 25 images when only 10 slots remain: Import first 10, show "Imported 10 of 25 images. Board limit is 100 images."
- Board already at 100: Show "This board is full (100 images). Delete some images to add new ones."

**Sort/Filter/Ranking Logic:**
- **Board list sort:** Most recently updated first
- **Images within a board:** By sort_order ascending (user can reorder via drag-and-drop in future version)
- **Board filter options:** By season, by occasion

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Photo library permission denied | "Enable photo library access to add inspiration images" with settings link | User grants permission |
| Image file cannot be saved (storage full) | "Could not save image. Free up storage and try again." | User frees storage |
| Board save fails | "Could not save style board. Please try again." toast | User retries |
| Image file missing (deleted externally) | Placeholder shown in grid with "Image not found" label | User deletes the missing entry or re-adds the image |
| Linked wardrobe item deleted | Link silently removed; coverage recalculated | Coverage updates automatically |
| Board at 100-image limit | "This board is full (100 images). Delete some to add more." | User deletes images |

**Validation Timing:**
- Board name is validated on create/save
- Image limit is checked before import begins
- Coverage is recalculated on board detail screen load

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has no style boards,
   **When** the user taps "+" and creates "Summer Boho Vibes" with season "Summer",
   **Then** the board appears in the Board List with its name and an empty state on the detail screen.

2. **Given** the user opens a board and adds 5 inspiration images from the photo library,
   **When** the images are imported,
   **Then** all 5 images appear in the masonry grid, and the coverage indicator shows "0 of 5 looks matched - 0%."

3. **Given** the user links a wardrobe item to 3 of 5 board images,
   **When** the coverage updates,
   **Then** the coverage indicator shows "3 of 5 looks matched - 60%."

4. **Given** the user long-presses an image and selects "Set as Cover",
   **When** the user returns to the Board List,
   **Then** the board card shows the selected image as the hero/cover image.

**Edge Cases:**

5. **Given** a board has 95 images and the user tries to add 10 more,
   **When** the import runs,
   **Then** only 5 images are imported, and the user sees "Imported 5 of 10 images. Board limit is 100 images."

6. **Given** a linked wardrobe item is deleted from the catalog,
   **When** the user views the board,
   **Then** the link is removed silently, and coverage is recalculated without the deleted item.

**Negative Tests:**

7. **Given** the user attempts to create a board with no name,
   **When** the create is triggered,
   **Then** an inline error "Name is required" appears,
   **And** the board is not created.

8. **Given** photo library permission is denied,
   **When** the user taps "Add Image",
   **Then** a prompt says "Enable photo library access to add inspiration images" with a link to device settings,
   **And** no images are imported.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| calculates coverage with no images | 0 images | coverage: 0% |
| calculates coverage with no links | 5 images, 0 links | coverage: 0% |
| calculates coverage with partial links | 5 images, 3 with links | coverage: 60% |
| calculates coverage at 100% | 10 images, all linked | coverage: 100% |
| multi-linked image counts once | 1 image with 3 linked items | matched: 1 (not 3) |
| enforces 100-image limit | current: 95, adding: 10 | allowed: 5, warned |
| blocks addition at limit | current: 100, adding: 1 | allowed: 0, blocked |
| validates board name required | name: "" | validation error |
| validates board name whitespace | name: "   " | validation error |
| rejects duplicate image-item link | existing link for (img1, item1) | rejection error |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Create board and add images | 1. Create board, 2. Add 5 images, 3. View board | Board shows 5 images in grid |
| Link item and verify coverage | 1. Add images, 2. Link an item to 1 image, 3. Check coverage | Coverage shows "1 of X matched" |
| Delete linked item from catalog | 1. Link item to board image, 2. Delete item from wardrobe, 3. View board | Link removed, coverage recalculated |
| Set cover image | 1. Add images, 2. Long-press, set as cover, 3. View board list | Board card shows the selected cover image |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User creates seasonal mood board | 1. Create "Fall 2026 Vibes" board, 2. Add 8 inspiration images, 3. Link 3 wardrobe items, 4. Review coverage | Board saved with 8 images, 37.5% coverage, linked items visible |
| User plans purchases from board gaps | 1. View board with 20% coverage, 2. Identify unmatched looks, 3. Add missing pieces to wishlist (CL-013) | Wishlist has new entries inspired by the unmatched board images |

---

### CL-017: Data Export (CSV/JSON)

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | CL-017 |
| **Feature Name** | Data Export (CSV/JSON) |
| **Priority** | P1 |
| **Category** | Import/Export |
| **Estimated Complexity** | Low |

#### 3.2 User Stories

**Primary:**
> As a privacy-conscious user, I want to export all my wardrobe data in a standard format (CSV or JSON), so that I own my data and can take it to another app at any time.

**Secondary:**
> As a minimalist dresser, I want to export my wardrobe catalog to a spreadsheet, so that I can analyze my clothing collection outside the app or share it with a personal stylist.

**Tertiary:**
> As a budget-minded shopper, I want to export my cost-per-wear data as a CSV, so that I can track clothing ROI in my personal finance tools.

#### 3.3 Detailed Description

Data Export provides users with the ability to export all MyCloset data in two standard formats: CSV (for spreadsheet compatibility) and JSON (for data portability and developer use). This feature is a core component of the MyLife privacy promise: users own their data and can take it with them at any time.

The export covers all major data types: wardrobe items (with all metadata), outfits (with item references), wear logs, wishlist items, capsule wardrobe configurations, and style boards (metadata only; photos are exported as file references, not embedded in the export file).

Users can choose to export everything at once ("Full Export") or export specific data types individually. Each export generates a file that is saved to the device's file system or shared via the device share sheet (allowing AirDrop, email, cloud drive upload, or any sharing target the user chooses).

CSV exports produce one file per entity type (e.g., `closet-items.csv`, `closet-outfits.csv`, `closet-wear-logs.csv`). JSON exports produce a single file containing all selected data in a structured format.

Export runs entirely on-device. No data is transmitted to any server. The file is generated locally and stays on the device unless the user explicitly shares it.

#### 3.4 Prerequisites

**Feature Dependencies:**
- CL-001: Wardrobe Catalog - Source data for item export

**External Dependencies:**
- File system access for saving export files
- Device share sheet for sharing exported files

**Assumed Capabilities:**
- Local database is readable
- CSV and JSON serialization are available
- Share sheet is available on the platform

#### 3.5 User Interface Requirements

##### Screen: Export Screen

**Layout:**
- Accessible from Settings (CL-018) under a "Data" section, or from the module dashboard
- The screen has a top navigation bar showing "Export Data" as the title
- A brief explanation at the top: "Export your wardrobe data in CSV or JSON format. Your data stays on your device unless you choose to share it."
- Format selector: two large option cards side by side:
  - "CSV" card: icon of a spreadsheet, subtitle "Best for spreadsheets and analysis"
  - "JSON" card: icon of a code bracket, subtitle "Best for data portability and backups"
- Below the format selector: a checklist of data types to export:
  - Wardrobe Items (with item count, e.g., "127 items")
  - Outfits (with count)
  - Wear Logs (with count)
  - Wishlist Items (with count)
  - Capsule Wardrobes (with count)
  - Style Boards (metadata only, with count)
  - All checkboxes are checked by default
- Below the checklist: an "Export" button (prominent, primary style)
- Below the export button: a note "Photos are not included in the export file. Only photo file paths are exported."

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Ready | Data types listed with counts | Normal checklist view, export button enabled |
| No Data | All data types have 0 items | "Nothing to export yet. Add items to your wardrobe first." with export button disabled |
| Exporting | Export in progress | Progress indicator: "Exporting... [data type being processed]" |
| Complete | Export file generated | Success screen: "Export complete! [file size]" with "Share" and "Done" buttons |
| Error | Export failed | Error message with retry button |

**Interactions:**
- Tap format card: Select CSV or JSON (radio-style selection)
- Tap checkbox: Toggle inclusion of that data type
- Tap "Export": Generate the export file
- Tap "Share" (on success): Open the device share sheet with the export file
- Tap "Done": Return to the previous screen

**Transitions/Animations:**
- Format selection highlights with a border-color transition, 150ms
- Progress indicator shows a linear progress bar
- Success state animates in with a checkmark scale-up, 300ms

#### 3.6 Data Requirements

This feature does not introduce new persistent entities. It reads from all existing entities (ClothingItem, Outfit, OutfitItem, WearLog, WearLogItem, WishlistItem, CapsuleWardrobe, CapsuleItem, StyleBoard, BoardImage) and produces output files.

##### CSV Output Schema: closet-items.csv

| Column | Source Field | Format |
|--------|-------------|--------|
| id | ClothingItem.id | UUID string |
| name | ClothingItem.name | Text |
| brand | ClothingItem.brand | Text |
| category | ClothingItem.category | Text |
| subcategory | ClothingItem.subcategory | Text |
| colors | ClothingItem.colors | Comma-separated list |
| size | ClothingItem.size | Text |
| seasons | ClothingItem.seasons | Comma-separated list |
| occasions | ClothingItem.occasions | Comma-separated list |
| purchase_price | ClothingItem.purchase_price | Decimal (2 places) |
| purchase_date | ClothingItem.purchase_date | YYYY-MM-DD |
| condition | ClothingItem.condition | Text |
| status | ClothingItem.status | Text |
| times_worn | ClothingItem.times_worn | Integer |
| last_worn_date | ClothingItem.last_worn_date | YYYY-MM-DD |
| cost_per_wear | Computed | Decimal (2 places) or "N/A" |
| notes | ClothingItem.notes | Text |
| photo_path | ClothingItem.photo_path | File path |
| created_at | ClothingItem.created_at | ISO 8601 |

##### CSV Output Schema: closet-outfits.csv

| Column | Source Field | Format |
|--------|-------------|--------|
| id | Outfit.id | UUID string |
| name | Outfit.name | Text |
| item_ids | OutfitItem.item_id | Comma-separated UUIDs |
| occasion | Outfit.occasion | Text |
| season | Outfit.season | Text |
| times_worn | Computed from WearLog | Integer |
| created_at | Outfit.created_at | ISO 8601 |

##### CSV Output Schema: closet-wear-logs.csv

| Column | Source Field | Format |
|--------|-------------|--------|
| id | WearLog.id | UUID string |
| date | WearLog.date | YYYY-MM-DD |
| outfit_id | WearLog.outfit_id | UUID string or empty |
| item_ids | WearLogItem.item_id | Comma-separated UUIDs |
| notes | WearLog.notes | Text |

##### JSON Output Structure

```
{
  "export_version": "1.0",
  "exported_at": "2026-03-07T12:00:00Z",
  "module": "closet",
  "data": {
    "items": [ { ...ClothingItem fields... } ],
    "outfits": [ { ...Outfit fields with nested items... } ],
    "wear_logs": [ { ...WearLog fields with nested items... } ],
    "wishlist": [ { ...WishlistItem fields... } ],
    "capsules": [ { ...CapsuleWardrobe fields with nested item IDs... } ],
    "style_boards": [ { ...StyleBoard fields with nested image metadata... } ]
  }
}
```

**Validation Rules:**
- At least one data type must be checked for export
- CSV files use UTF-8 encoding with BOM for Excel compatibility
- Text fields containing commas are wrapped in double quotes in CSV output
- Null values are exported as empty strings in CSV and null in JSON
- Dates use ISO 8601 format consistently
- Photo paths are exported as-is (local file paths); a note in the export header explains this

#### 3.7 Business Logic Rules

##### Export File Generation

**Purpose:** Generate export files in the selected format for the selected data types.

**Inputs:**
- format: "csv" or "json"
- selected_types: list of data types to include
- all_data: access to local database

**Logic:**

```
1. Validate at least one data type is selected
2. IF format = "csv":
   a. For each selected data type:
      - Query all records of that type
      - Generate a CSV file with headers and rows
      - File naming: "closet-[type]-[YYYY-MM-DD].csv" (e.g., "closet-items-2026-03-07.csv")
   b. IF multiple files: Package into a ZIP archive named "closet-export-[YYYY-MM-DD].zip"
   c. IF single file: Use the CSV file directly
3. IF format = "json":
   a. Query all records for each selected data type
   b. Build a single JSON object with the export structure
   c. File naming: "closet-export-[YYYY-MM-DD].json"
4. Calculate file size
5. RETURN { file_path, file_size, file_count }
```

**Formulas:**
- `cost_per_wear = purchase_price / times_worn` (exported as computed column in CSV; "N/A" if times_worn = 0 or purchase_price is null)

**Edge Cases:**
- Large wardrobe (1000+ items): Export may take several seconds; show progress indicator
- Items with special characters in text fields (commas, quotes, newlines): CSV escaping per RFC 4180
- Null dates: Exported as empty string in CSV, null in JSON
- Multi-color or multi-season fields: Joined with commas in CSV, arrays in JSON

**Sort/Filter/Ranking Logic:**
- **Export order:** Items sorted by created_at ascending (oldest first)
- **No filtering applied:** Export always includes all records of the selected types

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| No data to export | "Nothing to export yet. Add items to your wardrobe first." with export button disabled | User adds items |
| File system write fails (storage full) | "Could not save export file. Free up storage and try again." | User frees storage |
| Export generation fails mid-process | "Export failed. Please try again." with retry button | User retries; partial files are cleaned up |
| Share sheet cancelled | Export file is retained; user can tap "Share" again | User taps "Share" or "Done" |
| Database read error during export | "Could not read your data. Please try again." | User retries |

**Validation Timing:**
- Data type counts are calculated on screen load
- Export button is disabled if no types are selected or all counts are 0
- File generation begins on "Export" tap

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has 50 wardrobe items, 10 outfits, and 30 wear logs,
   **When** the user selects "JSON" format with all types checked and taps "Export",
   **Then** a single JSON file is generated containing all 50 items, 10 outfits, and 30 wear logs, with the correct export structure.

2. **Given** the user selects "CSV" format with only "Wardrobe Items" checked,
   **When** the user taps "Export",
   **Then** a single CSV file (`closet-items-2026-03-07.csv`) is generated with 50 rows (plus header), and the share sheet opens.

3. **Given** the user selects "CSV" format with 3 data types checked,
   **When** the export completes,
   **Then** a ZIP archive containing 3 CSV files is generated, and the success screen shows the total file size.

4. **Given** the user has items with purchase prices and wear counts,
   **When** the CSV export is generated,
   **Then** the `cost_per_wear` column shows the computed value (purchase_price / times_worn) rounded to 2 decimal places, or "N/A" for items with 0 wears or no price.

**Edge Cases:**

5. **Given** an item has a name containing a comma (e.g., "Blazer, Navy Pinstripe"),
   **When** exported to CSV,
   **Then** the name field is wrapped in double quotes per RFC 4180.

6. **Given** the user's wardrobe has 0 items but 2 wishlist items,
   **When** the user unchecks "Wardrobe Items" and checks "Wishlist Items",
   **Then** the export generates a file containing only wishlist data.

**Negative Tests:**

7. **Given** no data types are selected (all unchecked),
   **When** the user looks at the export button,
   **Then** the button is disabled with a tooltip "Select at least one data type to export."

8. **Given** device storage is full,
   **When** the export is attempted,
   **Then** the system shows "Could not save export file. Free up storage and try again.",
   **And** no partial or corrupted files remain on the device.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| generates valid CSV header | item schema | correct column names in order |
| escapes commas in CSV fields | name: "Blazer, Navy" | field wrapped in double quotes |
| escapes double quotes in CSV fields | notes: 'Said "wow"' | quotes doubled: '""wow""' |
| handles null fields in CSV | purchase_price: null | empty string in column |
| handles null fields in JSON | purchase_price: null | null in JSON |
| computes cost_per_wear for export | price: 100, wears: 20 | "5.00" |
| computes cost_per_wear N/A | price: 100, wears: 0 | "N/A" |
| generates correct JSON structure | 3 items, 1 outfit | valid JSON with export_version, module, data sections |
| generates ZIP for multi-CSV | 3 data types selected, CSV format | ZIP file with 3 CSV files |
| generates single file for one CSV type | 1 data type, CSV format | single CSV file (no ZIP) |
| rejects export with no types selected | selected_types: [] | validation error |
| includes export metadata in JSON | any data | exported_at timestamp present, export_version = "1.0" |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full JSON export and re-read | 1. Add 5 items, 2. Export as JSON, 3. Read file | JSON file contains all 5 items with correct fields |
| CSV export with computed fields | 1. Add items with prices and wears, 2. Export CSV | cost_per_wear column has computed values |
| Share sheet integration | 1. Export, 2. Tap Share | Device share sheet opens with the export file |
| Export with no data | 1. Empty wardrobe, 2. Open export | "Nothing to export" message, button disabled |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User backs up all data | 1. Open Export, 2. Select JSON, all types, 3. Export, 4. Share to Files | JSON file in device Files app with all wardrobe data |
| User exports for spreadsheet analysis | 1. Open Export, 2. Select CSV, items only, 3. Export, 4. Open in spreadsheet | CSV file opens correctly in spreadsheet app with all columns and rows |

---

### CL-018: Settings and Preferences

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | CL-018 |
| **Feature Name** | Settings and Preferences |
| **Priority** | P0 |
| **Category** | Settings |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a user, I want to configure MyCloset preferences (currency, default view, laundry behavior, donation thresholds) in one central settings screen, so that the app behaves the way I expect.

**Secondary:**
> As a privacy-conscious user, I want a clear way to delete all my wardrobe data from the device, so that I feel in control of my personal information.

**Tertiary:**
> As a budget-minded shopper, I want to set my preferred currency and donation threshold, so that cost-per-wear calculations and donation suggestions use my personal benchmarks.

#### 3.3 Detailed Description

Settings and Preferences provides a centralized configuration screen for all user-adjustable behaviors in MyCloset. This is the control center for personalizing how the module works, managing data, and accessing help/about information.

The settings are organized into logical groups: Display, Catalog Defaults, Wear Tracking, Laundry, Donation, Seasonal, Data, and About. Each setting has a sensible default so users never need to visit Settings to use the app effectively. Settings are persisted locally and apply immediately upon change.

Settings also provides access to data management operations: export (links to CL-017), clear all data (with confirmation and password/biometric gate), and storage usage display. These data controls reinforce the privacy-first positioning by giving users full ownership of their information.

The Settings screen is a critical P0 feature because other features reference user preferences (currency format, donation threshold, laundry auto-dirty behavior, seasonal start months) that need a place to live and be configured.

#### 3.4 Prerequisites

**Feature Dependencies:**
- None (settings is standalone; it provides configuration consumed by other features)

**External Dependencies:**
- Device locale for currency formatting defaults
- Biometric or PIN authentication for destructive data operations

**Assumed Capabilities:**
- Local persistent storage for preferences
- Device locale and currency information are accessible
- Biometric authentication API is available (optional; falls back to confirmation dialog)

#### 3.5 User Interface Requirements

##### Screen: Settings

**Layout:**
- Accessible from the module tab bar (fifth tab) or from a gear icon in the module dashboard
- The screen is a scrollable list of grouped settings sections:

**Section: Display**
- Default View Mode: Segmented control (Grid / List), default: Grid
- Grid Columns: Stepper (2 or 3), default: 2
- Show Wardrobe Value: Toggle (on/off), default: on
- Currency: Picker with common currencies (USD, EUR, GBP, CAD, AUD, JPY, CNY, INR, BRL, MXN, custom), default: device locale currency

**Section: Catalog Defaults**
- Default Condition: Picker (New, Good, Fair, Worn Out), default: Good
- Require Photo for New Items: Toggle (on/off), default: off
- Auto-Detect Season from Purchase Date: Toggle (on/off), default: off

**Section: Wear Tracking**
- Auto-mark as Worn When Outfit is Logged: Toggle (on/off), default: on
- Wear Logging Reminder: Picker (None, Daily at [time], Custom), default: None

**Section: Laundry**
- Auto-mark Items Dirty After Wear: Toggle (on/off), default: on
- Wears Before Dirty: Stepper (1-10), default: 1
- Laundry Day Reminder: Picker (None, Weekly on [day], Custom), default: None

**Section: Donation**
- Donation Threshold (days): Stepper (30 to 730, step 30), default: 365
- Minimum Items Before Suggestions: Stepper (1-50), default: 10
- Include Low-Cost Items: Toggle (on/off), default: on

**Section: Seasonal**
- Season Start Months: 4 month pickers (Spring, Summer, Fall, Winter), defaults: 3, 6, 9, 12
- Rotation Reminder Timing: Picker (1 week before, First day of season, 2 weeks after), default: First day of season

**Section: Data**
- Export Data: Row with chevron, navigates to CL-017 Export Screen
- Storage Usage: Display showing total storage used by photos and database (e.g., "Photos: 245 MB | Database: 2.1 MB")
- Clear All Data: Destructive button, requires confirmation

**Section: About**
- Version: Display showing module version (e.g., "MyCloset v1.0.0")
- Acknowledgements: Row with chevron, navigates to licenses/credits screen

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Normal | Settings loaded | All settings displayed with current values |
| Saving | A setting is being persisted | Brief inline spinner next to the changed setting |
| Clear Data Confirmation | User tapped "Clear All Data" | Full-screen confirmation: "This will permanently delete all your wardrobe data, including photos, outfits, and wear history. This cannot be undone." with biometric/PIN gate, then "Delete Everything" (red) and "Cancel" buttons |
| Data Cleared | Deletion complete | Toast: "All data deleted. Your wardrobe is empty." Return to empty catalog state |

**Interactions:**
- Toggle switches: Apply immediately on tap, persist to local storage
- Pickers/steppers: Open appropriate picker UI, apply on selection
- Tap "Export Data": Navigate to CL-017 Export screen
- Tap "Clear All Data": Show confirmation flow (biometric/PIN, then confirm dialog)
- Tap "Acknowledgements": Navigate to licenses screen
- Scroll: Standard vertical scroll for the settings list

**Transitions/Animations:**
- Toggle switches animate with platform-standard toggle animation
- Clear data confirmation dialog fades in over a dimmed overlay, 200ms
- Settings changes save with a brief checkmark flash next to the changed setting, 300ms

#### 3.6 Data Requirements

##### Entity: UserPreferences

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | string | Primary key | "user_preferences" | Singleton preferences record |
| display_view_mode | enum | One of: grid, list | "grid" | Default catalog view mode |
| display_grid_columns | integer | One of: 2, 3 | 2 | Number of columns in grid view |
| display_show_value | boolean | - | true | Whether to show total wardrobe value in summary |
| currency_code | string | ISO 4217 currency code, max 3 chars | Device locale | Preferred currency for price display |
| catalog_default_condition | enum | One of: new, good, fair, worn_out | "good" | Default condition for new items |
| catalog_require_photo | boolean | - | false | Whether photos are required when adding items |
| catalog_auto_season | boolean | - | false | Whether to auto-detect season from purchase date |
| wear_auto_mark | boolean | - | true | Auto-mark items as worn when outfit is logged |
| wear_reminder | enum | One of: none, daily, custom | "none" | Wear logging reminder setting |
| wear_reminder_time | string | HH:MM format, optional | null | Time for daily wear reminder |
| laundry_auto_dirty | boolean | - | true | Auto-mark items dirty after wear |
| laundry_wears_before_dirty | integer | Min: 1, max: 10 | 1 | Number of wears before item is marked dirty |
| laundry_reminder | enum | One of: none, weekly, custom | "none" | Laundry day reminder setting |
| laundry_reminder_day | integer | 0-6 (Sun-Sat), optional | null | Day of week for weekly laundry reminder |
| donation_threshold_days | integer | Min: 30, max: 730 | 365 | Days since last wear before suggesting donation |
| donation_minimum_items | integer | Min: 1, max: 50 | 10 | Minimum wardrobe items before donation suggestions appear |
| donation_include_low_cost | boolean | - | true | Include low-cost items in donation suggestions |
| season_spring_start | integer | 1-12 | 3 | Spring start month |
| season_summer_start | integer | 1-12 | 6 | Summer start month |
| season_fall_start | integer | 1-12 | 9 | Fall start month |
| season_winter_start | integer | 1-12 | 12 | Winter start month |
| season_reminder_timing | enum | One of: week_before, first_day, two_weeks_after | "first_day" | When to trigger seasonal rotation reminders |
| updated_at | datetime | Auto-set on modification | Current timestamp | Last modification time |

**Relationships:**
- Singleton record (only one UserPreferences row exists)

**Indexes:**
- None needed (singleton record, accessed by fixed primary key)

**Validation Rules:**
- currency_code must be a valid ISO 4217 code (3 uppercase letters)
- laundry_wears_before_dirty must be between 1 and 10 inclusive
- donation_threshold_days must be between 30 and 730 inclusive
- Season start months must be valid (1-12) and must not overlap (each month belongs to exactly one season)
- wear_reminder_time must be in HH:MM format if wear_reminder is "daily" or "custom"
- laundry_reminder_day must be 0-6 if laundry_reminder is "weekly"

**Example Data:**

```
{
  "id": "user_preferences",
  "display_view_mode": "grid",
  "display_grid_columns": 2,
  "display_show_value": true,
  "currency_code": "USD",
  "catalog_default_condition": "good",
  "catalog_require_photo": false,
  "catalog_auto_season": false,
  "wear_auto_mark": true,
  "wear_reminder": "none",
  "wear_reminder_time": null,
  "laundry_auto_dirty": true,
  "laundry_wears_before_dirty": 1,
  "laundry_reminder": "none",
  "laundry_reminder_day": null,
  "donation_threshold_days": 365,
  "donation_minimum_items": 10,
  "donation_include_low_cost": true,
  "season_spring_start": 3,
  "season_summer_start": 6,
  "season_fall_start": 9,
  "season_winter_start": 12,
  "season_reminder_timing": "first_day",
  "updated_at": "2026-03-07T10:00:00Z"
}
```

#### 3.7 Business Logic Rules

##### Preference Application

**Purpose:** Apply user preferences to feature behavior across the module.

**Inputs:**
- preferences: UserPreferences record

**Logic:**

```
1. On module initialization, load UserPreferences from local storage
2. IF no record exists, create a new record with all defaults
3. Each feature reads relevant preferences:
   - CL-001 (Catalog): display_view_mode, display_grid_columns, display_show_value,
     catalog_default_condition, catalog_require_photo, currency_code
   - CL-005 (Wear Tracking): wear_auto_mark, wear_reminder, wear_reminder_time
   - CL-006 (Cost-Per-Wear): currency_code
   - CL-007 (Donation): donation_threshold_days, donation_minimum_items,
     donation_include_low_cost
   - CL-009 (Laundry): laundry_auto_dirty, laundry_wears_before_dirty,
     laundry_reminder, laundry_reminder_day
   - CL-012 (Seasonal): season_spring_start, season_summer_start,
     season_fall_start, season_winter_start, season_reminder_timing
4. Changes to preferences take effect immediately (no restart required)
```

**Edge Cases:**
- Preferences record is corrupted or missing fields: Reset to defaults for missing fields, log warning
- Currency code changes mid-use: All price displays update to new currency format; stored values remain unchanged (they are raw numbers, formatting is display-only)

##### Storage Usage Calculation

**Purpose:** Calculate total storage consumed by MyCloset data.

**Inputs:**
- photo_directory: file system path for photos
- database_file: file system path for SQLite database

**Logic:**

```
1. photo_size = SUM of all file sizes in photo_directory (recursive)
2. database_size = file size of database_file
3. total_size = photo_size + database_size
4. RETURN { photo_size_mb: photo_size / (1024 * 1024), database_size_mb: database_size / (1024 * 1024), total_size_mb: total_size / (1024 * 1024) }
```

**Edge Cases:**
- Photo directory does not exist yet: photo_size = 0
- Permission denied reading file sizes: Show "Unable to calculate storage usage"

##### Clear All Data

**Purpose:** Irreversibly delete all MyCloset data from the device.

**Inputs:**
- user_confirmation: boolean (from confirmation dialog)
- biometric_verified: boolean (from biometric gate)

**Logic:**

```
1. IF NOT biometric_verified AND NOT pin_verified: ABORT (authentication required)
2. IF NOT user_confirmation: ABORT
3. Delete all records from all MyCloset tables (cl_* tables)
4. Delete all photo files from the MyCloset photo directory
5. Reset UserPreferences to defaults
6. Navigate to the empty state of the Wardrobe Catalog
7. Show toast: "All data deleted. Your wardrobe is empty."
```

**Edge Cases:**
- Biometric unavailable on device: Fall back to a typed confirmation phrase ("DELETE" in all caps)
- Deletion partially fails (some files cannot be removed): Report partial deletion, list failed items, offer retry
- User navigates away during deletion: Continue deletion in background; show result on return

**Sort/Filter/Ranking Logic:**
- Settings are not sorted (they are in a fixed, logical grouping order)
- No search or filter within settings

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Preference save fails | "Could not save setting. Please try again." toast, setting reverts to previous value | User retries |
| Storage calculation fails | "Unable to calculate storage usage" in the storage display area | User retries or ignores |
| Data deletion partially fails | "Some data could not be deleted. [X files] remaining." with retry button | User retries |
| Biometric authentication fails | "Authentication failed. Please try again." | User retries biometric or uses typed confirmation |
| Invalid season configuration (months overlap) | Inline error: "Season months must not overlap. Each month belongs to one season." | User corrects month values |
| Invalid currency code | Inline error: "Select a valid currency" | User selects from the picker |

**Validation Timing:**
- Toggle and picker changes save immediately
- Stepper changes save on interaction (each increment/decrement)
- Season month validation runs when any season month is changed
- Data deletion requires authentication before the confirmation dialog

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user has never visited Settings,
   **When** the Settings screen opens for the first time,
   **Then** all settings show their default values (Grid view, 2 columns, USD currency, 365-day donation threshold, etc.).

2. **Given** the user changes the currency from USD to EUR,
   **When** the user returns to the Wardrobe Catalog,
   **Then** all price displays use EUR formatting (e.g., "45.00 EUR" or locale-appropriate format).

3. **Given** the user sets donation_threshold_days to 180,
   **When** the Donation Suggestions feature (CL-007) runs,
   **Then** items not worn in 180+ days are flagged (instead of the default 365).

4. **Given** the user toggles "Auto-mark Items Dirty After Wear" off,
   **When** the user logs a wear (CL-005),
   **Then** the worn items' laundry_status remains unchanged (not set to "dirty" automatically).

**Edge Cases:**

5. **Given** the user sets season months to Southern Hemisphere values (spring: 9, summer: 12, fall: 3, winter: 6),
   **When** the seasonal features detect the current season in January,
   **Then** the current season is correctly identified as "summer."

6. **Given** the preferences record is corrupted (missing fields),
   **When** Settings loads,
   **Then** missing fields are reset to defaults, and the settings screen displays normally.

**Negative Tests:**

7. **Given** the user taps "Clear All Data" and cancels the confirmation,
   **When** the user returns to the Catalog,
   **Then** all data remains intact and unchanged.

8. **Given** the user enters overlapping season months (spring: 3, summer: 3),
   **When** the validation runs,
   **Then** an inline error "Season months must not overlap" is displayed,
   **And** the setting is not saved until corrected.

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| creates defaults when no record exists | empty database | UserPreferences with all default values |
| persists currency change | currency: "EUR" | saved and retrievable as "EUR" |
| persists donation threshold change | threshold: 180 | saved as 180 |
| validates season month overlap | spring: 3, summer: 3 | validation error |
| validates season month range | spring: 13 | validation error |
| validates laundry wears range (low) | wears: 0 | validation error |
| validates laundry wears range (high) | wears: 11 | validation error |
| validates donation threshold range (low) | threshold: 15 | validation error |
| validates donation threshold range (high) | threshold: 800 | validation error |
| calculates storage usage | photos: 256MB, db: 2MB | total: 258MB |
| handles missing photo directory | directory does not exist | photo_size: 0 |
| resets corrupted preferences | missing currency field | currency reset to device locale default |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Currency change affects catalog display | 1. Set currency to GBP, 2. View catalog | All prices display in GBP format |
| Donation threshold affects suggestions | 1. Set threshold to 90, 2. View donations | Items unworn for 90+ days appear as suggestions |
| Laundry auto-dirty toggle | 1. Disable auto-dirty, 2. Log a wear | Worn item's laundry_status unchanged |
| Clear all data flow | 1. Add 10 items, 2. Settings, 3. Clear All Data, 4. Authenticate, 5. Confirm | All tables empty, photos deleted, catalog shows empty state |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| User configures app for personal preferences | 1. Open Settings, 2. Set currency EUR, 3. Set donation threshold 180, 4. Set grid to 3 columns, 5. Return to catalog | Catalog shows 3-column grid with EUR prices, donation suggestions use 180-day threshold |
| User wipes data before uninstalling | 1. Settings, 2. Clear All Data, 3. Authenticate, 4. Confirm | All wardrobe data permanently deleted, empty state shown |

---

### CL-019: Onboarding and First-Run

#### 3.1 Header

| Field | Value |
|-------|-------|
| **Feature ID** | CL-019 |
| **Feature Name** | Onboarding and First-Run |
| **Priority** | P1 |
| **Category** | Onboarding |
| **Estimated Complexity** | Medium |

#### 3.2 User Stories

**Primary:**
> As a new user, I want a guided introduction that explains what MyCloset does and walks me through adding my first few items, so that I understand the value of the app before committing to digitizing my entire wardrobe.

**Secondary:**
> As a busy professional, I want to see the Quick Capture feature highlighted during onboarding, so that I know there is a fast way to photograph many items without filling in every detail up front.

**Tertiary:**
> As a privacy-conscious user, I want onboarding to clearly explain that all my data stays on my device, so that I feel safe photographing my wardrobe.

#### 3.3 Detailed Description

Onboarding and First-Run provides a structured introduction for new users launching MyCloset for the first time. The onboarding flow addresses the primary adoption barrier for wardrobe apps: the perceived effort of digitizing an entire wardrobe. The flow is designed to get users to value in under 3 minutes.

The onboarding consists of three parts:

1. **Welcome Slides (3 screens):** A brief, visual introduction explaining the core value of MyCloset. Each slide has a single illustration and a concise message. The slides cover: (a) "Your wardrobe, organized" (catalog and browse), (b) "Know what you actually wear" (cost-per-wear and donation insights), (c) "100% private, 100% yours" (privacy commitment). Users can skip the slides at any time.

2. **Guided First Item:** After the slides, the user is prompted to add their first wardrobe item. This is a streamlined version of the Add Item flow (CL-001) with contextual tooltips explaining each field. The goal is to make the user experience the core loop (photograph, categorize, save) at least once.

3. **Quick Capture Introduction:** After the first item is saved, a brief tooltip or callout highlights the Quick Capture button, explaining that users can photograph many items rapidly and fill in details later. This addresses the "wardrobe digitization dread" by showing the fast path.

After onboarding, the user lands on the Wardrobe Catalog with their first item visible and a subtle prompt encouraging them to add more. The onboarding flow is shown only once (tracked via a preference flag). Users can replay the welcome slides from Settings.

The onboarding flow does not collect any personal data, does not require account creation, and does not make any network calls. It is purely an on-device UX flow.

#### 3.4 Prerequisites

**Feature Dependencies:**
- CL-001: Wardrobe Catalog - The Add Item flow is used for the guided first item step

**External Dependencies:**
- Camera hardware for the guided first item photo capture
- Photo library access (alternative to camera)

**Assumed Capabilities:**
- Local database is initialized and ready for the first write
- Preference flag storage is available to track onboarding completion
- Tooltip/callout UI components are available on the platform

#### 3.5 User Interface Requirements

##### Screen: Welcome Slides

**Layout:**
- Full-screen, edge-to-edge slides with a paging indicator (3 dots) at the bottom
- Each slide has:
  - A large illustration (top 50% of the screen)
  - A bold heading (2-4 words)
  - A subtext (1-2 sentences)
- Navigation: swipe left/right to navigate, or tap dots. A "Skip" button in the top-right corner. A "Next" button at the bottom-right (becomes "Get Started" on the final slide).

**Slide 1: "Your Wardrobe, Organized"**
- Illustration: A stylized closet with neatly arranged items
- Subtext: "Photograph and catalog every item you own. Build outfits, track what you wear, and discover your true style."

**Slide 2: "Know What You Actually Wear"**
- Illustration: A chart or graph showing cost-per-wear declining
- Subtext: "See which items earn their keep and which are collecting dust. Get smart donation suggestions for things you have outgrown."

**Slide 3: "100% Private, 100% Yours"**
- Illustration: A phone with a shield/lock icon
- Subtext: "All photos and data stay on your device. No accounts, no cloud uploads, no tracking. Your wardrobe is nobody else's business."

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Slide 1 Active | First slide visible | Dot 1 filled, "Skip" and "Next" visible |
| Slide 2 Active | Second slide visible | Dot 2 filled, "Skip" and "Next" visible |
| Slide 3 Active | Third slide visible | Dot 3 filled, "Skip" and "Get Started" visible |

**Interactions:**
- Swipe left: Advance to next slide
- Swipe right: Return to previous slide
- Tap "Next": Advance to next slide
- Tap "Get Started" (slide 3): Proceed to Guided First Item
- Tap "Skip": Proceed directly to Guided First Item

**Transitions/Animations:**
- Slides transition with a horizontal parallax effect (illustration moves slower than text), 300ms
- Paging dots animate fill with a scale-up, 150ms
- "Get Started" button pulses gently on the final slide to draw attention

##### Screen: Guided First Item

**Layout:**
- This is the standard Add Item screen (CL-001) with contextual overlays:
  - A banner at the top: "Let's add your first item! Grab something from your closet."
  - Tooltip callouts pointing to key fields:
    - Photo area: "Tap to take a photo or pick from your library"
    - Name field: "Give it a short name, like 'Blue Oxford Shirt'"
    - Category picker: "Pick the closest category"
  - Tooltips appear one at a time as the user reaches each field (progressive disclosure)
  - All non-required fields have a "You can fill these in later" hint
- After the user saves the first item, a success celebration screen appears briefly (confetti animation or similar)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Guided | First item not yet saved | Add Item screen with tooltip overlays |
| Success | First item saved | Brief celebration animation (1.5 seconds), then transition to Quick Capture Introduction |
| Skipped | User taps "Skip" on the guided step | Proceed directly to the Catalog with an empty state |

**Interactions:**
- All standard Add Item interactions apply
- Tap tooltip: Dismiss that tooltip and advance to the next one
- Tap "Skip for now" (optional link below the form): Skip guided item, go to catalog
- Save: Standard save behavior, followed by the success celebration

**Transitions/Animations:**
- Tooltips appear with a fade-in and subtle bounce, 200ms
- Success celebration: confetti particles fall from the top for 1.5 seconds, then fade out
- Transition to Quick Capture Introduction: slide from right, 300ms

##### Screen: Quick Capture Introduction

**Layout:**
- A brief overlay or callout screen (not a full onboarding step):
  - A spotlight/highlight effect on the Quick Capture button in the Catalog screen
  - A callout bubble: "Got lots of items? Use Quick Capture to photograph many items fast. You can add details later."
  - "Got It" button to dismiss
  - "Try It Now" button to open Quick Capture (CL-001)

**States:**

| State | Condition | Display |
|-------|-----------|---------|
| Visible | First item saved, callout not yet dismissed | Spotlight overlay with callout |
| Dismissed | User taps "Got It" or "Try It Now" | Overlay dismissed, catalog visible |

**Interactions:**
- Tap "Got It": Dismiss the callout, show the catalog
- Tap "Try It Now": Open Quick Capture flow

#### 3.6 Data Requirements

This feature introduces a minimal data addition to UserPreferences (CL-018):

##### Extension to Entity: UserPreferences

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| onboarding_completed | boolean | - | false | Whether onboarding has been completed |
| onboarding_completed_at | datetime | Optional, ISO 8601 | null | When onboarding was completed |

**Validation Rules:**
- onboarding_completed is checked on module launch to determine whether to show the onboarding flow
- Once set to true, onboarding is not shown again unless manually triggered from Settings

**Example Data:**

```
{
  "onboarding_completed": true,
  "onboarding_completed_at": "2026-03-07T08:15:00Z"
}
```

#### 3.7 Business Logic Rules

##### Onboarding Flow Control

**Purpose:** Determine whether to show onboarding and which step to display.

**Inputs:**
- preferences: UserPreferences record

**Logic:**

```
1. On module launch:
   a. Load UserPreferences
   b. IF onboarding_completed = false OR onboarding_completed IS NULL:
      - Show Welcome Slides (Slide 1)
   c. ELSE:
      - Navigate directly to the Wardrobe Catalog
2. Onboarding progression:
   a. Welcome Slides (3 slides) -> Guided First Item -> Quick Capture Introduction -> Catalog
   b. "Skip" on Welcome Slides -> Guided First Item
   c. "Skip for now" on Guided First Item -> Catalog (with empty state)
3. On completion (any of: first item saved, "Skip for now" on Guided First Item, or "Got It"/"Try It Now" on Quick Capture):
   a. SET onboarding_completed = true
   b. SET onboarding_completed_at = NOW
4. "Replay Welcome Slides" from Settings:
   - Shows the 3 Welcome Slides only (not the guided item or quick capture steps)
   - Does not reset onboarding_completed
```

**Edge Cases:**
- User force-quits during onboarding: onboarding_completed remains false; flow resumes from the beginning on next launch
- User completes onboarding without adding an item (skipped guided item): onboarding_completed is set to true; catalog shows empty state with the standard "Add First Item" prompt
- Module re-enabled after being disabled: onboarding_completed is preserved (data is not deleted on disable); onboarding is not shown again
- User has items from a data import before onboarding: Guided First Item step is skipped; flow goes directly to Quick Capture Introduction (or catalog)

##### Time-to-Value Target

**Purpose:** Ensure onboarding gets users to value quickly.

**Benchmark:**
- Welcome Slides: Target duration 30-45 seconds (3 slides, 10-15 seconds each)
- Guided First Item: Target duration 60-90 seconds (photo + name + category)
- Quick Capture Introduction: Target duration 10 seconds
- Total onboarding: Under 3 minutes from launch to first item saved

**Sort/Filter/Ranking Logic:**
- Not applicable (onboarding is a linear flow)

#### 3.8 Error Handling

| Scenario | User-Facing Behavior | Recovery Action |
|----------|---------------------|----------------|
| Camera permission denied during guided item | "Camera access is needed to photograph your items. You can also choose a photo from your library." with "Open Settings" link | User grants permission or uses photo library |
| Photo library permission denied | "Photo library access is needed to import images." with "Open Settings" link | User grants permission |
| First item save fails | "Could not save your first item. Let's try again." with retry option | User retries; form data is preserved |
| Onboarding flag cannot be persisted | Onboarding completes visually; next launch may re-show slides | Acceptable degradation; user can skip again |
| Database not initialized on first launch | "Setting up MyCloset..." loading screen for up to 3 seconds | Database initialization completes; onboarding begins |

**Validation Timing:**
- Onboarding flag is checked on module launch
- Guided first item uses the same validation as CL-001 Add Item
- Tooltips advance on user interaction (tap to dismiss)

#### 3.9 Acceptance Criteria

**Happy Path:**

1. **Given** the user launches MyCloset for the first time,
   **When** the module opens,
   **Then** the Welcome Slides appear starting with Slide 1 ("Your Wardrobe, Organized").

2. **Given** the user completes all 3 slides and taps "Get Started",
   **When** the Guided First Item screen appears,
   **Then** the Add Item form is shown with a banner "Let's add your first item!" and tooltip on the photo area.

3. **Given** the user takes a photo, enters a name, and selects a category,
   **When** the user taps "Save",
   **Then** a celebration animation plays, the item is saved, and the Quick Capture Introduction appears.

4. **Given** the user taps "Got It" on the Quick Capture Introduction,
   **When** the catalog loads,
   **Then** the first item is visible in the grid, and onboarding_completed is set to true.

**Edge Cases:**

5. **Given** the user taps "Skip" on the first Welcome Slide,
   **When** the skip is processed,
   **Then** the user is taken directly to the Guided First Item screen (slides are skipped entirely).

6. **Given** the user taps "Skip for now" on the Guided First Item screen,
   **When** the skip is processed,
   **Then** the user lands on the empty Catalog with the standard empty state, and onboarding_completed is set to true.

7. **Given** the user has imported data before first launch (data import happened before onboarding),
   **When** the module detects existing items,
   **Then** the Guided First Item step is skipped, and the flow goes to the Quick Capture Introduction or directly to the catalog.

**Negative Tests:**

8. **Given** onboarding_completed is already true,
   **When** the user launches MyCloset,
   **Then** onboarding is not shown, and the user goes directly to the Wardrobe Catalog.

9. **Given** the user force-quits during the Welcome Slides,
   **When** the user relaunches,
   **Then** onboarding restarts from Slide 1 (onboarding_completed was never set to true).

#### 3.10 Test Specifications

##### Unit Tests

| Test Name | Input | Expected Output |
|-----------|-------|----------------|
| shows onboarding when flag is false | onboarding_completed: false | should show onboarding: true |
| skips onboarding when flag is true | onboarding_completed: true | should show onboarding: false |
| shows onboarding when flag is null | onboarding_completed: null | should show onboarding: true |
| sets flag on completion | complete onboarding | onboarding_completed: true, timestamp set |
| preserves flag on module re-enable | disable then enable module | onboarding_completed remains true |
| skip advances past slides | tap "Skip" | proceeds to guided first item |
| skip-for-now sets completion flag | tap "Skip for now" on guided item | onboarding_completed: true |
| detects existing items for skip | 5 items exist | guided first item step skipped |
| replay from settings does not reset flag | replay slides | onboarding_completed remains true |

##### Integration Tests

| Scenario | Steps | Expected Behavior |
|----------|-------|-------------------|
| Full onboarding flow | 1. Launch (new user), 2. View slides, 3. Add first item, 4. Dismiss quick capture | Item saved, onboarding complete, catalog shows item |
| Skip entire onboarding | 1. Launch, 2. Skip slides, 3. Skip guided item | Empty catalog, onboarding complete |
| Camera permission denied flow | 1. Launch, 2. Reach guided item, 3. Deny camera | Photo library option shown, user can proceed |
| Replay slides from settings | 1. Complete onboarding, 2. Settings > Replay Welcome | Slides shown, then return to settings (not guided item) |

##### End-to-End Tests

| User Scenario | Steps | Expected Final State |
|--------------|-------|---------------------|
| New user completes full onboarding | 1. First launch, 2. Read 3 slides, 3. Photograph a shirt, 4. Name it, select category, save, 5. Dismiss quick capture intro | 1 item in catalog, onboarding complete, user understands core features |
| Returning user after onboarding | 1. Complete onboarding, 2. Close app, 3. Reopen | Goes directly to catalog, no onboarding shown |

---

## 4. Data Architecture

### 4.1 Entity-Relationship Overview

The data model centers on the ClothingItem entity, which represents a single wardrobe item. ClothingItems are organized through tags (CL-002), grouped into Outfits (CL-003), and tracked through WearLogs (CL-004/CL-005). Financial analysis is computed from ClothingItem.purchase_price and ClothingItem.times_worn (CL-006). Peripheral entities include WishlistItem (CL-013), CapsuleWardrobe with its CapsuleItem join table (CL-014), and StyleBoard with its BoardImage and BoardImageItemLink tables (CL-016).

A single UserPreferences record stores all user-configurable settings as a singleton. Seasonal settings (CL-012) are consolidated into UserPreferences rather than stored in a separate table.

All tables use the `cl_` prefix to avoid collisions with other modules in the MyLife hub. All entities use string UUIDs as primary keys, auto-generated timestamps for created_at and updated_at, and enforce referential integrity through application-level checks (SQLite foreign key support enabled).

### 4.2 Complete Entity Definitions

#### Entity: cl_clothing_items

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique item identifier |
| name | TEXT | NOT NULL, max 255 | None | Item name |
| brand | TEXT | Max 255 | NULL | Brand or maker |
| category | TEXT | NOT NULL, one of: tops, bottoms, dresses, outerwear, shoes, accessories, activewear, swimwear, sleepwear, underwear, other | None | Primary category |
| subcategory | TEXT | Max 100 | NULL | Subcategory (e.g., t-shirt, blazer, boots) |
| colors | TEXT | JSON array of color strings | "[]" | Assigned colors |
| size | TEXT | Max 50 | NULL | Item size (freeform) |
| seasons | TEXT | JSON array, values: spring, summer, fall, winter, all-season | "[]" | Applicable seasons |
| occasions | TEXT | JSON array, values: casual, work, formal, active, lounge, date_night, outdoor | "[]" | Applicable occasions |
| purchase_price | REAL | Min: 0.0 | NULL | Purchase price in user's currency |
| purchase_date | TEXT | ISO 8601 date | NULL | Date of purchase |
| condition | TEXT | One of: new, good, fair, worn_out | "good" | Current item condition |
| status | TEXT | One of: active, stored, donated, sold, archived | "active" | Lifecycle status |
| times_worn | INTEGER | Min: 0 | 0 | Total wear count |
| last_worn_date | TEXT | ISO 8601 date | NULL | Date last worn |
| laundry_status | TEXT | One of: clean, dirty, washing | "clean" | Current laundry state |
| photo_path | TEXT | Max 1024 | NULL | Local path to primary photo |
| notes | TEXT | Max 2000 | NULL | Free-form notes |
| created_at | TEXT | ISO 8601 datetime, NOT NULL | Current timestamp | Record creation |
| updated_at | TEXT | ISO 8601 datetime, NOT NULL | Current timestamp | Last modification |

#### Entity: cl_outfits

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique outfit identifier |
| name | TEXT | NOT NULL, max 255 | None | Outfit name |
| occasion | TEXT | Max 100 | NULL | Occasion tag |
| season | TEXT | Max 50 | NULL | Season tag |
| notes | TEXT | Max 2000 | NULL | Notes about the outfit |
| thumbnail_path | TEXT | Max 1024 | NULL | Auto-generated composite thumbnail |
| created_at | TEXT | ISO 8601 datetime, NOT NULL | Current timestamp | Record creation |
| updated_at | TEXT | ISO 8601 datetime, NOT NULL | Current timestamp | Last modification |

#### Entity: cl_outfit_items (join table)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique identifier |
| outfit_id | TEXT | NOT NULL, references cl_outfits.id | None | Parent outfit |
| item_id | TEXT | NOT NULL, references cl_clothing_items.id | None | Included item |
| layer_order | INTEGER | Min: 0 | 0 | Visual layering order |
| position_x | REAL | 0.0 to 1.0 | 0.5 | Horizontal position on canvas |
| position_y | REAL | 0.0 to 1.0 | 0.5 | Vertical position on canvas |
| scale | REAL | Min: 0.1, max: 3.0 | 1.0 | Item scale on canvas |
| created_at | TEXT | ISO 8601 datetime, NOT NULL | Current timestamp | Record creation |

#### Entity: cl_wear_logs

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique log identifier |
| date | TEXT | NOT NULL, ISO 8601 date | Today | Date the outfit was worn |
| outfit_id | TEXT | References cl_outfits.id | NULL | Associated outfit (if logged from an outfit) |
| notes | TEXT | Max 1000 | NULL | Notes about the wear event |
| created_at | TEXT | ISO 8601 datetime, NOT NULL | Current timestamp | Record creation |

#### Entity: cl_wear_log_items (join table)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique identifier |
| wear_log_id | TEXT | NOT NULL, references cl_wear_logs.id | None | Parent wear log |
| item_id | TEXT | NOT NULL, references cl_clothing_items.id | None | Item worn |
| created_at | TEXT | ISO 8601 datetime, NOT NULL | Current timestamp | Record creation |

#### Entity: cl_tags

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique tag identifier |
| name | TEXT | NOT NULL, UNIQUE, max 100 | None | Tag name |
| color_hex | TEXT | 7-char hex string (#RRGGBB) | "#808080" | Display color |
| created_at | TEXT | ISO 8601 datetime, NOT NULL | Current timestamp | Record creation |

#### Entity: cl_item_tags (join table)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique identifier |
| item_id | TEXT | NOT NULL, references cl_clothing_items.id | None | Tagged item |
| tag_id | TEXT | NOT NULL, references cl_tags.id | None | Applied tag |
| created_at | TEXT | ISO 8601 datetime, NOT NULL | Current timestamp | Record creation |

#### Entity: cl_packing_lists

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique list identifier |
| name | TEXT | NOT NULL, max 255 | None | Trip/list name |
| destination | TEXT | Max 255 | NULL | Trip destination |
| start_date | TEXT | ISO 8601 date | NULL | Trip start date |
| end_date | TEXT | ISO 8601 date | NULL | Trip end date |
| notes | TEXT | Max 2000 | NULL | Trip notes |
| created_at | TEXT | ISO 8601 datetime, NOT NULL | Current timestamp | Record creation |
| updated_at | TEXT | ISO 8601 datetime, NOT NULL | Current timestamp | Last modification |

#### Entity: cl_packing_list_items (join table)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique identifier |
| list_id | TEXT | NOT NULL, references cl_packing_lists.id | None | Parent list |
| item_id | TEXT | NOT NULL, references cl_clothing_items.id | None | Item to pack |
| packed | INTEGER | 0 or 1 | 0 | Whether the item is checked off |
| quantity | INTEGER | Min: 1 | 1 | Number of this item to pack |
| created_at | TEXT | ISO 8601 datetime, NOT NULL | Current timestamp | Record creation |

#### Entity: cl_outfit_suggestions

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique suggestion identifier |
| suggestion_date | TEXT | NOT NULL, ISO 8601 date | Today | Date generated for |
| item_ids | TEXT | NOT NULL, comma-separated UUIDs | None | Items in the suggestion |
| score | REAL | Min: 0.0 | 0.0 | Algorithm score |
| weather_temp | REAL | | NULL | Temperature at generation |
| weather_condition | TEXT | Max 50 | NULL | Weather condition |
| feedback | TEXT | One of: thumbs_up, thumbs_down, NULL | NULL | User feedback |
| was_worn | INTEGER | 0 or 1 | 0 | Whether user wore this suggestion |
| auto_name | TEXT | Max 100 | NULL | Auto-generated name |
| created_at | TEXT | ISO 8601 datetime, NOT NULL | Current timestamp | Record creation |

#### Entity: cl_suggestion_feedback

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique identifier |
| item_pair | TEXT | NOT NULL, UNIQUE, two sorted UUIDs joined by ":" | None | Canonical pair key |
| positive_count | INTEGER | Min: 0 | 0 | Thumbs-up count |
| negative_count | INTEGER | Min: 0 | 0 | Thumbs-down count |
| net_score | INTEGER | Computed | 0 | positive - negative |
| updated_at | TEXT | ISO 8601 datetime, NOT NULL | Current timestamp | Last update |

#### Entity: cl_wishlist_items

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique identifier |
| name | TEXT | NOT NULL, max 255 | None | Item name |
| category | TEXT | NOT NULL, same enum as cl_clothing_items.category | None | Clothing category |
| target_price | REAL | Min: 0.0 | NULL | Desired price |
| store_brand | TEXT | Max 255 | NULL | Store or brand |
| priority | TEXT | One of: low, medium, high | "medium" | Purchase priority |
| url | TEXT | Max 2048 | NULL | Product page URL |
| photo_path | TEXT | Max 1024 | NULL | Reference photo path |
| notes | TEXT | Max 2000 | NULL | Notes |
| status | TEXT | One of: active, purchased | "active" | Purchase status |
| purchase_date | TEXT | ISO 8601 date | NULL | Actual purchase date |
| converted_to_item_id | TEXT | References cl_clothing_items.id | NULL | Linked catalog item |
| created_at | TEXT | ISO 8601 datetime, NOT NULL | Current timestamp | Record creation |
| updated_at | TEXT | ISO 8601 datetime, NOT NULL | Current timestamp | Last modification |

#### Entity: cl_capsule_wardrobes

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique identifier |
| name | TEXT | NOT NULL, max 255 | None | Capsule name |
| season | TEXT | One of: spring, summer, fall, winter, year_round | "year_round" | Target season |
| target_count | INTEGER | Min: 10, max: 50 | 33 | Target item count |
| created_at | TEXT | ISO 8601 datetime, NOT NULL | Current timestamp | Record creation |
| updated_at | TEXT | ISO 8601 datetime, NOT NULL | Current timestamp | Last modification |

#### Entity: cl_capsule_items (join table)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique identifier |
| capsule_id | TEXT | NOT NULL, references cl_capsule_wardrobes.id | None | Parent capsule |
| item_id | TEXT | NOT NULL, references cl_clothing_items.id | None | Included item |
| added_at | TEXT | ISO 8601 datetime, NOT NULL | Current timestamp | When added |

#### Entity: cl_style_boards

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique identifier |
| name | TEXT | NOT NULL, max 255 | None | Board name |
| description | TEXT | Max 1000 | NULL | Board description |
| season | TEXT | One of: spring, summer, fall, winter, NULL | NULL | Season association |
| occasion | TEXT | One of: casual, work, formal, active, date_night, travel, NULL | NULL | Occasion association |
| cover_image_id | TEXT | References cl_board_images.id | NULL | Cover image |
| created_at | TEXT | ISO 8601 datetime, NOT NULL | Current timestamp | Record creation |
| updated_at | TEXT | ISO 8601 datetime, NOT NULL | Current timestamp | Last modification |

#### Entity: cl_board_images

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique identifier |
| board_id | TEXT | NOT NULL, references cl_style_boards.id | None | Parent board |
| photo_path | TEXT | NOT NULL, max 1024 | None | Local image path |
| sort_order | INTEGER | Min: 0 | 0 | Display order |
| created_at | TEXT | ISO 8601 datetime, NOT NULL | Current timestamp | Record creation |

#### Entity: cl_board_image_item_links (join table)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key, UUID | Auto-generated | Unique identifier |
| board_image_id | TEXT | NOT NULL, references cl_board_images.id | None | Inspiration image |
| item_id | TEXT | NOT NULL, references cl_clothing_items.id | None | Linked wardrobe item |
| created_at | TEXT | ISO 8601 datetime, NOT NULL | Current timestamp | Record creation |

#### Entity: cl_user_preferences (singleton)

| Field | Type | Constraints | Default | Description |
|-------|------|-------------|---------|-------------|
| id | TEXT | Primary key | "user_preferences" | Fixed key |
| display_view_mode | TEXT | One of: grid, list | "grid" | Catalog view mode |
| display_grid_columns | INTEGER | One of: 2, 3 | 2 | Grid column count |
| display_show_value | INTEGER | 0 or 1 | 1 | Show wardrobe value |
| currency_code | TEXT | ISO 4217, 3 chars | Device locale | Currency |
| catalog_default_condition | TEXT | One of: new, good, fair, worn_out | "good" | Default condition |
| catalog_require_photo | INTEGER | 0 or 1 | 0 | Require photo |
| catalog_auto_season | INTEGER | 0 or 1 | 0 | Auto-detect season |
| wear_auto_mark | INTEGER | 0 or 1 | 1 | Auto-mark worn |
| wear_reminder | TEXT | One of: none, daily, custom | "none" | Reminder type |
| wear_reminder_time | TEXT | HH:MM | NULL | Reminder time |
| laundry_auto_dirty | INTEGER | 0 or 1 | 1 | Auto-dirty |
| laundry_wears_before_dirty | INTEGER | 1-10 | 1 | Wears before dirty |
| laundry_reminder | TEXT | One of: none, weekly, custom | "none" | Laundry reminder |
| laundry_reminder_day | INTEGER | 0-6 | NULL | Reminder day |
| donation_threshold_days | INTEGER | 30-730 | 365 | Days before donation |
| donation_minimum_items | INTEGER | 1-50 | 10 | Min items for suggestions |
| donation_include_low_cost | INTEGER | 0 or 1 | 1 | Include low-cost |
| season_spring_start | INTEGER | 1-12 | 3 | Spring start |
| season_summer_start | INTEGER | 1-12 | 6 | Summer start |
| season_fall_start | INTEGER | 1-12 | 9 | Fall start |
| season_winter_start | INTEGER | 1-12 | 12 | Winter start |
| season_reminder_timing | TEXT | One of: week_before, first_day, two_weeks_after | "first_day" | Reminder timing |
| onboarding_completed | INTEGER | 0 or 1 | 0 | Onboarding done |
| onboarding_completed_at | TEXT | ISO 8601 datetime | NULL | When completed |
| updated_at | TEXT | ISO 8601 datetime, NOT NULL | Current timestamp | Last modification |

### 4.3 Relationships

| Relationship | Type | Description |
|-------------|------|-------------|
| cl_clothing_items -> cl_outfit_items | one-to-many | An item can appear in many outfits |
| cl_outfits -> cl_outfit_items | one-to-many | An outfit contains many items |
| cl_clothing_items <-> cl_outfits | many-to-many | Through cl_outfit_items |
| cl_wear_logs -> cl_wear_log_items | one-to-many | A wear log tracks many items worn that day |
| cl_clothing_items -> cl_wear_log_items | one-to-many | An item can have many wear log entries |
| cl_wear_logs -> cl_outfits | many-to-one | A wear log can reference an outfit (optional) |
| cl_clothing_items <-> cl_tags | many-to-many | Through cl_item_tags |
| cl_packing_lists -> cl_packing_list_items | one-to-many | A list contains many items |
| cl_clothing_items -> cl_packing_list_items | one-to-many | An item can appear in many packing lists |
| cl_capsule_wardrobes -> cl_capsule_items | one-to-many | A capsule contains many items |
| cl_clothing_items -> cl_capsule_items | one-to-many | An item can appear in many capsules |
| cl_style_boards -> cl_board_images | one-to-many | A board contains many images |
| cl_board_images -> cl_board_image_item_links | one-to-many | An image can link to many wardrobe items |
| cl_clothing_items -> cl_board_image_item_links | one-to-many | An item can be linked to many board images |
| cl_style_boards -> cl_board_images (cover) | one-to-one | A board has one optional cover image |
| cl_wishlist_items -> cl_clothing_items | one-to-one (optional) | A purchased wishlist item can link to a catalog entry |

### 4.4 Indexes

| Entity | Index Name | Fields | Reason |
|--------|-----------|--------|--------|
| cl_clothing_items | idx_items_category | category | Filter by category |
| cl_clothing_items | idx_items_status | status | Filter active vs stored/archived |
| cl_clothing_items | idx_items_last_worn | last_worn_date | Sort by recency, donation detection |
| cl_clothing_items | idx_items_times_worn | times_worn | Sort by wear count |
| cl_clothing_items | idx_items_created | created_at | Sort by date added |
| cl_outfit_items | idx_oi_outfit | outfit_id | Fast outfit item lookup |
| cl_outfit_items | idx_oi_item | item_id | Find outfits containing an item |
| cl_outfit_items | idx_oi_unique | (outfit_id, item_id) | UNIQUE - prevent duplicates |
| cl_wear_logs | idx_wl_date | date | Query by date range |
| cl_wear_log_items | idx_wli_log | wear_log_id | Fast log item lookup |
| cl_wear_log_items | idx_wli_item | item_id | Find wear events for an item |
| cl_item_tags | idx_it_item | item_id | Find tags for an item |
| cl_item_tags | idx_it_tag | tag_id | Find items with a tag |
| cl_item_tags | idx_it_unique | (item_id, tag_id) | UNIQUE - prevent duplicates |
| cl_packing_list_items | idx_pli_list | list_id | Fast list item lookup |
| cl_outfit_suggestions | idx_os_date | suggestion_date | Query by date |
| cl_outfit_suggestions | idx_os_feedback | feedback | Query by feedback type |
| cl_suggestion_feedback | idx_sf_pair | item_pair | UNIQUE - fast pair lookup |
| cl_suggestion_feedback | idx_sf_score | net_score | Sort by compatibility |
| cl_wishlist_items | idx_wi_status | status | Filter active vs purchased |
| cl_wishlist_items | idx_wi_priority | priority | Sort by priority |
| cl_capsule_items | idx_ci_capsule | capsule_id | Fast capsule item lookup |
| cl_capsule_items | idx_ci_unique | (capsule_id, item_id) | UNIQUE - prevent duplicates |
| cl_board_images | idx_bi_board | board_id | Fast board image lookup |
| cl_board_images | idx_bi_order | (board_id, sort_order) | Ordered retrieval |
| cl_board_image_item_links | idx_biil_image | board_image_id | Fast link lookup |
| cl_board_image_item_links | idx_biil_unique | (board_image_id, item_id) | UNIQUE - prevent duplicates |

### 4.5 Table Prefix

**MyLife hub table prefix:** `cl_`

All table names in the SQLite database are prefixed with `cl_` to avoid collisions with other modules in the MyLife hub. Example: the `clothing_items` table becomes `cl_clothing_items`, the `outfits` table becomes `cl_outfits`.

The prefix is applied at the schema definition level and is transparent to application code (the data access layer abstracts the prefix).

### 4.6 Migration Strategy

- **Module enable (v1):** All tables are created when the user enables the MyCloset module. Schema version is tracked in the hub's `hub_module_migrations` table with module_id = "closet".
- **Schema versioning:** Each migration is numbered sequentially (1, 2, 3...). The migration orchestrator applies any unapplied migrations on module enable or app update.
- **Non-destructive migrations:** Columns are only added, never removed, in minor versions. Column removal is deferred to major version upgrades only.
- **Standalone import:** Data from a standalone MyCloset app (if one exists) can be imported via the data importer in `packages/migration/`. The importer maps standalone table names to the `cl_` prefixed names.
- **Disable behavior:** When the user disables MyCloset, all data is preserved (tables remain, data is untouched). Only the navigation routes are deactivated. The user can re-enable and find their data intact.
- **Delete behavior:** "Clear All Data" (CL-018) drops all `cl_*` table contents and deletes associated photo files. Schema tables remain for re-enable.

---

## 5. Screen Map

### 5.1 Tab Structure

| Tab | Icon | Screen | Description |
|-----|------|--------|-------------|
| Wardrobe | Hanger icon | Catalog Grid | Browse all items in grid or list view |
| Outfits | Stack/layers icon | Outfit List | View, create, and manage outfits |
| Calendar | Calendar icon | Outfit Calendar | See what was worn on which day, log daily outfits |
| Stats | Chart/bar icon | Statistics Dashboard | Wear analytics, cost-per-wear, donation suggestions, color analysis |
| Settings | Gear icon | Settings Screen | Preferences, data management, export, about |

### 5.2 Navigation Flow

```
[Tab 1: Wardrobe]
  ├── Catalog Grid / List
  │     ├── Item Detail
  │     │     ├── Edit Item (reuses Add Item as edit mode)
  │     │     └── Outfit thumbnails -> Outfit Detail
  │     ├── Add Item (modal)
  │     ├── Quick Capture (full-screen camera batch flow)
  │     │     └── Batch Review -> Save All
  │     └── Filter/Sort Bottom Sheet
  ├── Wishlist (accessible from dashboard card)
  │     ├── Add Wishlist Item (modal)
  │     ├── Wishlist Item Detail
  │     │     └── Add to Wardrobe -> Add Item (pre-filled)
  │     └── Filter/Sort Bottom Sheet
  └── Style Boards (accessible from dashboard card)
        ├── Create Board (modal)
        ├── Board Detail
        │     ├── Image Detail
        │     │     └── Linked Items -> Item Detail
        │     ├── Add Image (photo library picker)
        │     └── Link Item (wardrobe picker bottom sheet)
        └── Edit Board

[Tab 2: Outfits]
  ├── Outfit List
  │     ├── Outfit Detail
  │     │     ├── Edit Outfit -> Outfit Builder
  │     │     ├── Item thumbnails -> Item Detail
  │     │     └── Log Wear -> Wear Log entry
  │     ├── Outfit Builder (create new outfit)
  │     │     └── Item Picker (multi-select from catalog)
  │     └── Filter/Sort Bottom Sheet
  └── Capsule Wardrobes (accessible from section header)
        ├── Capsule List
        ├── Create/Edit Capsule (multi-step flow)
        │     ├── Step 1: Setup
        │     ├── Step 2: Select Items
        │     └── Step 3: Review
        ├── Capsule Detail
        │     ├── Item grid -> Item Detail
        │     ├── Rest Items list -> Item Detail
        │     └── Outfit Ideas -> Outfit Builder (filtered)
        └── Edit Capsule

[Tab 3: Calendar]
  ├── Outfit Calendar (month view)
  │     ├── Day Detail (list of items worn that day)
  │     │     └── Item thumbnails -> Item Detail
  │     ├── Log Wear (modal to log what was worn today)
  │     │     ├── Pick from Saved Outfits
  │     │     └── Pick Individual Items
  │     └── Month Navigation (previous/next)
  └── AI Suggestions (accessible from "Today" card)
        ├── Today's Suggestions carousel
        │     ├── Suggestion Card -> Item Detail
        │     └── "Wear This" -> Log Wear
        └── Suggestion History

[Tab 4: Stats]
  ├── Statistics Dashboard
  │     ├── Wear Frequency section -> Wear Detail
  │     ├── Cost-Per-Wear section -> Cost Detail
  │     ├── Donation Suggestions section -> Donation List
  │     ├── Color Analysis section -> Color Analysis Dashboard
  │     ├── Laundry Status section -> Laundry Overview
  │     └── Seasonal Overview section -> Seasonal Overview
  ├── Color Analysis Dashboard
  │     └── Color bar -> Catalog (filtered by color)
  ├── Seasonal Overview
  │     ├── Season Detail (items for selected season)
  │     └── Rotate Now -> Rotation Reminder modal
  └── Donation Candidates list
        └── Item row -> Item Detail

[Tab 5: Settings]
  ├── Settings Screen (grouped preferences)
  │     ├── Export Data -> Export Screen (CL-017)
  │     │     └── Share Sheet
  │     ├── Clear All Data -> Confirmation Flow
  │     ├── Replay Welcome Slides -> Welcome Slides (view-only)
  │     └── Acknowledgements Screen
  └── Packing Lists (accessible from settings or dashboard)
        ├── Packing List Detail
        │     ├── Add Items (wardrobe picker)
        │     └── Item row -> Item Detail
        └── Create Packing List (modal)
```

### 5.3 Screen Inventory

| Screen | Route/Path | Purpose | Entry Points |
|--------|-----------|---------|-------------|
| Catalog Grid | `/closet` | Browse all wardrobe items | Tab 1 (default), back from Item Detail |
| Item Detail | `/closet/item/:id` | View item details, wear stats, outfits | Tap item in catalog, outfit, or any item reference |
| Add/Edit Item | `/closet/item/add` or `/closet/item/:id/edit` | Create or modify a wardrobe item | "+" button, Edit button, "Add to Wardrobe" from wishlist |
| Quick Capture | `/closet/capture` | Batch photograph multiple items | "Quick Capture" button in catalog |
| Outfit List | `/closet/outfits` | Browse saved outfits | Tab 2 |
| Outfit Detail | `/closet/outfits/:id` | View outfit details and items | Tap outfit in list or calendar |
| Outfit Builder | `/closet/outfits/build` | Create or edit an outfit | "+" in outfit list, Edit button |
| Outfit Calendar | `/closet/calendar` | Calendar view of daily outfits | Tab 3 |
| Day Detail | `/closet/calendar/:date` | Items worn on a specific day | Tap day in calendar |
| Log Wear | `/closet/calendar/log` | Record what was worn today | "+" in calendar, "Log Wear" button |
| Today's Suggestions | `/closet/suggestions` | AI outfit suggestions | "Today" card in calendar |
| Statistics Dashboard | `/closet/stats` | Analytics overview | Tab 4 |
| Color Analysis | `/closet/stats/colors` | Color distribution analysis | Stats dashboard color section |
| Seasonal Overview | `/closet/stats/seasons` | Seasonal wardrobe breakdown | Stats dashboard seasonal section |
| Donation Candidates | `/closet/stats/donations` | Items to consider donating | Stats dashboard donation section |
| Wishlist | `/closet/wishlist` | Shopping wishlist | Dashboard card, catalog menu |
| Wishlist Item Detail | `/closet/wishlist/:id` | View wishlist item details | Tap wishlist item |
| Capsule List | `/closet/capsules` | Browse capsule wardrobes | Outfits tab section |
| Capsule Detail | `/closet/capsules/:id` | View capsule contents and stats | Tap capsule in list |
| Create/Edit Capsule | `/closet/capsules/build` | Multi-step capsule creation | "+" in capsule list |
| Style Board List | `/closet/boards` | Browse mood/style boards | Dashboard card |
| Board Detail | `/closet/boards/:id` | View board images and coverage | Tap board in list |
| Image Detail | `/closet/boards/:boardId/image/:imageId` | View inspiration image with links | Tap image in board |
| Packing Lists | `/closet/packing` | Trip packing list management | Settings or dashboard |
| Packing List Detail | `/closet/packing/:id` | Manage a specific packing list | Tap list |
| Settings | `/closet/settings` | Module preferences and data | Tab 5 |
| Export Screen | `/closet/settings/export` | Export data as CSV/JSON | Settings data section |
| Laundry Overview | `/closet/laundry` | View and manage laundry status | Stats dashboard, dashboard card |

### 5.4 Deep Link Patterns

| Pattern | Target | Parameters |
|---------|--------|-----------|
| `mylife://closet` | Catalog Grid | None |
| `mylife://closet/item/:id` | Item Detail | id: UUID of clothing item |
| `mylife://closet/item/add` | Add Item | None |
| `mylife://closet/outfits/:id` | Outfit Detail | id: UUID of outfit |
| `mylife://closet/calendar` | Outfit Calendar | None |
| `mylife://closet/calendar/:date` | Day Detail | date: ISO 8601 date |
| `mylife://closet/suggestions` | Today's Suggestions | None |
| `mylife://closet/stats` | Statistics Dashboard | None |
| `mylife://closet/wishlist` | Wishlist | None |
| `mylife://closet/capsules/:id` | Capsule Detail | id: UUID of capsule |
| `mylife://closet/boards/:id` | Board Detail | id: UUID of board |
| `mylife://closet/settings` | Settings | None |
| `mylife://closet/settings/export` | Export Screen | None |

---

## 6. Cross-Module Integration Points

| Integration | Source Module | Target Module | Data Flow | Trigger |
|------------|-------------|--------------|-----------|---------|
| Clothing purchase tracking | Closet | Budget | When a user adds a new item with a purchase_price, the transaction can optionally be recorded in MyBudget under a "Clothing" spending category | Manual: user taps "Track in Budget" on item save or detail screen |
| Cost-per-wear enrichment | Closet | Budget | Aggregate clothing spending and cost-per-wear metrics can surface in MyBudget's spending reports as a "Clothing ROI" insight | On demand: when user views budget reports and closet module is enabled |
| Daily outfit as habit | Closet | Habits | Logging a daily outfit in MyCloset can register as a completed habit in MyHabits ("Get dressed intentionally" or similar) | Automatic: on WearLog creation, if the user has linked a habit |
| Activity-appropriate clothing | Closet | Trails | When planning an outdoor activity in MyTrails, the packing list generator can suggest appropriate clothing from the wardrobe | On demand: user opens packing list and selects "Outdoor/Activity" template |
| Outfit photo in journal | Closet | Journal | A daily outfit photo can be attached as a journal entry attachment for life documentation | Manual: user taps "Add to Journal" from the calendar day view |

**Integration behavior when target module is disabled:** All integrations degrade gracefully. If the target module is not enabled, the integration trigger point (button, link, or automatic action) is hidden or no-oped. No errors are shown. Data stays in the source module. When the target module is later enabled, any pending integration points become active.

---

## 7. Privacy and Security Requirements

### 7.1 Data Storage

| Data Type | Storage Location | Encrypted | Synced | Notes |
|-----------|-----------------|-----------|--------|-------|
| Wardrobe metadata | Local SQLite (`cl_*` tables) | At rest (OS-level encryption) | No | Never leaves device |
| Clothing photos | Local file system (app sandbox) | At rest (OS-level encryption) | No | Never uploaded to any server |
| Outfit compositions | Local SQLite | At rest (OS-level encryption) | No | Never leaves device |
| Wear history/logs | Local SQLite | At rest (OS-level encryption) | No | Never leaves device |
| Shopping wishlist | Local SQLite | At rest (OS-level encryption) | No | URLs stored locally; no tracking |
| Style board images | Local file system (app sandbox) | At rest (OS-level encryption) | No | Never uploaded to any server |
| User preferences | Local SQLite | At rest (OS-level encryption) | No | Never leaves device |
| AI suggestion data | Local SQLite | At rest (OS-level encryption) | No | Algorithm runs on-device |
| Exported files (CSV/JSON) | User-initiated export to file system | No (user's responsibility) | No | Only created when user explicitly exports |

### 7.2 Network Activity

| Activity | Purpose | Data Sent | Data Received | User Consent |
|----------|---------|-----------|--------------|-------------|
| Weather forecast (CL-011 only) | Outfit suggestion scoring | Approximate location (city-level lat/lon) | Temperature, condition, forecast | Implicit (user enables AI suggestions and grants location permission) |

All other features operate entirely offline. The weather request is the only network call in the entire module, and it is optional. If the user denies location permission or disables AI suggestions, zero network requests are made.

### 7.3 Data That Never Leaves the Device

- Clothing item photos and metadata
- Body measurements (if entered in notes)
- Purchase prices and purchase history
- Brand preferences and shopping patterns
- Daily outfit choices and wear history
- Style preferences (thumbs up/down feedback)
- Capsule wardrobe configurations
- Mood board and inspiration images
- Donation candidate lists
- Cost-per-wear calculations and financial metrics
- Laundry habits and patterns

### 7.4 User Data Ownership

- **Export:** Users can export all their data in CSV or JSON format (CL-017). Export covers all entity types with full field data.
- **Delete:** Users can delete all module data from Settings (CL-018). Deletion is irreversible, requires biometric/PIN authentication, and removes all database records and photo files.
- **Portability:** Export format is documented and human-readable. CSV files open in any spreadsheet application. JSON files follow a published schema.
- **Selective deletion:** Users can delete individual items, outfits, boards, or capsules at any time from their respective detail screens.
- **Photo ownership:** All photos remain in the app's sandbox directory and are included in device backups (iCloud/Google). The app never copies photos to external locations without explicit user action.

### 7.5 Security Controls

| Control | Requirement | Notes |
|---------|-------------|-------|
| Data deletion authentication | Biometric (Face ID / Touch ID / fingerprint) or typed confirmation ("DELETE") required before clearing all data | Prevents accidental or unauthorized data wipes |
| Photo storage isolation | Clothing photos are stored in the app sandbox, not the shared photo library | Other apps cannot access wardrobe photos |
| Export file handling | Export files are generated locally and offered via the share sheet; app does not retain copies after sharing | User controls where the export file goes |
| No background data transmission | Module makes zero background network requests; weather requests only happen during active use when user opens suggestions | Verifiable by network monitoring |
| No fingerprinting | No device identifiers, advertising IDs, or hardware fingerprints are collected or transmitted | Fully anonymous usage |

---

## 8. Glossary

| Term | Definition |
|------|-----------|
| Active item | A clothing item with status "active," meaning it is currently in the user's accessible wardrobe (not stored, donated, or archived) |
| All-season | A season tag indicating the item is appropriate for all four seasons and should not be included in seasonal rotation |
| Batch capture | See "Quick Capture" |
| Board | See "Style Board" |
| Capsule wardrobe | A curated collection of a limited number of interchangeable clothing items (standard: 33 items) designed to maximize outfit combinations from minimal pieces |
| Catalog | The Wardrobe Catalog (CL-001), the central inventory of all clothing items |
| Category | A primary classification for clothing items: tops, bottoms, dresses, outerwear, shoes, accessories, activewear, swimwear, sleepwear, underwear, or other |
| Color harmony | An assessment of how well the wardrobe's colors complement each other based on color theory principles (complementary, analogous, monochromatic) |
| Condition | The physical state of a clothing item: new, good, fair, or worn out |
| Cost-per-wear | A financial metric calculated as purchase_price / times_worn, representing the amortized cost of each use of an item. Lower values indicate better return on investment |
| Coverage (style board) | The percentage of a style board's inspiration images that have at least one linked wardrobe item, calculated as (matched_images / total_images) * 100 |
| Donation candidate | A wardrobe item flagged for potential donation because it has not been worn within the configured threshold period (default: 365 days) |
| Donation threshold | The number of days since an item was last worn after which it is suggested for donation. Configurable in Settings (default: 365 days) |
| Freshness score | A scoring factor in the outfit suggestion algorithm that penalizes recently worn items and rewards items not worn in 14+ days |
| Item | A single clothing article tracked in the Wardrobe Catalog (a ClothingItem record) |
| Laundry status | The cleanliness state of a clothing item: clean, dirty, or washing |
| Module | A self-contained feature set within the MyLife hub app. MyCloset is one module among many (books, budget, fast, etc.) |
| Occasion | A usage context for clothing: casual, work, formal, active, lounge, date night, or outdoor |
| Outfit | A saved combination of 2 or more clothing items intended to be worn together |
| Outfit potential | An estimate of how many distinct outfits can be formed from a set of items, calculated as tops * bottoms * shoes * (outerwear + 1) |
| Packing list | A trip-specific checklist of wardrobe items to pack, with check-off tracking |
| Quick Capture | A streamlined camera mode for photographing multiple wardrobe items in rapid succession, with minimal metadata entry (name and category only), designed for initial wardrobe digitization |
| Rest items | Wardrobe items that are NOT included in a capsule wardrobe, representing candidates for storage, donation, or sale |
| Rotation | The seasonal process of putting away out-of-season items and bringing out in-season items |
| Season | One of four time periods (spring: Mar-May, summer: Jun-Aug, fall: Sep-Nov, winter: Dec-Feb by default) used to classify when clothing items are most appropriate |
| Status | The lifecycle state of a clothing item: active (in-use), stored (put away), donated (given away), sold (sold), or archived (removed from active use) |
| Style board | A visual mood board of collected inspiration images with optional links to existing wardrobe items, used for style planning and shopping guidance |
| Subcategory | A secondary classification within a category (e.g., t-shirt, blouse, and button-down are subcategories of tops) |
| Suggestion score | A weighted composite score (0.0 to 1.0) assigned to AI-generated outfit suggestions based on weather, freshness, occasion, feedback, and color harmony factors |
| Tag | A user-defined label that can be applied to multiple clothing items for custom organization beyond the built-in category/season/occasion taxonomy |
| Times worn | The cumulative count of how many times an item has been logged as worn |
| Versatility score | A scoring factor in the capsule suggestion algorithm based on how many saved outfits include an item. More outfits = more versatile |
| Wardrobe utilization | The percentage of the total wardrobe that has been worn in the last 30 days, calculated as (items_worn_30d / total_active_items) * 100 |
| Wardrobe value | The sum of all purchase_price values across all active items in the catalog |
| Wear log | A dated record of which items (and optionally which outfit) were worn on a given day |
| Wishlist | A shopping planning list of clothing items the user intends to purchase, with target prices, priorities, and conversion to wardrobe catalog entries on purchase |

---

## Appendix A: Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-06 | Claude (spec-mycloset agent) | Initial specification: Sections 1-2, features CL-001 through CL-012 |
| 1.1 | 2026-03-07 | Claude (Opus 4.6) | Features CL-013 through CL-019, Sections 4-8 (Data Architecture, Screen Map, Cross-Module Integration, Privacy and Security, Glossary) |

---

## Appendix B: Open Questions

| # | Question | Context | Resolution | Resolved Date |
|---|----------|---------|------------|--------------|
| 1 | Should photo background removal be automatic or user-triggered? | Better catalog visuals with cutout photos, but processing overhead and accuracy concerns | Deferred to v1.1 | - |
| 2 | Should AI suggestions use a local ML model or only rule-based scoring? | ML could improve over time, but adds binary size and complexity | Rule-based for v1; revisit for v2 | - |
| 3 | Should the weather API require an API key or use a free endpoint? | Privacy vs reliability tradeoff | Deferred to implementation phase | - |
| 4 | Should capsule wardrobes support sharing (exporting a capsule as a list)? | Useful for stylist collaboration, but adds sharing complexity | Deferred to v2 | - |
| 5 | Should there be an import feature for competitor apps (Cladwell CSV, Stylebook backup)? | Could accelerate user migration from competitors | Deferred to v1.2; needs competitor export format analysis | - |
