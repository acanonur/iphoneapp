/**
 * The Ikimiz mark: two lowercase i's side by side, one in each ink.
 *
 * Same geometry as the app icon — the numbers come from `scripts/make-icons.py`
 * — drawn as SVG so it is sharp at any size and follows the theme's inks.
 */

import Svg, { Circle, Rect } from 'react-native-svg';
import { colors } from './theme.js';

export function Logo({ size = 64, tile = true }: { size?: number; tile?: boolean }) {
  const coral = tile ? '#f0704f' : colors.accent;
  const teal = tile ? '#4cb7b1' : colors.accent2;

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* The plum tile, with the corner radius the home screen gives the icon. */}
      {tile ? <Rect width="100" height="100" rx="22.5" fill="#231f2b" /> : null}
      <Circle cx="38.5" cy="31" r="9.5" fill={coral} />
      <Rect x="30" y="45" width="17" height="34" rx="8.5" fill={coral} />
      <Circle cx="61.5" cy="24" r="9.5" fill={teal} />
      <Rect x="53" y="38" width="17" height="41" rx="8.5" fill={teal} />
    </Svg>
  );
}
