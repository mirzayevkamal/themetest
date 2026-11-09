import { hydrate } from './hydrate';
import appCssUrl from './styles/app.css?url';

// Home paints from the inline critical sheet. Start the full sheet now without blocking, and
// hydrate at once: the engine's bootClient waited for the hero image first, which cost Speed
// Index and TBT on PR 66. Other routes already have the full sheet as a blocking link.
if (!document.querySelector(`link[rel="stylesheet"][href="${appCssUrl}"]`)) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = appCssUrl;
  // React adopts a stylesheet with a matching href and precedence instead of adding a second one.
  link.dataset.precedence = 'default';
  document.head.appendChild(link);
}

hydrate();
