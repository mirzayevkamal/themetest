import { StrokeIcon, type StrokeIconProps } from './StrokeIcon';

export function GiftIcon(props: StrokeIconProps) {
  return (
    <StrokeIcon viewBox="0 0 13.5 13.5" {...props}>
      <path d="M1.2 6.2h11.1v6.7H1.2z" />
      <path d="M0.6 3.7h12.3v2.5H0.6z" />
      <path d="M6.75 3.7v9.2" />
      <path d="M6.75 3.7S5.6 0.6 3.9 1.2c-1.5.5-.6 2.5 2.85 2.5Zm0 0s1.15-3.1 2.85-2.5c1.5.5.6 2.5-2.85 2.5Z" />
    </StrokeIcon>
  );
}
