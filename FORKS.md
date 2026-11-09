# Engine forks

These theme components started as copies of engine components and were changed for grocery. The
engine does not update them, so each upgrade of `@salla.sa/twilight-theme-engine` can leave them
behind. This file records where each one came from, so you can see what changed upstream.

**Base** is the engine version in the lockfile when the fork was last edited. It is the oldest
upstream change the fork might have taken in, not proof that it was synced then.

Theme-owned pages that only reuse an engine loader (`cart.tsx`, `search.tsx`, `$slug.c$id.tsx`,
the `account.*` overrides, `thankyou.$orderId.tsx`) and the rewritten `ProductCard` / `CartView`
are grocery's own markup, not forks, and are not listed.

| Fork (`app/components/…`)    | Engine source (`tailwind/…` in the engine) | Wired in by                                      | Base   | What the fork changes                                                                                                                                                        |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `product/ProductPage.tsx`    | `routes/product/ProductPage.tsx`           | `app/routes/$slug.p$id.tsx`                      | 1.0.89 | Keeps the engine's `product:*` hook slots; renders `ProductInfo`, `ProductActionBar` and `RelatedProducts` instead of `ProductDetails`, the products slider and testimonials |
| `product/ProductGallery.tsx` | `components/product/ProductGallery.tsx`    | `registry` `product:gallery` in `app/router.tsx` | 1.0.85 | Image-frame skeleton that shows the list-card image as LCP until the first gallery image decodes, then mounts the slider once                                                |
| `home/ProductsSlider.tsx`    | `components/home/ProductsSlider.tsx`       | `registerHomeComponents` in `app/router.tsx`     | 1.0.55 | Loads through `queryClient.fetchQuery`, honours `show_out_of_stock_products`, slider-sized card images, arrows unless `show_controls === false`, no "view all" link          |
| `home/PhotosSlider.tsx`      | `components/home/PhotosSlider.tsx`         | `registerHomeComponents` in `app/router.tsx`     | 1.0.95 | Server-renders the first banner (the engine SSRs a skeleton, so the LCP image is missing) and requests width-only CDN images                                                 |

## Upgrading the engine

The engine package ships each component's source as `tailwind/<path>.tsx.txt`, under the path in
**Engine source**. For each fork, compare that file between **Base** and the new version and port
what applies:

```bash
for v in 1.0.89 1.0.101; do
  mkdir -p engine-$v && tar -xzf "$(npm pack @salla.sa/twilight-theme-engine@$v --silent)" -C engine-$v
done
diff -u engine-1.0.89/package/tailwind/routes/product/ProductPage.tsx.txt \
  engine-1.0.101/package/tailwind/routes/product/ProductPage.tsx.txt
```

Then set **Base** to the new version. Packages before 1.0.86 have no source copy, so for an older
**Base** compare the fork with the 1.0.86 source in full.

## Adding a fork

Add a row here. Fork only when a hook slot, the `registry`, or a home-component key can't do the
job: every fork is code you now maintain by hand. See
[Fork a built-in route](https://docs.salla.dev/twilight/react/recipes/fork-a-built-in-route).
