'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import {
  createAccount,
  deleteAccount,
  updateAccount,
  importStudents,
  type StudentImportRow,
  type ImportStudentsResult,
} from '@/app/[locale]/librarian/actions';
import {
  UserPlus,
  Trash2,
  Pencil,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  X,
  FileSpreadsheet,
  FileDown,
  Download,
} from 'lucide-react';
import { useMemo, useRef, useState, useTransition } from 'react';
import type { Profile, Role } from '@/types/database';

interface Props {
  accounts: Profile[];
  mode: Role; // yaratiladigan/tahrirlanadigan hisob roli
}

// ExcelJS workbook'ni faylga saqlaydi
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveWorkbook(wb: any, filename: string) {
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AccountManager({ accounts, mode }: Props) {
  const t = useTranslations('students');
  const tc = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const isStudent = mode === 'student';

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [filterClass, setFilterClass] = useState('');
  const [editing, setEditing] = useState<Profile | null>(null);
  const [isPending, startTransition] = useTransition();

  // Excel import holati
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportStudentsResult | null>(null);

  // Mavjud sinflar (o'quvchilardan olinadi) — filtr uchun
  const existingClasses = useMemo(
    () =>
      Array.from(new Set(accounts.map((a) => a.class_name?.trim()).filter(Boolean)))
        .sort((a, b) => (a as string).localeCompare(b as string, undefined, { numeric: true })) as string[],
    [accounts]
  );

  function generatePassword(setter: (v: string) => void) {
    const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
    let p = '';
    for (let i = 0; i < 8; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setter(p);
  }

  function handleCreate(formData: FormData) {
    setError('');
    setSuccess(false);
    formData.set('locale', locale);
    formData.set('role', mode);
    startTransition(async () => {
      const res = await createAccount(formData);
      if (res.ok) {
        setSuccess(true);
        setPassword('');
        formRef.current?.reset();
        router.refresh();
      } else if (res.error === 'taken') {
        setError(t('loginTaken'));
      } else if (res.error === 'name') {
        setError(t('nameTaken'));
      } else {
        setError(res.message || tc('required'));
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm(t('confirmDelete'))) return;
    startTransition(async () => {
      await deleteAccount(id);
      router.refresh();
    });
  }

  // Excel shabloni: F.I.Sh. | Sinf | Login | Parol
  async function downloadTemplate() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('exceljs');
    const ExcelJS = mod.default ?? mod;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(t('title'));
    ws.columns = [
      { header: t('fullName'), key: 'name', width: 30 },
      { header: t('className'), key: 'cls', width: 12 },
      { header: t('login'), key: 'login', width: 20 },
      { header: t('password'), key: 'pwd', width: 16 },
    ];
    ws.getRow(1).eachCell((c: { font: unknown; fill: unknown }) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A5D3A' } };
    });
    ws.addRow(['Aliyev Vali Aliyevich', '5-A', 'aliyev05', '']);
    ws.addRow(['Valiyeva Nodira Valiyevna', '5-A', 'valiyeva05', '']);
    await saveWorkbook(wb, 'oquvchi-shablon.xlsx');
  }

  // Excel faylni o'qib import qilish
  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    setImporting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod: any = await import('exceljs');
      const ExcelJS = mod.default ?? mod;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.worksheets[0];
      const rows: StudentImportRow[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ws.eachRow((row: any, rowNumber: number) => {
        if (rowNumber === 1) return; // sarlavha
        const cell = (i: number) => String(row.getCell(i).value ?? '').trim();
        const full_name = cell(1);
        const login = cell(3);
        if (!full_name && !login) return; // bo'sh qator
        rows.push({ full_name, class_name: cell(2), login, password: cell(4) });
      });

      const res = await importStudents(rows, locale as 'uz' | 'kk');
      setImportResult(res);
      router.refresh();
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  // Yaratilgan login/parollarni Excel'ga yuklab olish
  async function downloadCredentials(created: ImportStudentsResult['created']) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('exceljs');
    const ExcelJS = mod.default ?? mod;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(t('title'));
    ws.columns = [
      { header: t('fullName'), key: 'name', width: 30 },
      { header: t('className'), key: 'cls', width: 12 },
      { header: t('login'), key: 'login', width: 20 },
      { header: t('password'), key: 'pwd', width: 16 },
    ];
    ws.getRow(1).eachCell((c: { font: unknown; fill: unknown }) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A5D3A' } };
    });
    for (const c of created) ws.addRow([c.full_name, c.class_name, c.login, c.password]);
    await saveWorkbook(wb, 'oquvchi-loginlar.xlsx');
  }

  return (
    <div className="space-y-8">
      {/* Yaratish formasi */}
      <form
        ref={formRef}
        action={handleCreate}
        className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-5"
      >
        <label className="block lg:col-span-2">
          <span className="mb-1 block text-sm font-medium text-stone-700">{t('fullName')}</span>
          <input name="full_name" required className="sfld" />
        </label>

        {isStudent && (
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-stone-700">{t('className')}</span>
            <ClassInput name="class_name" existingClasses={existingClasses} />
          </label>
        )}

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">{t('login')}</span>
          <input name="login" required autoComplete="off" className="sfld" />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">{t('password')}</span>
          <div className="flex gap-1">
            <input
              name="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="sfld"
            />
            <button
              type="button"
              onClick={() => generatePassword(setPassword)}
              title={t('generate')}
              className="shrink-0 rounded-lg border border-stone-200 px-2 text-stone-500 transition-colors hover:bg-stone-50"
            >
              <KeyRound className="h-4 w-4" />
            </button>
          </div>
        </label>

        <div className="sm:col-span-2 lg:col-span-5">
          {error && !editing && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="mb-3 flex items-center gap-2 rounded-lg bg-green-50 p-3 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {t('created')}
            </div>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
          >
            <UserPlus className="h-4 w-4" />
            {isStudent ? t('addStudent') : t('addStaff')}
          </button>
        </div>
      </form>

      {/* Excel orqali ommaviy import (faqat o'quvchilar) */}
      {isStudent && (
        <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-brand-600" />
            <h2 className="font-semibold text-stone-900">{t('importTitle')}</h2>
          </div>
          <p className="text-sm text-stone-500">{t('importHint')}</p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={downloadTemplate}
              className="flex items-center gap-2 rounded-lg border border-stone-200 px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50"
            >
              <FileDown className="h-4 w-4" />
              {t('downloadTemplate')}
            </button>

            <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700">
              <FileSpreadsheet className="h-4 w-4" />
              {importing ? t('importing') : t('chooseFile')}
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportFile}
                disabled={importing}
                className="hidden"
              />
            </label>
          </div>

          {/* Import natijasi */}
          {importResult && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 font-medium text-green-700">
                  <CheckCircle2 className="h-4 w-4" />
                  {t('importedN', { count: importResult.added })}
                </span>
                {importResult.skipped.length > 0 && (
                  <span className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 font-medium text-amber-700">
                    <AlertCircle className="h-4 w-4" />
                    {t('skippedN', { count: importResult.skipped.length })}
                  </span>
                )}
              </div>

              {importResult.created.length > 0 && (
                <button
                  type="button"
                  onClick={() => downloadCredentials(importResult.created)}
                  className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100"
                >
                  <Download className="h-4 w-4" />
                  {t('downloadCreds')}
                </button>
              )}

              {importResult.skipped.length > 0 && (
                <div className="overflow-hidden rounded-lg border border-stone-200">
                  <table className="w-full text-sm">
                    <thead className="bg-stone-50 text-left text-stone-500">
                      <tr>
                        <th className="p-2.5 font-medium">{t('fullName')}</th>
                        <th className="p-2.5 font-medium">{t('skipReason')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {importResult.skipped.map((s, i) => (
                        <tr key={i}>
                          <td className="p-2.5 text-stone-700">{s.name}</td>
                          <td className="p-2.5 text-stone-500">{t(`reason_${s.reason}`)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sinf bo'yicha filtr (faqat o'quvchilar) */}
      {isStudent && accounts.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-stone-500">{t('filterByClass')}:</span>
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
          >
            <option value="">{tc('all')}</option>
            {existingClasses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Ro'yxat */}
      {accounts.length === 0 ? (
        <p className="text-stone-500">{t('empty')}</p>
      ) : isStudent ? (
        <StudentGroups
          accounts={filterClass ? accounts.filter((a) => a.class_name === filterClass) : accounts}
          onEdit={setEditing}
          onDelete={handleDelete}
          pending={isPending}
        />
      ) : (
        <AccountTable
          rows={accounts}
          onEdit={setEditing}
          onDelete={handleDelete}
          pending={isPending}
        />
      )}

      {/* Tahrirlash oynasi */}
      {editing && (
        <EditModal
          account={editing}
          isStudent={isStudent}
          role={mode}
          existingClasses={existingClasses}
          pending={isPending}
          onClose={() => setEditing(null)}
          onSave={(formData) => {
            setError('');
            startTransition(async () => {
              const res = await updateAccount(formData);
              if (res.ok) {
                setEditing(null);
                router.refresh();
              } else if (res.error === 'taken') {
                setError(t('loginTaken'));
              } else if (res.error === 'name') {
                setError(t('nameTaken'));
              } else {
                setError(res.message || tc('required'));
              }
            });
          }}
          error={error}
          onGenerate={generatePassword}
        />
      )}

      <style jsx global>{`
        .sfld {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #e7e5e4;
          padding: 0.5rem 0.75rem;
          outline: none;
          background: white;
        }
        .sfld:focus {
          border-color: #2f7d52;
          box-shadow: 0 0 0 2px #d4e9dd;
        }
      `}</style>
    </div>
  );
}

// ---- Sinf tanlash: mavjudlar ro'yxati + "Yangi sinf" ----
function ClassInput({
  name,
  existingClasses,
  defaultValue,
}: {
  name: string;
  existingClasses: string[];
  defaultValue?: string;
}) {
  const t = useTranslations('students');
  const NEW = '__new__';
  const [mode, setMode] = useState<'select' | 'new'>('select');

  // Hech qanday sinf yo'q bo'lsa — to'g'ridan-to'g'ri matn kiritish
  if (existingClasses.length === 0) {
    return (
      <input
        name={name}
        required
        defaultValue={defaultValue}
        placeholder="2-A"
        autoComplete="off"
        className="sfld"
      />
    );
  }

  return mode === 'select' ? (
    <select
      name={name}
      required
      defaultValue={defaultValue && existingClasses.includes(defaultValue) ? defaultValue : ''}
      onChange={(e) => {
        if (e.target.value === NEW) setMode('new');
      }}
      className="sfld"
    >
      <option value="" disabled>
        —
      </option>
      {existingClasses.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
      <option value={NEW}>➕ {t('newClass')}</option>
    </select>
  ) : (
    <div className="flex gap-1">
      <input
        name={name}
        required
        autoFocus
        placeholder="2-A"
        autoComplete="off"
        className="sfld"
      />
      <button
        type="button"
        onClick={() => setMode('select')}
        title={t('fromList')}
        className="shrink-0 rounded-lg border border-stone-200 px-3 text-stone-500 transition-colors hover:bg-stone-50"
      >
        ↩
      </button>
    </div>
  );
}

// ---- O'quvchilar: sinflar bo'yicha guruhlangan ----
function StudentGroups({
  accounts,
  onEdit,
  onDelete,
  pending,
}: {
  accounts: Profile[];
  onEdit: (p: Profile) => void;
  onDelete: (id: string) => void;
  pending: boolean;
}) {
  const t = useTranslations('students');
  const locale = useLocale();

  const byClass = new Map<string, Profile[]>();
  for (const s of accounts) {
    const key = s.class_name?.trim() || t('noClass');
    if (!byClass.has(key)) byClass.set(key, []);
    byClass.get(key)!.push(s);
  }
  const classNames = Array.from(byClass.keys()).sort((a, b) => a.localeCompare(b, locale));

  return (
    <div className="space-y-6">
      {classNames.map((cls) => (
        <div key={cls}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
            {cls}
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-500">
              {byClass.get(cls)!.length}
            </span>
          </h3>
          <AccountTable
            rows={byClass.get(cls)!}
            onEdit={onEdit}
            onDelete={onDelete}
            pending={pending}
          />
        </div>
      ))}
    </div>
  );
}

function AccountTable({
  rows,
  onEdit,
  onDelete,
  pending,
}: {
  rows: Profile[];
  onEdit: (p: Profile) => void;
  onDelete: (id: string) => void;
  pending: boolean;
}) {
  const t = useTranslations('students');
  const tc = useTranslations('common');

  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
          <tr>
            <th className="p-3 font-medium">{t('fullName')}</th>
            <th className="p-3 font-medium">{t('login')}</th>
            <th className="p-3 font-medium">{tc('actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {rows.map((s) => (
            <tr key={s.id} className="hover:bg-stone-50">
              <td className="p-3 font-medium text-stone-900">{s.full_name}</td>
              <td className="p-3 font-mono text-stone-600">{s.login ?? '—'}</td>
              <td className="p-3">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onEdit(s)}
                    disabled={pending}
                    className="rounded-lg p-2 text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-50"
                    title={tc('edit')}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(s.id)}
                    disabled={pending}
                    className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                    title={tc('delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Tahrirlash oynasi (modal) ----
function EditModal({
  account,
  isStudent,
  role,
  existingClasses,
  pending,
  onClose,
  onSave,
  error,
  onGenerate,
}: {
  account: Profile;
  isStudent: boolean;
  role: Role;
  existingClasses: string[];
  pending: boolean;
  onClose: () => void;
  onSave: (formData: FormData) => void;
  error: string;
  onGenerate: (setter: (v: string) => void) => void;
}) {
  const t = useTranslations('students');
  const tc = useTranslations('common');
  const [newPassword, setNewPassword] = useState('');

  function submit(formData: FormData) {
    formData.set('user_id', account.id);
    formData.set('role', role);
    onSave(formData);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-stone-900">{t('editTitle')}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form action={submit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-stone-700">{t('fullName')}</span>
            <input name="full_name" required defaultValue={account.full_name} className="sfld" />
          </label>

          {isStudent && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">{t('className')}</span>
              <ClassInput
                name="class_name"
                existingClasses={existingClasses}
                defaultValue={account.class_name ?? ''}
              />
            </label>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-stone-700">{t('login')}</span>
            <input name="login" required defaultValue={account.login ?? ''} className="sfld" />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-stone-700">{t('password')}</span>
            <div className="flex gap-1">
              <input
                name="password"
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('passwordKeep')}
                className="sfld"
              />
              <button
                type="button"
                onClick={() => onGenerate(setNewPassword)}
                title={t('generate')}
                className="shrink-0 rounded-lg border border-stone-200 px-2 text-stone-500 transition-colors hover:bg-stone-50"
              >
                <KeyRound className="h-4 w-4" />
              </button>
            </div>
            <span className="mt-1 block text-xs text-stone-400">{t('passwordKeep')}</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
            >
              {tc('save')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-stone-200 px-5 py-2.5 font-medium text-stone-600 transition-colors hover:bg-stone-50"
            >
              {tc('cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
