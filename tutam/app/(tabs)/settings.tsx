/**
 * Settings: language, units, and getting your own recipes in and out. There is
 * no account, so export and import are how recipes move between phones.
 */

import { useState } from 'react';
import { Share, Text, View } from 'react-native';
import Constants from 'expo-constants';
import type { Recipe } from '../../src/model/types';
import { useStore, useT } from '../../src/store/useStore';
import { Button, Card, Chip, Field, Header, Label, Screen, Seg } from '../../src/ui/components';
import { ShareIcon } from '../../src/ui/icons';
import { colors, fonts, spacing, type } from '../../src/ui/theme';

export default function SettingsScreen() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const setLang = useStore((s) => s.setLang);
  const system = useStore((s) => s.system);
  const setSystem = useStore((s) => s.setSystem);
  const mine = useStore((s) => s.recipes);
  const hidden = useStore((s) => s.hidden);
  const restoreStarters = useStore((s) => s.restoreStarters);
  const importRecipes = useStore((s) => s.importRecipes);

  const [pasted, setPasted] = useState('');
  const [message, setMessage] = useState<{ text: string; tone: 'ok' | 'bad' } | null>(null);

  function exportMine() {
    const list = Object.values(mine);
    if (list.length === 0) {
      setMessage({ text: t('settings.export.none'), tone: 'bad' });
      return;
    }
    void Share.share({ message: JSON.stringify({ app: 'tutam', version: 1, recipes: list }, null, 2) });
  }

  function importPasted() {
    try {
      const parsed: unknown = JSON.parse(pasted);
      const list: unknown = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object'
          ? (parsed as { recipes?: unknown }).recipes
          : undefined;
      if (!Array.isArray(list)) throw new Error('not an export');
      const count = importRecipes(list as Recipe[]);
      if (count === 0) throw new Error('nothing imported');
      setPasted('');
      setMessage({
        text: count === 1 ? t('settings.import.done.one') : t('settings.import.done.many', { count }),
        tone: 'ok',
      });
    } catch {
      setMessage({ text: t('settings.import.failed'), tone: 'bad' });
    }
  }

  return (
    <Screen>
      <Header title={t('settings.title')} />

      <Label>{t('settings.language')}</Label>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Chip label={t('settings.language.system')} tone="accent" selected={lang === null} onPress={() => setLang(null)} />
        {/* Each language is named in itself, so it can be found whatever the app is currently in. */}
        <Chip label="English" tone="accent" selected={lang === 'en'} onPress={() => setLang('en')} />
        <Chip label="Türkçe" tone="accent" selected={lang === 'tr'} onPress={() => setLang('tr')} />
        <Chip label="Deutsch" tone="accent" selected={lang === 'de'} onPress={() => setLang('de')} />
      </View>

      <Label style={{ marginTop: spacing.xl }}>{t('settings.units')}</Label>
      <Seg
        options={[
          { value: 'metric', label: t('units.metric') },
          { value: 'us', label: t('units.us') },
        ]}
        value={system}
        onChange={setSystem}
      />
      <Text style={[type.small, { marginTop: spacing.sm }]}>{t('settings.units.hint')}</Text>

      <Label style={{ marginTop: spacing.xl }}>{t('settings.data')}</Label>
      <Card>
        <Text style={type.body}>{t('settings.data.body')}</Text>
        <Button
          label={t('settings.export')}
          variant="quiet"
          icon={<ShareIcon size={18} color={colors.text} />}
          onPress={exportMine}
          style={{ marginTop: spacing.md }}
        />
        <Field
          multiline
          label={t('settings.import')}
          placeholder={t('settings.import.placeholder')}
          value={pasted}
          onChangeText={setPasted}
          autoCapitalize="none"
          autoCorrect={false}
          containerStyle={{ marginTop: spacing.lg }}
        />
        <Button
          label={t('settings.import.button')}
          variant="quiet"
          disabled={!pasted.trim()}
          onPress={importPasted}
        />
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

      {hidden.length > 0 ? (
        <Button
          label={t('settings.restore')}
          variant="quiet"
          style={{ marginTop: spacing.xl }}
          onPress={() => {
            restoreStarters();
            setMessage({ text: t('settings.restore.done'), tone: 'ok' });
          }}
        />
      ) : null}

      <Label style={{ marginTop: spacing.xl }}>{t('settings.about')}</Label>
      <Text style={[type.body, { color: colors.textMuted }]}>{t('settings.about.body')}</Text>
      <Text style={[type.small, { marginTop: spacing.sm }]}>
        {t('settings.version', { version: Constants.expoConfig?.version ?? '0.1.0' })}
      </Text>
    </Screen>
  );
}
