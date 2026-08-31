'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { lookupCopy, issueByCopy, type LookupCopy } from '@/app/[locale]/librarian/book-actions';
import { parseQr } from '@/lib/qr';
import ScanBox from './ScanBox';
import { useHardwareScanner } from '@/lib/useHardwareScanner';
import SearchSelect, { type SelectOption } from './SearchSelect';
import ConfirmDialog, { type ConfirmDetail } from './ConfirmDialog';
import {
  ScanLine,
  BookCheck,
  UserCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  QrCode as QrIcon,
  Usb,
} from 'lucide-react';

interface UserLite {
  id: string;
  full_name: string;
  class_name: string | null;
  login: string | null;
  role: string;
}

type Unit = 'min' | 'hour' | 'day';

export default function QrIssue({ users }: { users: UserLite[] }) {
  const t = useTranslations('qr');
  const tl = useTranslations('librarian');
  const tb = useTranslations('book');
  const tls = useTranslations('loans');
  const router = useRouter();

  const [ask, setAsk] = useState(false);
  const [scan, setScan] = useState<'book' | 'user' | null>(null);
  const [copy, setCopy] = useState<LookupCopy | null>(null);
  const [userId, setUserId] = useState('');
  const [durVal, setDurVal] = useState(1);
  const [unit, setUnit] = useState<Unit>('day');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const userMap = new Map(users.map((u) => [u.id, u]));
  const userOptions: SelectOption[] = users.map((u) => ({
    id: u.id,
    label: u.full_name,
    sub: [u.class_name, u.login].filter(Boolean).join(' · '),
    search: `${u.full_name} ${u.login ?? ''} ${u.class_name ?? ''}`.toLowerCase(),
  }));
  const selectedUser = userId ? userMap.get(userId) : undefined;

  const unitMinutes: Record<Unit, number> = { min: 1, hour: 60, day: 1440 };

  function applyBook(copyId: string) {
    setMsg(null);
    startTransition(async () => {
      const res = await lookupCopy(copyId);
      if (res.ok) setCopy(res);
      else setMsg({ type: 'err', text: t('copyNotFound') });
    });
  }

  function applyUser(id: string) {
    if (userMap.has(id)) {
      setUserId(id);
      setMsg(null);
    } else {
      setMsg({ type: 'err', text: t('userNotFound') });
    }
  }

  // QR turiga qarab o'zi kerakli qadamga joylashtiradi
  function routeScan(text: string) {
    const parsed = parseQr(text);
    if (parsed.kind === 'bc') return applyBook(parsed.id);
    if (parsed.kind === 'us') return applyUser(parsed.id);
    setMsg({ type: 'err', text: t('unknownQr') });
  }

  // Skaner oynasi ochiq: qaysi qadam so'ralgan bo'lsa, shuni tekshiramiz
  function handleScan(text: string) {
    const want = scan;
    const parsed = parseQr(text);
    setScan(null);
    if (want === 'book' && parsed.kind !== 'bc') {
      setMsg({ type: 'err', text: t('notBookQr') });
      return;
    }
    if (want === 'user' && parsed.kind !== 'us') {
      setMsg({ type: 'err', text: t('notUserQr') });
      return;
    }
    routeScan(text);
  }

  // Oyna ochilmagan bo'lsa ham USB skaner apparati to'g'ridan-to'g'ri ishlaydi
  useHardwareScanner(routeScan, { enabled: !scan });

  // Tasdiqlash oynasida ko'rsatiladigan berish tafsilotlari
  function issueDetails(): ConfirmDetail[] {
    return [
      {
        label: tb('title'),
        value: `${copy?.title ?? '—'}${copy?.copyNumber ? ` · #${copy.copyNumber}` : ''}`,
      },
      {
        label: tls('borrower'),
        value: `${selectedUser?.full_name ?? '—'}${
          selectedUser?.class_name ? ` · ${selectedUser.class_name}` : ''
        }`,
      },
      { label: tl('issueTerm'), value: `${Math.max(1, durVal)} ${t(`unit_${unit}`)}` },
    ];
  }

  function confirmIssue() {
    if (!copy?.copyId || !userId) return;
    setMsg(null);
    const minutes = Math.max(1, durVal) * unitMinutes[unit];
    startTransition(async () => {
      const res = await issueByCopy(copy.copyId!, userId, minutes);
      setAsk(false);
      if (res.ok) {
        setMsg({ type: 'ok', text: t('issued') });
        setCopy(null);
        setUserId('');
        router.refresh();
      } else {
        setMsg({
          type: 'err',
          text: res.error === 'borrowed' ? t('copyBorrowed') : res.message || t('issueError'),
        });
      }
    });
  }

  const canIssue = copy?.status === 'available' && !!userId && !isPending;

  return (
    <div className="max-w-2xl space-y-5">
      {msg && (
        <div
          className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
            msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {msg.type === 'ok' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {msg.text}
        </div>
      )}

      {/* Skaner ochilganda — apparat yoki kamera */}
      {scan ? (
        <ScanBox
          title={scan === 'book' ? t('scanBook') : t('scanUser')}
          onScan={handleScan}
          onClose={() => setScan(null)}
        />
      ) : (
        <p className="flex items-center gap-2 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-500">
          <Usb className="h-3.5 w-3.5 shrink-0 text-brand-600" />
          {t('deviceReady')}
        </p>
      )}

      {/* 1-qadam: kitob */}
      <Step n={1} title={t('step1')} icon={BookCheck} done={!!copy}>
        {copy ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-stone-900">{copy.title}</p>
              <p className="text-xs text-stone-500">
                {copy.copyNumber ? `#${copy.copyNumber}` : ''}
                {copy.status === 'borrowed' ? ` · ${t('copyBorrowed')}` : ''}
              </p>
            </div>
            <button onClick={() => setCopy(null)} className="text-sm text-brand-600 hover:underline">
              {t('rescan')}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setScan('book')}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            <ScanLine className="h-4 w-4" />
            {t('scanBook')}
          </button>
        )}
      </Step>

      {/* 2-qadam: foydalanuvchi */}
      <Step n={2} title={t('step2')} icon={UserCheck} done={!!userId}>
        <div className="space-y-3">
          <div className="max-w-md">
            <SearchSelect
              name="user"
              options={userOptions}
              placeholder={t('searchUser')}
              emptyText=""
              onChange={setUserId}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400">{t('or')}</span>
            <button
              onClick={() => setScan('user')}
              className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-700 transition-colors hover:bg-stone-50"
            >
              <QrIcon className="h-4 w-4" />
              {t('scanUser')}
            </button>
          </div>
          {selectedUser && (
            <p className="text-sm text-stone-600">
              <UserCheck className="mr-1 inline h-4 w-4 text-green-600" />
              {selectedUser.full_name}
              {selectedUser.class_name ? ` · ${selectedUser.class_name}` : ''}
            </p>
          )}
        </div>
      </Step>

      {/* 3-qadam: muddat */}
      <Step n={3} title={t('step3')} icon={Clock} done={false}>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            value={durVal}
            onChange={(e) => setDurVal(Number(e.target.value) || 1)}
            className="w-24 rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
          />
          <div className="inline-flex rounded-lg border border-stone-200 p-0.5">
            {(['min', 'hour', 'day'] as Unit[]).map((u) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  unit === u ? 'bg-brand-600 text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                {t(`unit_${u}`)}
              </button>
            ))}
          </div>
        </div>
      </Step>

      <button
        onClick={() => setAsk(true)}
        disabled={!canIssue}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-40"
      >
        <BookCheck className="h-5 w-5" />
        {t('issueBook')}
      </button>
      {copy?.status === 'borrowed' && (
        <p className="text-center text-sm text-amber-600">{t('copyBorrowedHint')}</p>
      )}

      {/* Berishni tasdiqlash — skaner xato o'qigan bo'lsa shu yerda ko'rinadi */}
      <ConfirmDialog
        open={ask}
        title={tl('confirmIssueTitle')}
        message={tl('confirmIssueText')}
        details={issueDetails()}
        confirmLabel={tl('confirmIssueBtn')}
        tone="brand"
        pending={isPending}
        onConfirm={confirmIssue}
        onCancel={() => setAsk(false)}
      />
    </div>
  );
}

function Step({
  n,
  title,
  icon: Icon,
  done,
  children,
}: {
  n: number;
  title: string;
  icon: typeof BookCheck;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
            done ? 'bg-green-100 text-green-700' : 'bg-brand-50 text-brand-700'
          }`}
        >
          {n}
        </span>
        <Icon className="h-4 w-4 text-stone-400" />
        <h2 className="font-semibold text-stone-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}
