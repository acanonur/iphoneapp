/**
 * Tutam's icons, drawn for this app.
 *
 * Two sets on one 24 × 24 grid with a round 1.9 stroke: the interface icons,
 * and one glyph per recipe category for the coloured tiles. They are built
 * from plain circles, lines and arcs so the whole family shares one hand.
 */

import type { ReactNode } from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import type { Category } from '../model/types';
import { colors } from './theme';

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  /** Solid version, where one exists (the heart). */
  filled?: boolean;
}

function Icon({ size = 22, color = colors.text, strokeWidth = 1.9, children }: IconProps & { children: ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

// -- interface ---------------------------------------------------------------

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx="11" cy="11" r="6.5" />
    <Line x1="16" y1="16" x2="20.5" y2="20.5" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <Line x1="12" y1="5" x2="12" y2="19" />
    <Line x1="5" y1="12" x2="19" y2="12" />
  </Icon>
);

export const MinusIcon = (p: IconProps) => (
  <Icon {...p}>
    <Line x1="5" y1="12" x2="19" y2="12" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <Line x1="6" y1="6" x2="18" y2="18" />
    <Line x1="18" y1="6" x2="6" y2="18" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M5 12.5 L10 17.5 L19 7" />
  </Icon>
);

export const BackIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M14.5 5 L7.5 12 L14.5 19" />
  </Icon>
);

export const ForwardIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M9.5 5 L16.5 12 L9.5 19" />
  </Icon>
);

export const HeartIcon = ({ filled, ...p }: IconProps) => (
  <Svg
    width={p.size ?? 22}
    height={p.size ?? 22}
    viewBox="0 0 24 24"
    fill={filled ? (p.color ?? colors.text) : 'none'}
    stroke={p.color ?? colors.text}
    strokeWidth={p.strokeWidth ?? 1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <Path d="M12 20 C5 15 3 11.5 3 8.5 A4.5 4.5 0 0 1 12 6.5 A4.5 4.5 0 0 1 21 8.5 C21 11.5 19 15 12 20 Z" />
  </Svg>
);

export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx="12" cy="12" r="8.5" />
    <Path d="M12 7.5 V12 L15 14" />
  </Icon>
);

export const PeopleIcon = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx="9" cy="8" r="3.2" />
    <Path d="M3 19.5 C3 15.5 6 14 9 14 C12 14 15 15.5 15 19.5" />
    <Circle cx="17" cy="9" r="2.5" />
    <Path d="M17.5 14 C19.8 14.3 21 16 21 19" />
  </Icon>
);

export const BookIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M12 6.5 C10 5 7 4.5 4 5 V18.5 C7 18 10 18.5 12 20 C14 18.5 17 18 20 18.5 V5 C17 4.5 14 5 12 6.5 Z" />
    <Line x1="12" y1="6.5" x2="12" y2="20" />
  </Icon>
);

export const SparkIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M12 3.5 L13.8 9.2 L19.5 11 L13.8 12.8 L12 18.5 L10.2 12.8 L4.5 11 L10.2 9.2 Z" />
    <Line x1="18.5" y1="17" x2="18.5" y2="21" />
    <Line x1="16.5" y1="19" x2="20.5" y2="19" />
  </Icon>
);

export const BasketIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M4 10 H20 L18.5 19 A1.5 1.5 0 0 1 17 20 H7 A1.5 1.5 0 0 1 5.5 19 Z" />
    <Path d="M8 10 L11 4.5" />
    <Path d="M16 10 L13 4.5" />
  </Icon>
);

export const GearIcon = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx="12" cy="12" r="3" />
    <Path d="M12 3 V5.5 M12 18.5 V21 M3 12 H5.5 M18.5 12 H21 M5.6 5.6 L7.4 7.4 M16.6 16.6 L18.4 18.4 M18.4 5.6 L16.6 7.4 M7.4 16.6 L5.6 18.4" />
  </Icon>
);

export const PencilIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M4.5 19.5 L5.5 15 L15.5 5 A2.1 2.1 0 0 1 18.5 8 L8.5 18 Z" />
  </Icon>
);

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M5 7 H19" />
    <Path d="M9.5 7 V4.5 H14.5 V7" />
    <Path d="M6.5 7 L7.5 19.5 H16.5 L17.5 7" />
  </Icon>
);

export const ShareIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M12 15 V4" />
    <Path d="M8 7.5 L12 3.5 L16 7.5" />
    <Path d="M6 11.5 V19.5 H18 V11.5" />
  </Icon>
);

export const LinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M10 14 A4 4 0 0 0 15.7 14.3 L18.8 11.2 A4 4 0 0 0 13.1 5.5 L11.8 6.8" />
    <Path d="M14 10 A4 4 0 0 0 8.3 9.7 L5.2 12.8 A4 4 0 0 0 10.9 18.5 L12.2 17.2" />
  </Icon>
);

export const PlayIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M8 5.5 L18.5 12 L8 18.5 Z" />
  </Icon>
);

export const CopyIcon = (p: IconProps) => (
  <Icon {...p}>
    <Rect x="8.5" y="8.5" width="11" height="11" rx="2.5" />
    <Path d="M15.5 8.5 V6.5 A2 2 0 0 0 13.5 4.5 H6.5 A2 2 0 0 0 4.5 6.5 V13.5 A2 2 0 0 0 6.5 15.5 H8.5" />
  </Icon>
);

// -- category glyphs ---------------------------------------------------------

const Steam = () => (
  <>
    <Path d="M9.5 3.5 C8.7 4.6 10.3 5.4 9.5 6.5" />
    <Path d="M14.5 3.5 C13.7 4.6 15.3 5.4 14.5 6.5" />
  </>
);

const GLYPHS: Record<Category, ReactNode> = {
  // A fried egg.
  breakfast: (
    <>
      <Path d="M12 3.5 C17 3.5 20.5 7 20.5 11.5 C20.5 16.5 16.5 20.5 11.5 20.5 C7 20.5 3.5 17.5 3.5 13 C3.5 8 7 3.5 12 3.5 Z" />
      <Circle cx="12" cy="12" r="3.3" />
    </>
  ),
  // A bowl with steam.
  soup: (
    <>
      <Steam />
      <Path d="M3.5 10.5 H20.5 A8.5 8.5 0 0 1 3.5 10.5 Z" />
      <Line x1="8.5" y1="20.5" x2="15.5" y2="20.5" />
    </>
  ),
  // A leaf.
  salad: (
    <>
      <Path d="M5 19 C4 11 9 4.5 19.5 4.5 C19.5 15 13 20 5 19 Z" />
      <Path d="M5 19 L14 10" />
    </>
  ),
  // A plate with fork and knife.
  main: (
    <>
      <Circle cx="12" cy="12" r="5.5" />
      <Path d="M3.5 5 V9 A1.5 1.5 0 0 0 5 10.5 V19.5" />
      <Path d="M20.5 19.5 V4.5 C18.8 5.8 18.3 8.5 18.5 12.5 H20.5" />
    </>
  ),
  // Three small plates: a meze.
  side: (
    <>
      <Circle cx="8" cy="9" r="4.5" />
      <Circle cx="16.5" cy="8" r="3" />
      <Circle cx="15" cy="16.5" r="3.8" />
    </>
  ),
  // A slice of cake.
  dessert: (
    <>
      <Path d="M3.5 18.5 V12 L16 5.5 C18.5 7 20.5 9.5 20.5 12 V18.5 Z" />
      <Path d="M3.5 12 H20.5" />
      <Path d="M3.5 15.3 H20.5" />
    </>
  ),
  // A loaf.
  baking: (
    <>
      <Path d="M4 11.5 C4 8 7.5 5.5 12 5.5 C16.5 5.5 20 8 20 11.5 C20 12.6 19.5 13.3 18.8 13.8 V18.5 H5.2 V13.8 C4.5 13.3 4 12.6 4 11.5 Z" />
      <Path d="M9 9.5 L10.5 12" />
      <Path d="M13.5 9.5 L15 12" />
    </>
  ),
  // A cup with a handle and steam.
  coffee: (
    <>
      <Steam />
      <Path d="M5 9.5 H16.5 V14 A5.75 5.75 0 0 1 5 14 Z" />
      <Path d="M16.5 10.5 H18 A2.5 2.5 0 0 1 18 15.5 H16.2" />
    </>
  ),
  // A tulip tea glass on a saucer.
  tea: (
    <>
      <Path d="M8.5 4.5 H15.5 C15.5 8 13.5 9 13.5 11.5 C13.5 14 16 14.5 16 17 A4 4 0 0 1 8 17 C8 14.5 10.5 14 10.5 11.5 C10.5 9 8.5 8 8.5 4.5 Z" />
      <Line x1="5.5" y1="21" x2="18.5" y2="21" />
    </>
  ),
  // A cocktail glass with an olive.
  cocktail: (
    <>
      <Path d="M4.5 5.5 H19.5 L12 13.5 Z" />
      <Line x1="12" y1="13.5" x2="12" y2="20" />
      <Line x1="8.5" y1="20" x2="15.5" y2="20" />
      <Circle cx="14.5" cy="8.2" r="1.1" />
    </>
  ),
  // A tall glass with a straw and a slice.
  mocktail: (
    <>
      <Path d="M7 7.5 H17 L16 20 H8 Z" />
      <Path d="M13 7.5 L15 3.5 H17.5" />
      <Path d="M7.3 12 H16.7" />
    </>
  ),
  // A tumbler with ice.
  cold: (
    <>
      <Path d="M6 5 H18 L16.8 20 H7.2 Z" />
      <Rect x="9" y="9.5" width="3.6" height="3.6" rx="0.8" />
      <Rect x="12.2" y="14" width="3.2" height="3.2" rx="0.8" />
    </>
  ),
  // A mug with steam.
  hot: (
    <>
      <Steam />
      <Path d="M6 9.5 H16 V18 A2 2 0 0 1 14 20 H8 A2 2 0 0 1 6 18 Z" />
      <Path d="M16 11.5 H17.5 A2.2 2.2 0 0 1 17.5 16 H16" />
    </>
  ),
};

export function CategoryGlyph({ category, ...p }: IconProps & { category: Category }) {
  return <Icon {...p}>{GLYPHS[category]}</Icon>;
}
