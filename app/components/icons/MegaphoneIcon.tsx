import { StrokeIcon, type StrokeIconProps } from './StrokeIcon';

export function MegaphoneIcon(props: StrokeIconProps) {
  return (
    <StrokeIcon viewBox="0 0 16 16" {...props}>
      <path d="M2.5 6.5V9.5C2.5 10.05 2.95 10.5 3.5 10.5H5L9.8 13.6C10.35 13.95 11 13.55 11 12.9V3.1C11 2.45 10.35 2.05 9.8 2.4L5 5.5H3.5C2.95 5.5 2.5 5.95 2.5 6.5Z" />
      <path d="M5 10.5L5.8 13.5M13 6.5C13.6 7.3 13.6 8.7 13 9.5" />
    </StrokeIcon>
  );
}

/** Red "x" badge on the wallet empty state (fixed Figma colors). */
