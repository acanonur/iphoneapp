/**
 * The shopping list: type an item (amounts are picked up, "2 l milk"), tick
 * things off in the shop, share the rest.
 */

import { Fragment, useState } from 'react';
import { Alert, Pressable, Share, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { parseIngredient } from '../../src/logic/parseIngredient';
import { formatNumber, usesFractions } from '../../src/logic/quantity';
import { unitLabel } from '../../src/logic/units';
import type { Lang } from '../../src/model/types';
import { useLang, useStore, useT, type ShoppingItem } from '../../src/store/useStore';
import { Button, Card, EmptyState, Field, Header, Hairline, IconButton, Label, Screen, Tick } from '../../src/ui/components';
import { PlusIcon, ShareIcon } from '../../src/ui/icons';
import { colors, fonts, spacing, type } from '../../src/ui/theme';

function amountOf(item: ShoppingItem, lang: Lang): string {
  if (item.qty === null) return '';
  const number = formatNumber(item.qty, lang, { fractions: usesFractions(item.unit) });
  const unit = unitLabel(item.unit, item.qty, lang);
  return unit ? `${number} ${unit}` : number;
}

export default function ShoppingScreen() {
  const t = useT();
  const lang = useLang();
  const shopping = useStore((s) => s.shopping);
  const addShopping = useStore((s) => s.addShopping);
  const toggleShopping = useStore((s) => s.toggleShopping);
  const clearShopping = useStore((s) => s.clearShopping);
  const [draft, setDraft] = useState('');

  const toBuy = shopping.filter((item) => !item.done);
  const done = shopping.filter((item) => item.done);

  function add() {
    const text = draft.trim();
    if (!text) return;
    const parsed = parseIngredient(text);
    addShopping([{ name: parsed.name, qty: parsed.qty, unit: parsed.unit, recipes: [] }]);
    setDraft('');
  }

  function share() {
    const message = toBuy.map((item) => `• ${amountOf(item, lang)} ${item.name}`.replace(/\s+/g, ' ').trim()).join('\n');
    void Share.share({ message });
  }

  function toggle(id: string) {
    void Haptics.selectionAsync();
    toggleShopping(id);
  }

  function clearAll() {
    Alert.alert(t('shopping.clearAll.title'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('shopping.clearAll'), style: 'destructive', onPress: () => clearShopping('all') },
    ]);
  }

  function renderGroup(items: ShoppingItem[]) {
    return (
      <Card style={{ paddingVertical: spacing.xs }}>
        {items.map((item, index) => {
          const amount = amountOf(item, lang);
          return (
            <Fragment key={item.id}>
              {index > 0 ? <Hairline /> : null}
              <Pressable
                onPress={() => toggle(item.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 13 }}
              >
                <Tick checked={item.done} onPress={() => toggle(item.id)} label={item.name} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      type.body,
                      item.done ? { textDecorationLine: 'line-through', color: colors.textFaint } : null,
                    ]}
                  >
                    {item.name}
                  </Text>
                  {item.recipes.length > 0 ? (
                    <Text style={type.small}>{t('shopping.for', { recipes: item.recipes.join(', ') })}</Text>
                  ) : null}
                </View>
                {amount ? (
                  <Text style={{ fontFamily: fonts.semi, fontSize: 15, color: colors.textMuted }}>{amount}</Text>
                ) : null}
              </Pressable>
            </Fragment>
          );
        })}
      </Card>
    );
  }

  return (
    <Screen>
      <Header
        title={t('shopping.title')}
        right={
          shopping.length > 0 ? (
            <IconButton label={t('shopping.share')} onPress={share}>
              <ShareIcon />
            </IconButton>
          ) : undefined
        }
      />

      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
        <Field
          containerStyle={{ flex: 1 }}
          placeholder={t('shopping.add')}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          returnKeyType="done"
        />
        <IconButton label={t('shopping.add')} tone="primary" size={50} onPress={add}>
          <PlusIcon color={colors.onAccent} />
        </IconButton>
      </View>

      {shopping.length === 0 ? (
        <EmptyState title={t('shopping.empty.title')} body={t('shopping.empty.body')} />
      ) : (
        <>
          {toBuy.length > 0 ? (
            <>
              <Label>
                {t('shopping.toBuy')} · {toBuy.length}
              </Label>
              {renderGroup(toBuy)}
            </>
          ) : null}

          {done.length > 0 ? (
            <>
              <Label style={{ marginTop: spacing.xl }}>
                {t('shopping.done')} · {done.length}
              </Label>
              {renderGroup(done)}
            </>
          ) : null}

          <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
            {done.length > 0 ? (
              <Button label={t('shopping.clearDone')} variant="quiet" onPress={() => clearShopping('done')} />
            ) : null}
            <Button label={t('shopping.clearAll')} variant="ghost" onPress={clearAll} />
          </View>
        </>
      )}
    </Screen>
  );
}
