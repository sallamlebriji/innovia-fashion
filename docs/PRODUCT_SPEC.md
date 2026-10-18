# MASTER PROMPT — INNOVIA FASHION OS

## Next-Generation Fashion Retail SaaS

### Premium E-commerce · Smart POS · Inventory · AI Virtual Fitting Room · Mobile App · Loyalty & Rewards

---

# 0. GLOBAL MISSION

You are an elite multidisciplinary software development and creative team composed of:

* Principal Software Architect
* Senior Full Stack Engineer
* Senior React / Next.js Engineer
* React Native Mobile Architect
* MySQL Database Architect
* SaaS Multi-Tenant Specialist
* AI / Computer Vision Engineer
* Creative Director specialized in Luxury Fashion
* Senior UI/UX & Interaction Designer
* Motion Design Engineer
* Cybersecurity Engineer
* DevOps Engineer
* Quality Assurance Engineer

Your mission is to design and build **INNOVIA FASHION OS**, a next-generation, premium, scalable and production-oriented SaaS platform dedicated to fashion retail businesses.

The platform must support:

* Clothing boutiques
* Sneaker and shoe stores
* Luxury fashion retailers
* Streetwear stores
* Accessories and handbag boutiques
* Multi-brand stores
* Fashion chains operating multiple locations
* Independent fashion merchants

The solution must combine the aesthetic quality of world-class fashion e-commerce websites with the operational power of enterprise retail management software.

**Core vision:**

Create a platform that feels like a premium digital fashion ecosystem rather than a generic SaaS dashboard.

The software must be beautiful, fast, intelligent, secure, responsive, configurable, multilingual and commercially viable.

The product consists of six interconnected experiences:

1. SaaS Super Admin Platform
2. Merchant Management Dashboard
3. Smart Point of Sale
4. Premium E-commerce Storefront
5. React Native Customer Mobile Application
6. AI Virtual Fitting Room and Fashion Intelligence

All experiences must share a reliable, unified business architecture.

**IMPORTANT:**

Do not deliver only a landing page, visual prototype or static dashboard.

Build real connected business functionalities with persistent data, secure APIs, functional interactions, meaningful validations and tests.

---

# 1. DESIGN SKILLS & CREATIVE RESEARCH

Before implementing any UI, inspect the development environment and identify all available design-related skills, plugins, component libraries and creative resources.

Use relevant installed skills wherever possible.

If a skill is unavailable, do not claim to have used it. Apply the design principles manually or use a documented alternative.

Priority expertise:

* Premium UI/UX design
* Luxury fashion art direction
* Editorial website design
* Advanced React component design
* Design systems and typography
* Fashion e-commerce interactions
* Mobile experience design
* Responsive design
* Motion design
* Micro-interactions
* Accessibility
* Visual storytelling
* Conversion-oriented e-commerce design
* 3D CSS visual techniques
* AI-assisted creative production

## 1.1 Design references

Research and draw inspiration from the following websites and design philosophies:

**ZARA**

* Immersive fashion storytelling
* Cinematic product presentation
* Large photographic compositions
* Minimal navigation
* Editorial collection pages

**COS**

* Refined minimalism
* Sophisticated typography
* Harmonious whitespace
* Timeless visual language
* Premium product photography

**NIKE**

* Dynamic product transitions
* Sneaker-focused experiences
* Interactive product storytelling
* Bold yet controlled visual hierarchy

**SSENSE**

* Luxury fashion editorial interfaces
* Modern catalog navigation
* Minimalist grids
* Strong art direction

**FARFETCH**

* Premium fashion marketplace UX
* Product discovery
* Filtering and merchandising
* Cross-category navigation

**APPLE**

* Precise animation
* High-performance transitions
* Product-centered layouts
* Exceptional attention to detail

**AWWWARDS / LANDING.LOVE**

* Creative layouts
* High-end interaction design
* Innovative navigation concepts
* Modern visual presentation

Use these references as creative inspiration.

Do not replicate copyrighted artwork, layouts, branding or proprietary designs directly.

Build an original identity suitable for INNOVIA FASHION OS.

---

# 2. PREMIUM ART DIRECTION

The visual direction must combine:

**Italian-inspired elegance + Contemporary fashion editorial + Modern technology + Luxury minimalism.**

Avoid generic dashboards and overused template aesthetics.

The platform should feel refined, confident and sophisticated.

## 2.1 Color system

Create a professional design token system.

Suggested initial palette:

* Ivory: #F8F6F2
* Off White: #FDFCF9
* Warm Beige: #E7DED1
* Sand: #D2C3B0
* Charcoal: #242424
* Graphite: #353535
* Deep Black: #111111
* Champagne Gold: #C6A87C

Use colors with restraint.

Admin interfaces must prioritize clarity and contrast.

Storefronts may feature visually expressive campaign colors while remaining consistent.

Allow each boutique to configure its own branding.

Support light and dark themes.

## 2.2 Typography

Create a premium typographic hierarchy.

Use a sophisticated display font for editorial headings and a clean sans-serif for functional content.

Evaluate suitable fonts such as:

* Manrope
* Inter
* DM Sans
* Plus Jakarta Sans
* Instrument Serif
* Cormorant Garamond

Use only legally available font assets.

Do not mix too many fonts.

Establish consistent scales for headings, body text, metadata, prices and buttons.

## 2.3 Layout and composition

Apply:

* Strong grid systems
* Intentional whitespace
* Precise alignment
* Balanced asymmetry
* Large editorial photography
* Elegant product cards
* Refined borders
* Consistent spacing tokens
* Responsive typography
* Sophisticated navigation

Do not overuse rounded cards, shadows, decorative gradients or glassmorphism.

The result must be modern and artistic, but still professional.

---

# 3. ANIMATION & MOTION SYSTEM

The entire product must use a coherent motion language.

**Design philosophy:**

The interface should breathe, not react aggressively.

Animations must feel smooth, continuous, deliberate and premium.

## 3.1 Web animation stack

Use:

* Motion for React / Framer Motion
* GSAP
* GSAP ScrollTrigger
* Lenis
* CSS transforms
* CSS perspective
* Modern CSS transitions

Use the signature easing curve:

`cubic-bezier(0.22, 1, 0.36, 1)`

Equivalent GSAP easing:

`power3.out`

Use this visual language consistently.

Do not combine multiple conflicting easing styles without justification.

Avoid unnecessary requestAnimationFrame loops.

Synchronize Lenis and ScrollTrigger correctly.

## 3.2 Required interactions

Implement elegant variations of:

* Page transitions
* Staggered content reveals
* Editorial image reveals
* Product card hover
* Subtle image zoom
* Animated product galleries
* Magnetic interactions where appropriate
* Smooth drawer transitions
* Shopping cart interactions
* Wishlist feedback
* Skeleton loading states
* Filter transitions
* Animated numerical indicators
* Refined notifications
* Scroll-based storytelling
* Interactive collection presentations

Use subtle CSS perspective and 3D transformations where they enhance the product presentation.

Do not introduce heavy 3D engines unnecessarily.

## 3.3 React Native motion

Use:

* React Native Reanimated
* React Native Gesture Handler
* Smooth native navigation transitions
* Gesture-based interactions
* Bottom sheets
* Native-feeling haptic feedback where supported

Respect:

* Reduced-motion preferences
* Accessibility
* Mobile battery consumption
* Low-powered devices
* Touch target sizes

Never compromise functionality for visual effects.

---

# 4. COMPLETE TECHNICAL STACK

Build the application in TypeScript.

Do not use MongoDB.

Although the requested stack is inspired by MERN, the database must be **MySQL**.

## 4.1 Frontend

### E-commerce storefront

* Next.js
* React
* TypeScript
* Tailwind CSS
* Motion for React
* GSAP
* TanStack Query where needed

Use server-rendering or static generation strategically for SEO and performance.

### Merchant Dashboard

* React
* Vite
* TypeScript
* Tailwind CSS
* shadcn/ui
* TanStack Query
* Zustand
* Recharts
* React Hook Form
* Zod

### SaaS Super Admin

Use the same design system as the merchant dashboard, with dedicated routes, permissions and business capabilities.

### POS

React-based POS interface optimized for desktop and tablet.

Use a dedicated POS layout and interaction model.

## 4.2 Backend

* Node.js
* Express.js
* TypeScript
* Prisma ORM
* MySQL 8
* Zod
* Redis
* BullMQ
* Socket.IO when real-time capabilities are required
* OpenAPI documentation
* Structured logging

Use a modular backend architecture.

## 4.3 Mobile

* React Native
* Expo
* Expo Router
* TypeScript
* React Native Reanimated
* React Native Gesture Handler
* TanStack Query
* Zustand
* Expo Notifications
* Expo Camera
* SecureStore for appropriate credentials

Use development builds when native features require custom native modules.

## 4.4 Infrastructure

Design an architecture compatible with:

* Vercel for Next.js and React frontend deployments
* Render or an equivalent platform for the Node.js API
* Aiven MySQL or an equivalent managed MySQL service
* Redis-compatible infrastructure
* Cloudinary or S3-compatible object storage
* CDN for static media
* GitHub Actions for CI/CD

Provide environment-specific configuration.

Never hardcode secrets or production credentials.

---

# 5. MONOREPO ARCHITECTURE

Create a maintainable monorepo using pnpm workspaces or an equivalent appropriate solution.

Suggested structure:

```text
innovia-fashion-os/
│
├── apps/
│   ├── storefront/
│   ├── merchant-admin/
│   ├── super-admin/
│   ├── pos/
│   ├── mobile/
│   └── api/
│
├── packages/
│   ├── ui/
│   ├── design-tokens/
│   ├── types/
│   ├── validation/
│   ├── api-client/
│   ├── config/
│   └── utils/
│
├── prisma/
├── docs/
├── tests/
├── scripts/
├── .env.example
└── README.md
```

The structure may be adapted when technically justified.

Share business types, API contracts and validation rules.

Do not force direct sharing of web-specific UI components with React Native.

Maintain platform-specific interface components where appropriate.

---

# 6. MULTI-TENANT SAAS ENGINE

This is a true SaaS, not a single-store application.

The architecture must support an unlimited logical number of merchant accounts, within infrastructure and subscription limits.

Each merchant can own one or more stores.

## 6.1 Tenant isolation

Every tenant must have isolated:

* Products
* Customers and membership records
* Employees
* Stores
* Warehouses
* Orders
* Inventory
* Loyalty programs
* Promotions
* Financial data
* Branding
* Analytics
* Media references
* Business settings

Use tenant-scoped authorization at the API and data-access layers.

Do not rely only on frontend filtering.

Prevent cross-tenant access through object identifiers.

## 6.2 Merchant onboarding

Develop a polished onboarding experience:

1. Merchant registration
2. Business information
3. Store creation
4. Subscription selection
5. Brand identity configuration
6. Currency and language
7. Staff setup
8. Product import
9. Inventory configuration
10. Storefront activation

## 6.3 Subscription management

Support:

* Free trial
* Subscription plans
* Billing cycles
* Plan upgrades and downgrades
* Feature limits
* Store limits
* Employee limits
* Product limits if required
* AI generation credits
* Usage reporting
* Billing history

Subscription enforcement must occur on the backend.

---

# 7. SUPER ADMIN PLATFORM

Build a professional SaaS operator dashboard.

Required modules:

* Global overview
* Merchants
* Stores
* Subscription plans
* Subscription management
* Billing
* Platform users
* Roles and permissions
* Feature flags
* AI usage
* Virtual Try-On consumption
* Platform analytics
* Support requests
* System configuration
* Audit logs
* Security monitoring

Allow the platform operator to create and configure subscription plans.

Super Admin can define features by subscription.

Example:

**Starter**

* Inventory
* Product management
* Basic POS
* Sales reporting

**Professional**

* All Starter features
* E-commerce
* Customer CRM
* Loyalty program
* Promotions
* Advanced analytics

**Premium / Enterprise**

* All Professional features
* AI Virtual Fitting Room
* AR features where supported
* Multiple stores
* Extended automation
* Custom branding
* Advanced integrations

Subscription prices must remain configurable, not hardcoded.

---

# 8. SMART PRODUCT MANAGEMENT

Create a comprehensive fashion inventory engine.

## 8.1 Product information

Each product can contain:

* Name
* Description
* Category
* Subcategory
* Brand
* Collection
* Season
* Gender or intended audience
* Material
* Fabric
* Style
* Fit
* Color
* Size
* Shoe size
* SKU
* Barcode
* Supplier
* Cost price
* Selling price
* Promotional price
* Tax category
* Product images
* Product videos
* Virtual fitting assets
* Publication status
* SEO metadata

## 8.2 Product variants

Support combinations of:

* Size
* Color
* Shoe size
* Material
* Style variation

Example:

Product: Nike Air Max

Variants:

* Black / EU 40
* Black / EU 41
* Black / EU 42
* White / EU 40
* White / EU 41
* White / EU 42

Each variant must have its own SKU and inventory quantity.

Implement size conversion tables when appropriate.

## 8.3 Product import

Support:

* Manual product creation
* Bulk product import
* CSV import/export
* Image uploads
* Multiple product images
* Variant editing
* Bulk price updates
* Product duplication

Provide precise import validation and error reports.

---

# 9. ADVANCED INVENTORY & WAREHOUSE

Implement reliable inventory management.

Required capabilities:

* Multi-store inventory
* Multi-warehouse support
* Inventory per product variant
* Stock movements
* Stock adjustments
* Transfers between locations
* Purchase orders
* Supplier receiving
* Low-stock alerts
* Dead-stock detection
* Reorder suggestions
* Physical inventory counts
* Inventory valuation
* Returns to inventory
* Damaged product tracking

Use transactional database operations for inventory mutations.

Stock must not be reduced twice when receiving repeated API requests.

Define available, reserved, sold and returned stock consistently.

Prevent overselling when inventory restrictions are enabled.

All stock modifications must be auditable.

---

# 10. SMART POINT OF SALE — POS

Build a modern and efficient POS interface.

The experience must be optimized for cashiers, touch screens and rapid transactions.

## 10.1 Required functionalities

* Product search
* Barcode scanning
* Cart creation
* Product variant selection
* Discounts
* Promotional coupons
* Customer lookup
* Loyalty identification
* Cash payments
* Card payments through supported integrations
* Configurable payment methods
* Receipt generation
* Email receipts if configured
* Printing workflow
* Returns and refunds
* Size exchanges
* Sales history
* Cash register opening and closing
* Cash movements
* Cashier performance
* Store-level reporting

Support hardware barcode scanners that operate as keyboard input.

Provide appropriate adapters for additional hardware integrations.

## 10.2 Unified commerce

A product sold physically must update the stock available online.

An online order must reserve or reduce stock according to its status and configured business rules.

Refunds and exchanges must reconcile inventory, payments and loyalty points.

Design an explicit order and inventory state machine.

A complete offline POS mode can be planned as an advanced phase, with a reconciliation strategy. Never represent an online-only POS as fully offline.

---

# 11. PREMIUM E-COMMERCE WEBSITE

Each merchant must have a dedicated premium storefront.

The storefront must look like a fashion brand website, not a generic shopping template.

## 11.1 Homepage

Create:

* Immersive hero campaigns
* Editorial full-screen images
* New collections
* Featured brands
* Trending products
* Seasonal campaigns
* Featured categories
* Curated looks
* Best sellers
* Promotional storytelling
* Fashion lookbooks
* Newsletter subscription
* Elegant footer

Use meaningful, optimized imagery.

## 11.2 Catalog

Required:

* Product grids
* Responsive layouts
* Filtering by category
* Filtering by size
* Filtering by shoe size
* Filtering by brand
* Filtering by color
* Price filtering
* Sorting
* Wishlist
* Quick view
* Quick add to cart
* Product availability
* Collection filtering

Filters must work against real backend data.

## 11.3 Product detail page

Design an outstanding product experience with:

* Premium image gallery
* Product video
* Image zoom
* Size selector
* Color selector
* Size guide
* Stock status
* Delivery information
* Return policy
* Product recommendations
* Complete the Look
* Customer reviews if enabled
* Add to cart
* Wishlist
* AI Virtual Try-On button
* Size Advisor button

## 11.4 Checkout

Support:

* Guest checkout
* Customer accounts
* Address management
* Delivery selection
* Click & collect
* Cash on delivery
* Supported online payment gateways
* Coupons
* Loyalty reward redemption
* Order confirmation
* Order tracking

Payment providers must be selected based on verified availability and requirements in the target market, especially Morocco.

Do not invent functioning payment integrations.

---

# 12. AI VIRTUAL FITTING ROOM

## Advanced Artificial Intelligence Fashion Experience

This is one of the product's key premium differentiators.

Develop a **Virtual Fitting Room** integrated into both the Web storefront and the React Native application.

The customer must be able to virtually try on products before purchase.

Create three complementary modes.

---

## 12.1 MODE A — AI PHOTO VIRTUAL TRY-ON

Allow customers to upload or capture a personal photo.

The customer selects a product such as:

* T-shirt
* Shirt
* Jacket
* Dress
* Pants
* Full outfit

The system generates an image showing the selected item on the customer, subject to provider capabilities.

### User journey

1. Open product detail page.
2. Click "Essayer virtuellement".
3. Upload or capture an image.
4. Validate image requirements.
5. Choose the product and variant.
6. Start AI generation.
7. Display generation progress.
8. Show the generated result.
9. Compare before and after.
10. Add product to wishlist or cart.

### AI integration

Build a provider abstraction for virtual try-on.

Evaluate available providers such as:

* FASHN AI
* Google Vertex AI Virtual Try-On
* Other verified commercial providers
* A legally usable self-hosted virtual try-on model

Verify current APIs, availability, licensing, image requirements, pricing and usage restrictions before integration.

Do not invent API endpoints.

All provider credentials must remain on the backend.

Implement asynchronous jobs, status polling or notifications, retries, timeouts and error handling.

The generated visualization must preserve the person's identity and actual product characteristics as closely as possible.

Do not claim perfect garment fit or exact sizing accuracy.

---

## 12.2 MODE B — LIVE AR VIRTUAL TRY-ON

Develop an augmented reality mode where technically feasible.

### Shoe Try-On

Allow compatible customers to visualize selected shoes or sneakers on their feet using a smartphone camera.

Potential capabilities:

* Foot tracking
* Virtual sneaker positioning
* Perspective adjustment
* Real-time movement tracking
* 3D shoe assets
* Product switching
* Camera capture

Evaluate Snap Camera Kit or other compatible, appropriately licensed AR SDKs.

Verify actual Web, Android and iOS support before implementation.

Do not attempt to achieve production-quality tracking through a simple CSS overlay.

### Clothing AR

Explore real-time garment visualization using appropriate body tracking and rendering technologies.

Treat this as an advanced phase requiring technical validation.

Provide AI photo try-on as a fallback.

### React Native implementation

Use Expo development builds and native modules when necessary.

Do not assume every AR SDK will work in Expo Go.

Create device capability checks and graceful fallbacks.

---

## 12.3 MODE C — INTELLIGENT SIZE ADVISOR

Develop an intelligent clothing and shoe size recommendation assistant.

Inputs may include:

* Customer-provided measurements
* Height when relevant
* Brand size charts
* Existing size preferences
* Shoe size system
* Clothing fit preferences
* Historical purchases when permitted
* Return-related fitting feedback
* Product-specific size charts

Outputs:

* Recommended size
* Explanation
* Possible alternative size
* Fit type
* Size guide
* Confidence indication only where justified

Never falsely claim to infer exact measurements from ordinary photographs.

The module must clearly distinguish visual try-on from actual fit prediction.

---

## 12.4 PREMIUM FITTING ROOM UI

Design the virtual fitting room like a luxury digital mirror.

Create:

* Full-screen premium fitting interface
* Elegant product selector
* Before/after comparison slider
* Smooth loading experience
* Garment selection panel
* Product information
* Size selector
* Add to cart
* Wishlist
* Try another product
* Session reset
* Mobile-first interface

Implement realistic loading feedback based on actual job status.

Do not use a fake animation to imply that an AI generation happened.

---

## 12.5 PRIVACY & DATA PROTECTION

Photos of customers must be handled securely.

Requirements:

* Explicit informed consent before AI processing
* Transparent disclosure of external providers
* Private storage
* Signed temporary URLs
* Configurable automatic deletion
* Secure transmission
* No public photo access
* Data minimization
* Protection against unauthorized access
* User-controlled deletion
* No model training on uploaded photos without an appropriate separate authorization

Define a limited default retention policy and allow earlier deletion.

Do not store uploaded images indefinitely without a valid purpose.

The system must distinguish between original photos, generated outputs and product assets.

---

## 12.6 AI COST CONTROL

Each virtual fitting generation can generate infrastructure costs.

Implement:

* AI usage ledger
* Per-tenant quota
* Per-user rate limiting
* Monthly generation limits
* Credit consumption
* Provider cost tracking
* Admin usage reports
* Retry protection
* Idempotency
* Failed-generation credit adjustments
* Subscription-based entitlements

Allow the Super Admin to configure AI credit packages.

---

# 13. MOBILE APP — REACT NATIVE

Build a polished, production-oriented iOS and Android application.

The mobile application must offer a native experience rather than simply embedding the website.

## 13.1 Application model

Start with one central customer application.

Users can discover participating fashion boutiques and connect to their preferred stores.

Each boutique has its own digital storefront and loyalty experience inside the mobile app.

Keep the architecture compatible with future white-label mobile apps.

## 13.2 Required screens

* Splash screen
* Premium onboarding
* Login / registration
* Account recovery
* Discover boutiques
* Boutique homepage
* Collections
* Categories
* Product catalog
* Search
* Product details
* AI Virtual Fitting Room
* Size Advisor
* Wishlist
* Shopping cart
* Checkout
* Order history
* Order tracking
* Loyalty dashboard
* Rewards
* Digital membership card
* QR code
* Notifications
* Profile
* Addresses
* Preferences
* Privacy settings

## 13.3 Mobile premium experience

Use refined navigation transitions, gesture interactions, elegant bottom sheets, responsive loading states and smooth animations.

The mobile design must be consistent with the Web storefront but optimized for touch interaction.

## 13.4 Notifications

Support notifications for:

* Order confirmation
* Shipping updates
* New collections
* Promotions
* Loyalty points earned
* Rewards unlocked
* Expiring rewards
* Birthday offers
* VIP campaigns

Use notifications only in compliance with customer preferences and consent requirements.

---

# 14. SMART LOYALTY & REWARDS SYSTEM

Create a powerful omnichannel loyalty engine.

This must be a functional business module, not just a digital loyalty card.

## 14.1 Loyalty points

Merchants configure:

* Points earned per amount spent
* Eligible products
* Excluded products
* Earning multipliers
* Redemption rules
* Reward thresholds
* Points expiration
* Customer levels
* Birthday bonuses
* Referral bonuses

Example configurable rule:

10 MAD spent = 1 point.

100 points = 20 MAD reward.

These are editable demonstration values, not fixed business rules.

## 14.2 Loyalty tiers

Support levels such as:

* Bronze
* Silver
* Gold
* Platinum
* VIP

Configure level thresholds and benefits per merchant.

Possible benefits:

* Exclusive discounts
* Birthday rewards
* Free delivery
* Early access to collections
* Special campaigns
* Reserved promotions
* Member-only products

## 14.3 Digital loyalty card

Create an elegant loyalty card inside the mobile app.

Display:

* Customer membership
* Boutique branding
* Loyalty tier
* Point balance
* QR code
* Reward progress
* Available rewards
* Membership benefits

Create visually premium card treatments inspired by luxury membership programs.

## 14.4 Omnichannel loyalty

Customers can earn points from:

* E-commerce purchases
* Mobile app orders
* POS purchases

Customers can redeem eligible rewards both online and in-store.

Implement a loyalty transaction ledger.

Prevent duplicate point awards.

Handle:

* Partial refunds
* Full refunds
* Canceled purchases
* Expiration
* Manual corrections
* Fraudulent redemption attempts
* Simultaneous redemptions

Use database transactions and idempotency.

---

# 15. CUSTOMER CRM

Build a centralized customer relationship management module.

Required capabilities:

* Customer directory
* Customer profile
* Purchase history
* Preferred stores
* Loyalty membership
* Reward usage
* Order history
* Shopping preferences
* Customer segmentation
* Repeat purchase indicators
* Customer lifetime value estimates
* Customer notes with appropriate permissions
* Marketing consent management

Allow staff to search for customers quickly.

Enforce tenant isolation and data minimization.

Customer profiles belonging to different merchants must not be exposed to one another.

---

# 16. MARKETING & FASHION CAMPAIGNS

Develop integrated marketing capabilities.

Include:

* Promotion management
* Coupon codes
* Seasonal sales
* Flash sales
* Featured collections
* Personalized campaign groups
* Newsletter integration
* Promotional banners
* Lookbooks
* Product bundles
* Cross-selling
* Upselling
* New collection announcements
* Abandoned cart workflows where lawful and technically implemented

Allow administrators to create, schedule, publish and deactivate campaigns.

Support campaign targeting based on legitimate customer segmentation and consent.

---

# 17. HIGGSFIELD AI & CREATIVE CONTENT

Integrate a professional creative asset workflow compatible with **Higgsfield AI**.

The objective is to achieve cinematic and editorial fashion presentations.

Use Higgsfield or equivalent licensed creative tools for:

* Fashion campaign visuals
* Product advertising concepts
* Editorial fashion imagery
* Collection teaser videos
* Promotional reels
* Cinematic storefront backgrounds
* Seasonal campaigns
* Premium storytelling assets

However:

Do not claim to have access to any external API without verification.

Do not make an unverified service a mandatory runtime dependency.

Initially support the import and management of externally created Higgsfield assets.

If an official integration is genuinely available and its use is authorized, build an optional provider adapter.

## Creative CMS

Allow merchants to:

* Upload campaign assets
* Create campaign collections
* Replace homepage images
* Configure homepage videos
* Reorder homepage sections
* Customize visual blocks
* Assign campaigns to collections
* Define scheduling dates
* Customize text and calls to action
* Preview before publishing

All storefront campaign content must be configurable through the admin.

Avoid hardcoded campaign media in page components.

Use appropriately licensed assets.

AI-generated marketing content must not misrepresent the actual items sold.

---

# 18. VISUAL WEBSITE BUILDER

Create a configurable storefront content management system.

Each merchant can personalize:

* Logo
* Favicon
* Brand name
* Color palette
* Typography
* Header style
* Navigation
* Hero layout
* Homepage sections
* Collections
* Promotional banners
* Product card variants
* Footer
* Social media links
* Store information
* Contact details
* Return policy
* Delivery policy
* SEO settings

Implement modular sections.

Examples:

* Full-screen campaign hero
* Editorial split section
* Featured collection
* Product carousel
* Brand story
* Collection grid
* Promotional strip
* Lookbook
* Video banner
* Customer testimonials
* Newsletter block

Enable section ordering and preview.

Allow only validated design options to prevent broken storefronts.

Prefer a controlled section-based builder over an unrestricted page builder in the first version.

---

# 19. ANALYTICS & BUSINESS INTELLIGENCE

Build real business dashboards.

## 19.1 Sales analytics

* Total revenue
* Net sales
* Number of orders
* Average order value
* Gross margin
* Refunds
* Sales by store
* Sales by category
* Sales by brand
* Sales by product
* Sales by employee

## 19.2 Inventory analytics

* Stock valuation
* Low-stock products
* Dead stock
* Inventory turnover
* Best-selling variants
* Fast-selling sizes
* Slow-moving products
* Inventory discrepancies

## 19.3 E-commerce analytics

* Conversion rate where tracking is configured
* Product performance
* Cart abandonment
* Campaign attribution where available
* Popular searches
* Device performance
* Order channels

## 19.4 Loyalty analytics

* Active members
* Points earned
* Points redeemed
* Reward redemption rate
* Loyalty-driven sales
* Tier distribution
* Repeat purchase rate

## 19.5 AI analytics

* Virtual try-on sessions
* Successful generations
* Failed generations
* AI credit consumption
* Try-on to add-to-cart events
* Try-on to purchase events

Distinguish correlation from causal impact.

Do not invent metrics or use hardcoded analytics as production data.

---

# 20. INTELLIGENT AI FEATURES

Prepare an extensible AI feature architecture.

Future optional modules:

* Personalized product recommendations
* Frequently bought together
* Complete the Look recommendations
* Fashion style assistant
* Natural-language product discovery
* Intelligent search
* Automated product descriptions
* Product tagging
* Demand forecasting
* Stock replenishment suggestions
* Trend analysis

Implement only features for which real data, valid models and operational integrations are available.

For the MVP, prioritize deterministic and verifiable functionality over speculative AI claims.

---

# 21. LOCALIZATION — MOROCCO FIRST

The product must be initially suitable for Morocco while remaining internationally extensible.

## Languages

* French
* Arabic
* English

Support RTL layouts correctly.

## Currency

Use MAD as the default currency.

Support configurable currencies and explicit monetary formatting.

## Commerce

Support:

* Moroccan addresses
* Moroccan phone number validation
* Cash on delivery
* Store pickup
* Configurable delivery zones
* Shipping charges
* Local tax settings
* Invoice information
* Supported payment gateways
* WhatsApp contact actions where appropriate

Do not hardcode tax rates, business obligations or payment assumptions.

Use configurable business settings and verify current legal and provider requirements.

---

# 22. DATABASE DESIGN — MYSQL + PRISMA

Design a normalized, scalable relational database.

Core entities should include:

### SaaS

* Tenant
* Subscription
* SubscriptionPlan
* TenantFeature
* Store
* Warehouse
* User
* Role
* Permission
* AuditLog

### Fashion catalog

* Brand
* Category
* Collection
* Product
* ProductVariant
* ProductImage
* ProductVideo
* ProductAttribute
* SizeChart
* SizeChartEntry

### Inventory

* Inventory
* StockMovement
* StockReservation
* StockTransfer
* Supplier
* PurchaseOrder
* PurchaseOrderItem
* InventoryAdjustment

### Commerce

* Cart
* CartItem
* Order
* OrderItem
* Payment
* PaymentTransaction
* Refund
* Return
* Exchange
* Shipment
* Promotion
* Coupon

### Customers

* Customer
* CustomerAddress
* CustomerPreference
* Wishlist
* WishlistItem
* CustomerConsent

### Loyalty

* LoyaltyProgram
* LoyaltyAccount
* LoyaltyTier
* LoyaltyTransaction
* Reward
* RewardRedemption
* Referral

### AI

* VirtualTryOnSession
* VirtualTryOnJob
* VirtualTryOnResult
* TryOnProviderConfig
* AIUsageLedger
* ProductARAsset
* SizeRecommendation

### Content

* ThemeSettings
* CMSPage
* CMSSection
* Campaign
* MediaAsset
* Notification

Use proper relational constraints and indexes.

All tenant-owned business data must carry or reliably derive its tenant scope.

Use compound unique indexes where required.

Use Prisma Decimal for monetary precision.

Avoid floating-point arithmetic for currency calculations.

Define appropriate deletion and retention policies.

---

# 23. API & BACKEND ARCHITECTURE

Create a versioned REST API.

Example endpoint organization:

```text
/api/v1/auth
/api/v1/tenants
/api/v1/stores
/api/v1/products
/api/v1/categories
/api/v1/collections
/api/v1/inventory
/api/v1/suppliers
/api/v1/purchases
/api/v1/pos
/api/v1/orders
/api/v1/payments
/api/v1/returns
/api/v1/customers
/api/v1/loyalty
/api/v1/rewards
/api/v1/virtual-try-on
/api/v1/size-advisor
/api/v1/marketing
/api/v1/cms
/api/v1/analytics
/api/v1/subscriptions
/api/v1/notifications
```

Use a consistent structure:

* Routes
* Controllers
* Services
* Repositories or scoped data-access layer
* Validation
* Middleware
* Integrations
* Background jobs

Implement:

* Request validation
* Standardized errors
* Pagination
* Filtering
* Sorting
* Authentication
* Authorization
* Rate limiting
* Idempotency for critical operations
* Structured logging
* API documentation

Use shared request/response contracts where possible.

Do not expose provider secrets or internal operational data to the frontend.

---

# 24. SECURITY & PRIVACY

Security is mandatory.

Implement:

* Secure password hashing
* Appropriate token/session management
* RBAC
* Multi-tenant isolation
* Server-side permissions
* Input validation
* Secure file uploads
* API rate limiting
* Audit logging
* CSRF protection where applicable
* Secure cookie configuration
* CORS allowlisting
* Secure response headers
* Environment secret management
* SQL injection protection
* XSS protection
* File type and size validation
* Secure media access
* Consent management
* Data export and deletion workflows
* Backup and recovery procedures

Never trust merchant, store or role identifiers provided without authorization verification.

Financial, inventory, customer and loyalty operations require traceability.

Avoid storing payment card details.

Evaluate relevant Moroccan privacy requirements, including Law 09-08, and GDPR where applicable.

---

# 25. PERFORMANCE & RESPONSIVENESS

All interfaces must be professional on:

* Desktop
* Laptop
* Tablet
* Smartphone
* iOS
* Android

Prioritize:

* Fast initial loading
* Core Web Vitals
* Optimized images
* Lazy loading
* Server-side pagination
* Efficient database queries
* Cache invalidation
* Code splitting
* Responsive product galleries
* Mobile performance
* Efficient list virtualization
* Minimal JavaScript overhead

Avoid excessive animation libraries operating on the same element.

Ensure that scrolling remains smooth and predictable.

Use image optimization and appropriate CDN delivery.

Respect keyboard navigation and WCAG-oriented accessibility practices.

---

# 26. REQUIRED DEMONSTRATION DATA

Create realistic seed data for several fictional fashion businesses.

Example boutiques:

**ATELIER NOIR**
Premium contemporary clothing.

**URBAN SOLE**
Sneakers and streetwear.

**MODA STUDIO**
Women's fashion and accessories.

Create realistic categories, product variants, images where properly licensed, prices in MAD, stores, stock movements, customers, loyalty memberships and transactions.

Generate realistic demo orders and sales analytics.

Clearly distinguish seed/demo data from live data.

Do not populate production dashboards with fabricated business figures.

---

# 27. TESTING & QUALITY ASSURANCE

Implement automated tests for critical flows.

Required test scenarios:

* Merchant registration
* Tenant isolation
* Role authorization
* Product creation
* Variant creation
* Inventory updates
* Concurrent orders
* Stock reservations
* POS transactions
* Order cancellation
* Refunds
* Exchanges
* Loyalty point attribution
* Loyalty redemption
* Duplicate webhook handling
* AI credit usage
* AI generation failure
* Customer image deletion
* Subscription limits
* Storefront checkout

Include unit, integration and relevant E2E tests.

Use realistic test fixtures.

Ensure TypeScript checks, linting, migrations and application builds pass.

Document any provider-dependent functionality that cannot be tested without credentials or external access.

---

# 28. DELIVERY ROADMAP

Do not attempt to create disconnected mock features across the entire platform simultaneously.

Build the product in functional phases.

## PHASE 1 — Foundation & Design System

Deliver:

* Monorepo
* Technical architecture
* Design tokens
* UI component library
* Navigation architecture
* Database configuration
* Prisma schema
* Authentication
* Multi-tenant foundation
* SaaS layouts
* Storefront design foundation
* Mobile design foundation

## PHASE 2 — Retail Core

Deliver:

* Merchant management
* Product catalog
* Product variants
* Brands and categories
* Inventory management
* Warehouse management
* Store management
* Basic analytics

## PHASE 3 — Commerce Operations

Deliver:

* POS
* Sales
* Orders
* Returns
* Refunds
* Customers
* Store transactions
* Stock synchronization

## PHASE 4 — Premium E-commerce

Deliver:

* Storefront
* CMS
* Product discovery
* Cart
* Checkout
* Delivery configuration
* Order tracking
* Wishlist
* SEO

## PHASE 5 — Loyalty System

Deliver:

* Loyalty program configuration
* Point transactions
* Reward rules
* Customer memberships
* QR identification
* Reward redemption
* Loyalty analytics

## PHASE 6 — React Native Mobile

Deliver:

* Native navigation
* Authentication
* Boutique discovery
* Mobile commerce
* Customer profile
* Loyalty card
* Rewards
* Orders
* Notifications

## PHASE 7 — AI Virtual Fitting Room

Deliver:

* Photo try-on integration
* Secure upload pipeline
* Asynchronous AI jobs
* Try-on interface
* Before/after comparison
* AI credit tracking
* Mobile integration
* Size Advisor

## PHASE 8 — AR & Advanced Intelligence

Deliver where technically validated:

* AR sneaker try-on
* Advanced body tracking
* Multi-garment experiences
* AI product recommendations
* Advanced merchandising
* Demand forecasting
* Extended marketing automation

## PHASE 9 — Production Readiness

Deliver:

* Security audit
* Performance optimization
* Integration tests
* E2E validation
* Monitoring
* Backups
* Deployment configuration
* Admin documentation
* Production checklist

---

# 29. DEVELOPMENT EXECUTION RULES

Follow these rules strictly.

**Rule 1 — Inspect before editing**

If a repository already exists, inspect it fully before making changes.

Identify existing architecture, dependencies, environment configuration, database schemas, routes and interfaces.

Preserve working functionalities.

Do not rewrite the project unnecessarily.

**Rule 2 — Think architecturally**

Define domain boundaries, data relationships, API contracts and user journeys before complex implementation.

**Rule 3 — Implement real features**

No fake buttons.

No nonfunctional forms presented as complete.

No static arrays pretending to be a persistent inventory system.

No fake AI results presented as real provider output.

**Rule 4 — Use genuine UI/UX expertise**

Apply the best relevant design skills available.

Do not generate a generic Bootstrap-style interface.

Pay attention to spacing, typography, movement and visual consistency.

**Rule 5 — Admin configurability**

Anything that is a legitimate merchant business setting should be configurable through an appropriate admin interface.

Do not hardcode prices, campaigns, loyalty rules or storefront branding.

**Rule 6 — Secure multi-tenancy**

Tenant isolation must be enforced consistently.

**Rule 7 — Work in vertical slices**

For each feature, implement:

Database → Backend → API → Frontend → Validation → Tests.

**Rule 8 — Verify**

Run checks and tests after implementation.

Fix errors instead of ignoring them.

**Rule 9 — Avoid unnecessary dependencies**

Do not introduce costly services or heavy packages without justification.

**Rule 10 — Maintain deployment compatibility**

Keep production configuration separated from development.

Protect credentials.

Provide reproducible builds.

**Rule 11 — Handle integrations honestly**

If an external API key, account, license or hardware is unavailable, implement the correct adapter and clearly document the missing external requirement.

Use a clearly labeled development mock only when necessary.

**Rule 12 — Do not stop at planning**

After producing the necessary architecture and development plan, begin implementing the first functional phase.

Continue implementing coherent and verifiable functionality within the execution environment.

Do not ask repetitive questions for decisions that can be resolved using reasonable professional defaults.

---

# 30. FINAL DESIGN ACCEPTANCE CRITERIA

The visual quality should be comparable in ambition to high-end international fashion platforms.

The result must exhibit:

* Sophisticated typography
* Strong visual identity
* Refined minimalist layouts
* Exceptional product presentation
* Smooth purposeful animations
* Responsive composition
* Beautiful empty states
* Clear visual feedback
* Premium checkout experience
* Consistent mobile experience
* Elegant customer loyalty cards
* Immersive AI fitting room
* Professional business dashboards
* Functional and accessible interfaces

The storefront must express luxury and fashion.

The merchant dashboard must express clarity, efficiency and confidence.

The mobile app must express simplicity, exclusivity and fluidity.

The virtual fitting room must express innovation, trust and visual quality.

All four must belong to the same coherent product ecosystem.

---

# 31. EXPECTED ENGINEERING OUTPUT

At each significant delivery milestone, provide:

1. Architecture decisions
2. Implemented functionality
3. Relevant folder structure
4. Database changes
5. API endpoints
6. Working UI pages
7. Mobile screens where applicable
8. Environment variables
9. Test results
10. Remaining limitations
11. Next implementation priorities

When testing is blocked by an external requirement, explain the precise blocker and retain an honest implementation status.

The final objective is a professional product that can eventually be sold to independent boutiques and retail chains through a recurring SaaS subscription.

---

# 32. START NOW

Begin by analyzing the current repository, or initialize the monorepo if it is empty.

Then:

1. Establish the SaaS architecture.
2. Define the complete design system.
3. Create the initial Prisma database schema.
4. Build the multi-tenant authentication foundation.
5. Implement the Super Admin and Merchant Dashboard shells.
6. Create the premium storefront design foundation.
7. Implement the first real product and inventory management workflow.
8. Add validation and tests.
9. Document how to run and verify the system.

Use the full requirements above as the product specification for subsequent phases.

**THE PRODUCT MUST BE BEAUTIFUL, FUNCTIONAL, SCALABLE AND COMMERCIALLY CREDIBLE.**

**BUILD A FASHION COMMERCE ECOSYSTEM, NOT JUST AN E-COMMERCE WEBSITE.**
