import { getLocale, getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import DashboardShell from '@/components/DashboardShell';
import SummaryBook, {
  type SummaryData,
  type KirimRow,
  type ChiqimRow,
  type YearRow,
} from '@/components/SummaryBook';
import type { InventoryEntry } from '@/types/database';

// KSU inventar yozuvlaridan hisoblanadi — doim yangi.
export const dynamic = 'force-dynamic';

const yearOf = (d: string | null | undefined, fallback: string): string =>
  d && d.length >= 4 ? d.slice(0, 4) : fallback;

// Inventar yozuvlaridan Summar hisob kitobini (KSU) hisoblaymiz
function buildSummary(entries: InventoryEntry[]): SummaryData {
  const price = (e: InventoryEntry) => Number(e.price) || 0;

  // ---- 1-qism: Kirim (kelgan partiyalar) — hujjat+sana+manba bo'yicha ----
  const kirimMap = new Map<string, KirimRow>();
  for (const e of entries) {
    const date = e.received_at ?? e.created_at.slice(0, 10);
    const key = `${date}||${e.document_ref ?? ''}||${e.source ?? ''}`;
    const row = kirimMap.get(key) ?? {
      n: 0,
      date,
      document: e.document_ref ?? '',
      source: e.source ?? '',
      count: 0,
      value: 0,
    };
    row.count += 1;
    row.value += price(e);
    kirimMap.set(key, row);
  }
  const kirim = Array.from(kirimMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r, i) => ({ ...r, n: i + 1 }));

  // ---- 2-qism: Chiqim (hisobdan chiqarilgan partiyalar) — dalolatnoma bo'yicha ----
  const chiqimMap = new Map<string, ChiqimRow>();
  for (const e of entries) {
    if (!e.written_off) continue;
    const date = e.write_off_date ?? e.received_at ?? e.created_at.slice(0, 10);
    const key = `${date}||${e.write_off_act ?? ''}||${e.write_off_reason ?? ''}`;
    const row = chiqimMap.get(key) ?? {
      n: 0,
      date,
      act: e.write_off_act ?? '',
      reason: e.write_off_reason ?? '',
      count: 0,
      value: 0,
    };
    row.count += 1;
    row.value += price(e);
    chiqimMap.set(key, row);
  }
  const chiqim = Array.from(chiqimMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r, i) => ({ ...r, n: i + 1 }));

  // ---- 3-qism: Fond harakati (yillik) ----
  const nowYear = String(new Date().getFullYear());
  const inByYear = new Map<string, { c: number; v: number }>();
  const outByYear = new Map<string, { c: number; v: number }>();
  for (const e of entries) {
    const iy = yearOf(e.received_at ?? e.created_at, nowYear);
    const gi = inByYear.get(iy) ?? { c: 0, v: 0 };
    gi.c += 1;
    gi.v += price(e);
    inByYear.set(iy, gi);
    if (e.written_off) {
      const oy = yearOf(e.write_off_date ?? e.received_at ?? e.created_at, nowYear);
      const go = outByYear.get(oy) ?? { c: 0, v: 0 };
      go.c += 1;
      go.v += price(e);
      outByYear.set(oy, go);
    }
  }

  const yearsSet = new Set<string>([...inByYear.keys(), ...outByYear.keys()]);
  const sortedYears = Array.from(yearsSet).sort();
  const years: YearRow[] = [];
  let runCount = 0;
  let runValue = 0;
  for (const y of sortedYears) {
    const inn = inByYear.get(y) ?? { c: 0, v: 0 };
    const out = outByYear.get(y) ?? { c: 0, v: 0 };
    const startCount = runCount;
    const startValue = runValue;
    const endCount = startCount + inn.c - out.c;
    const endValue = startValue + inn.v - out.v;
    years.push({
      year: y,
      startCount,
      startValue,
      inCount: inn.c,
      inValue: inn.v,
      outCount: out.c,
      outValue: out.v,
      endCount,
      endValue,
    });
    runCount = endCount;
    runValue = endValue;
  }

  const inCount = entries.length;
  const inValue = entries.reduce((s, e) => s + price(e), 0);
  const off = entries.filter((e) => e.written_off);
  const outCount = off.length;
  const outValue = off.reduce((s, e) => s + price(e), 0);

  return {
    kirim,
    chiqim,
    years,
    totals: {
      inCount,
      inValue,
      outCount,
      outValue,
      currentCount: inCount - outCount,
      currentValue: inValue - outValue,
    },
  };
}

export default async function SummaryPage() {
  const locale = await getLocale();
  const profile = await getProfile();

  if (!profile || profile.role !== 'librarian') {
    redirect({ href: '/dashboard', locale });
    return null;
  }

  const t = await getTranslations('summary');
  const supabase = await createClient();
  const { data: entries } = await supabase
    .from('inventory_entries')
    .select('*')
    .order('received_at', { ascending: true });

  const summary = buildSummary((entries as InventoryEntry[]) ?? []);

  return (
    <DashboardShell role="librarian">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">{t('title')}</h1>
        <p className="mt-1 text-stone-500">{t('subtitle')}</p>
      </div>
      <SummaryBook data={summary} />
    </DashboardShell>
  );
}
