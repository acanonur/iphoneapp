import { Text, View } from 'react-native';
import { formatMinutes } from '../logic/quantity';
import { totalMinutes } from '../logic/search';
import { localise } from '../logic/text';
import type { Lang, Recipe } from '../model/types';
import { Card, CategoryTile } from './components';
import { ClockIcon, HeartIcon } from './icons';
import { colors, spacing, type } from './theme';

/** One recipe in a list: its tile, its name, one line about it, and how long it takes. */
export function RecipeCard({
  recipe,
  lang,
  onPress,
  footer,
}: {
  recipe: Recipe;
  lang: Lang;
  onPress: () => void;
  /** Replaces the summary line — "Missing: lime" on the Make tab. */
  footer?: string;
}) {
  const minutes = totalMinutes(recipe);
  return (
    <Card onPress={onPress} style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.md, marginBottom: spacing.md }}>
      <CategoryTile category={recipe.category} size={72} />
      <View style={{ flex: 1, justifyContent: 'center', gap: 3 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[type.subheading, { flex: 1, fontSize: 17 }]} numberOfLines={1}>
            {localise(recipe.title, lang)}
          </Text>
          {recipe.favourite ? <HeartIcon size={16} color={colors.mark} filled /> : null}
        </View>
        <Text style={[type.small, footer ? { color: colors.mark } : null]} numberOfLines={footer ? 1 : 2}>
          {footer ?? localise(recipe.summary, lang)}
        </Text>
        {minutes > 0 && !footer ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <ClockIcon size={13} color={colors.textFaint} />
            <Text style={[type.small, { fontSize: 12.5, color: colors.textFaint }]}>{formatMinutes(minutes)}</Text>
          </View>
        ) : null}
      </View>
    </Card>
  );
}
