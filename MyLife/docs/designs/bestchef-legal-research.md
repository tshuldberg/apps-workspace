# BestChef: Legal Research Report -- Recipe Copyright and Platform Liability

**Date:** 2026-04-22
**Status:** Research Only (not legal advice)
**Purpose:** Assess legal viability of a recipe-sharing platform where users submit recipes sourced from cookbooks, restaurants, family traditions, and websites, with community voting on the best recipe per dish.

> **Disclaimer:** This document is legal research, not legal advice. Consult a licensed attorney before launch. Areas flagged with **[ATTORNEY REVIEW NEEDED]** require professional legal counsel.

---

## Table of Contents

1. [Recipe Copyright Law (US)](#1-recipe-copyright-law-us)
2. [Platform Comparables: How Existing Platforms Handle Copyright](#2-platform-comparables)
3. [Safe Harbor Protections (Section 230 and DMCA)](#3-safe-harbor-protections)
4. [Notable Case Law](#4-notable-case-law)
5. [Food Photography Copyright](#5-food-photography-copyright)
6. [International Considerations](#6-international-considerations)
7. [Terms of Service Recommendations](#7-terms-of-service-recommendations)
8. [Attribution Requirements](#8-attribution-requirements)
9. [Risk Matrix](#9-risk-matrix)
10. [Recommended Next Steps](#10-recommended-next-steps)

---

## 1. Recipe Copyright Law (US)

### The Core Rule: Recipes Are Generally Not Copyrightable

The foundational principle in US copyright law is that **recipes, as functional instructions, are generally not protected by copyright.** This derives from two statutory provisions:

**17 U.S.C. Section 102(b):**
> "In no case does copyright protection for an original work of authorship extend to any idea, procedure, process, system, method of operation, concept, principle, or discovery, regardless of the form in which it is described, explained, illustrated, or embodied in such work."

Recipes are classified as "procedures" or "processes" under this section.

**US Copyright Office, Circular 33 ("Works Not Protected by Copyright"):**
> "A mere listing of ingredients or contents, or a simple set of directions, is uncopyrightable."

The Copyright Office explicitly states it **cannot register recipes** consisting of a set of ingredients and a process for preparing a dish.

### What IS Protectable vs. What IS NOT

| Element | Protectable? | Legal Basis |
|---------|-------------|-------------|
| Ingredient list | **No** | Factual statements; 17 U.S.C. 102(b) |
| Basic cooking instructions | **No** | Functional directions / procedures |
| Quantities and measurements | **No** | Facts |
| Cooking temperatures and times | **No** | Facts |
| Headnotes, stories, personal anecdotes | **Yes** | Literary expression |
| Detailed creative descriptions | **Yes** | "Substantial literary expression" |
| Photographs | **Yes** | Independent copyrightable works |
| Illustrations and drawings | **Yes** | Artistic works |
| Cookbook compilation/arrangement | **Yes** | Compilation copyright (selection and arrangement) |
| Unique food presentation/plating | **Unlikely** | Too functional; no clear precedent |
| Taste of food | **No** | Not a "work" (see EU law, Section 6) |

### The Idea-Expression Dichotomy Applied to Recipes

The key legal distinction is between the **idea** (how to make a dish) and the **expression** (how that idea is communicated in words). Copyright protects only expression, never the underlying idea.

For recipes, this means:
- The fact that a chocolate cake requires flour, sugar, cocoa, eggs, and butter is an **idea/fact** -- unprotectable.
- The step-by-step process of combining those ingredients at specific temperatures is a **procedure** -- unprotectable.
- A paragraph musing about "the spiritual nature of baking" or "how my grandmother taught me this recipe on rainy Sunday mornings" is **literary expression** -- protectable.

### The "Substantial Literary Expression" Exception

The Copyright Office and courts recognize that when a recipe is "accompanied by substantial literary expression in the form of an explanation or directions," there may be a basis for copyright protection. This means recipes enriched with:
- Personal stories and anecdotes
- Creative commentary ("This is the secret to the unique taste!")
- Detailed serving suggestions, wine pairings, or ambiance recommendations
- Elaborate descriptive language beyond bare instructions

...may cross the threshold into copyrightable expression. However, even here, the copyright protects only the **expressive text**, not the underlying recipe itself.

### What This Means for BestChef

**Good news:** The core BestChef model -- users sharing ingredient lists and cooking instructions -- deals primarily in uncopyrightable factual/functional content. A user who submits "Grandma's Chocolate Cake: 2 cups flour, 1 cup sugar, 1/2 cup cocoa..." is sharing unprotectable facts and procedures.

**Risk area:** If users copy verbatim headnotes, creative descriptions, or personal stories from cookbooks or food blogs, those expressive elements may be copyrightable. The platform should encourage users to write their own descriptions.

---

## 2. Platform Comparables

### How Existing Platforms Handle Recipe Copyright

**AllRecipes (Dotdash Meredith / People Inc.)**
- Operates as a user-generated content platform where users submit original recipes
- Users retain ownership of their submitted content but grant the platform a broad license to use, display, and distribute
- Dotdash Meredith licenses its professionally created recipe content separately (e.g., $16M+ annual deal with OpenAI for content licensing)
- Maintains DMCA takedown procedures
- Professional editorial recipes are distinct from user-submitted content

**Cookpad**
- Requires users to credit reference sources: "If there is a recipe you have referred to, include the information of the reference source"
- Users must ask permission before republishing someone else's recipe in its entirety
- Attribution is framed as "respect and appreciation" rather than pure legal requirement
- Users retain rights to their content

**Yummly (now shut down as of December 2024)**
- Operated as an aggregator, linking back to source recipes rather than hosting full copies
- Required users to include "the name and hyperlinks of the recipe provider"
- Users could not "remove, alter or obscure any copyright or other proprietary notice or hyperlinks to Recipe Source pages"
- **Key lesson:** The link-back model reduced copyright exposure significantly

**Epicurious (Conde Nast)**
- Primarily editorial content (professionally developed recipes), not UGC
- User-submitted content governed by Conde Nast's general terms
- Users must not submit content that infringes third-party rights
- Conde Nast reserves right to terminate access for infringers

**Tasty (BuzzFeed)**
- Primarily creates original recipe video content
- Community features allow users to save and rate recipes but not typically submit their own
- Content is BuzzFeed-owned, not user-generated

### Common ToS Patterns Across Platforms

1. **Users retain copyright** in their submissions
2. **Users grant a broad license** (typically worldwide, royalty-free, sublicensable, perpetual) to the platform
3. **Users represent and warrant** that their content does not infringe third-party rights
4. **Users indemnify** the platform against infringement claims
5. **Platforms maintain DMCA procedures** for takedown requests
6. **Platforms reserve the right** to remove content at their discretion

---

## 3. Safe Harbor Protections

### Section 230 of the Communications Decency Act (47 U.S.C. Section 230)

**Core provision (Section 230(c)(1)):**
> "No provider or user of an interactive computer service shall be treated as the publisher or speaker of any information provided by another information content provider."

**What this means for BestChef:** If a user submits a recipe that includes copied copyrightable material, BestChef cannot be treated as the "publisher" of that content under Section 230.

**Important limitation:** Section 230 provides broad immunity for most types of claims (defamation, negligence, etc.) but **does NOT immunize platforms from federal intellectual property claims.** Section 230(e)(2) explicitly states:

> "Nothing in this section shall be construed to limit or expand any law pertaining to intellectual property."

This means **Section 230 alone is NOT sufficient** to protect BestChef from copyright infringement claims. You need DMCA safe harbor for that.

### DMCA Safe Harbor (17 U.S.C. Section 512)

This is the critical protection for BestChef. Section 512(c) limits liability for platforms that store user-generated content at the direction of users.

**Requirements to qualify for DMCA safe harbor:**

| Requirement | What BestChef Must Do |
|------------|----------------------|
| **Designated Agent** | Register a DMCA agent with the US Copyright Office and publish agent contact info on your website. Registration must be renewed every 3 years. |
| **Takedown Procedures** | Implement and follow notice-and-takedown procedures: receive valid DMCA notices, expeditiously remove or disable access to claimed infringing material. |
| **Counter-Notification** | Provide a process for users to file counter-notifications if they believe their content was wrongly removed. |
| **Repeat Infringer Policy** | Adopt and reasonably implement a policy for terminating accounts of repeat infringers. Inform users of this policy. |
| **No Actual Knowledge** | Must not have actual knowledge that material is infringing, or be aware of facts making infringement apparent, without acting expeditiously to remove it. |
| **No Financial Benefit** | Must not receive a financial benefit directly attributable to the infringing activity, in a case where you have the right and ability to control such activity. |
| **Standard Technical Measures** | Must accommodate standard technical measures used by copyright owners to identify or protect their works. |

**[ATTORNEY REVIEW NEEDED]:** The "financial benefit" prong needs careful analysis. If BestChef charges a subscription and a popular recipe drives subscriptions, an argument could be made that the platform financially benefits from specific infringing content. Structure the revenue model so financial benefit is from the platform as a whole, not attributable to individual pieces of content.

### DMCA Notice Requirements (Section 512(c)(3))

A valid DMCA takedown notice must include:
1. Physical or electronic signature of the copyright owner or authorized agent
2. Identification of the copyrighted work claimed to be infringed
3. Identification of the material to be removed, with information sufficient to locate it
4. Contact information of the complaining party
5. Statement of good faith belief that use is not authorized
6. Statement under penalty of perjury that the information is accurate

**Practical note:** Because most recipe content (ingredients, instructions) is not copyrightable, many DMCA takedown requests for recipes may be invalid. However, you should still process them properly to maintain safe harbor. Having an attorney review borderline cases is advisable.

---

## 4. Notable Case Law

### Publications International, Ltd. v. Meredith Corp.
**88 F.3d 473 (7th Cir. 1996)**

The landmark recipe copyright case. Meredith published "Discover Dannon -- 50 Fabulous Recipes with Yogurt" and sued Publications International for publishing twelve publications containing similar recipes.

**Holding:** The Seventh Circuit found the individual recipes were **not copyrightable** because they "comprised the lists of required ingredients and the directions for combining them, and contained no expressive elaboration upon these functional components."

**Key dicta:** The court acknowledged that copyright *could* protect recipes where authors "lace their directions for producing dishes with musings about the spiritual nature of cooking" or include "suggestions for presentation, advice on wines, or hints on place settings and appropriate music." This dicta established the "substantial literary expression" standard.

**Relevance to BestChef:** Strong precedent that bare recipe content (ingredients + steps) is not copyrightable. This is the most favorable case for the BestChef model.

### Lambing v. Godiva Chocolatier
**142 F.3d 434 (6th Cir. 1998)**

Lambing sued Godiva for copying her truffle recipe and design.

**Holding:** The Sixth Circuit held that "[r]ecipes are functional directions for achieving a result and are excluded from copyright protection under 17 U.S.C. Section 102(b)." The court stated that "the identification of ingredients necessary for the preparation of food is a statement of facts. There is no expressive element deserving copyright protection."

**Relevance to BestChef:** Reinforces that even specific, creative recipes (a unique truffle) are uncopyrightable when reduced to ingredients and instructions.

### Tomaydo-Tomahhdo, LLC v. Vozary
**No. 15-3179 (6th Cir. 2015)**

A dispute between former restaurant partners over a recipe book. Carroll claimed copyright in a recipe book she compiled; Moore (her ex-partner who had actually developed the recipes) published competing versions.

**Holding:** The Sixth Circuit held that "the list of ingredients is merely a factual statement" and "a recipe's instructions, as functional directions, are statutorily excluded from copyright protection." The court also found the recipe book was not protectable as an original compilation.

**Relevance to BestChef:** Confirms that even in the context of restaurant recipes, the functional content is unprotectable.

### Barbour v. Head
**178 F. Supp. 2d 758 (S.D. Tex. 2001)**

Barbour authored "Cowboy Chow" and sued after his recipes were published verbatim online and in a competing cookbook without permission.

**Holding:** The court denied summary judgment, finding that because the recipes contained "light hearted or helpful commentary" (e.g., "This is the secret to the unique taste!" and descriptions like "Great with all your meats!"), there was a genuine issue of material fact about whether they were "sufficiently expressive to warrant protection."

**Outcome:** The case **settled** before a jury could decide, leaving the question unresolved.

**Relevance to BestChef:** This is the cautionary case. Recipes with embedded creative commentary may be protectable. BestChef should instruct users to write their own descriptions rather than copying verbatim from sources.

### Lapine v. Seinfeld
**375 F. App'x 81 (2d Cir. 2010)**

Missy Chase Lapine sued Jessica Seinfeld, alleging that Seinfeld's cookbook "Deceptively Delicious" infringed Lapine's "The Sneaky Chef" (both involved hiding vegetables in children's food).

**Holding:** No infringement found. The concept of hiding vegetables in food is an uncopyrightable idea. The court found no substantial similarity in the protectable expression.

**Relevance to BestChef:** Reinforces that cooking concepts, techniques, and approaches are ideas, not protectable expression.

### Summary of Case Law Trends

The case law strongly favors BestChef's model:
- Bare recipes (ingredients + instructions) are consistently held uncopyrightable
- Only "substantial literary expression" layered on top of functional content receives protection
- Cooking concepts, techniques, and ideas are never copyrightable
- Cookbook compilations may receive thin copyright protection for selection and arrangement, but not for individual recipes

---

## 5. Food Photography Copyright

### Ownership Rules

**The photographer always owns the copyright to their food photo.** This is independent of whether the dish was made from someone else's recipe.

Key principles:

1. **Photos are independent copyrightable works.** A photograph involves creative choices (composition, lighting, angle, depth of field, styling) that qualify as original expression under 17 U.S.C. Section 102(a)(5).

2. **Making a dish does not create photo rights.** If User A publishes a recipe and User B makes the dish and photographs it, User B owns the photo copyright. The recipe creator has no claim to the photo.

3. **The dish itself is generally not copyrightable.** Food plating may involve creativity, but courts have not recognized plated dishes as copyrightable works. The CJEU has explicitly held that taste cannot be copyrighted (see Section 6).

4. **Stock food photography is separately licensed.** Professional food photos used in cookbooks and food blogs are typically owned by the photographer or licensed by the publisher. These are fully copyrightable and cannot be freely copied.

### Implications for BestChef

| Scenario | Legal Status |
|----------|-------------|
| User makes a dish from a cookbook and takes their own photo | User owns the photo. The cookbook author has no claim to the photo. |
| User copies a photo from a cookbook or food blog | **Copyright infringement.** The photo is independently copyrightable. |
| User screenshots a recipe photo from AllRecipes | **Copyright infringement** of the photographer's work. |
| User takes a photo of a restaurant dish | User owns the photo. The restaurant/chef has no IP claim to the photo (assuming no contract). |
| User uploads an AI-generated food image | Copyright status of AI images is evolving. **[ATTORNEY REVIEW NEEDED]** |

**Recommendation:** BestChef should require users to upload their own original photos. This is already aligned with the product vision ("real photos only, no AI-generated images"). Implement a ToS warranty that uploaded photos are user-created originals.

---

## 6. International Considerations

### European Union

**Directive 2001/29/EC (InfoSoc Directive):**
EU copyright law applies the same idea-expression dichotomy as US law. Recipes as functional instructions are generally not copyrightable.

**CJEU, Case C-310/17, Levola Hengelo BV v. Smilde Foods BV (2018):**
The Court of Justice of the European Union held that the **taste of a food product cannot be copyrighted** because it cannot be "expressed in a way that is sufficiently precise or objective" to constitute a "work." While this case specifically addressed taste rather than written recipes, it reinforces the EU position that food-related creations have limited IP protection.

**EU Database Directive (96/9/EC):**
A collection of recipes *could* qualify for sui generis database protection if the platform makes a "substantial investment in obtaining, verifying, or presenting the contents." This protects the database as a whole from unauthorized extraction of a substantial part, but does NOT protect individual recipes within it.

**Key difference from US law:** The EU database right has no US equivalent. If BestChef operates in the EU and invests substantially in curating its recipe database, it may gain database protection for the collection. Conversely, BestChef should be careful about scraping substantial portions of EU-protected recipe databases.

**GDPR Considerations:** If BestChef operates in the EU, user-submitted content containing personal data (e.g., "my grandmother Maria's recipe from Tuscany") may implicate GDPR data processing requirements. **[ATTORNEY REVIEW NEEDED]**

### United Kingdom

**Copyright, Designs and Patents Act 1988 (CDPA):**
Recipes *could* constitute "literary works" under the CDPA, but the protection is narrow:
- It protects the written expression of the recipe, not the dish or the underlying technique
- It would not prevent someone from following the recipe to make the dish
- Typographical arrangement of a recipe publication receives separate protection (preventing photocopying/scanning), but this is very narrow

The UK position is slightly more protective of written recipes than US law, as the CDPA does not have an explicit Section 102(b) equivalent. However, the practical outcome is similar: bare ingredient lists and simple instructions receive little or no protection.

### Canada

Canadian copyright law follows similar principles. In the recipe context, the Copyright Act protects "original literary works," but the threshold for originality requires "skill and judgment" (CCH Canadian Ltd. v. Law Society of Upper Canada, 2004 SCC 13). A bare recipe likely does not meet this threshold, but one with substantial creative expression might.

### Australia

Australian copyright law protects "literary works" and requires originality. Like the UK, bare recipes are unlikely to qualify, but creatively expressed recipe content may. Australia does not have a database right equivalent.

### Summary of International Landscape

| Jurisdiction | Bare Recipe Protected? | Creative Expression Protected? | Database Right? |
|-------------|----------------------|-------------------------------|-----------------|
| United States | No | Yes (substantial literary expression) | No |
| European Union | No | Yes | Yes (sui generis) |
| United Kingdom | Unlikely | Yes (literary work) | Yes (retained post-Brexit) |
| Canada | No | Yes (skill and judgment test) | No |
| Australia | Unlikely | Yes | No |

**[ATTORNEY REVIEW NEEDED]:** If BestChef plans to operate internationally, jurisdiction-specific legal review is needed, particularly for EU database rights, GDPR compliance, and UK CDPA implications.

---

## 7. Terms of Service Recommendations

### Essential Provisions

**[ATTORNEY REVIEW NEEDED]:** All ToS provisions should be drafted or reviewed by a licensed attorney. The following are research-informed recommendations, not legal drafts.

#### 7.1 User Content Ownership and License Grant

Users should retain ownership of their submissions but grant BestChef a broad license:

- Worldwide, royalty-free, non-exclusive, sublicensable, transferable license
- Right to use, reproduce, modify, adapt, publish, translate, create derivative works, distribute, perform, and display the content
- License should survive account termination (to avoid broken platform content)
- Users should be able to delete their content, with the license terminating upon deletion (subject to reasonable caching/backup periods)

#### 7.2 User Representations and Warranties

Users must represent and warrant that:

1. **Their submitted recipe content is either:**
   - Original to them, OR
   - Factual/functional content (ingredients, instructions) not subject to copyright protection, OR
   - Properly attributed content submitted with permission of the copyright holder

2. **Their submitted photos are:**
   - Taken by them personally, OR
   - Licensed for use on the platform

3. **Their submissions do not:**
   - Infringe any third-party copyright, trademark, or other intellectual property right
   - Violate any contractual obligation (e.g., NDA with a restaurant, publishing agreement)
   - Contain trade secrets belonging to others (though note: once a trade secret is publicly disclosed, it loses trade secret status)

#### 7.3 DMCA Compliance

Required elements:
- Designated DMCA agent contact information (published on website and registered with the Copyright Office)
- Clear procedure for submitting takedown notices
- Counter-notification process
- Statement of repeat infringer policy
- Commitment to expeditious removal upon valid notice

#### 7.4 Indemnification

Users should indemnify BestChef against:
- Claims arising from their submitted content
- Claims of copyright or IP infringement based on their submissions
- Claims arising from their breach of the ToS representations and warranties

**Note:** Indemnification clauses are unenforceable in some jurisdictions (e.g., certain US states, EU consumer protection law). **[ATTORNEY REVIEW NEEDED]**

#### 7.5 Content Moderation Rights

BestChef should reserve the right to:
- Remove any content at its sole discretion
- Edit or modify content for formatting, clarity, or policy compliance
- Refuse to publish content that violates its policies
- Terminate accounts of users who repeatedly violate content policies

#### 7.6 Recipe Source Disclosure Policy

Require users to disclose the source of their recipe:
- "Family recipe" / "Personal creation"
- "Adapted from [source]" (with attribution)
- "Found at [restaurant/location]"
- "Inspired by [cookbook/website/chef]"

This is both a legal risk-reduction measure and a product feature aligned with BestChef's "find the best recipe from anywhere" mission.

#### 7.7 Disclaimer of Accuracy

Include disclaimers that:
- BestChef does not verify the accuracy, safety, or nutritional content of user-submitted recipes
- Users follow recipes at their own risk
- BestChef is not liable for allergic reactions, food safety issues, or dietary harm

**[ATTORNEY REVIEW NEEDED]:** Product liability implications of hosting recipe content, especially for allergen-related harm.

---

## 8. Attribution Requirements

### What Is Legally Required

**Very little is legally required** for recipe attribution, because most recipe content is not copyrightable. There is no legal obligation to credit the "inventor" of a recipe for its functional content (ingredients and steps).

However:
- If protectable **creative expression** (headnotes, stories, detailed descriptions) is reproduced, attribution does not cure infringement. You need permission, not just credit.
- If **photos** are used, you need a license. Attribution alone is not sufficient.
- Trademark law may apply if a recipe is associated with a trademarked name (e.g., "Big Mac" is a registered trademark).

### What Is Best Practice

Even though not legally required, attribution is strongly recommended for:

1. **Community trust:** Recipe creators expect credit. Failing to attribute will generate backlash and platform reputation damage faster than any legal issue.

2. **Platform differentiation:** BestChef's model of "finding the best recipe for each dish from around the world" is inherently about sourcing. Transparent sourcing builds credibility.

3. **Reduced legal risk:** If a user copies creative expression from a source and attributes it, the original author may be less likely to file a DMCA takedown or lawsuit.

4. **Industry norms:** Major platforms (Cookpad, Yummly) enforce attribution norms. Food bloggers and cookbook authors are a vocal community that will publicly call out platforms that enable uncredited copying.

### Recommended Attribution Framework

| Recipe Source | Attribution Best Practice |
|--------------|--------------------------|
| Personal/family recipe | "Original recipe by [user]" |
| Adapted from cookbook | "Adapted from [Book Title] by [Author]" |
| Restaurant-inspired | "Inspired by [Dish Name] at [Restaurant], [City]" |
| Website-sourced | "Adapted from [Website Name]" (do NOT reproduce verbatim text) |
| Traditional/cultural recipe | "Traditional [Cuisine] recipe" or "[Region] classic" |

### The "Adapted From" Framework

Encourage users to adapt rather than copy:
- Use the source recipe as inspiration
- Write instructions in their own words
- Adjust ingredients, quantities, or techniques based on their experience
- Take their own photos
- Add their own tips and commentary

This approach avoids copyright issues entirely (since you're creating new expression for uncopyrightable functional content) while being transparent about inspiration.

---

## 9. Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| User copies verbatim headnotes/stories from cookbook | Medium | Low-Medium | ToS warranty; DMCA procedures; encourage "own words" |
| User uploads copied food photos | High | Medium | Photo originality requirement; reverse image search; DMCA |
| Cookbook publisher sends DMCA takedown for recipe instructions | Low | Low | Respond; most bare recipe content is not copyrightable |
| Cookbook publisher sends DMCA takedown for copied creative text | Medium | Low | Honor takedown; remove expressive content |
| Restaurant claims trade secret misappropriation | Very Low | Medium | Trade secrets lose protection once publicly disclosed; ToS disclaimer |
| EU database right claim from recipe aggregator | Low | Medium | Don't scrape EU databases; organic UGC is different |
| Class action from recipe creators for systematic copying | Very Low | High | DMCA compliance; user indemnification; proactive content policy |
| Product liability for unsafe recipe (allergens, food safety) | Low | High | Disclaimers; allergen warnings; safety notices |
| Trademark claim (using trademarked dish/brand names) | Low | Medium | Content moderation; user education |
| AI-generated photo copyright uncertainty | Low | Low | Ban AI photos (already in product vision) |

---

## 10. Recommended Next Steps

### Before Launch (Required)

1. **[ATTORNEY REVIEW NEEDED] Retain an IP attorney** to review and finalize Terms of Service, Privacy Policy, and DMCA procedures
2. **Register a DMCA designated agent** with the US Copyright Office ($6 filing fee)
3. **Draft and publish a DMCA policy page** with agent contact info, takedown procedure, and counter-notification process
4. **Implement a repeat infringer policy** (e.g., three-strike account termination)
5. **Build a DMCA takedown processing workflow** (receive notice, review, remove content, notify user, accept counter-notice)

### Before Launch (Recommended)

6. **Implement photo originality checks** (EXIF data verification, optional reverse image search)
7. **Build a recipe source attribution system** (required field when submitting a recipe)
8. **Create user-facing educational content** about recipe copyright (what they can and cannot submit)
9. **Draft community guidelines** with clear examples of acceptable vs. unacceptable submissions
10. **Implement content moderation tools** for flagging suspicious submissions

### If Operating Internationally

11. **[ATTORNEY REVIEW NEEDED] Obtain EU/UK legal review** for GDPR compliance, database rights, and jurisdiction-specific ToS requirements
12. **Consider geo-specific ToS** for EU users (consumer protection, right of withdrawal)
13. **Implement data processing agreements** if handling EU user data

### Ongoing Operations

14. **Document DMCA takedown responses** (maintain records of all notices received and actions taken)
15. **Monitor case law developments** in recipe copyright (this area of law continues to evolve)
16. **Periodic ToS review** (annually or when significant legal developments occur)

---

## Key Takeaway

**The BestChef model is legally viable.** The weight of US copyright law, Copyright Office guidance, and case law strongly supports the position that recipe content (ingredients, instructions, techniques) is not copyrightable. The primary legal risks come from:

1. Users copying **creative expression** (headnotes, stories, elaborate descriptions) rather than just functional recipe content
2. Users uploading **copied photographs** rather than their own
3. Failure to implement proper **DMCA safe harbor** protections

All three risks are manageable with proper Terms of Service, DMCA compliance, content policies, and user education. The platform's emphasis on user-generated photos, community voting, and "adapted from" attribution aligns well with copyright law's treatment of recipes as functional, uncopyrightable content.

---

## Sources and Citations

### Statutes
- 17 U.S.C. Section 102 (Subject matter of copyright)
- 17 U.S.C. Section 102(b) (Idea-expression dichotomy)
- 17 U.S.C. Section 512 (DMCA safe harbor)
- 47 U.S.C. Section 230 (Communications Decency Act)
- EU Directive 2001/29/EC (InfoSoc Directive)
- EU Directive 96/9/EC (Database Directive)
- UK Copyright, Designs and Patents Act 1988

### Cases
- Publications International, Ltd. v. Meredith Corp., 88 F.3d 473 (7th Cir. 1996)
- Lambing v. Godiva Chocolatier, 142 F.3d 434 (6th Cir. 1998)
- Tomaydo-Tomahhdo, LLC v. Vozary, No. 15-3179 (6th Cir. 2015)
- Barbour v. Head, 178 F. Supp. 2d 758 (S.D. Tex. 2001)
- Lapine v. Seinfeld, 375 F. App'x 81 (2d Cir. 2010)
- Levola Hengelo BV v. Smilde Foods BV, Case C-310/17 (CJEU 2018)
- CCH Canadian Ltd. v. Law Society of Upper Canada, 2004 SCC 13

### Copyright Office Guidance
- US Copyright Office, Circular 33: Works Not Protected by Copyright
- US Copyright Office, Compendium of U.S. Copyright Office Practices (recipes and formulas)
- US Copyright Office, DMCA Designated Agent Directory

### Platform Terms (reviewed April 2026)
- Cookpad Terms of Service (cookpad.com/us/terms)
- Cookpad Community Guidelines (cookpad.com/uk/community)
- Conde Nast Terms and Conditions (condenast.co.uk/terms)
- Yummly Terms and Conditions (developer.yummly.com/policies) (service discontinued Dec 2024)
- Dotdash Meredith Content Licensing (ddmcontentlicensing.com)

### Secondary Sources
- Copyright Alliance, "Are Recipes and Cookbooks Protected by Copyright?"
- Bird & Bird, "Intellectual Property Rights in Recipes and Food" (2020)
- Bradley Arant, "Intellectual Property Protection for Recipes" (2019)
- NYC Bar Association, "Secret Ingredients: How to Protect Recipes"
- National Law Review, "Mixing Things Up: Let's Talk Recipes"
- Fasken, "Are Recipes Protected by Copyright Law?" (2021)
