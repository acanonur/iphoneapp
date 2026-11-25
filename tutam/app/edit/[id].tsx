/**
 * The editor for a new or existing recipe, with import from a website.
 *
 * The form keeps everything as plain strings and only builds a Recipe on save,
 * so half-typed numbers never end up in the store. Ingredients and steps are
 * typed one per line and read back with the same parser the shopping list uses.
 */

import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Switch, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { importFromHtml } from '../../src/logic/importRecipe';
import { parseIngredient } from '../../src/logic/parseIngredient';
import { formatNumber } from '../../src/logic/quantity';
import { localise } from '../../src/logic/text';
import { DRINK_CATEGORIES, FOOD_CATEGORIES } from '../../src/model/types';
import type { Category, Ingredient, Kind, Lang, Recipe } from '../../src/model/types';
import { newId, useLang, useStore, useT } from '../../src/store/useStore';
import { Button, Card, Chip, EmptyState, Field, Header, IconButton, Label, Screen, Seg } from '../../src/ui/components';
import { CloseIcon, LinkIcon } from '../../src/ui/icons';
import { colors, fonts, spacing, type } from '../../src/ui/theme';

type Difficulty = '1' | '2' | '3';

/** One ingredient as a typed line. Raw unit codes and '.' decimals, because that is what parseIngredient reads back. */
function ingredientToLine(ingredient: Ingredient, lang: Lang): string {
  const name = localise(ingredient.name, lang);
  const note = localise(ingredient.note, lang);
  const parts = [
    ingredient.qty !== null ? formatNumber(ingredient.qty, 'en') : '',
    ingredient.unit !== null && ingredient.unit !== 'piece' ? ingredient.unit : '',
    name,
  ].filter(Boolean);
  return parts.join(' ') + (note ? `, ${note}` : '');
}

function ingredientsToText(recipe: { ingredients: Ingredient[] }, lang: Lang): string {
  return recipe.ingredients.map((ing) => ingredientToLine(ing, lang)).join('\n');
}

function stepsToText(recipe: Pick<Recipe, 'steps'>, lang: Lang): string {
  return recipe.steps.map((step) => localise(step.text, lang)).join('\n');
}

/** The first duration mentioned in a step, in minutes. */
function timerFrom(text: string): number | undefined {
  const match = text.match(
    /(\d+)(?:\s*[-–—]\s*\d+)?\s*(minutes|minuten|minute|mins|min|dakika|dk|hours|hour|stunden|stunde|saat)\b/i,
  );
  if (!match) return undefined;
  const amount = parseInt(match[1] ?? '', 10);
  if (Number.isNaN(amount) || amount <= 0) return undefined;
  const unit = (match[2] ?? '').toLowerCase();
  const isHours = unit.startsWith('hour') || unit.startsWith('stunde') || unit === 'saat';
  return isHours ? amount * 60 : amount;
}

function toNumber(text: string, fallback: number): number {
  const n = parseInt(text, 10);
  return Number.isNaN(n) || n <= 0 ? fallback : n;
}

function toMinutes(text: string): number {
  const n = parseInt(text, 10);
  return Number.isNaN(n) ? 0 : Math.max(0, n);
}

export default function EditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const isNew = id === 'new';
  const existing = useStore((s) => (isNew || !id ? undefined : s.recipes[id]));
  const saveRecipe = useStore((s) => s.saveRecipe);

  // Seeded once: later store changes must not wipe what is being typed.
  const [title, setTitle] = useState(() => (existing ? localise(existing.title, lang) : ''));
  const [summary, setSummary] = useState(() => (existing ? localise(existing.summary, lang) : ''));
  const [kind, setKind] = useState<Kind>(existing?.kind ?? 'food');
  const [category, setCategory] = useState<Category>(existing?.category ?? 'main');
  const [servings, setServings] = useState(existing ? String(existing.servings) : '2');
  const [prep, setPrep] = useState(existing ? String(existing.prepMinutes) : '10');
  const [cook, setCook] = useState(existing ? String(existing.cookMinutes) : '0');
  const [difficulty, setDifficulty] = useState<Difficulty>(existing ? (String(existing.difficulty) as Difficulty) : '1');
  const [ingredientsText, setIngredientsText] = useState(() => (existing ? ingredientsToText(existing, lang) : ''));
  const [stepsText, setStepsText] = useState(() => (existing ? stepsToText(existing, lang) : ''));
  const [notes, setNotes] = useState(() => (existing ? localise(existing.notes, lang) : ''));
  const [alcoholic, setAlcoholic] = useState(existing?.alcoholic ?? false);
  const [source, setSource] = useState<string | undefined>(existing?.source);

  const [url, setUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'bad' } | null>(null);

  if (!isNew && !existing) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ padding: spacing.lg, flexDirection: 'row' }}>
          <IconButton label={t('common.cancel')} onPress={() => router.back()}>
            <CloseIcon />
          </IconButton>
        </View>
        <EmptyState title={t('recipe.notFound')} body="" />
      </SafeAreaView>
    );
  }

  function changeKind(next: Kind) {
    if (next === kind) return;
    setKind(next);
    // A food category means nothing on a drink, so the category follows the kind.
    setCategory(next === 'food' ? 'main' : 'cocktail');
  }

  async function runImport() {
    let address = url.trim();
    if (!address) return;
    if (!address.startsWith('http')) address = `https://${address}`;
    setImporting(true);
    setMessage(null);
    try {
      const response = await fetch(address);
      const html = await response.text();
      const draft = importFromHtml(html, address);
      if (!draft) {
        setMessage({ text: t('edit.import.failed'), tone: 'bad' });
        return;
      }
      setTitle(localise(draft.title, lang));
      setSummary(localise(draft.summary, lang));
      setKind(draft.kind);
      setCategory(draft.category);
      setServings(String(draft.servings));
      setPrep(String(draft.prepMinutes));
      setCook(String(draft.cookMinutes));
      setDifficulty(String(draft.difficulty) as Difficulty);
      setIngredientsText(ingredientsToText(draft, lang));
      setStepsText(stepsToText(draft, lang));
      setNotes(localise(draft.notes, lang));
      setAlcoholic(Boolean(draft.alcoholic));
      setSource(address);
      setMessage({ text: t('edit.import.done'), tone: 'ok' });
    } catch {
      setMessage({ text: t('edit.import.offline'), tone: 'bad' });
    } finally {
      setImporting(false);
    }
  }

  function save() {
    if (!title.trim()) {
      Alert.alert(t('edit.needsName'));
      return;
    }
    const recipe: Recipe = {
      id: existing?.id ?? newId('recipe'),
      kind,
      category,
      title: title.trim(),
      summary: summary.trim(),
      servings: toNumber(servings, 1),
      prepMinutes: toMinutes(prep),
      cookMinutes: toMinutes(cook),
      difficulty: Number(difficulty) as 1 | 2 | 3,
      ingredients: ingredientsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const parsed = parseIngredient(line);
          return {
            qty: parsed.qty,
            unit: parsed.unit,
            name: parsed.name,
            ...(parsed.note ? { note: parsed.note } : {}),
          };
        }),
      steps: stepsText
        .split('\n')
        .map((line) => line.trim().replace(/^(?:\d+\s*[.)]|[-•*])\s*/, ''))
        .filter(Boolean)
        .map((text) => {
          const minutes = timerFrom(text);
          return { text, ...(minutes ? { timerMinutes: minutes } : {}) };
        }),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      tags: existing?.tags ?? [],
      ...(kind === 'drink' ? { alcoholic, ...(existing?.glass ? { glass: existing.glass } : {}) } : {}),
      ...(source ? { source } : {}),
    };
    saveRecipe(recipe);
    router.replace('/recipe/' + recipe.id);
  }

  function close() {
    if (!title.trim() && !ingredientsText.trim() && !stepsText.trim()) {
      router.back();
      return;
    }
    Alert.alert(t('edit.discard.title'), undefined, [
      { text: t('edit.discard.keep'), style: 'cancel' },
      { text: t('edit.discard.discard'), style: 'destructive', onPress: () => router.back() },
    ]);
  }

  const categories = kind === 'food' ? FOOD_CATEGORIES : DRINK_CATEGORIES;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <Header
          title={t(isNew ? 'edit.new' : 'edit.title')}
          right={
            <IconButton label={t('common.cancel')} onPress={close}>
              <CloseIcon />
            </IconButton>
          }
        />

        {isNew ? (
          <Card style={{ marginBottom: spacing.lg, backgroundColor: colors.accentSoft }}>
            <Label>{t('edit.import.label')}</Label>
            <Field
              placeholder={t('edit.import.placeholder')}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              left={<LinkIcon size={18} color={colors.textFaint} />}
              containerStyle={{ marginBottom: spacing.sm }}
            />
            <Button
              label={importing ? t('edit.import.busy') : t('edit.import.button')}
              disabled={importing || !url.trim()}
              onPress={() => void runImport()}
            />
            <Text style={[type.small, { marginTop: spacing.sm }]}>{t('edit.import.hint')}</Text>
            {message ? (
              <Text
                style={[
                  type.small,
                  {
                    marginTop: spacing.sm,
                    fontFamily: fonts.semi,
                    color: message.tone === 'ok' ? colors.success : colors.danger,
                  },
                ]}
              >
                {message.text}
              </Text>
            ) : null}
          </Card>
        ) : null}

        <Field
          label={t('edit.name')}
          placeholder={t('edit.name.placeholder')}
          value={title}
          onChangeText={setTitle}
        />
        <Field
          label={t('edit.summary')}
          placeholder={t('edit.summary.placeholder')}
          value={summary}
          onChangeText={setSummary}
        />

        <Label>{t('edit.kind')}</Label>
        <View style={{ marginBottom: spacing.md }}>
          <Seg<Kind>
            stretch
            options={[
              { value: 'food', label: t('home.kind.food') },
              { value: 'drink', label: t('home.kind.drink') },
            ]}
            value={kind}
            onChange={changeKind}
          />
        </View>

        <Label>{t('edit.category')}</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
          {categories.map((c) => (
            <Chip
              key={c}
              label={t(`category.${c}`)}
              selected={c === category}
              tone="accent"
              onPress={() => setCategory(c)}
            />
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-end' }}>
          <Field
            label={t('edit.servings')}
            value={servings}
            onChangeText={setServings}
            keyboardType="number-pad"
            containerStyle={{ flex: 1 }}
          />
          <Field
            label={t('edit.prep')}
            value={prep}
            onChangeText={setPrep}
            keyboardType="number-pad"
            containerStyle={{ flex: 1 }}
          />
          <Field
            label={t('edit.cook')}
            value={cook}
            onChangeText={setCook}
            keyboardType="number-pad"
            containerStyle={{ flex: 1 }}
          />
        </View>

        <Label>{t('edit.difficulty')}</Label>
        <View style={{ marginBottom: spacing.md }}>
          <Seg<Difficulty>
            stretch
            options={[
              { value: '1', label: t('recipe.difficulty.1') },
              { value: '2', label: t('recipe.difficulty.2') },
              { value: '3', label: t('recipe.difficulty.3') },
            ]}
            value={difficulty}
            onChange={setDifficulty}
          />
        </View>

        {kind === 'drink' ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <Text style={[type.body, { flex: 1 }]}>{t('edit.alcoholic')}</Text>
            <Switch
              value={alcoholic}
              onValueChange={setAlcoholic}
              trackColor={{ true: colors.accent, false: colors.divider }}
            />
          </View>
        ) : null}

        <Field
          multiline
          label={t('edit.ingredients')}
          placeholder={t('edit.ingredients.placeholder')}
          hint={t('edit.ingredients.hint')}
          value={ingredientsText}
          onChangeText={setIngredientsText}
          autoCapitalize="none"
        />
        <Field
          multiline
          label={t('edit.steps')}
          placeholder={t('edit.steps.placeholder')}
          hint={t('edit.steps.hint')}
          value={stepsText}
          onChangeText={setStepsText}
        />
        <Field
          multiline
          label={t('edit.notes')}
          placeholder={t('edit.notes.placeholder')}
          value={notes}
          onChangeText={setNotes}
        />

        <Button label={t('edit.save')} onPress={save} style={{ marginTop: spacing.md }} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
