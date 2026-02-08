Perfect! Now I have comprehensive information. Let me create a detailed feature requirements document.

---

# ShipHawk Templates - Detailed Feature Requirements Document

## Executive Summary

**shiphawk-templates** is a Liquid-templated document generation system for ShipHawk's shipping platform. It provides HTML packing slips, pick tickets, and JSON-based carton/pallet labels for 20+ customers. The repository was recently reorganized (Feb 2026) to establish shared infrastructure, canonical field naming, and comprehensive developer documentation.

**Current State (2026-02-05):**
- 28 HTML packing slip templates (20 customer directories)
- 7 carton label JSON configurations
- 5 pallet label JSON configurations
- 1 pick ticket template
- Documented workflow for template creation and customization
- Comprehensive Liquid variable reference library
- 80% reduction in CSS duplication through shared stylesheets

---

## 1. Application Overview

### 1.1 Purpose and Scope

shiphawk-templates provides **document-as-code infrastructure** for generating customer-specific shipping documents (packing slips, labels, pick tickets) from standardized ShipHawk shipment data. The system:

- Accepts shipment JSON from ShipHawk's API
- Renders documents using Liquid templating
- Outputs HTML for PDF conversion (packing slips, pick tickets) or JSON for label printer integration
- Supports unlimited customer customization through template variants and field mappings
- Maintains 20+ production customer templates

### 1.2 Key Characteristics

- **No Build Step** — Templates are flat files (HTML, JSON) with no compilation or preprocessing
- **Template-First** — Liquid templates are the single source of truth; no code generation
- **Configuration-Light** — Minimal JSON configs for customer field mappings and layout preferences
- **PDF Renderer Dependency** — HTML templates must use table-based layout with inline styles (ShipHawk's PDF renderer requirement)
- **Git-Versioned** — All templates, configs, and documentation tracked in version control

---

## 2. Technical Stack

### 2.1 Core Technologies

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Template Language** | Liquid | Shopify | Variable interpolation, conditionals, loops, filters |
| **Markup (Packing Slips, Pick Tickets)** | HTML 5 | — | W3C-compliant structure for PDF rendering |
| **Styling** | Inline CSS + Shared Stylesheets | — | Table-based layout with inline styles (PDF compliance) |
| **Label Config** | JSON | — | Zone-based positioning system for label printer integration |
| **Field Mapping** | JSON | — | Customer-specific field name resolution |
| **Documentation** | Markdown | — | Variable references, patterns, development guides |

### 2.2 External Dependencies

- **ShipHawk API** — Provides shipment, order, item, and address data
- **PDF Renderer** — Converts HTML → PDF (ShipHawk-managed, table-based layout required)
- **Label Printer System** — Consumes JSON label configs and renders to physical labels
- **Git** — Version control for all templates and documentation

### 2.3 Supported Platforms

- **Web Browsers** — For HTML preview/debugging
- **PDF Readers** — For generated packing slips (standard PDF support required)
- **Label Printers** — Zebra, generic thermal printers (via JSON config consumption)

---

## 3. Architecture and Design

### 3.1 Directory Structure

```
shiphawk-templates/
├── templates/
│   ├── packing-slips/
│   │   ├── customers/
│   │   │   ├── amazon/                    # Customer directory
│   │   │   │   └── amazon-packing-slip.html
│   │   │   ├── grainger/
│   │   │   │   └── grainger-packing-slip.html
│   │   │   ├── guardair/                  # Multi-variant customers
│   │   │   │   ├── guardair-global-packing-slip.html
│   │   │   │   ├── guardair-grainger-packing-slip.html
│   │   │   │   └── guardair-zoro-packing-slip.html
│   │   │   └── [17 more customer directories]
│   │   └── _base/                         # Base templates (for copying)
│   │       ├── standard-paginated.html
│   │       └── standard-single-page.html
│   │
│   ├── pick-tickets/
│   │   ├── customers/
│   │   │   └── margo/
│   │   │       └── margo-pick-ticket.html
│   │   └── _base/
│   │
│   ├── labels/
│   │   ├── carton-labels/
│   │   │   ├── customers/
│   │   │   │   ├── amazon/
│   │   │   │   │   └── amazon-carton.json
│   │   │   │   ├── proclip/
│   │   │   │   │   └── proclip-carton.json
│   │   │   │   └── [5 more customers]
│   │   │   └── _base/
│   │   │
│   │   └── pallet-labels/
│   │       ├── customers/
│   │       │   ├── amazon/
│   │       │   │   └── amazon-pallet.json
│   │       │   └── [4 more customers]
│   │       └── _base/
│   │
│   └── assets/
│       └── css/
│           ├── base.css                   # Universal reset, print settings
│           └── packing-slip-standard.css # Common packing slip patterns
│
├── config/
│   └── reference-fields/
│       ├── standard-fields.json           # Canonical field registry
│       └── customer-mappings/
│           ├── grainger.json
│           └── sample-co.json
│
├── docs/
│   ├── variable-reference/
│   │   └── reference-fields.md           # Complete Liquid variable guide
│   ├── visual-reference/
│   │   ├── README.md                     # Pattern matching guide
│   │   └── samples/                      # Customer example PDFs
│   ├── template-development/
│   │   └── creating-new-template.md      # Step-by-step guide
│   └── customer-requirements/
│       └── sample-co-crd.md              # Customer requirement docs
│
├── CLAUDE.md                              # Claude Code project guidance
├── README.md                              # Project overview
└── timeline.md                            # Development history
```

### 3.2 Data Flow

```
ShipHawk API
    ↓
Shipment JSON
(order, items, addresses, references)
    ↓
Template Selection
(customer → template file)
    ↓
Liquid Rendering Engine
(resolve variables, conditionals, loops)
    ↓
HTML Output (Packing Slip)  OR  JSON Output (Label Config)
    ↓
PDF Converter              OR  Label Printer Driver
    ↓
PDF File                    OR  Thermal Label
```

### 3.3 Shared Infrastructure

**Shared CSS System (80% duplication reduction):**
- `base.css` — Universal reset, print settings (`@page 8.5"×11"`), container layouts
- `packing-slip-standard.css` — Common patterns: header, details table, shipping info, items table, footer

**Canonical Field Naming:**
- `standard-fields.json` — Single source of truth for field naming
- Resolves 40+ naming variations (e.g., "PO#", "PO Number", "Purchase Order") → canonical names
- Customer mappings (`customer-mappings/*.json`) map customer-specific field names to canonical names

**Template Organization:**
- `templates/[type]/customers/[customer-name]/` — Production templates
- `templates/[type]/_base/` — Base templates for new customers
- Naming convention: `[customer-name]-[document-type].html` or `[customer-name]-[variant]-[document-type].html`

---

## 4. Features List

### 4.1 Template Types

#### 4.1.1 Packing Slips (HTML + Liquid)

**Purpose:** Customer-facing order documents accompanying shipments

**Current State:**
- **28 HTML templates** across **20 customer directories**
- **Paginated** (standard: 15 items/page)
- **Responsive** to varying item counts (1, 10, 30+ items tested)

**Customers with Multiple Variants:**
- **GuardAir** — 3 variants (global, Grainger reseller, Zoro reseller)
- **MSC** — 2 variants (standard, SawStop-specific)
- **SawStop** — 3 variants (default, Zoro reseller, test)
- **Jacks** — 3 variants (LIVE, PREVIEW, standard)
- **Sample-Co** — 2 variants (standard, PREVIEW)

**Features:**
- Logo positioning (top-right, top-left, centered)
- Address layouts (side-by-side shipping/billing, shipping-only, floating)
- Items table variations (with/without pricing, with/without EDI fields)
- Pagination for 15+ items
- Barcode support (order#, PO#)
- Page count indicators
- Customer-specific disclaimers and footer text

#### 4.1.2 Pick Tickets (HTML + Liquid)

**Purpose:** Internal warehouse picking documents sorted for fulfillment

**Current State:**
- **1 template** (Margo)
- Warehouse-optimized layout
- Items sorted by quantity (descending)
- Barcode for order tracking
- Customer/PO information for staff reference

#### 4.1.3 Carton Labels (JSON)

**Purpose:** Individual box shipping label configurations (typically 4" × 6")

**Current State:**
- **7 carton label configs** across 7 customers
- Zone-based positioning system (X, Y coordinates in inches)
- Font size constraints: `[12, 17, 22, 28, 33, 44, 67, 100, 111, 133, 150, 170, 190, 220]` pt

**Customers:**
- Amazon, Bunzl, Generic Freight, ProClip, SawStop/MSC, TrueValue (standard + GS1 variant)

**Features:**
- Multi-zone layout (A-I zones, each with independent fields)
- Text blocks (static or variable)
- Barcode integration (Code 39, Code 128, SSCC18)
- Positioning control (exact inch/point placement)
- Font styling (bold, size, justification)
- Block reusability (address blocks, item lists)

#### 4.1.4 Pallet Labels (JSON)

**Purpose:** Large pallet shipping label configurations

**Current State:**
- **5 pallet label configs** across 5 customers
- Typically larger dimensions than carton labels
- BOL#, PRO#, tracking barcodes
- Handling unit information

**Customers:**
- Amazon, Argco, Middleby (SB + test), Pivot

---

### 4.2 Customization Capabilities

#### 4.2.1 Field Mapping
- Map customer-specific field names to canonical names
- Support customer references at order and item levels
- Optional field handling with fallback chains

#### 4.2.2 Layout Customization
- Logo positioning and sizing
- Address block layout (side-by-side, stacked, floating)
- Items table columns (SKU, description, quantity, price, UOM, etc.)
- Special sections (disclaimers, instructions, contact info)

#### 4.2.3 Pagination
- Standard: 15 items per page (configurable per customer)
- Automatic page breaks for 30+ item orders
- Page count indicators

#### 4.2.4 Barcode Integration
- Order number barcodes (Code 39, Code 128)
- PO# barcodes
- SSCC18 for pallet labels
- Inline barcode generation via Liquid filters

#### 4.2.5 Conditional Display
- Show/hide fields based on data availability
- Customer-specific warnings and disclaimers
- EDI-specific field variants

---

## 5. Template System Details

### 5.1 Liquid Template Language

**Standard Version:** Shopify Liquid (full feature set)

**Key Capabilities:**
- **Variables:** `{{ object.field }}`
- **Filters:** `{{ value | filter }}`, `{{ date | date: "%m/%d/%Y" }}`
- **Conditionals:** `{% if condition %} ... {% endif %}`
- **Loops:** `{% for item in items %} ... {% endfor %}`
- **Comments:** `{% comment %} ... {% endcomment %}`

**Filters Used:**
- `date` — Format dates (e.g., `%m/%d/%Y`, `%d-%b-%Y`)
- `newline_to_br` — Convert newlines to `<br>` tags
- `inline_barcode` — Generate barcodes (Code 128, Code 39)
- `default` — Fallback values
- `upcase` / `downcase` — Case conversion

**Patterns:**
```liquid
{# Pagination #}
{% assign items_per_page = 15 %}
{% assign pages = items.size | times: 1.0 | divided_by: items_per_page | ceil %}
{% for page in (1..pages) %}
  {% assign offset = page | minus: 1 | times: items_per_page %}
  {% for item in items limit: items_per_page offset: offset %}
    ...
  {% endfor %}
{% endfor %}

{# Safe Defaults #}
{{ order.references["PO#"] | default: "N/A" }}

{# Conditional Display #}
{% if shipment.tracking_number %}
  <div>Tracking: {{ shipment.tracking_number }}</div>
{% endif %}
```

### 5.2 Available Data Objects

**Section 1: Native Fields** (directly accessible, no mapping needed)

| Object | Key Fields | Liquid Syntax |
|--------|-----------|---------------|
| **account** | company_name, logo_src | `{{ account.company_name }}` |
| **shipment** | ship_date, tracking_number, carrier_name, shipping_service, pro_number, total_weight, currency, barcode images | `{{ shipment.ship_date \| date: "%m/%d/%Y" }}` |
| **order** | order_number, order_date, shipping_price, billing address fields | `{{ order.order_number }}` |
| **origin** (ship from) | name, company, street1, street2, city, state, zip, country, phone, email | `{{ origin.street1 }}` |
| **destination** (ship to) | name, company, street1, street2, city, state, zip, country, phone, email | `{{ destination.city }}` |
| **items** (line items) | sku, upc, name, description, quantity, quantity_ordered, value, sum_value, weight, line_number, inventory_identifiers | `{{ item.sku }}` (in loop) |
| **packages** | tracking_number, dimensions, weight, total_weight, line_items (nested) | `{{ package.tracking_number }}` (in loop) |

**Section 2: Order-Level References** (A-Series: 64 canonical fields)

Accessed via `{{ order.references["Field Name"] }}`:
- PO# (A38) — Purchase order number
- Account# (A2) — Customer account identifier
- BOL# (A8) — Bill of lading
- Customer Order #(EDI) (A15) — EDI order number
- Location (A29) — Warehouse code
- FOB (A19) — Free on board point
- Terms (A57) — Payment terms
- Shipping Instructions (A49) — Special handling notes
- [58 more canonical order-level fields]

**Section 3: Item-Level References** (B-Series: 20 canonical fields)

Accessed via `{{ item.references["Field Name"] }}`:
- UOM (B19) — Unit of measure
- Serial Number (B15) — Serial identifier
- Buyer Part # (EDI) (B5) — Buyer's part number
- Vendor Part # (EDI) (B20) — Vendor's part number
- Color (B6), Size (B17), Model # (B12)
- [15 more canonical item-level fields]

### 5.3 Layout Constraints

**Critical Requirement: Table-Based Layout with Inline Styles**

ShipHawk's PDF renderer requires strict adherence to table-based HTML with inline styles:

```html
<!-- CORRECT ✓ -->
<table cellspacing="0" cellpadding="2" border="0" style="width: 100%">
  <tr>
    <td style="width: 322px; font-weight: bold; font-size: 20px">
      {{ account.company_name }}
    </td>
  </tr>
</table>

<!-- WRONG ✗ -->
<div class="header-row">  {# No div-based layout #}
  <div class="company-info">{{ account.company_name }}</div>
</div>
```

**Why?**
- ShipHawk's PDF renderer is table-aware and optimizes table rendering
- Div-based CSS may fail or render inconsistently in PDF conversion
- Inline styles guarantee consistent rendering across PDF engines

**Inline Style Guidelines:**
- Width specifications: `style="width: 100%"` or `style="width: 322px"`
- Alignment: `align="left" | "center" | "right"`, `valign="top" | "middle" | "bottom"`
- Spacing: `cellspacing="0"`, `cellpadding="2"`
- Borders: `border="0"` or inline `style="border: 1px solid black"`
- Typography: `style="font-weight: bold; font-size: 14px; font-family: Arial"`
- Colors: `style="color: #333; background-color: #f2f2f2"`

**Print Settings (in base.css):**
```css
@page {
  size: 8.5in 11in;
  margin: 0.5in;
}

body {
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 0;
}

table {
  border-collapse: collapse;
  page-break-inside: avoid;
}

tr {
  page-break-inside: avoid !important;
}

thead {
  display: table-header-group;  /* Repeat header on page breaks */
}
```

### 5.4 Label Configuration Format

**Zone-Based JSON Structure:**

```json
{
  "zones": [
    {
      "title": "Zone A",
      "width": 2,
      "height": 1.265,
      "position": [0, 0],
      "description": "Ship From",
      "fields": [
        {
          "text": "SHIP FROM",
          "font_type": "bold",
          "font_size": 28
        },
        {
          "variable": "origin_company"
        },
        {
          "text": "${origin_street1} ${origin_street2}"
        }
      ]
    }
  ],
  "blocks": {
    "origin_address": {
      "fields": [ ... ]
    }
  }
}
```

**Zone Fields:**
- `title` (string) — Zone identifier
- `width`, `height` (inches) — Zone dimensions
- `position` (array) — [x, y] coordinates in inches
- `description` (string) — Purpose/label
- `fields` (array) — Text, variables, or barcodes

**Field Types:**
1. **Text (static):** `{ "text": "SHIP FROM" }`
2. **Variable:** `{ "variable": "origin_company" }`
3. **Barcode:** `{ "barcode": { "type": "code128", "height": 0.8 }, "variable": "..." }`

**Font Sizes (Allowed only):** 12, 17, 22, 28, 33, 44, 67, 100, 111, 133, 150, 170, 190, 220

---

## 6. Customer Templates Overview

### 6.1 Current Customer Coverage

**20 Unique Customers with 28+ Templates:**

| Customer | Packing Slips | Variants | Carton | Pallet | Pick Ticket | Notes |
|----------|--------------|----------|--------|--------|-------------|-------|
| **Amazon** | 1 | — | ✓ | ✓ | — | EDI fields, SSCC18 barcodes |
| **Argco** | 1 | — | — | ✓ | — | Detailed items, newline handling |
| **Bunzl** | — | — | ✓ | — | — | Carton label only |
| **Current** | 1 | — | — | — | — | Generic template |
| **Fastenal** | 1 | — | — | — | — | FOB, ship dates |
| **Generic** | — | — | ✓ | — | — | Freight label base |
| **Grainger** | 1 | — | — | — | — | No pricing, EDI integration |
| **GuardAir** | 3 | Zoro, Grainger | — | — | — | International, multi-PO |
| **Home Depot** | 1 | — | — | — | — | Vendor part numbers |
| **Jacks** | 3 | LIVE, PREVIEW | — | — | — | Preview variants for QA |
| **Margo** | 1 | — | — | — | ✓ | Pick ticket (sorted by qty) |
| **Middleby** | — | — | — | ✓ | — | SB variant, test variant |
| **Millennium** | 1 | — | — | — | — | Centered logo |
| **MSC** | 2 | SawStop | — | — | — | Disclaimer box, terms |
| **Pivot** | — | — | — | ✓ | — | Pallet label |
| **PPR** | 1 | — | — | — | — | — |
| **ProClip** | 1 | — | ✓ | — | — | Floating Ship To, UPC barcodes |
| **Riad** | 1 | — | — | — | — | Alternative header |
| **SafariLand** | 1 | — | — | — | — | Product options |
| **Sample-Co** | 2 | PREVIEW | — | — | — | Reference customer |
| **SawStop** | 3 | Default, Zoro, Test | ✓ | — | — | Test variant |
| **TouchTunes** | 1 | — | — | — | — | — |
| **TrueValue** | — | — | ✓ | — | — | Standard + GS1 variant |
| **WECS** | 1 | — | — | — | — | — |
| **Wise Eye** | 1 | — | — | — | — | — |

### 6.2 Layout Pattern Distribution

**Header Styles:**
- Logo Right (60%) — Company info left, logo top-right (Amazon, Grainger, Fastenal, MSC, Home Depot)
- Logo Left (20%) — Logo left, title right (GuardAir Global, ProClip)
- Centered (15%) — Logo centered, title below (Millennium, Home Depot)
- Two-Column (5%) — Logo + info left, title right (SafariLand)

**Address Layouts:**
- Ship To Only (55%) — Single address block, details on side (Grainger, MSC, SafariLand)
- Side-by-Side (30%) — Billing and shipping addresses in columns (Amazon, Fastenal, GuardAir)
- Floating Ship To (15%) — Top-right, minimal layout (ProClip)

**Items Table Styles:**
- No Pricing (45%) — SKU, description, quantity (Grainger, MSC)
- Standard (35%) — SKU, description, quantity, price (Amazon, Fastenal)
- Detailed (15%) — BPN, VPN, SKU, description, UOM, qty (Argco, SafariLand)
- Compact (5%) — Description, quantity only (ProClip)

**Special Features:**
- EDI Integration (40%) — Grainger, Amazon, GuardAir, MSC
- Barcode Support (50%) — Order#, PO#, SSCC18
- Pagination (78%) — 15 items/page standard
- Disclaimers (25%) — MSC, GuardAir Global

---

## 7. Configuration System

### 7.1 Standard Fields Registry (standard-fields.json)

**Purpose:** Single source of truth for canonical field naming

**Schema:**
```json
{
  "schema_version": "1.0",
  "description": "Canonical reference field names",
  "last_updated": "2026-02-04",

  "order_fields": {
    "po_number": {
      "canonical_name": "PO#",
      "aliases": ["PO Number", "Customer PO", "Purchase Order"],
      "description": "Customer purchase order number",
      "data_type": "string",
      "common_usage": "{{ order.references[\"PO#\"] }}",
      "barcode_compatible": true
    },
    ...
  },

  "item_fields": {
    "unit_of_measure": {
      "canonical_name": "UOM",
      "aliases": ["Unit of Measure", "Unit"],
      "description": "Unit of measure",
      "data_type": "string",
      "common_usage": "{{ item.references[\"UOM\"] | default: \"EA\" }}"
    },
    ...
  }
}
```

**Resolves 40+ Naming Variations:**
- PO# vs PO Number vs Customer PO vs Purchase Order
- Customer# vs Customer Number vs Account Number vs Acct. No.
- UOM vs Unit of Measure vs Unit
- [37 more canonical fields]

### 7.2 Customer Field Mappings (customer-mappings/*.json)

**Purpose:** Map customer-specific field names to canonical names; document layout preferences

**Structure:**
```json
{
  "customer": "Grainger",
  "customer_code": "GRAINGER",
  "template_files": [
    "templates/packing-slips/customers/grainger/grainger-packing-slip.html"
  ],

  "field_mappings": {
    "order.references": {
      "Order Number": {
        "canonical": "order_number",
        "required": true,
        "description": "Internal Grainger order number"
      },
      ...
    },
    "item.references": {
      "UOM": {
        "canonical": "unit_of_measure",
        "required": false
      },
      ...
    }
  },

  "layout_config": {
    "items_per_page": 15,
    "show_prices": false,
    "header_style": "logo-right",
    "address_layout": "side-by-side"
  },

  "special_requirements": {
    "edi_integration": true,
    "no_pricing": true,
    "disclaimer_text": "..."
  },

  "testing_notes": [
    "Test with 1 item, 15 items, 30+ items",
    "Verify EDI fields populate correctly"
  ]
}
```

**Current Mappings:**
- `grainger.json` — Full example
- `sample-co.json` — Reference implementation

---

## 8. Constraints and Technical Requirements

### 8.1 PDF Renderer Constraints

**Critical: Table-Based Layout Only**
- No `<div>` containers with CSS classes
- No external stylesheets (CSS must be inline or in `<style>`)
- No CSS Grid or Flexbox
- Tables must use `border-collapse: collapse` and explicit widths

**Why:** ShipHawk's PDF renderer is table-optimized; non-table layouts fail or render inconsistently.

### 8.2 Label Font Size Constraints

**Allowed Font Sizes (in points):**
```
12, 17, 22, 28, 33, 44, 67, 100, 111, 133, 150, 170, 190, 220
```

**Rationale:** Thermal printer capabilities; non-standard sizes may not render correctly.

### 8.3 Barcode Format Constraints

**Supported Barcode Types:**
- **Code 128** — Alphanumeric, dense encoding
- **Code 39** — Alphanumeric, standard retail
- **SSCC18** — 18-digit serial shipping container code (pallet labels)

**Character Set Limitations:**
- Code 39: A-Z, 0-9, and special characters `- . $ / + % *`
- Code 128: Full ASCII range (128 characters)

### 8.4 Liquid Template Limitations

- **No Direct Math:** Use Liquid filters instead (`times`, `divided_by`, `ceil`)
- **No Custom Functions:** Limited to built-in filters
- **No External APIs:** Variables must come from ShipHawk data object
- **No File I/O:** Templates can't read external files (assets referenced via URLs)

### 8.5 Browser/PDF Compatibility

**Tested Environments:**
- Chrome/Chromium (for preview)
- Modern PDF readers (Adobe Reader, Preview on macOS)
- ShipHawk's PDF conversion service

**Unsupported:**
- CSS Grid, Flexbox, CSS Custom Properties
- `@supports` queries (not reliably handled in PDF)
- JavaScript (PDFs don't execute code)

---

## 9. Workflow and Development

### 9.1 Template Creation Workflow

**Step 1: Gather Requirements**
- Obtain customer sample (PDF, image, or physical)
- List required data fields
- Document special requirements (barcodes, logos, disclaimers)
- Test samples with varying item counts (1, 10, 30+)

**Step 2: Match to Patterns**
- Open [Visual Pattern Reference](docs/visual-reference/README.md)
- Compare sample to Quick Reference Table
- Identify header style, address layout, items table type
- Select closest existing customer as base

**Step 3: Map Fields**
- Use [Variable Reference](docs/variable-reference/reference-fields.md)
- Create field mapping table: Customer Field → Liquid Variable
- Identify native fields vs. reference fields
- Document fallback chains for optional fields

**Step 4: Select Base Template**
- Choose from `templates/[type]/_base/`:
  - `standard-paginated.html` — 15+ items
  - `standard-single-page.html` — <15 items
  - `landscape.html` — Landscape orientation
- Copy to `templates/[type]/customers/[customer-name]/[customer-name]-[document-type].html`

**Step 5: Customize**
- Update header (logo, company info)
- Adjust address block layout
- Modify items table columns
- Add customer-specific sections (disclaimers, instructions)
- Use shared CSS classes where possible

**Step 6: Create Configuration**
- Create `config/reference-fields/customer-mappings/[customer-name].json`
- Document field mappings (order and item levels)
- Specify layout preferences
- Add testing notes

**Step 7: Test**
- Test with 1 item, 15 items, 30+ items
- Verify pagination on multi-page orders
- Check barcode generation
- Validate special fields (EDI, references)
- Test PDF output (color, layout, page breaks)

**Step 8: Document**
- Update [Visual Reference](docs/visual-reference/README.md) Quick Reference Table
- Add customer sample to `docs/visual-reference/samples/`
- Create customer README in template directory
- Update [Variable Reference](docs/variable-reference/reference-fields.md) if new fields discovered

### 9.2 Updating Existing Templates

**Process:**
1. Locate template in `templates/[type]/customers/[customer-name]/`
2. Check customer mapping in `config/reference-fields/customer-mappings/[customer-name].json`
3. Use canonical field names from `standard-fields.json`
4. Maintain table-based layout with inline styles
5. Test with sample data before committing

**Common Updates:**
- Logo URL changes
- Field additions/removals
- Layout adjustments
- Pagination parameter changes
- Barcode format updates

### 9.3 Version Control Practices

**Commit Strategy:**
- One template per commit (or related templates in a group)
- Commit message format: `[CUSTOMER] description`
  - Example: `[Grainger] Add EDI order# field to packing slip`
- Include both template and config changes in single commit

**Branch Strategy:**
- Feature branch per customer: `feature/customer-name`
- Config changes on separate branch if shared: `feature/standard-fields`

**Review Checklist:**
- [ ] Template uses table-based layout only
- [ ] All styles are inline (no external CSS)
- [ ] Variables use canonical field names
- [ ] Pagination tested (1, 15, 30+ items)
- [ ] Barcode generation tested
- [ ] Configuration JSON is valid
- [ ] Documentation updated

---

## 10. Feature Requirements by Template Type

### 10.1 Packing Slip Requirements

**Purpose:** Customer-facing order document accompanying shipment

**Required Features:**

| Feature | Requirement | Implementation | Priority |
|---------|-------------|-----------------|----------|
| **Header** | Company logo and/or name | Liquid variable `{{ logo_src }}`, `{{ account.company_name }}` | CRITICAL |
| **Document Title** | "Packing Slip" or variant | Static text | CRITICAL |
| **Order Information** | Order#, date, shipment date | Native fields: `order.order_number`, `order.order_date`, `shipment.ship_date` | CRITICAL |
| **Shipping Address** | Recipient name, address, city/state/zip | `destination.*` fields | CRITICAL |
| **Billing Address** | Bill-to name and address (optional) | `billing.*` fields or reference `"Bill To"` | HIGH |
| **Items Table** | SKU, description, quantity | Items loop: `item.sku`, `item.description`, `item.quantity` | CRITICAL |
| **Pricing** | Unit price, extended price (optional) | `item.value`, `item.sum_value` | MEDIUM |
| **Pagination** | Page X of Y for 15+ items | Liquid pagination logic, standard 15/page | HIGH |
| **Special Fields** | PO#, Location, Terms, etc. | `order.references[canonical_name]` | MEDIUM |
| **Barcodes** | Order# or PO# barcode | Inline barcode filter + variable | MEDIUM |
| **Custom References** | EDI fields, buyer part numbers | `item.reference_numbers` loop | MEDIUM |
| **Tracking** | Tracking number | `shipment.tracking_number` | LOW |
| **Footer** | Contact info, return instructions | Static text + references | MEDIUM |

**Layout Patterns:**

| Pattern | Header | Address | Items | Pagination | Example Customers |
|---------|--------|---------|-------|------------|-------------------|
| **Logo Right** | Info left, logo top-right | Side-by-side or Ship To | Standard or detailed | Yes (15/page) | Grainger, Amazon, MSC |
| **Logo Left** | Logo left, title right | Floating ship to | Compact | No | GuardAir Global, ProClip |
| **Centered** | Logo centered, title below | Ship To only | Standard | Yes (15/page) | Millennium |

**Validation Checklist:**
- [ ] HTML uses table-based layout only
- [ ] All styles are inline (no CSS classes or external sheets)
- [ ] Pagination logic tested with 1, 15, 30+ item sets
- [ ] All Liquid variables resolve correctly
- [ ] Barcode(s) render without errors
- [ ] PDF output validates (page breaks, margins, orientation)
- [ ] Customer logo displays properly (or fallback text shown)
- [ ] Optional fields handled gracefully when absent

---

### 10.2 Pick Ticket Requirements

**Purpose:** Internal warehouse document for order fulfillment

**Required Features:**

| Feature | Requirement | Implementation | Priority |
|---------|-------------|-----------------|----------|
| **Order Identification** | Order#, barcode | `order.order_number`, barcode image | CRITICAL |
| **Customer Info** | Customer name, PO# (optional) | `order.references[canonical]` | HIGH |
| **Items List** | SKU, description, quantity | Items loop with sort/filter | CRITICAL |
| **Item Sorting** | Sorted for picking efficiency (qty desc) | Liquid sort filter: `sort: "quantity" \| reverse` | HIGH |
| **Warehouse Location** | Location/bin codes | `order.references["Location"]` | MEDIUM |
| **Quantity Verification** | Quantity ordered vs shipped | `item.quantity_ordered` vs `item.quantity` | MEDIUM |
| **Page Layout** | Landscape (optional) | CSS `@page { size: landscape }` | MEDIUM |

**Validation Checklist:**
- [ ] Items sorted by quantity (highest first)
- [ ] Warehouse staff can easily identify items
- [ ] Order barcode scans correctly
- [ ] Optional fields (PO#, location) handle missing data
- [ ] Multi-page handling works (rare for pick tickets)

---

### 10.3 Carton Label Requirements

**Purpose:** Individual box shipping label for carrier/destination

**Required Features:**

| Feature | Requirement | Implementation | Priority |
|---------|-------------|-----------------|----------|
| **Zones** | Multi-zone layout (typical: 6-9 zones) | JSON zones array with x/y positioning | CRITICAL |
| **Positioning** | Exact inch-based placement | `position: [x, y]` coordinates | CRITICAL |
| **Addresses** | Ship From, Ship To (block format) | Block definitions for address lines | CRITICAL |
| **Barcodes** | Tracking, PO#, UPC | Barcode field with type (Code128, Code39) | HIGH |
| **Carton Sequence** | Carton # of # (multi-carton orders) | `${package_number} of ${packages_count}` | HIGH |
| **Items** | SKU, description, quantity | Multi-item list with variable fields | MEDIUM |
| **Font Control** | Size constraints (predefined list) | Font sizes: 12, 17, 22, 28, 33, 44, ... 220 | CRITICAL |
| **Block Reusability** | Reuse address/item blocks | Blocks section for common elements | HIGH |
| **SSCC18 Support** | SSCC barcode for pallets | `fits_sscc18: true` zone flag | MEDIUM |

**Validation Checklist:**
- [ ] Zones positioned without overlap
- [ ] Font sizes are within allowed range
- [ ] Barcodes render without distortion
- [ ] Text positioning consistent across cartons
- [ ] Block structure reduces duplication >50%
- [ ] Testing with varying item counts (1-20+ items)

---

### 10.4 Pallet Label Requirements

**Purpose:** Large pallet shipping label with consolidated tracking/billing info

**Required Features:**

| Feature | Requirement | Implementation | Priority |
|---------|-------------|-----------------|----------|
| **Handling Units** | Display all packages/cartons on pallet | `shipment.handling_units` iteration | HIGH |
| **BOL#** | Bill of lading barcode | Code128 barcode + text | CRITICAL |
| **PRO#** | Progressive number (LTL) | `shipment.pro_number` | CRITICAL |
| **SSCC18** | GS1 serial shipping container code | SSCC18 barcode, automatic generation | HIGH |
| **Destination Address** | Ship To address block | Full address, formatted for scanning | CRITICAL |
| **Dimensions** | Pallet dimensions and weight | Package/shipment totals | MEDIUM |
| **Item Summary** | Item count, SKU listing | Total items, abbreviated SKU list | MEDIUM |

**Validation Checklist:**
- [ ] BOL# and PRO# barcodes scan correctly
- [ ] SSCC18 auto-generated without errors
- [ ] All handling units listed
- [ ] Weight/dimensions display correctly
- [ ] Carrier integration tested

---

## 11. Current State and Completeness

### 11.1 Template Coverage

**Production Templates:**
- **Packing Slips:** 28 HTML files across 20 customers (100% coverage of current clients)
- **Pick Tickets:** 1 HTML file (Margo only; not comprehensive)
- **Carton Labels:** 7 JSON configs across 7 customers
- **Pallet Labels:** 5 JSON configs across 5 customers

**Gaps/Opportunities:**
- Pick ticket coverage: Only 1 of 20 packing slip customers has pick tickets
- Label coverage: Only 7 of 20 customers have carton/pallet labels
- Template variants: Some customers have multiple variants; potential for consolidation

### 11.2 Documentation Completeness

**Comprehensive (100%):**
- Variable reference guide (reference-fields.md) — All 64 A-series + 20 B-series fields documented
- Visual pattern reference — 32 templates analyzed, patterns identified
- Creation workflow — 9-step guide with examples
- CLAUDE.md — AI assistant guidance

**Partial (50%):**
- Standard fields registry — Only 2 customer mappings created (Grainger, Sample-Co)
- Customer mapping documentation — Missing for 18 customers

**Gaps:**
- Automated testing — No test suite for template rendering
- Template linting — No validation of Liquid syntax
- PDF regression testing — No baseline PDF comparison

### 11.3 Code Quality

**Strengths:**
- Shared CSS reduces duplication by ~80%
- Canonical field naming prevents inconsistencies
- Organized directory structure enables scaling
- Clear development workflow documented

**Areas for Improvement:**
- Inconsistent inline styles (some templates use classes, some use inline)
- Missing JSDoc/comments in complex Liquid logic
- No linting for Liquid syntax errors
- Limited error handling (missing fields show as blank)

---

## 12. Future Feature Requirements

### 12.1 Priority 1 (Critical Path)

| Feature | Purpose | Effort | Owner |
|---------|---------|--------|-------|
| **Template Linting** | Validate Liquid syntax, catch variable errors before deployment | 2 weeks | Backend |
| **Customer Mapping Completion** | Create mappings for remaining 18 customers | 1 week | Documentation |
| **Pick Ticket Expansion** | Add pick tickets for 5+ additional customers | 2 weeks | Template Designer |
| **PDF Regression Testing** | Baseline PDFs + automated visual regression testing | 3 weeks | QA/Testing |
| **Carton Label Expansion** | Add carton labels for 5+ customers without labels | 2 weeks | Template Designer |

### 12.2 Priority 2 (Enhancement)

| Feature | Purpose | Effort |
|---------|---------|--------|
| **Template Preview UI** | Web interface to preview templates with sample data | 4 weeks |
| **Version History** | Track template changes, rollback capability | 2 weeks |
| **A/B Testing** | Compare template variants side-by-side | 3 weeks |
| **Barcode Validation** | Automatic barcode format verification | 1 week |
| **Internationalization** | Multi-language support (RTL, currency symbols) | 4 weeks |

### 12.3 Priority 3 (Nice-to-Have)

| Feature | Purpose | Effort |
|---------|---------|--------|
| **Template Composition** | Reusable template sections (header, footer) | 2 weeks |
| **Dynamic Field Mapping** | Runtime field mapping without JSON config | 3 weeks |
| **Thermal Printer Integration** | Direct label printing without intermediate system | 4 weeks |
| **Brand Asset Management** | Centralized logo/image storage with versioning | 2 weeks |

---

## 13. Key Takeaways and Recommendations

### 13.1 Architecture Strengths

1. **Template-as-Code** — All documents are version-controlled, reviewable, testable
2. **Shared Infrastructure** — Canonical field naming + shared CSS reduce inconsistency and duplication
3. **Clear Organization** — Customer-first directory structure scales easily
4. **Comprehensive Documentation** — Variable reference, pattern guide, creation workflow minimize learning curve

### 13.2 Immediate Action Items

1. **Complete Customer Mappings** — Create JSON configs for all 20 customers (1 week effort)
2. **Pick Ticket Expansion** — Build pick tickets for 5+ customers (addresses current gap)
3. **Add Template Linting** — Catch Liquid errors in CI pipeline
4. **Automate PDF Testing** — Establish baseline PDFs for regression detection

### 13.3 Long-Term Vision

- **Template Marketplace** — Share templates across ShipHawk partners
- **White-Label Customization** — Customer self-service template editor
- **Label Printer SDK** — Direct integration with carrier label systems
- **Analytics** — Track document generation success rates, PDF rendering failures

---

## Appendix A: Glossary

| Term | Definition |
|------|-----------|
| **Canonical Name** | Standardized field identifier (e.g., "PO#") used across all templates |
| **Field Mapping** | JSON config mapping customer-specific field names to canonical names |
| **Liquid** | Template language by Shopify; used for variable interpolation and logic |
| **Native Field** | Data field directly accessible from ShipHawk API (e.g., `order.order_number`) |
| **Reference Field** | Custom field accessible via `order.references["Field Name"]` |
| **Zone** | Area on a label with defined position, size, and fields |
| **Block** | Reusable set of fields (addresses, items) in label JSON |
| **Pagination** | Automatic page breaks for orders with 15+ items |
| **SSCC18** | 18-digit Serial Shipping Container Code (GS1 standard) |

---

## Appendix B: File Location Reference

| Resource | Path |
|----------|------|
| **Project Home** | `/Users/trey/Desktop/Apps/shiphawk-templates/` |
| **Packing Slips** | `templates/packing-slips/customers/[customer]/` |
| **Pick Tickets** | `templates/pick-tickets/customers/[customer]/` |
| **Carton Labels** | `templates/labels/carton-labels/customers/[customer]/` |
| **Pallet Labels** | `templates/labels/pallet-labels/customers/[customer]/` |
| **Shared CSS** | `templates/assets/css/` |
| **Standard Fields** | `config/reference-fields/standard-fields.json` |
| **Customer Mappings** | `config/reference-fields/customer-mappings/[customer].json` |
| **Variable Reference** | `docs/variable-reference/reference-fields.md` |
| **Pattern Guide** | `docs/visual-reference/README.md` |
| **Creation Guide** | `docs/template-development/creating-new-template.md` |
| **Development Timeline** | `timeline.md` |

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-08  
**Status:** RESEARCH COMPLETE  
**Classification:** Internal Documentation