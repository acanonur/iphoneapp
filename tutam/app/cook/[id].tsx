/**
 * Cook mode: one step at a time in large type, with the screen kept awake so
 * it can be read from arm's length with flour on your hands. Steps that are
 * mostly waiting carry a timer.
 */

import { Fragment, useEffect, useState } from 'react';
import { ScrollView, Text, Vibration, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { ingredientLine } from '../../src/logic/ingredientLine';
import { scaleFactor } from '../../src/logic/quantity';
import { localise } from '../../src/logic/text';
import { useLang, useRecipe, useStore, useT } from '../../src/store/useStore';
import { Button, Card, Chip, EmptyState, Hairline, IconButton } from '../../src/ui/components';
import { BackIcon, CheckIcon, ClockIcon, CloseIcon, ForwardIcon, PlayIcon } from '../../src/ui/icons';
import { colors, fonts, spacing, type } from '../../src/ui/theme';

export default function CookScreen() {
  useKeepAwake();

  const { id, servings } = useLocalSearchParams<{ id: string; servings?: string }>();
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const recipe = useRecipe(id);
  const system = useStore((s) => s.system);

  const [index, setIndex] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);

  if (!recipe) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ padding: spacing.lg, flexDirection: 'row' }}>
          <IconButton label={t('cook.close')} onPress={() => router.back()}>
            <CloseIcon />
          </IconButton>
        </View>
        <EmptyState title={t('recipe.notFound')} body="" />
      </SafeAreaView>
    );
  }

  const wanted = Number(servings) || recipe.servings;
  const factor = scaleFactor(recipe.servings, wanted);
  const total = recipe.steps.length;
  const step = recipe.steps[index];
  const last = index >= total - 1;

  function go(next: number) {
    void Haptics.selectionAsync();
    setIndex(next);
  }

  function forward() {
    if (!last) {
      go(index + 1);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <IconButton label={t('cook.close')} onPress={() => router.back()}>
          <CloseIcon />
        </IconButton>
        <Text style={[type.label, { flex: 1, textAlign: 'center' }]}>
          {t('cook.stepOf', { n: Math.min(index + 1, Math.max(total, 1)), total })}
        </Text>
        <Chip
          label={t('cook.ingredients')}
          selected={showIngredients}
          onPress={() => setShowIngredients((shown) => !shown)}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: 4, marginHorizontal: spacing.lg }}>
        {recipe.steps.map((_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: i <= index ? colors.accent : colors.surfaceAlt,
            }}
          />
        ))}
      </View>

      {showIngredients ? (
        <Card style={{ margin: spacing.lg, maxHeight: 260 }}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {recipe.ingredients.map((ing, i) => {
              const line = ingredientLine(ing, { factor, system, lang });
              return (
                <Fragment key={i}>
                  {i > 0 ? <Hairline /> : null}
                  <Text style={[type.body, { paddingVertical: spacing.sm }]}>
                    {line.amount ? <Text style={{ fontFamily: fonts.bold }}>{line.amount} </Text> : null}
                    {line.name}
                  </Text>
                </Fragment>
              );
            })}
          </ScrollView>
        </Card>
      ) : null}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.xl, flexGrow: 1, justifyContent: 'center' }}
      >
        <Text style={[type.label, { color: colors.textMuted, marginBottom: spacing.md }]}>
          {localise(recipe.title, lang)}
        </Text>
        {step ? <Text style={type.cook}>{localise(step.text, lang)}</Text> : null}
        {step?.timerMinutes ? (
          <View style={{ marginTop: spacing.xl }}>
            {/* Keyed by step so moving on throws the old countdown away. */}
            <StepTimer key={index} minutes={step.timerMinutes} />
          </View>
        ) : null}
      </ScrollView>

      <View style={{ padding: spacing.lg, flexDirection: 'row', gap: spacing.md }}>
        <Button
          label={t('cook.back')}
          variant="quiet"
          icon={<BackIcon />}
          disabled={index === 0}
          onPress={() => go(index - 1)}
          style={{ flex: 1 }}
        />
        <Button
          label={last ? t('cook.done') : t('cook.next')}
          icon={last ? <CheckIcon color={colors.onAccent} /> : <ForwardIcon color={colors.onAccent} />}
          onPress={forward}
          style={{ flex: 2 }}
        />
      </View>

      <Text style={[type.small, { textAlign: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md }]}>
        {t('cook.awake')}
      </Text>
    </SafeAreaView>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** A countdown for a step that is mostly waiting. */
function StepTimer({ minutes }: { minutes: number }) {
  const t = useT();
  const full = minutes * 60;
  const [remaining, setRemaining] = useState(full);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  // The interval only ticks; reaching zero is handled below, so no side effect
  // runs inside a state updater.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (!running || remaining > 0) return;
    setRunning(false);
    setFinished(true);
    Vibration.vibrate([0, 400, 200, 400]);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [running, remaining]);

  function reset() {
    setRunning(false);
    setFinished(false);
    setRemaining(full);
  }

  const untouched = remaining === full && !running && !finished;
  const paused = !running && !finished && remaining < full;

  return (
    <Card style={{ backgroundColor: colors.markSoft, alignItems: 'center', gap: spacing.sm }}>
      <ClockIcon size={26} color={colors.mark} />
      <Text style={{ fontFamily: fonts.display, fontSize: 40, color: colors.text }}>
        {pad(Math.floor(remaining / 60))}:{pad(remaining % 60)}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm }}>
        {untouched ? (
          <Button
            label={t('cook.timer.start', { minutes })}
            icon={<PlayIcon color={colors.onAccent} />}
            onPress={() => setRunning(true)}
          />
        ) : null}
        {running ? <Button label={t('cook.timer.pause')} variant="quiet" onPress={() => setRunning(false)} /> : null}
        {paused ? (
          <>
            <Button label={t('cook.timer.resume')} onPress={() => setRunning(true)} />
            <Button label={t('cook.timer.reset')} variant="ghost" onPress={reset} />
          </>
        ) : null}
        {finished ? (
          <>
            <Text style={[type.subheading, { color: colors.mark }]}>{t('cook.timer.finished')}</Text>
            <Button label={t('cook.timer.reset')} variant="ghost" onPress={reset} />
          </>
        ) : null}
      </View>
    </Card>
  );
}
