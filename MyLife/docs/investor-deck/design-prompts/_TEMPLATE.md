# Claude Design Prompt — My<Name>

**Use:** paste into Claude Design (or claude.ai with image generation) to generate investor-ready mockups.

## System Role
You are designing investor-deck hero mockups for My<Name>, a module in the MyLife suite. MyLife is a privacy-first, offline-first personal-data hub bundling 30+ modules under a single subscription. Obsidian Noir theme: warm dark `#131318` background, `#FFB877` accent, subtle glass morphism, `#E4E1E9` text, `#D6C3B5` secondary text. Avoid gradients that feel gaming or crypto-adjacent. iOS-native feel on mobile, Apple-aware on web.

## Brand Constraints
- Typography: SF Pro / Inter, 17pt body, 28pt title, 13pt caption.
- Corners: 16px card radius, 24px modal radius.
- Shadows: none on dark surfaces; rely on layered surface tiers (`#0E0E13` → `#35343A`).
- Iconography: SF Symbols style, single accent stroke.
- No em dashes in any copy.

## Deliverables Requested
1. **Hero screen (mobile, 390×844):** primary feature-forward view.
2. **Secondary screen (mobile):** detail/entry flow.
3. **Web dashboard (1440×900):** sidebar + module canvas.
4. **Marketing still (1920×1080):** product-on-phone, investor-deck slide-ready.
5. **Optional animation (vertical video prompt):** 6-second loop of the hero flow.

## Module-Specific Copy (fill per module)
- **One-line promise:**
- **3 marquee features:**
- **Key numbers (TAM, competitor count, distinctive metric):**
- **Competitive wedge:**

## Output Instructions for Claude Design
Return 5 prompts, one per deliverable, each under 80 words, with exact dimensions, mood, copy, and composition notes. No filler. Emit prompts in a copy-paste-ready code block.
