# MyCar -- UI/UX Design Prompts

**Tagline:** Your garage, fully tracked
**Icon:** 🚗 | **Accent:** #3B82F6 | **Tier:** Premium
**Bottom Tabs (mobile):** Home | Vehicles | Fuel | Service | Settings
**Total Screens:** 19 mobile + 8 web = 27

---

## Prompt 1: Mobile Screens 1--12

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyCar
Accent color: #3B82F6
Icon: 🚗
Bottom tabs: Home | Vehicles | Fuel | Service | Settings

Design 12 mobile screens for a car management app. Each screen should use the Cool Obsidian dark theme with glass morphism cards, #3B82F6 accent color, and smooth rounded corners.

1. HOME (index.tsx)
   - Vehicle selector dropdown at top (current vehicle name + chevron)
   - Next due maintenance card (glass surface): service name, due date or due mileage, urgency badge (green/yellow/red)
   - Fuel economy summary card: average MPG (large number), trend arrow (up/down), last fill date
   - Quick stats row: total vehicles count, total services count, total fuel cost ($)
   - Bottom tab bar: Home (active), Vehicles, Fuel, Service, Settings

2. VEHICLES (vehicles.tsx)
   - Section header "My Vehicles" with "+" add button
   - Multi-vehicle list cards: photo thumbnail (left), make/model/year (primary text), current mileage (secondary text), fuel type badge
   - Each card tappable with right chevron
   - Empty state: illustration + "Add your first vehicle" CTA button

3. ADD VEHICLE (vehicle/add.tsx)
   - Nav bar with "Cancel" (left) and "Save" (right)
   - Form fields: Make (text input), Model (text input), Year (number picker), VIN (text input with scan icon), Current Mileage (number input)
   - Fuel type picker: segmented control (Gas / Diesel / Electric / Hybrid / Other)
   - Photo upload area: dashed border box with camera icon, "Add Photo" label
   - Color picker (optional)

4. VEHICLE DETAIL (vehicle/[id].tsx)
   - Hero photo of vehicle (full width, rounded bottom corners)
   - Vehicle name (make model year) as title
   - Specs grid: fuel type, VIN (masked), mileage, color
   - Service history timeline: vertical line with dot markers, each entry shows service type + date + cost
   - Total cost summary card: lifetime spend on this vehicle
   - Edit button (top right), Delete (bottom, danger red)

5. SERVICE HISTORY (service-history.tsx)
   - Vehicle selector at top
   - Chronological service log (newest first)
   - Each entry card: service type icon + name, date, cost ($), mileage at service
   - Filter chips: All | Oil | Tires | Brakes | Battery | Other
   - "Add Service" floating action button

6. ADD SERVICE (service/add.tsx)
   - Nav bar with "Cancel" and "Save"
   - Vehicle selector (if multiple vehicles)
   - Service type picker grid: Oil Change, Tires, Brakes, Battery, Filters, Transmission, Coolant, Inspection, Other -- each with icon
   - Date picker
   - Cost input ($)
   - Mileage at service (number input)
   - Notes text area (optional)

7. FUEL LOG (fuel.tsx)
   - Vehicle selector at top
   - Fuel fill-up list (newest first): date, gallons, cost, calculated MPG per fill
   - MPG comparison mini-chart (sparkline per entry)
   - Price trend chart: line graph of price-per-gallon over time
   - Summary stats: average MPG, total gallons, total spend
   - "Add Fill" floating action button

8. ADD FUEL (fuel/add.tsx)
   - Nav bar with "Cancel" and "Save"
   - Vehicle selector
   - Gallons/Liters input (number, with unit label)
   - Price per unit input ($)
   - Total cost (auto-calculated, editable)
   - Odometer reading (number input)
   - Station name (text input, optional)
   - Full tank toggle switch
   - Date picker

9. MAINTENANCE SCHEDULE (maintenance.tsx)
   - Vehicle selector at top
   - Upcoming maintenance items list: service name, due condition (e.g., "in 2,000 mi or 3 months"), status badge (OK/Due Soon/Overdue)
   - Each item expandable to show interval details (mileage interval OR time interval)
   - Snooze button per item (snooze 1 week / 1 month / 1,000 mi)
   - "Add Reminder" button

10. TRIP LOG (trips.tsx)
    - Vehicle selector at top
    - Trip list cards: date, distance (mi/km), purpose badge (Business -- blue / Personal -- green), estimated cost
    - Monthly summary at top: total miles, total trips, business vs personal split
    - Filter: All | Business | Personal
    - "Add Trip" floating action button

11. ADD TRIP (trip/add.tsx)
    - Nav bar with "Cancel" and "Save"
    - Vehicle selector
    - Start odometer input
    - End odometer input
    - Distance auto-calculated (editable)
    - Purpose picker: segmented control (Business / Personal)
    - Date picker
    - GPS tracking toggle ("Track live" with location icon)
    - Notes (optional)

12. DOCUMENTS (documents.tsx)
    - Vehicle selector at top
    - Document vault list: document name, type badge (Insurance/Registration/Inspection/Title/Other), expiry date (if applicable), status (Valid/Expiring Soon/Expired)
    - Expiring soon items highlighted with yellow border
    - Expired items highlighted with red border
    - Thumbnail previews for uploaded images/PDFs
    - "Add Document" floating action button
```

---

## Prompt 2: Mobile Screens 13--19 + Web Pages

```
Design system: Cool Obsidian (dark theme — #0A0A0F background, #12121A surfaces, glass morphism, rgba(255,255,255,0.04) glass fills)

App: MyCar
Accent color: #3B82F6
Icon: 🚗

Design 7 remaining mobile screens and 7 web pages for a car management app. Use Cool Obsidian dark theme throughout.

MOBILE SCREENS:

13. ADD DOCUMENT (document/add.tsx)
    - Nav bar with "Cancel" and "Save"
    - Vehicle selector
    - Document type classification picker: Insurance, Registration, Inspection, Title, Other
    - Document name (text input)
    - Expiry date picker (optional)
    - File upload area: camera capture button, photo library button, file picker button
    - Preview thumbnail of uploaded file
    - Notes (optional)

14. TIRES (tires.tsx)
    - Vehicle selector at top
    - Current tire set card: brand, model, size (e.g., 225/45R17)
    - Tread depth tracker: 4 positions (FL/FR/RL/RR) with depth value and wear indicator (green/yellow/red)
    - Rotation schedule: last rotation date, next due date, interval setting
    - Total mileage on current set
    - Tire history list (past sets)
    - "Add Tire Set" button

15. PARKING SAVER (parking.tsx)
    - Map view (top half) with pin showing saved parking location
    - "Save Parking" large button (when no location saved)
    - When saved: address text, distance from current location, walking directions button
    - Meter timer: time remaining (large countdown), set timer button, alert when expiring
    - Photo of parking spot (thumbnail, tap to view full)
    - "Clear Parking" button
    - Notes field (level number, spot number, etc.)

16. FUEL PRICES (fuel-prices.tsx)
    - Map header showing nearby stations as pins
    - Nearby fuel price comparison list: station name, brand logo, distance, regular/mid/premium prices
    - Sort toggle: by Price (lowest first) / by Distance (nearest first)
    - Last updated timestamp
    - Fuel type filter: Regular | Mid | Premium | Diesel

17. VIN DECODER (vin.tsx)
    - VIN input field with scan (camera) icon
    - "Decode" button
    - Decoded results card (glass surface): Make, Model, Year, Engine type, Transmission, Drivetrain, Country of manufacture, Plant
    - "Save to Vehicle" button (links decoded info to a vehicle profile)
    - History of decoded VINs

18. OBD-II (obd.tsx)
    - Bluetooth connection status indicator (connected/disconnected/searching)
    - "Connect" button with device selector
    - Live data dashboard (when connected): RPM, speed, coolant temp, engine load
    - Trouble codes list: code (e.g., P0301), description, severity badge (Info/Warning/Critical)
    - "Clear Codes" button (with confirmation dialog)
    - "Scan" button to read current codes

19. SETTINGS (settings.tsx)
    - Units section: Distance (Miles/Kilometers toggle), Volume (Gallons/Liters toggle), Currency selector
    - Default vehicle selector
    - Notifications section: maintenance reminders toggle, fuel price alerts toggle, parking meter alerts toggle
    - Data section: Export data (CSV), Import data, Clear all data (danger button with confirmation)
    - About section: app version, support link

WEB PAGES:

20. HUB (/car)
    - Desktop dashboard layout with sidebar navigation
    - Vehicle overview card (selected vehicle photo, key stats)
    - Recent activity feed (latest services, fuel fills, trips)
    - Upcoming maintenance alerts panel
    - Quick action buttons: Add Fuel, Add Service, Log Trip

21. VEHICLES (/car/vehicles)
    - Vehicle grid (card layout, 2-3 columns)
    - Each card: photo, make/model/year, mileage, fuel type badge
    - Full CRUD: add/edit/delete with modal forms
    - Click card to expand detail view

22. SERVICE (/car/service)
    - Service history table: sortable columns (date, type, cost, mileage, vehicle)
    - Filter bar: vehicle selector, service type, date range
    - Maintenance schedule panel (sidebar or tab)
    - Add service modal form

23. FUEL (/car/fuel)
    - Fuel economy chart (line graph, MPG over time)
    - Fuel log table: date, gallons, cost, MPG, station
    - Cost analysis section: monthly/yearly fuel spend
    - Vehicle comparison (if multiple)

24. TRIPS (/car/trips)
    - Trip log table: date, vehicle, distance, purpose, cost
    - Business vs personal summary cards
    - Mileage report generator (date range, purpose filter, exportable)
    - Map view option for GPS-tracked trips

25. DOCUMENTS (/car/documents)
    - Document vault grid: thumbnails with type badges
    - Expiry calendar view: upcoming expirations
    - Upload area with drag-and-drop support
    - Document preview panel (click to view full)

26. REMINDERS (/car/reminders)
    - Maintenance reminder management table
    - Columns: service type, vehicle, interval, next due, status
    - Bulk actions: snooze, mark complete, edit interval
    - Add custom reminder form
```
