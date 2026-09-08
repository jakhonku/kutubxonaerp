// Qozoq tili normalizatsiyasi uchun unit-testlar.
//
// Ishga tushirish (yangi paket TALAB QILINMAYDI — Node 22+ o'zi .ts fayllarni
// tushunadi):
//
//   node --test lib/beles/normalize.test.ts
//
// Modul dinamik import orqali yuklanadi, chunki Node ESM to'liq fayl nomini
// ('./normalize.ts') talab qiladi, TypeScript esa import satrida .ts
// kengaytmasini qabul qilmaydi. `modulePath: string` shu ikki talabni
// yarashtiradi.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import type * as NormalizeModule from './normalize';

const modulePath: string = './normalize.ts';
const { normalizeKk, stemKk, levenshtein, isSameAnswer, isAnswerAccepted } =
  (await import(modulePath)) as typeof NormalizeModule;

// ------------------------------------------------------------------
// Topshiriqning asosiy qabul mezoni (7-bo'lim, 10-band)
// ------------------------------------------------------------------
test('велосипед: kirill, qo\'shimchali va lotin shakllari — hammasi to\'g\'ri', () => {
  const accepted = ['велосипед'];

  assert.equal(isAnswerAccepted('велосипед', accepted), true);
  assert.equal(isAnswerAccepted('велосипедпен', accepted), true);
  assert.equal(isAnswerAccepted('велосипедті', accepted), true);
  assert.equal(isAnswerAccepted('velosiped', accepted), true);
});

test('bazada lotin, bola kirill yozsa ham to\'g\'ri (teskari yo\'nalish)', () => {
  const accepted = ['velosiped'];

  assert.equal(isAnswerAccepted('велосипед', accepted), true);
  assert.equal(isAnswerAccepted('велосипедпен', accepted), true);
  assert.equal(isAnswerAccepted('Велосипедті', accepted), true);
});

// ------------------------------------------------------------------
// 1-qadam: tozalash
// ------------------------------------------------------------------
test('katta harf, ortiqcha bo\'shliq va tinish belgilari e\'tiborga olinmaydi', () => {
  assert.equal(normalizeKk('  ВЕЛОСИПЕД!  '), 'velosiped');
  assert.equal(normalizeKk('Велосипед, әрине.'), 'velosiped arine');
  assert.equal(normalizeKk('бір    екі'), 'bir eki');
  assert.equal(normalizeKk(''), '');
  assert.equal(isAnswerAccepted('  ВЕЛОСИПЕД!!! ', ['велосипед']), true);
});

// ------------------------------------------------------------------
// 2–3-qadamlar: kirill ↔ lotin va harf juftliklari
// ------------------------------------------------------------------
test('harf juftliklari tenglashtiriladi: ә/а, і/и, ұ/ү/у, ң/н, қ/к, ғ/г, ө/о, һ/х', () => {
  assert.equal(normalizeKk('ә'), normalizeKk('а'));
  assert.equal(normalizeKk('і'), normalizeKk('и'));
  assert.equal(normalizeKk('ұ'), normalizeKk('у'));
  assert.equal(normalizeKk('ү'), normalizeKk('у'));
  assert.equal(normalizeKk('ң'), normalizeKk('н'));
  assert.equal(normalizeKk('қ'), normalizeKk('к'));
  assert.equal(normalizeKk('ғ'), normalizeKk('г'));
  assert.equal(normalizeKk('ө'), normalizeKk('о'));
  assert.equal(normalizeKk('һ'), normalizeKk('х'));

  // Amaliy misol: "кітап" ning turli yozilishlari
  assert.equal(isAnswerAccepted('кітап', ['кitap']), true);
  assert.equal(isAnswerAccepted('қала', ['кala']), true);
});

test('apostrofli lotin shakllari (o\', g\') ham tushuniladi', () => {
  assert.equal(isAnswerAccepted("o'qituvchi", ['oqituvchi']), true);
  assert.equal(isAnswerAccepted('ǵalam', ['galam']), true);
});

// ------------------------------------------------------------------
// 4-qadam: qo'shimchalar
// ------------------------------------------------------------------
test('keng tarqalgan qo\'shimchalar kesiladi', () => {
  assert.equal(stemKk('велосипедті'), 'velosiped');
  assert.equal(stemKk('велосипедпен'), 'velosiped');
  assert.equal(stemKk('велосипедке'), 'velosiped');
  assert.equal(stemKk('велосипедде'), 'velosiped');
  assert.equal(stemKk('велосипедтің'), 'velosiped');
  assert.equal(stemKk('велосипедтер'), 'velosiped');
  // ikki qo'shimcha ketma-ket
  assert.equal(stemKk('велосипедтерге'), 'velosiped');
});

test('qisqa so\'zlar butunlay yo\'q bo\'lib ketmaydi', () => {
  // "ата" dan "та" kesilsa bitta harf qolardi — bunga yo'l qo'yilmaydi
  assert.equal(stemKk('ата'), 'ata');
  // Qisqa o'zak ham qo'shimchali shakli bilan tutashadi: "ат" ↔ "атпен"
  assert.equal(stemKk('атпен'), 'at');
  assert.equal(isSameAnswer('атпен', 'ат'), true);
});

test('ko\'p so\'zli javobda har bir so\'z alohida ishlanadi', () => {
  assert.equal(stemKk('қара атты'), 'kara at');
  assert.equal(isAnswerAccepted('қара атпен', ['қара ат']), true);
});

// ------------------------------------------------------------------
// 6-qadam: Levenshtein
// ------------------------------------------------------------------
test('levenshtein masofasi to\'g\'ri hisoblanadi', () => {
  assert.equal(levenshtein('velosiped', 'velosiped'), 0);
  assert.equal(levenshtein('velosiped', 'velosipd'), 1);   // o'chirish
  assert.equal(levenshtein('velosiped', 'velosipedd'), 1); // qo'shish
  assert.equal(levenshtein('velosiped', 'velosiper'), 1);  // almashtirish
  assert.equal(levenshtein('velosiped', 'samokat'), 8);
  assert.equal(levenshtein('', 'abc'), 3);
});

test('bitta harflik imlo xatosi kechiriladi', () => {
  assert.equal(isAnswerAccepted('velosipd', ['велосипед']), true);
  assert.equal(isAnswerAccepted('велосиппед', ['велосипед']), true);
});

// ------------------------------------------------------------------
// Noto'g'ri javoblar — kechirim CHEKSIZ emas
// ------------------------------------------------------------------
test('boshqa so\'z to\'g\'ri deb qabul qilinmaydi', () => {
  assert.equal(isAnswerAccepted('самокат', ['велосипед']), false);
  assert.equal(isAnswerAccepted('машина', ['велосипед']), false);
  assert.equal(isAnswerAccepted('', ['велосипед']), false);
  assert.equal(isAnswerAccepted('   ', ['велосипед']), false);
});

test('qisqa so\'zlarda bitta harf farqi kechirilmaydi', () => {
  // "бір" va "бар" — butunlay boshqa so'zlar
  assert.equal(isSameAnswer('бір', 'бар'), false);
  assert.equal(isSameAnswer('ат', 'от'), false);
});

test('qabul qilinadigan javoblar ro\'yxatidan istalgani mos kelsa yetarli', () => {
  const accepted = ['велосипед', 'екі дөңгелекті көлік'];
  assert.equal(isAnswerAccepted('velosiped', accepted), true);
  assert.equal(isAnswerAccepted('екі дөңгелекті көлікпен', accepted), true);
  assert.equal(isAnswerAccepted('пойыз', accepted), false);
});
