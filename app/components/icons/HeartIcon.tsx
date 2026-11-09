import { StrokeIcon, type StrokeIconProps } from './StrokeIcon';

/** `filled`: the wishlist's added state. */
export function HeartIcon({ filled = false, ...props }: StrokeIconProps & { filled?: boolean }) {
  return (
    <StrokeIcon viewBox="0 0 14 12.6" {...props}>
      <path
        d="M7 11.9S0.6 8.2 0.6 3.9A3.3 3.3 0 0 1 7 2.6a3.3 3.3 0 0 1 6.4 1.3C13.4 8.2 7 11.9 7 11.9Z"
        fill={filled ? 'currentColor' : 'none'}
      />
    </StrokeIcon>
  );
}
