# GA4 & Meta Pixel Setup Guide for Receeps

> **Context:** The Receeps frontend already has GA4 and Meta Pixel code initialized in `frontend/src/App.jsx` (lines 35-36) with blank tracking IDs. Once you create the accounts and paste in the IDs, all event tracking (signup, login, vote, comment, etc.) will start firing immediately.

---

## Task 1.1: Google Analytics 4 (GA4)

### Create the Property

1. Go to [analytics.google.com](https://analytics.google.com)
2. Click **Admin** (gear icon, bottom-left)
3. Click **+ Create Property**
4. Property name: `Receeps`
5. Reporting time zone: your timezone
6. Currency: USD
7. Click **Next**, select **Business size** and **objectives** (choose "Generate leads" and "Raise brand awareness")
8. Click **Create**

### Get the Measurement ID

1. After creating the property, you'll be prompted to set up a **Data Stream**
2. Choose **Web**
3. Website URL: `https://receeps.com`
4. Stream name: `Receeps Web`
5. Click **Create stream**
6. Copy the **Measurement ID** — it looks like `G-XXXXXXXXXX`

### Plug It In

Open `frontend/src/App.jsx` and replace line 35:

```diff
- const googleTrackingId = ""
+ const googleTrackingId = "G-XXXXXXXXXX"  // your actual ID
```

### Mark Key Conversions

Once data starts flowing (after deploy):

1. In GA4, go to **Admin > Events**
2. Find these events and toggle **Mark as conversion**:
   - `signup_completed`
   - `receipt_submitted`
   - `vote_cast`

---

## Task 1.2: Meta Pixel (Facebook)

### Create the Pixel

1. Go to [business.facebook.com/events_manager](https://business.facebook.com/events_manager)
   - If you don't have a Meta Business account, create one first at [business.facebook.com](https://business.facebook.com)
2. Click **Connect Data Sources** (green + button)
3. Select **Web**
4. Choose **Meta Pixel**
5. Pixel name: `Receeps Pixel`
6. Click **Create Pixel**
7. Choose **Install code manually** (skip partner integrations)
8. Copy the **Pixel ID** — it's a numeric string like `1234567890123456`

### Plug It In

Open `frontend/src/App.jsx` and replace line 36:

```diff
- const metaPixelId = ""
+ const metaPixelId = "1234567890123456"  // your actual ID
```

### Verify It Works

1. Install the [Meta Pixel Helper](https://chrome.google.com/webstore/detail/meta-pixel-helper/) Chrome extension
2. Visit your site after deploying
3. The extension icon should show a green checkmark with events firing

---

## After Both Are Set Up

- Deploy the updated `App.jsx` with both IDs filled in
- All 9 GA4 events from Phase 1 (signup, login, receipt submit, vote, comment, topic create, receipt view, topic view, search) will start recording automatically
- Meta Pixel will track `PageView` on every navigation, plus `CompleteRegistration` on signup and `Lead` on receipt submission (once those specific Pixel events are wired in Phase 2)
- Verify in **GA4 Real-Time report** and **Meta Events Manager** within 5 minutes of your first page load
