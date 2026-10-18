# Design system and creative research

The environment was inspected before UI work. Available resources include ImageGen, Adobe creative/font tools, native artifact skills, Sites and inline visualization capabilities. This project needs authored React interfaces rather than an Express template or a hosted Sites replacement, so the interface was built manually with shared tokens, Motion for React and Lucide. The ImageGen instructions were inspected, but no generated image is claimed or used.

The direction combines an editorial serif, precise sans-serif text, warm backgrounds and sparse champagne accents. Operational screens emphasize quiet hierarchy and trustworthy labels. Boutique pages use large imagery, generous type, restrained grids and a limited campaign system. The same signature easing curve appears in CSS and Motion. Reduced motion is respected. GSAP/Lenis were deferred because no scroll choreography currently justifies overlapping animation engines.

## References reviewed

- [COS runway](https://www.cos.com/en-us/runway/spring-summer-2026): spatial, product-first storytelling informed the collection hierarchy.
- [SSENSE editorial](https://www.ssense.com/en-us/editorial): integrating editorial identity with commerce informed the campaign card.
- [ZARA](https://www.zara.com/ww/): collection navigation and photographic scale informed the storefront foundation.
- [Nike](https://www.nike.com/): focused product discovery informed the short category controls.
- [Farfetch](https://www.farfetch.com/): discovery and category navigation informed catalog filters.
- [Apple](https://www.apple.com/): controlled typography and product emphasis informed spacing and interaction restraint.
- [Landing.love](https://www.landing.love/): reviewed contemporary landing compositions. Awwwards was attempted but the research tool could not retrieve it.

These are conceptual influences, not copied compositions, brand assets or campaign photographs.

## Tokens

Ivory `#F8F6F2`, paper `#FDFCF9`, beige `#E7DED1`, sand `#D2C3B0`, charcoal `#242424`, muted `#787872`, champagne `#B1946B`. Semantic green/red indicate business state. Borders and restrained radii replace decorative shadows. Instrument Serif headings pair with DM Sans Variable. Both open-source OFL font distributions are bundled locally through Fontsource; there are no Google Fonts runtime requests. System fallbacks remain available.

## Asset provenance

Demo imagery references `images.unsplash.com` under the [Unsplash license](https://unsplash.com/license). Each photo identifier is recorded in `prisma/seed.ts`. All boutique items and claims are fictional and all imagery is illustrative. Replace it with merchant-owned photographs before real selling. Campaign images live in tenant data and can be changed in the merchant interface; they are not hardcoded into page components.

## Responsive/accessibility foundation

Semantic headings, labelled controls, native dialog focus handling, visible keyboard focus, sufficiently large mobile controls, horizontally scrollable tables, Arabic direction, theme tokens and reduced-motion rules are implemented. Keyboard search uses Cmd/Ctrl+K. Browser verification checks desktop/mobile overflow and key workflows. Closed mobile navigation is hidden from display and keyboard focus and the trigger exposes its expanded state. Authentication/recovery, extended navigation, reports, settings and subscription billing have French/Arabic coverage; the native app has persisted EN/FR/AR selection and RTL content direction. Full WCAG evaluation, translation of every remaining operational secondary string and testing with assistive technologies remain later acceptance work.
