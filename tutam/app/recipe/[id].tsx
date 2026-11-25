/**
 * One recipe.
 *
 * The page answers, in order, the questions you have standing in a kitchen:
 * what is this, how long will it take, what do I need — for how many — and
 * what do I do. Servings and units change the ingredient list in place, so
 * there is never a second "scaled" view to keep in your head.
 */

import { useMemo, useState } from 'react';
import { Alert, ScrollView, Share, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ingredientLine, ingredientText } from '../../src/logic/ingredientLine';
import { formatMinutes, scaleFactor } from '../../src/logic/quantity';
import { totalMinutes } from '../../src/logic/search';
import { localise } from '../../src/logic/text';
import { newId, useLang, useRecipe, useStore, useT } from '../../src/store/useStore';
import { Button, Card, Chip, EmptyState, Hairline, IconButton, Seg, Stepper, Tick } from '../../src/ui/components';
import {
  BackIcon,
  BasketIcon,
  CategoryGlyph,
  ClockIcon,
  CopyIcon,
  HeartIcon,
  PencilIcon,
  PlayIcon,
  ShareIcon,
  TrashIcon,
} from '../../src/ui/icons';
import { categoryColors, colors, fonts, radius, spacing, type } from '../../src/ui/theme';

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const recipe = useRecipe(id);
  const system = useStore((s) => s.system);
  const setSystem = useStore((s) => s.setSystem);
  const toggleFavourite = useStore((s) => s.toggleFavourite);
  const removeRecipe = useStore((s) => s.removeRecipe);
  const saveRecipe = useStore((s) => s.saveRecipe);
  const addShopping = useStore((s) => s.addShopping);

  const [servings, setServings] = useState<number | null>(null);
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  const [added, setAdded] = useState(false);

  const wanted = servings ?? recipe?.servings ?? 1;
  const factor = recipe ? scaleFactor(recipe.servings, wanted) : 1;

  const lines = useMemo(
    () => (recipe ? recipe.ingredients.map((ing) => ingredientLine(ing, { factor, system, lang })) : []),
    [recipe, factor, system, lang],
  );

  if (!recipe) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ padding: spacing.lg }}>
          <IconButton label={t('cook.back')} onPress={() => router.back()}>
            <BackIcon />
          </IconButton>
        </View>
        <EmptyState title={t('recipe.notFound')} body="" />
      </SafeAreaView>
    );
  }

  const title = localise(recipe.title, lang);
  const tone = categoryColors[recipe.category];
  const isDrink = recipe.kind === 'drink';
  const total = totalMinutes(recipe);
  const notes = localise(recipe.notes, lang);

  function share() {
    if (!recipe) return;
    const text = [
      title,
      '',
      localise(recipe.summary, lang),
      '',
      `${t('recipe.ingredients')} (${wanted})`,
      ...lines.map((line) => `• ${ingredientText(line)}`),
      '',
      t('recipe.steps'),
      ...recipe.steps.map((step, i) => `${i + 1}. ${localise(step.text, lang)}`),
      ...(notes ? ['', notes] : []),
    ].join('\n');
    void Share.share({ message: text, title });
  }

  function duplicate() {
    if (!recipe) return;
    // A copy is written in one language — the one being read — so it can be edited as plain text.
    const copyId = newId('recipe');
    saveRecipe({
      ...recipe,
      id: copyId,
      title: t('recipe.copyOf', { title }),
      summary: localise(recipe.summary, lang),
      notes: notes || undefined,
      ingredients: recipe.ingredients.map((ing) => ({
        qty: ing.qty,
        unit: ing.unit,
        name: localise(ing.name, lang),
        ...(ing.note ? { note: localise(ing.note, lang) } : {}),
      })),
      steps: recipe.steps.map((step) => ({ ...step, text: localise(step.text, lang) })),
      starter: false,
    });
    router.replace(`/edit/${copyId}`);
  }

  function remove() {
    if (!recipe) return;
    const starter = Boolean(recipe.starter);
    Alert.alert(
      t(starter ? 'recipe.hide.title' : 'recipe.delete.title'),
      t(starter ? 'recipe.hide.body' : 'recipe.delete.body'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t(starter ? 'recipe.hide' : 'recipe.delete'),
          style: 'destructive',
          onPress: () => {
            removeRecipe(recipe.id);
            router.back();
          },
        },
      ],
    );
  }

  function addAllToShopping() {
    if (!recipe) return;
    addShopping(
      lines
        // What you have ticked off is what you already have.
        .filter((_, index) => !ticked.has(index))
        .map((line) => ({ name: line.name, qty: line.qty, unit: line.unit, recipes: [title] })),
    );
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAdded(true);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* The band of category colour that stands in for a photograph. */}
        <View
          style={{
            margin: spacing.lg,
            marginBottom: 0,
            height: 190,
            borderRadius: radius.lg,
            backgroundColor: tone.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CategoryGlyph category={recipe.category} size={96} color={tone.ink} strokeWidth={1.5} />
          <View
            style={{
              position: 'absolute',
              top: spacing.md,
              left: spacing.md,
              right: spacing.md,
              flexDirection: 'row',
              justifyContent: 'space-between',
            }}
          >
            <IconButton label={t('cook.back')} onPress={() => router.back()}>
              <BackIcon />
            </IconButton>
            <IconButton
              label={t(recipe.favourite ? 'recipe.favourite.remove' : 'recipe.favourite.add')}
              onPress={() => {
                void Haptics.selectionAsync();
                toggleFavourite(recipe.id);
              }}
            >
              <HeartIcon color={recipe.favourite ? colors.mark : colors.text} filled={recipe.favourite} />
            </IconButton>
          </View>
        </View>

        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          <View style={{ gap: spacing.sm }}>
            <Text style={[type.label, { color: tone.ink === colors.text ? colors.textMuted : colors.accentText }]}>
              {t(`category.${recipe.category}`)}
            </Text>
            <Text style={type.hero}>{title}</Text>
            <Text style={[type.body, { color: colors.textMuted }]}>{localise(recipe.summary, lang)}</Text>
          </View>

          {/* The facts, as one row of figures. */}
          <Card style={{ flexDirection: 'row', paddingVertical: spacing.md }}>
            {recipe.prepMinutes > 0 ? <Fact label={t('recipe.prep')} value={formatMinutes(recipe.prepMinutes)} /> : null}
            {recipe.cookMinutes > 0 ? <Fact label={t('recipe.cook')} value={formatMinutes(recipe.cookMinutes)} /> : null}
            {total > 0 ? <Fact label={t('recipe.total')} value={formatMinutes(total)} icon /> : null}
            <Fact label={t('edit.difficulty')} value={t(`recipe.difficulty.${recipe.difficulty}`)} />
          </Card>

          {recipe.tags.length > 0 || isDrink ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {isDrink && recipe.glass ? <Chip label={t(`glass.${recipe.glass}`)} /> : null}
              {isDrink && recipe.alcoholic !== undefined ? (
                <Chip label={t(recipe.alcoholic ? 'recipe.alcoholic' : 'recipe.alcoholFree')} />
              ) : null}
              {recipe.tags.map((tag) => (
                <Chip key={tag} label={tagLabel(tag, t)} />
              ))}
            </View>
          ) : null}

          {/* Ingredients, with the two controls that change them. */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <Text style={[type.heading, { flex: 1 }]}>{t('recipe.ingredients')}</Text>
              <Seg
                options={[
                  { value: 'metric', label: t('units.metric') },
                  { value: 'us', label: t('units.us') },
                ]}
                value={system}
                onChange={setSystem}
              />
            </View>
            <Card style={{ paddingVertical: spacing.sm }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: spacing.sm,
                }}
              >
                <Text style={type.subheading}>{t(isDrink ? 'recipe.glasses' : 'recipe.servings')}</Text>
                <Stepper
                  label={t(isDrink ? 'recipe.glasses' : 'recipe.servings')}
                  value={wanted}
                  onChange={(next) => {
                    setServings(next);
                    setAdded(false);
                  }}
                  max={48}
                />
              </View>
              {lines.map((line, index) => {
                const done = ticked.has(index);
                return (
                  <View key={index}>
                    <Hairline />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 13 }}>
                      <Tick
                        checked={done}
                        label={line.name}
                        onPress={() =>
                          setTicked((current) => {
                            const next = new Set(current);
                            if (next.has(index)) next.delete(index);
                            else next.add(index);
                            return next;
                          })
                        }
                      />
                      <Text style={[type.body, { flex: 1, opacity: done ? 0.45 : 1 }]}>
                        {line.amount ? <Text style={{ fontFamily: fonts.bold }}>{line.amount} </Text> : null}
                        {line.name}
                        {line.note ? <Text style={{ color: colors.textMuted }}>, {line.note}</Text> : null}
                        {!line.amount && !line.note ? (
                          <Text style={{ color: colors.textMuted }}> · {t('recipe.toTaste')}</Text>
                        ) : null}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </Card>
            <Button
              label={t(added ? 'recipe.addedToShopping' : 'recipe.addToShopping')}
              variant="quiet"
              disabled={added}
              icon={<BasketIcon size={19} />}
              onPress={addAllToShopping}
              style={{ marginTop: spacing.md }}
            />
          </View>

          <View>
            <Text style={[type.heading, { marginBottom: spacing.md }]}>{t('recipe.steps')}</Text>
            <View style={{ gap: spacing.md }}>
              {recipe.steps.map((step, index) => (
                <View key={index} style={{ flexDirection: 'row', gap: spacing.md }}>
                  <View
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 15,
                      backgroundColor: colors.accentSoft,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 1,
                    }}
                  >
                    <Text style={{ fontFamily: fonts.bold, fontSize: 14, color: colors.accentText }}>{index + 1}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={type.body}>{localise(step.text, lang)}</Text>
                    {step.timerMinutes ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <ClockIcon size={14} color={colors.mark} />
                        <Text style={[type.small, { color: colors.mark, fontFamily: fonts.semi }]}>
                          {formatMinutes(step.timerMinutes)}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </View>

          {notes ? (
            <Card style={{ backgroundColor: colors.markSoft, shadowOpacity: 0, elevation: 0 }}>
              <Text style={[type.label, { color: colors.mark, marginBottom: 4 }]}>{t('recipe.notes')}</Text>
              <Text style={type.body}>{notes}</Text>
            </Card>
          ) : null}

          {recipe.source ? (
            <Text style={type.small}>
              {t('recipe.source')}: {recipe.source}
            </Text>
          ) : recipe.starter ? (
            <Text style={type.small}>{t('recipe.starter')}</Text>
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {recipe.starter ? (
              <Button label={t('recipe.duplicate')} variant="quiet" icon={<CopyIcon size={18} />} onPress={duplicate} />
            ) : (
              <Button
                label={t('recipe.edit')}
                variant="quiet"
                icon={<PencilIcon size={18} />}
                onPress={() => router.push(`/edit/${recipe.id}`)}
              />
            )}
            <Button label={t('recipe.share')} variant="quiet" icon={<ShareIcon size={18} />} onPress={share} />
            <Button
              label={t(recipe.starter ? 'recipe.hide' : 'recipe.delete')}
              variant="danger"
              icon={<TrashIcon size={18} color={colors.danger} />}
              onPress={remove}
            />
          </View>
        </View>
      </ScrollView>

      {/* The one primary action, always in reach of a thumb. */}
      <SafeAreaView
        edges={['bottom']}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, paddingHorizontal: spacing.lg }}
      >
        <View style={{ paddingVertical: spacing.md }}>
          <Button
            label={t(isDrink ? 'recipe.startMixing' : 'recipe.startCooking')}
            icon={<PlayIcon size={18} color={colors.onAccent} />}
            onPress={() => router.push(`/cook/${recipe.id}?servings=${wanted}`)}
          />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}

function Fact({ label, value, icon = false }: { label: string; value: string; icon?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text style={[type.small, { fontSize: 12 }]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {icon ? <ClockIcon size={14} color={colors.text} /> : null}
        <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: colors.text }}>{value}</Text>
      </View>
    </View>
  );
}

const KNOWN_TAGS = ['vegetarian', 'vegan', 'gluten-free', 'quick', 'turkish', 'german'] as const;

/** A tag's translated name, or the tag itself for ones a person typed. */
function tagLabel(tag: string, t: ReturnType<typeof useT>): string {
  return (KNOWN_TAGS as readonly string[]).includes(tag) ? t(`tag.${tag as (typeof KNOWN_TAGS)[number]}`) : tag;
}
