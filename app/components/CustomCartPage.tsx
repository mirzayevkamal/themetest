import { CartPage, type CartPageProps } from '@salla.sa/twilight-theme-engine/routes/cart';

/**
 * Example: Custom cart page that wraps the base CartPage
 * with additional UI elements.
 *
 * The developer receives all cart data from the loader -
 * no need to handle data fetching!
 */
export function CustomCartPage(props: CartPageProps) {
  return (
    <div className="custom-cart-wrapper">
      {/* Add custom header */}
      <div className="custom-cart-header bg-primary text-white p-4 mb-4">
        <h2 className="text-xl font-bold">Your Shopping Cart</h2>
        <p>Free shipping on orders over 200 SAR!</p>
      </div>

      {/* Render the base cart page - reuse all the logic! */}
      <CartPage {...props} />

      {/* Add custom footer */}
      <div className="custom-cart-footer mt-6 p-4 bg-gray-100 rounded-lg">
        <p className="text-sm text-gray-600">Need help? Contact us at support@store.com</p>
      </div>
    </div>
  );
}

/**
 * Example: Completely custom cart page
 * Build your own UI while still receiving all data from loader
 */
export function FullyCustomCartPage({ cart }: CartPageProps) {
  if (!cart) {
    return (
      <div className="my-custom-cart">
        <h1>My Fully Custom Cart</h1>
        <p>Your cart is empty.</p>
      </div>
    );
  }

  return (
    <div className="my-custom-cart">
      <h1>My Fully Custom Cart</h1>
      <p>Items in cart: {cart.count}</p>
      <p>Total: {cart.total}</p>

      {/* Build your own UI here */}
      {cart.items.map((item) => (
        <div key={item.id} className="my-cart-item">
          {item.product_name} - {typeof item.price === 'object' ? item.price.formatted : item.price}
        </div>
      ))}
    </div>
  );
}
