import type { SizedIconProps } from './types';

export function TrackCheckIcon({ size = 20, className }: SizedIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M10.0013 18.3327C14.6036 18.3327 18.3346 14.6017 18.3346 9.99935C18.3346 5.39697 14.6036 1.66602 10.0013 1.66602C5.39893 1.66602 1.66797 5.39697 1.66797 9.99935C1.66797 14.6017 5.39893 18.3327 10.0013 18.3327ZM14.5489 7.88027L9.16797 13.2612L5.66204 9.75527L6.84056 8.57677L9.16797 10.9042L13.3704 6.70176L14.5489 7.88027Z" />
    </svg>
  );
}
