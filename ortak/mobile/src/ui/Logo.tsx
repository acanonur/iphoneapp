/**
 * The Hane mark: a lowercase h in two inks.
 *
 * A coral stem and a teal arch — two inks making one letter, which also stands
 * like a doorway. Same geometry as the app icon (the numbers come from
 * `scripts/make-icons.py`), drawn as SVG so it is sharp at any size.
 */

import Svg, { Path, Rect } from 'react-native-svg';
import { colors } from './theme.js';

export function Logo({ size = 64, tile = true }: { size?: number; tile?: boolean }) {
  const coral = tile ? '#f0704f' : colors.accent;
  const teal = tile ? '#4cb7b1' : colors.accent2;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* The plum tile, with the corner radius the home screen gives the icon. */}
      {tile ? <Rect width="100" height="100" rx="22.5" fill="#231f2b" /> : null}
      <Path
        d="M44 44 H58 A17 17 0 0 1 75 61 V73.5 A8.5 8.5 0 0 1 58 73.5 V67 A6 6 0 0 0 52 61 H44 Z"
        fill={teal}
      />
      <Rect x="28" y="18" width="17" height="64" rx="8.5" fill={coral} />
    </Svg>
  );
}
