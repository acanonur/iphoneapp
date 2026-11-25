/**
 * Everything Tutam remembers, kept on the phone.
 *
 * There is no server and no account: the starter recipes are compiled into the
 * app, and what you add — your own recipes, favourites, what is in your
 * cupboard, the shopping list, your settings — is one JSON document in local
 * storage. That is the whole privacy story, and it is also why nothing here
 * can be lost to a sync conflict.
 */

import { useMemo } from 'react';
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STARTER_RECIPES } from '../data/starter';
import { systemLang, translate, type StringKey } from '../i18n';
import type { UnitSystem } from '../logic/quantity';
import type { Lang, Recipe, Unit } from '../model/types';

const STORAGE_KEY = 'tutam:state:v1';

export interface ShoppingItem {
  id: string;
  name: string;
  qty: number | null;
  unit: Unit | null;
  done: boolean;
  /** Titles of the recipes that asked for it, for the "for …" line. */
  recipes: string[];
}

interface Persisted {
  /** null follows the phone. */
  lang: Lang | null;
  system: UnitSystem;
  recipes: Record<string, Recipe>;
  favourites: string[];
  hidden: string[];
  pantry: string[];
  shopping: ShoppingItem[];
}

interface State extends Persisted {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setLang: (lang: Lang | null) => void;
  setSystem: (system: UnitSystem) => void;
  saveRecipe: (recipe: Recipe) => void;
  /** Deletes one of your recipes, or hides a starter one. */
  removeRecipe: (id: string) => void;
  restoreStarters: () => void;
  toggleFavourite: (id: string) => void;
  togglePantry: (key: string) => void;
  clearPantry: () => void;
  addShopping: (items: Omit<ShoppingItem, 'id' | 'done'>[]) => void;
  toggleShopping: (id: string) => void;
  clearShopping: (which: 'done' | 'all') => void;
  /** Adds recipes from an export; returns how many were taken. */
  importRecipes: (recipes: Recipe[]) => number;
}

const DEFAULTS: Persisted = {
  lang: null,
  system: 'metric',
  recipes: {},
  favourites: [],
  hidden: [],
  pantry: [],
  shopping: [],
};

let counter = 0;
/** A short id that is unique on this phone, which is all that is needed. */
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

function toggled(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export const useStore = create<State>((set, get) => {
  /** Applies a change and writes the result to storage. */
  const commit = (change: Partial<Persisted>) => {
    set(change);
    const { lang, system, recipes, favourites, hidden, pantry, shopping } = get();
    const snapshot: Persisted = { lang, system, recipes, favourites, hidden, pantry, shopping };
    // A failed write costs the latest change, never the app: carry on.
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)).catch(() => undefined);
  };

  return {
    ...DEFAULTS,
    hydrated: false,

    async hydrate() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) set({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Persisted>) });
      } catch {
        // Unreadable storage is treated as a first launch.
      }
      set({ hydrated: true });
    },

    setLang: (lang) => commit({ lang }),
    setSystem: (system) => commit({ system }),

    saveRecipe(recipe) {
      const now = Date.now();
      const existing = get().recipes[recipe.id];
      commit({
        recipes: {
          ...get().recipes,
          [recipe.id]: { ...recipe, starter: false, createdAt: existing?.createdAt ?? now, updatedAt: now },
        },
      });
    },

    removeRecipe(id) {
      const { recipes, favourites, hidden } = get();
      if (recipes[id]) {
        const { [id]: _removed, ...rest } = recipes;
        commit({ recipes: rest, favourites: favourites.filter((f) => f !== id) });
      } else {
        commit({ hidden: [...new Set([...hidden, id])], favourites: favourites.filter((f) => f !== id) });
      }
    },

    restoreStarters: () => commit({ hidden: [] }),
    toggleFavourite: (id) => commit({ favourites: toggled(get().favourites, id) }),
    togglePantry: (key) => commit({ pantry: toggled(get().pantry, key) }),
    clearPantry: () => commit({ pantry: [] }),

    addShopping(items) {
      const list = [...get().shopping];
      for (const item of items) {
        // The same thing in the same unit is one line with a bigger number.
        const match = list.findIndex(
          (l) => !l.done && l.unit === item.unit && l.name.toLowerCase() === item.name.toLowerCase(),
        );
        const found = match >= 0 ? list[match] : undefined;
        if (found) {
          list[match] = {
            ...found,
            qty: found.qty !== null && item.qty !== null ? found.qty + item.qty : (found.qty ?? item.qty),
            recipes: [...new Set([...found.recipes, ...item.recipes])],
          };
        } else {
          list.push({ ...item, id: newId('buy'), done: false });
        }
      }
      commit({ shopping: list });
    },

    toggleShopping: (id) =>
      commit({ shopping: get().shopping.map((item) => (item.id === id ? { ...item, done: !item.done } : item)) }),

    clearShopping: (which) =>
      commit({ shopping: which === 'all' ? [] : get().shopping.filter((item) => !item.done) }),

    importRecipes(incoming) {
      const recipes = { ...get().recipes };
      let taken = 0;
      for (const recipe of incoming) {
        if (!recipe || typeof recipe !== 'object' || !recipe.title || !Array.isArray(recipe.ingredients)) continue;
        // Imported recipes always get a fresh id, so an import can never overwrite something.
        const id = newId('recipe');
        recipes[id] = { ...recipe, id, starter: false, favourite: undefined, createdAt: Date.now(), updatedAt: Date.now() };
        taken += 1;
      }
      if (taken > 0) commit({ recipes });
      return taken;
    },
  };
});

/** The language the interface is in right now. */
export function useLang(): Lang {
  const chosen = useStore((s) => s.lang);
  return chosen ?? systemLang();
}

/** A `t('key', { vars })` bound to the current language. */
export function useT(): (key: StringKey, vars?: Record<string, string | number>) => string {
  const lang = useLang();
  return useMemo(() => (key, vars) => translate(lang, key, vars), [lang]);
}

/** Every recipe to show: yours first, then the starters you have not hidden, with favourites marked. */
export function useRecipes(): Recipe[] {
  const mine = useStore((s) => s.recipes);
  const favourites = useStore((s) => s.favourites);
  const hidden = useStore((s) => s.hidden);
  return useMemo(() => {
    const fav = new Set(favourites);
    const gone = new Set(hidden);
    return [...Object.values(mine), ...STARTER_RECIPES.filter((r) => !gone.has(r.id))].map((r) => ({
      ...r,
      favourite: fav.has(r.id),
    }));
  }, [mine, favourites, hidden]);
}

export function useRecipe(id: string | undefined): Recipe | undefined {
  const recipes = useRecipes();
  return useMemo(() => recipes.find((r) => r.id === id), [recipes, id]);
}
