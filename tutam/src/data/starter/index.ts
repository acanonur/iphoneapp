/**
 * The recipes that ship with Tutam, in English, Turkish and German.
 *
 * One JSON file per recipe so each can be read, corrected and translated on its
 * own. Generated list — add a file, then add it here.
 */

import type { Recipe } from '../../model/types';
import aglioEOlio from './aglio-e-olio.json';
import aperolSpritz from './aperol-spritz.json';
import apfelkuchen from './apfelkuchen.json';
import apfelschorle from './apfelschorle.json';
import ayran from './ayran.json';
import cacik from './cacik.json';
import chickenCurry from './chicken-curry.json';
import gluehwein from './gluehwein.json';
import greekSalad from './greek-salad.json';
import guacamole from './guacamole.json';
import hotChocolate from './hot-chocolate.json';
import hummus from './hummus.json';
import icedLatte from './iced-latte.json';
import kaesespaetzle from './kaesespaetzle.json';
import kartoffelpuffer from './kartoffelpuffer.json';
import kisir from './kisir.json';
import menemen from './menemen.json';
import mercimekCorbasi from './mercimek-corbasi.json';
import mojito from './mojito.json';
import naneliLimonata from './naneli-limonata.json';
import negroni from './negroni.json';
import pancakes from './pancakes.json';
import sutlac from './sutlac.json';
import turkKahvesi from './turk-kahvesi.json';
import virginMojito from './virgin-mojito.json';

export const STARTER_RECIPES = [
  aglioEOlio,
  aperolSpritz,
  apfelkuchen,
  apfelschorle,
  ayran,
  cacik,
  chickenCurry,
  gluehwein,
  greekSalad,
  guacamole,
  hotChocolate,
  hummus,
  icedLatte,
  kaesespaetzle,
  kartoffelpuffer,
  kisir,
  menemen,
  mercimekCorbasi,
  mojito,
  naneliLimonata,
  negroni,
  pancakes,
  sutlac,
  turkKahvesi,
  virginMojito,
] as unknown as Recipe[];
