# Interface localization

The merchant app persists English, French or Arabic in its preferences. Arabic sets the document direction to RTL. Language changes affect interface labels and formatting; product/customer names, merchant notes, stock reasons, SKUs and business settings remain the stored content.

## Coverage

| Merchant area | Localized controls |
| --- | --- |
| Shared shell | Navigation, authentication/invitations/recovery, notifications, mobile menu and shared loading/error/dialog controls |
| Workspace | Reports, boutique settings, SaaS billing and media library |
| Retail | Product/variant editing, gallery metadata, size charts, canonical CSV import/export, duplication, bulk prices and inventory adjustments/movements |
| Sales | POS/cart/customer lookup, cash receipt, order management, partial returns and exchanges |
| Cash management | Register policy, opening, cash in/out, movement ledger, closure/variance and cashier report |
| Promotions | Form fields, channels, status/actions, scheduled dates, monetary values and known validation errors |
| CRM | Customer directory, profile value, purchase history, membership/consent/preferences display and private notes |
| Delivery actions | Dispatch and failed-delivery form labels/acknowledgements; no new localized COD browser acceptance is claimed |

Remaining merchant areas include supplier/purchase/transfer/count controls, loyalty administration, campaigns, staff/support, delivery settings, storefront studio, AI controls and platform administration. Some detailed validation messages still use the backend's English text. This is an incremental localization of existing connected workflows.

## Implementation rules

`apps/merchant-admin/src/words.ts` supplies the shared translator and `retail-words.ts` supplies retail vocabulary. Lazy sales/cash/CRM pages import `commerce-words.ts`, which registers its vocabulary before those pages render. This keeps the financial dictionary outside the initial application chunk. Existing shared translations take precedence over later registrations.

`count-words.ts` uses `Intl.PluralRules` for English/French singular/plural and Arabic zero, singular, dual, few, many and other forms. Money and dates on covered operational pages use the selected Moroccan locale. SKU/email/tracking inputs and codes retain appropriate left-to-right direction or bidirectional isolation.

Translate complete messages instead of concatenating translated sentence fragments. Translate displayed enum labels while keeping explicit request values such as `FIXED`, `PERCENT`, `POS`, `ONLINE`, `ALL`, `DRAFT` and `ACTIVE`. System-generated stock/cash descriptions are translated only when their exact known form matches; user-entered reasons remain untouched. Unknown backend errors remain visible in their original form. Known validation messages retain their field context. Prototype keys are never treated as dictionary entries; dynamic product names preserve literal replacement characters such as `$&`.

Sale, completion, cancellation, return and exchange success invalidate the affected customer/CRM queries. Returns/exchanges also invalidate register and cashier queries so financial/customer views reflect the committed transaction.

## Browser verification

With MySQL and the three local apps running, use:

```powershell
$env:CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
npx playwright test
node scripts/verify-localization.mjs
```

Run these browser commands successively. Running independent browser suites together against one API process can exceed the unchanged global request limit. Tests create uniquely named tenants and remove only their own guarded fixtures. The localized retail and financial tests exercise actual writes, preserved business content, backend enum values, stock/cash/customer totals and mobile dialog/page width. See VERIFICATION.md for results and reviewed screenshots.
