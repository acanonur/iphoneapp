/**
 * "What can I make?": tick what is in the cupboard and see which recipes can
 * be cooked or mixed right now, and what one more purchase would unlock.
 */

import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { bestNextBuy, pantryCatalogue, whatCanIMake } from '../../src/logic/pantry';
import { fold } from '../../src/logic/search';
import { useLang, useRecipes, useStore, useT } from '../../src/store/useStore';
import { Button, Card, Chip, EmptyState, Field, Header, Label, Screen } from '../../src/ui/components';
import { BasketIcon, SearchIcon } from '../../src/ui/icons';
import { RecipeCard } from '../../src/ui/RecipeCard';
import { colors, spacing, type } from '../../src/ui/theme';

/** How many ingredients the picker shows before "show all". */
const COLLAPSED = 18;

export default function MakeScreen() {
  const recipes = useRecipes();
  const lang = useLang();
  const t = useT();
  const router = useRouter();
  const pantry = useStore((s) => s.pantry);
  const togglePantry = useStore((s) => s.togglePantry);
  const clearPantry = useStore((s) => s.clearPantry);
  const addShopping = useStore((s) => s.addShopping);

  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [bought, setBought] = useState<string | null>(null);

  const pantrySet = useMemo(() => new Set(pantry), [pantry]);
  const catalogue = useMemo(() => pantryCatalogue(recipes, lang), [recipes, lang]);
  const results = useMemo(() => whatCanIMake(recipes, pantrySet, { maxMissing: 2 }), [recipes, pantrySet]);
  const nextBuy = useMemo(() => bestNextBuy(recipes, pantrySet), [recipes, pantrySet]);
  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  const nameOf = (key: string) => catalogue.find((c) => c.key === key)?.name ?? key;

  const searching = query.trim() !== '';
  const shown = useMemo(() => {
    if (searching) {
      const needle = fold(query.trim());
      return catalogue.filter((c) => fold(c.name).includes(needle));
    }
    // Ticked items first, so what you have is always within reach.
    const ordered = [...catalogue.filter((c) => pantrySet.has(c.key)), ...catalogue.filter((c) => !pantrySet.has(c.key))];
    return expanded ? ordered : ordered.slice(0, COLLAPSED);
  }, [catalogue, query, searching, expanded, pantrySet]);

  const ready = results.filter((r) => r.missing.length === 0);
  const almost = results.filter((r) => r.missing.length > 0);

  return (
    <Screen>
      <Header title={t('make.title')} subtitle={t('make.subtitle')} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
        <Label style={{ flex: 1, marginBottom: 0 }}>
          {t('make.have')}
          {pantry.length > 0 ? ` · ${t('make.have.count', { count: pantry.length })}` : ''}
        </Label>
        {pantry.length > 0 ? (
          <Button
            label={t('make.clear')}
            variant="ghost"
            onPress={clearPantry}
            style={{ minHeight: 36, paddingHorizontal: spacing.md }}
          />
        ) : null}
      </View>

      <Field
        placeholder={t('make.search')}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
        autoCorrect={false}
        left={<SearchIcon size={19} color={colors.textFaint} />}
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {shown.map((c) => (
          <Chip
            key={c.key}
            label={c.name}
            tone="mark"
            selected={pantrySet.has(c.key)}
            onPress={() => {
              void Haptics.selectionAsync();
              togglePantry(c.key);
            }}
          />
        ))}
      </View>

      {!searching && catalogue.length > COLLAPSED ? (
        <Button
          label={expanded ? t('make.showLess') : t('make.showAll', { count: catalogue.length })}
          variant="ghost"
          onPress={() => setExpanded((e) => !e)}
          style={{ marginTop: spacing.sm }}
        />
      ) : null}

      <View style={{ marginTop: spacing.xl }}>
        {pantry.length === 0 ? (
          <EmptyState title={t('make.empty.title')} body={t('make.empty.body')} />
        ) : ready.length === 0 && almost.length === 0 ? (
          <EmptyState title={t('make.none.title')} body={t('make.none.body')} />
        ) : (
          <>
            {ready.length > 0 ? (
              <>
                <Label>
                  {t('make.ready')} · {ready.length}
                </Label>
                {ready.map((status) => {
                  const recipe = byId.get(status.recipeId);
                  if (!recipe) return null;
                  return (
                    <RecipeCard
                      key={recipe.id}
                      recipe={recipe}
                      lang={lang}
                      onPress={() => router.push('/recipe/' + recipe.id)}
                    />
                  );
                })}
              </>
            ) : null}
            {almost.length > 0 ? (
              <>
                <Label style={{ marginTop: spacing.md }}>{t('make.almost')}</Label>
                {almost.map((status) => {
                  const recipe = byId.get(status.recipeId);
                  if (!recipe) return null;
                  return (
                    <RecipeCard
                      key={recipe.id}
                      recipe={recipe}
                      lang={lang}
                      footer={t('make.missing', { items: status.missing.map(nameOf).join(', ') })}
                      onPress={() => router.push('/recipe/' + recipe.id)}
                    />
                  );
                })}
              </>
            ) : null}
          </>
        )}
      </View>

      {nextBuy && pantry.length > 0 ? (
        <Card style={{ marginTop: spacing.md, backgroundColor: colors.markSoft }}>
          <Text style={type.body}>
            {nextBuy.unlocks.length === 1
              ? t('make.nextBuy.one', { item: nameOf(nextBuy.key) })
              : t('make.nextBuy.many', { item: nameOf(nextBuy.key), count: nextBuy.unlocks.length })}
          </Text>
          <Button
            label={t('make.nextBuy.add')}
            variant="quiet"
            icon={<BasketIcon size={18} color={colors.text} />}
            disabled={bought === nextBuy.key}
            style={{ marginTop: spacing.md }}
            onPress={() => {
              addShopping([{ name: nameOf(nextBuy.key), qty: null, unit: null, recipes: [] }]);
              setBought(nextBuy.key);
            }}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
