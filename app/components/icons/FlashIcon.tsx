export function FlashIcon({ size = 16, fill = '#FF4300' }: { size?: number; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8.66667 6.66667H13.3333L7.33333 15.3333V9.33333H2.66667L8.66667 0.666667V6.66667Z"
        fill={fill}
      />
    </svg>
  );
}
