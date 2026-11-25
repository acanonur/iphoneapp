/**
 * The recipe box.
 *
 * One list for food and drinks, narrowed three ways that can be combined: a
 * search that reads every language at once (so "mercimek" and "lentil" find
 * the same soup), a food/drinks switch, and category chips drawn from what is
 * actually in the box.
 */

import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { categoriesIn, filterRecipes } from '../../src/logic/search';
import type { Category, Kind } from '../../src/model/types';
import { useLang, useRecipes, useT } from '../../src/store/useStore';
import { RecipeCard } from '../../src/ui/RecipeCard';
import { Button, Chip, ChipRow, EmptyState, Field, Header, IconButton, Seg } from '../../src/ui/components';
import { ClockIcon, HeartIcon, PlusIcon, SearchIcon } from '../../src/ui/icons';
import { colors, spacing } from '../../src/ui/theme';

type KindFilter = 'all' | Kind;

export default function RecipesScreen() {
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const recipes = useRecipes();

  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [category, setCategory] = useState<Category | null>(null);
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [quick, setQuick] = useState(false);

  const ofKind = useMemo(() => (kind === 'all' ? recipes : recipes.filter((r) => r.kind === kind)), [recipes, kind]);
  const categories = useMemo(() => categoriesIn(ofKind), [ofKind]);

  const visible = useMemo(
    () =>
      filterRecipes(
        recipes,
        {
          query,
          kind: kind === 'all' ? null : kind,
          category,
          favouritesOnly,
          maxMinutes: quick ? 30 : null,
        },
        lang,
      ),
    [recipes, query, kind, category, favouritesOnly, quick, lang],
  );

  const filtered = Boolean(query.trim()) || kind !== 'all' || category !== null || favouritesOnly || quick;

  function clear() {
    setQuery('');
    setKind('all');
    setCategory(null);
    setFavouritesOnly(false);
    setQuick(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <FlatList
        data={visible}
        keyExtractor={(recipe) => recipe.id}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        ListHeaderComponent={
          <View style={{ marginBottom: spacing.lg }}>
            <Header
              title={t('home.title')}
              subtitle={
                recipes.length === 1 ? t('home.subtitle.one') : t('home.subtitle.many', { count: recipes.length })
              }
              right={
                <IconButton label={t('home.add')} tone="primary" size={48} onPress={() => router.push('/edit/new')}>
                  <PlusIcon size={24} color={colors.onAccent} strokeWidth={2.4} />
                </IconButton>
              }
            />
            <Field
              placeholder={t('home.search')}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
              left={<SearchIcon size={19} color={colors.textFaint} />}
            />
            <Seg
              stretch
              options={[
                { value: 'all', label: t('home.kind.all') },
                { value: 'food', label: t('home.kind.food') },
                { value: 'drink', label: t('home.kind.drink') },
              ]}
              value={kind}
              onChange={(next) => {
                setKind(next);
                setCategory(null);
              }}
            />
            <View style={{ height: spacing.md }} />
            <ChipRow>
              <Chip
                label={t('home.favourites')}
                tone="mark"
                selected={favouritesOnly}
                onPress={() => setFavouritesOnly((v) => !v)}
                icon={<HeartIcon size={15} color={favouritesOnly ? colors.onMark : colors.mark} filled={favouritesOnly} />}
              />
              <Chip
                label={t('home.quick')}
                selected={quick}
                onPress={() => setQuick((v) => !v)}
                icon={<ClockIcon size={15} color={quick ? colors.bg : colors.textMuted} />}
              />
              {categories.map((c) => (
                <Chip
                  key={c}
                  label={t(`category.${c}`)}
                  selected={category === c}
                  onPress={() => setCategory(category === c ? null : c)}
                />
              ))}
            </ChipRow>
          </View>
        }
        renderItem={({ item }) => (
          <RecipeCard recipe={item} lang={lang} onPress={() => router.push(`/recipe/${item.id}`)} />
        )}
        ListEmptyComponent={
          <EmptyState
            title={t('home.empty.title')}
            body={t('home.empty.body')}
            action={filtered ? <Button label={t('home.clear')} variant="quiet" onPress={clear} /> : undefined}
          />
        }
      />
    </SafeAreaView>
  );
}
