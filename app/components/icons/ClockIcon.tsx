import { StrokeIcon, type StrokeIconProps } from './StrokeIcon';

export function ClockIcon(props: StrokeIconProps) {
  return (
    <StrokeIcon viewBox="0 0 13.5 13.5" {...props}>
      <circle cx="6.75" cy="6.75" r="6.15" />
      <path d="M6.75 3.5v3.25l2.2 1.4" />
    </StrokeIcon>
  );
}
