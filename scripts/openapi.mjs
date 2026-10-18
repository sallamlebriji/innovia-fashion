import { readFile, writeFile } from "node:fs/promises";
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ "application/json": { schema } });
const response = (schema, successStatus) => ({
  [successStatus]: {
    description: "Success",
    content: json(schema ?? { type: "object" }),
  },
  400: { description: "Unsupported channel, payment method or operation" },
  401: { description: "Authentication required" },
  403: { description: "Permission or entitlement denied" },
  404: { description: "Resource not found in the permitted scope" },
  409: { description: "Stock, identifier, idempotency or state conflict" },
  422: { description: "Invalid input" },
  429: {
    description: "Request rate limit exceeded",
    headers: {
      "Retry-After": {
        description: "Seconds to wait before retrying",
        schema: { type: "integer", minimum: 1 },
      },
    },
    content: json(ref("RateLimitError")),
  },
});
const key = {
  in: "header",
  name: "Idempotency-Key",
  required: true,
  schema: { type: "string", minLength: 8, maxLength: 100 },
  description: "Reuse the same key when retrying the same operation.",
};
const path = (name) => ({
  in: "path",
  name,
  required: true,
  schema: { type: "string" },
});
const page = [
  {
    in: "query",
    name: "page",
    schema: { type: "integer", minimum: 1, default: 1 },
  },
  {
    in: "query",
    name: "limit",
    schema: { type: "integer", minimum: 1, maximum: 100, default: 24 },
  },
  { in: "query", name: "q", schema: { type: "string" } },
];
const string = { type: "string" };
const amount = { type: "string", pattern: "^\\d{1,8}(\\.\\d{1,2})?$" };
const paths = {};
function add(
  url,
  method,
  summary,
  {
    body,
    publicAccess = false,
    parameters = [],
    schema,
    successStatus = 200,
  } = {},
) {
  paths[url] ??= {};
  paths[url][method] = {
    summary,
    security: publicAccess
      ? []
      : [method === "get" ? { session: [] } : { session: [], csrf: [] }],
    parameters,
    responses: response(schema, successStatus),
    ...(body
      ? { requestBody: { required: true, content: json(ref(body)) } }
      : {}),
  };
}
add("/health", "get", "Database readiness", { publicAccess: true });
add("/auth/register", "post", "Register merchant, default store and session", {
  body: "Register",
  successStatus: 201,
  publicAccess: true,
});
add("/auth/login", "post", "Start a merchant/operator session", {
  body: "Login",
  publicAccess: true,
});
add("/auth/me", "get", "Current session identity and CSRF token");
add("/auth/logout", "post", "Revoke the current session");
add("/products", "get", "Tenant-scoped product catalog", {
  parameters: [
    ...page,
    { in: "query", name: "category", schema: string },
    {
      in: "query",
      name: "status",
      schema: { enum: ["ACTIVE", "DRAFT", "ARCHIVED"] },
    },
    { in: "query", name: "sort", schema: { enum: ["newest", "name"] } },
  ],
});
add("/products", "post", "Create product, variants and opening stock", {
  body: "ProductCreate",
  successStatus: 201,
});
add("/products/{id}", "get", "Read a tenant-scoped product", {
  parameters: [path("id")],
});
add("/products/{id}", "patch", "Rename, publish or archive a product", {
  body: "ProductPatch",
  parameters: [path("id")],
});
add("/products/{id}/variants", "post", "Create another SKU and opening stock", {
  body: "VariantCreate",
  successStatus: 201,
  parameters: [path("id")],
});
add("/categories", "get", "Distinct tenant catalog categories");
add("/stores", "get", "Tenant locations");
add("/stores", "post", "Create location within plan limits", {
  body: "StoreCreate",
  successStatus: 201,
});
add("/inventory/adjustments", "post", "Audited stock adjustment", {
  body: "Adjustment",
  parameters: [key],
});
add("/inventory/movements", "get", "Paginated stock movement ledger", {
  parameters: page,
});
add("/analytics", "get", "Analytics computed from completed orders", {
  parameters: [
    {
      in: "query",
      name: "days",
      schema: { type: "integer", minimum: 1, maximum: 90, default: 30 },
    },
    { in: "query", name: "storeId", schema: string },
  ],
});
add("/orders", "get", "Paginated tenant orders", { parameters: page });
add(
  "/orders/{id}/{action}",
  "post",
  "Fulfil, cancel or record a full cash reversal",
  {
    parameters: [
      path("id"),
      { ...path("action"), schema: { enum: ["complete", "cancel", "refund"] } },
      key,
    ],
  },
);
add("/pos/checkout", "post", "Transactional cash POS checkout", {
  body: "Checkout",
  successStatus: 201,
  parameters: [key],
});
add("/customers", "get", "Paginated customer directory", { parameters: page });
add("/audit", "get", "Recent tenant audit entries");
add("/settings", "patch", "Update brand/campaign settings", {
  body: "Branding",
});
add("/platform/overview", "get", "Operator merchant directory and plans");
add("/platform/plans", "post", "Operator plan creation", {
  body: "Plan",
  successStatus: 201,
});
add(
  "/platform/tenants/{id}/plan",
  "patch",
  "Operator plan assignment with usage validation",
  { body: "PlanAssign", parameters: [path("id")] },
);
add("/storefront/{slug}", "get", "Public boutique branding and locations", {
  publicAccess: true,
  parameters: [path("slug")],
});
add(
  "/storefront/{slug}/products",
  "get",
  "Public active catalog without internal cost data",
  {
    publicAccess: true,
    parameters: [
      path("slug"),
      ...page,
      { in: "query", name: "category", schema: string },
    ],
  },
);
add(
  "/storefront/{slug}/checkout",
  "post",
  "Guest pickup reservation with server-authoritative prices",
  {
    publicAccess: true,
    body: "Checkout",
    parameters: [path("slug"), key],
    successStatus: 201,
  },
);
const object = (properties, required = Object.keys(properties)) => ({
  type: "object",
  properties,
  required,
});
const variant = object({
  sku: string,
  size: string,
  color: string,
  price: amount,
  cost: amount,
  quantity: { type: "integer", minimum: 0 },
  reorderPoint: { type: "integer", minimum: 0, default: 5 },
});
const schemas = {
  RateLimitError: object({
    error: object({
      code: { type: "string", const: "RATE_LIMITED" },
      message: string,
    }),
  }),
  Login: object({
    email: { type: "string", format: "email" },
    password: { type: "string", maxLength: 72 },
  }),
  Register: object({
    name: string,
    businessName: string,
    email: { type: "string", format: "email" },
    password: { type: "string", minLength: 12, maxLength: 72 },
  }),
  Variant: variant,
  VariantCreate: object({ ...variant.properties, storeId: string }),
  ProductCreate: object(
    {
      name: string,
      description: string,
      category: string,
      brand: string,
      collection: string,
      imageUrl: { type: "string", description: "Empty or HTTPS" },
      status: { enum: ["ACTIVE", "DRAFT", "ARCHIVED"] },
      storeId: string,
      variants: {
        type: "array",
        minItems: 1,
        maxItems: 100,
        items: ref("Variant"),
      },
    },
    ["name", "category", "storeId", "variants"],
  ),
  ProductPatch: object(
    { name: string, status: { enum: ["ACTIVE", "DRAFT", "ARCHIVED"] } },
    [],
  ),
  StoreCreate: object({ name: string, city: string }),
  Adjustment: object({
    variantId: string,
    storeId: string,
    quantity: { type: "integer", description: "Nonzero signed adjustment" },
    reason: { type: "string", minLength: 3 },
  }),
  Checkout: object(
    {
      storeId: string,
      customerName: string,
      email: { type: "string", format: "email" },
      phone: { type: "string", pattern: "^(\\+212|0)[5-7]\\d{8}$" },
      channel: { enum: ["POS", "ONLINE"] },
      paymentMethod: {
        enum: ["CASH", "CASH_ON_DELIVERY", "PICKUP"],
        description:
          "POS supports CASH; ONLINE supports PICKUP or configured Moroccan cash-on-delivery zones. Electronic goods payments are not enabled.",
      },
      items: {
        type: "array",
        minItems: 1,
        maxItems: 50,
        items: object({
          variantId: string,
          quantity: { type: "integer", minimum: 1, maximum: 100 },
        }),
      },
    },
    ["storeId", "customerName", "channel", "paymentMethod", "items"],
  ),
  Branding: object({
    name: string,
    accent: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
    currency: { enum: ["MAD", "EUR", "USD"] },
    locale: { enum: ["en", "fr", "ar"] },
    heroTitle: string,
    heroSubtitle: string,
    heroImage: string,
  }),
  Plan: object({
    name: string,
    monthlyPrice: amount,
    productLimit: { type: "integer", minimum: 1 },
    storeLimit: { type: "integer", minimum: 1 },
  }),
  PlanAssign: object({ planId: string }),
};
// Include the registered route inventory directly from source, while retaining
// explicit schemas for the core contracts above. Extended write shapes are
// documented in API.md with authoritative shared Zod schema references.
const modules = [
  "app",
  "retail-operations",
  "customer-operations",
  "customer-accounts",
  "content-commerce",
  "workspace-operations",
  "media",
  "try-on",
  "cash-promotions",
  "crm-campaigns",
  "billing",
  "recurring-billing",
  "ar",
  "reports",
  "size-advisor",
  "platform-control",
];
for (const module of modules) {
  const source = await readFile(`apps/api/src/${module}.ts`, "utf8");
  const matcher =
    /\b(app|retail|platform|storefront|router|customer)\.(get|post|put|patch|delete)\(\s*"([^"]+)"/g;
  for (const match of source.matchAll(matcher)) {
    const [, receiver, method, route] = match;
    let prefix =
      receiver === "platform"
        ? "/platform"
        : receiver === "storefront"
          ? "/storefront"
          : "";
    if (module === "customer-accounts") prefix = "/storefront/:slug/customer";
    if (receiver === "customer")
      prefix = `/storefront/:slug/customer/${module === "media" ? "media" : "try-on"}`;
    const url =
      (prefix + route)
        .replace(/^\/api\/v1/, "")
        .replace(/:([A-Za-z][A-Za-z0-9]*)/g, "{$1}")
        .replace(/\/$/, "") || "/";
    const customer = url.includes("/customer/") || url.endsWith("/customer");
    const publicAccess =
      (url.startsWith("/storefront") &&
        (!customer || /\/(register|login)$/.test(url))) ||
      url === "/health" ||
      url === "/openapi.json" ||
      url === "/staff/invites/accept" ||
      url === "/billing/stripe/webhook" ||
      (url === "/media/{id}" && method === "get");
    if (!paths[url]?.[method])
      add(url, method, `${module}: ${method.toUpperCase()} ${url}`, {
        publicAccess,
        parameters: [...url.matchAll(/\{([^}]+)\}/g)].map((m) => path(m[1])),
      });
    const operation = paths[url][method];
    operation.tags = [module];
    operation["x-source"] = `apps/api/src/${module}.ts`;
    if (customer && !publicAccess)
      operation.security =
        method === "get"
          ? [{ customerCookie: [] }, { customerBearer: [] }]
          : [{ customerCookie: [], csrf: [] }, { customerBearer: [] }];
    if (url === "/media/{id}" && method === "get")
      operation.description =
        "Public product assets are readable without auth. Private assets require the owning customer cookie or bearer token and return no-store; expired/deleted assets are unavailable.";
    if (!["get", "delete"].includes(method) && !operation.requestBody)
      operation.requestBody = {
        required: true,
        description:
          "Validated JSON contract. See docs/API.md and the referenced shared/source schema for the exact fields.",
        content: json({ type: "object", additionalProperties: true }),
      };
    if (
      ["post", "put", "patch", "delete"].includes(method) &&
      !operation.parameters.some((p) => p.name === "Idempotency-Key")
    )
      operation.parameters.push({
        ...key,
        required: false,
        description:
          "Required by financial, inventory, coupon, campaign, invitation and AI-job commands. Reuse on uncertain retries. Other writes accept the header.",
      });
  }
}
schemas.Checkout.properties.rewardCode = string;
schemas.Checkout.properties.couponCode = string;
schemas.Checkout.properties.deliveryZoneId = string;
schemas.Checkout.properties.shippingAddress = object({
  recipient: string,
  street: string,
  city: string,
  postalCode: { type: "string", pattern: "^\\d{5}$" },
  phone: schemas.Checkout.properties.phone,
  country: { const: "MA" },
});
schemas.ProductPatch = object(
  {
    name: string,
    description: string,
    category: string,
    brand: string,
    collection: string,
    imageUrl: string,
    status: { enum: ["ACTIVE", "DRAFT", "ARCHIVED"] },
    season: string,
    audience: string,
    material: string,
    fit: string,
    care: string,
    sizeChart: {
      type: ["array", "null"],
      items: object(
        {
          size: string,
          chest: { type: "number" },
          waist: { type: "number" },
          length: { type: "number" },
        },
        ["size"],
      ),
    },
    tryOnEnabled: { type: "boolean" },
    tryOnImageUrl: string,
  },
  ["name", "category", "status"],
);
schemas.Plan.properties.employeeLimit = { type: "integer", minimum: 1 };
schemas.Plan.properties.aiCredits = { type: "integer", minimum: 0 };
schemas.Plan.properties.trialDays = {
  type: "integer",
  minimum: 0,
  maximum: 90,
};
for (const url of Object.keys(paths))
  if (url.includes("/customer/media")) {
    if (paths[url].post)
      paths[url].post.requestBody = {
        required: true,
        content: Object.fromEntries(
          ["image/jpeg", "image/png", "image/webp"].map((type) => [
            type,
            { schema: { type: "string", format: "binary" } },
          ]),
        ),
      };
  }
paths["/media"].post.requestBody = {
  required: true,
  description:
    "Raw image bytes, up to 10 MiB. Decoded, metadata-stripped and normalized to WebP.",
  content: Object.fromEntries(
    ["image/jpeg", "image/png", "image/webp"].map((type) => [
      type,
      { schema: { type: "string", format: "binary" } },
    ]),
  ),
};
paths["/billing/stripe/webhook"].post = {
  summary: "Verified hosted subscription-invoice payment event",
  tags: ["billing"],
  security: [],
  parameters: [
    { in: "header", name: "Stripe-Signature", required: true, schema: string },
  ],
  requestBody: {
    required: true,
    description:
      "Exact raw JSON bytes; signature verified before parsing. Requires an approved configured provider.",
    content: json({ type: "object" }),
  },
  responses: response({ type: "object" }, 200),
};
schemas.RecoveryRequest = object({
  email: { type: "string", format: "email" },
});
schemas.RecoveryReset = object({
  token: { type: "string", pattern: "^[a-f0-9]{64}$" },
  password: { type: "string", minLength: 12, maxLength: 72 },
});
for (const prefix of [
  "/auth/recovery",
  "/storefront/{slug}/customer/recovery",
]) {
  const parameters = prefix.includes("{slug}") ? [path("slug")] : [];
  add(
    `${prefix}/request`,
    "post",
    "Request a private one-hour recovery link; does not disclose account existence",
    {
      body: "RecoveryRequest",
      publicAccess: true,
      parameters,
      successStatus: 202,
    },
  );
  add(
    `${prefix}/reset`,
    "post",
    "Consume a recovery link once, change password and revoke existing sessions",
    { body: "RecoveryReset", publicAccess: true, parameters },
  );
}
schemas.PushDevice = object({ token: { type: "string", maxLength: 300 } });
for (const method of ["post", "delete"]) {
  const url = "/storefront/{slug}/customer/push/devices";
  add(
    url,
    method,
    method === "post"
      ? "Register this customer's Expo push device"
      : "Disable this customer's push device",
    { body: "PushDevice", parameters: [path("slug")] },
  );
  paths[url][method].security = [
    { customerCookie: [], csrf: [] },
    { customerBearer: [] },
  ];
}
schemas.SizeMeasurements = object(
  Object.fromEntries(
    ["chest", "waist", "length", "footLength"].map((name) => [
      name,
      {
        type: "number",
        exclusiveMinimum: 0,
        maximum: name === "footLength" ? 60 : 300,
      },
    ]),
  ),
  [],
);
schemas.SizeMeasurements.minProperties = 1;
paths["/storefront/{slug}/products/{id}/size-advisor"].post.requestBody = {
  required: true,
  content: json(ref("SizeMeasurements")),
};
schemas.BulkPrices = object({
  items: {
    type: "array",
    minItems: 1,
    maxItems: 100,
    items: object({ variantId: string, price: amount }),
  },
});
schemas.DuplicateProduct = object({
  sourceId: string,
  storeId: string,
  name: { type: "string", minLength: 2, maxLength: 150 },
});
for (const [url, body] of [
  ["/catalog/prices", "BulkPrices"],
  ["/catalog/duplicate", "DuplicateProduct"],
]) {
  paths[url].post.requestBody = { required: true, content: json(ref(body)) };
  paths[url].post.parameters = [key];
}
paths["/catalog/duplicate"].post.responses = response({ type: "object" }, 201);
paths["/reports"].get.parameters = [
  {
    in: "query",
    name: "days",
    schema: { type: "integer", minimum: 1, maximum: 366, default: 30 },
  },
  { in: "query", name: "storeId", schema: string },
];
paths["/reports"].get.description =
  "Tenant-scoped sales, tax-exclusive merchandise margins, inventory, loyalty and AI metrics. Margins are null for uncaptured historical costs. Conversion and abandonment remain null without configured visitor tracking.";
const catalogFilters = [
  "category",
  "collection",
  "brand",
  "size",
  "color",
  "minPrice",
  "maxPrice",
].map((name) => ({ in: "query", name, schema: string }));
paths["/storefront/{slug}/products"].get.parameters = [
  path("slug"),
  ...page,
  ...catalogFilters,
  {
    in: "query",
    name: "sort",
    schema: { enum: ["newest", "name", "price_asc", "price_desc"] },
  },
];
schemas.ProductPatch.required = [];
schemas.ProductPatch.properties.arLensId = { type: "string", maxLength: 150 };
schemas.ProductPatch.properties.arGroupId = { type: "string", maxLength: 150 };
schemas.ProductPatch.properties.sizeChart.items.properties.footLength = {
  type: "number",
  exclusiveMinimum: 0,
  maximum: 60,
};
schemas.ProductPatch.properties.sizeChart.items.properties.equivalentSizes = {
  type: "string",
  maxLength: 100,
};
schemas.Plan.properties.features = {
  type: ["array", "null"],
  items: { enum: ["COMMERCE", "CMS", "LOYALTY", "CRM", "REPORTS", "AI", "AR"] },
  description:
    "Null preserves legacy access. Explicit arrays define optional feature entitlements.",
};
schemas.RecurringCheckout = object({
  planId: string,
  consent: { const: "monthly-renewal-v1", type: "string" },
});
schemas.CancelRenewal = object({ confirmed: { const: true, type: "boolean" } });
paths["/billing/recurring/checkout"].post.requestBody = {
  required: true,
  content: json(ref("RecurringCheckout")),
};
paths["/billing/recurring/checkout"].post.parameters = [key];
paths["/billing/recurring/{id}/cancel"].post.requestBody = {
  required: true,
  content: json(ref("CancelRenewal")),
};
paths["/billing/recurring"].get.description =
  "Owner-only enrollment and available plan prices. Saved monthly prices remain immutable after consent; an approved eligible Stripe account is required for live automatic collection.";
await writeFile(
  "docs/openapi.json",
  JSON.stringify(
    {
      openapi: "3.1.0",
      info: {
        title: "INNOVIA Fashion OS API",
        version: "0.4.0",
        description:
          "Connected tenant retail, inventory, returns, delivery, customer accounts, loyalty, CMS, consented inbox campaigns, staff, private photo try-on jobs and subscription invoices. Browser writes require session CSRF; native customer requests use scoped bearer tokens. Optional Fal and Stripe adapters require explicit operator configuration. SaaS billing supports individual invoices and consented monthly renewal; retail card collection requires a separate eligible merchant gateway. Extended request fields are documented in API.md and source validation schemas.",
      },
      servers: [{ url: "/api/v1" }],
      paths,
      components: {
        securitySchemes: {
          session: { type: "apiKey", in: "cookie", name: "innovia_session" },
          csrf: { type: "apiKey", in: "header", name: "X-CSRF-Token" },
          customerCookie: {
            type: "apiKey",
            in: "cookie",
            name: "innovia_customer_{tenantId}",
            description:
              "Tenant-specific cookie name returned by customer register/login.",
          },
          customerBearer: {
            type: "http",
            scheme: "bearer",
            description:
              "Native customer token returned for client=native. Tenant-bound; stored in SecureStore.",
          },
        },
        schemas,
      },
    },
    null,
    2,
  ) + "\n",
);
