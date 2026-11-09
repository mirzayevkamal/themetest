# QCD-13 — Orders pages: pending items

Figma: https://www.figma.com/design/6ZRuFPhqMwMpGey8yX2NVQ/Mobile-Application?node-id=1-38627
Built: `/account/orders` (list) and `/account/orders/:id` (details) in `app/components/orders/`.

## Blocked on API / backend

| #   | Item                                                                               | Screen                 | Why it's pending                                                                                                         | Where to plug in                                                     |
| --- | ---------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 1   | "وصلنا طلبك … في **12 دقيقة**"                                                     | Details hero           | No `delivered_at` / duration on `Order`. Hero shows the message without the minutes.                                     | `OrderPage.tsx` → `delivered_message`.                               |
| 2   | Sticky in-progress bar (15–18 دقيقة, "جاري التحضير", progress steps, "الغاء طلبي") | List (frame `1:37994`) | No ETA / status timeline in the API. Progress could be faked from `status.sort_order`, the minutes cannot. Not built.    | New component under `orders/`, mounted above `BottomNav`.            |
| 3   | Payment method logos                                                               | Details                | API gives `payment.method` as a slug; only `apple_pay` maps to a logo, others fall back to a card icon + humanised slug. | `OrderPage.tsx` payment row — extend the map (mada, visa, stc pay…). |

## To verify on a store with real orders

- **List thumbnails**: [docs.salla.dev/orders/list](https://docs.salla.dev/orders/list) documents `items[] { name, quantity, thumbnail }` on each list order; the engine's `OrderListItem` type omits it, so the theme adds `OrderCard = OrderListItem & { items? }` (`mockOrders.ts`). Cards render the stack + "+N" when `items` is present. The dev store has no orders yet, so the live shape is unverified.

## Product / design decisions

- **Guest access**: both orders routes gate on `getAuthToken()` in the loader (same signal the engine's API client uses). The list renders `OrdersLoginRequired`, which opens the SDK login modal on arrival (`login::open` with `withoutReload`, after `salla.onReady`) and re-runs the loader on `auth::logged.in` — theme-tania's recipe, applied at the route instead of the bottom-nav tab so deep links are covered too; a guest opening `/account/orders/:id` is redirected to the list.
- **Rate order from the list card** links to the details page; the engine's `SallaRatingModal` only opens on the order page (`rating::open`). Auto-open via `?rate=1` if wanted.
- **Reorder** calls `salla.order.createCartFromOrder(id)` then navigates to `/cart`, without the engine's confirm modal.
- **Details footer + cart dock**: the reorder/rate footer (Figma `1:15114`) always renders; `CartAddedBar` ("عرض السلة", ex-`CartDock`) is global in `MainLayout` and appears only right after an add-to-cart on any page (cart count increased via the SDK cart events), until navigation or an empty cart; the cart page has its own `CartCheckoutBar`.
- **Status filter tabs** — none in Figma; the route still accepts `?status=`.
- **Delivered detection** is `status.slug` matching `deliver|complet`; confirm real slugs from the store.

## Mock data (dev only)

`app/components/orders/mockOrders.ts` + `public/images/mock-orders/` reproduce the Figma orders when
`import.meta.env.DEV` and the API returns an empty list (or 404s for a fixture id). Delete both when the
dev store has real orders.

Fixture item ids (`9001+`) are not real products, so the per-item "+" on a mock order fails in the cart API and
reverts; it works on real orders. Translation keys are theme-specific (`pages.orders.repeat`, `pages.order.*`)
because the store's own `pages.orders.reorder` string overrides theme locales.
