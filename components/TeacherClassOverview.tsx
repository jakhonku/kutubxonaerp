import { getTranslations } from 'next-intl/server';
import { BookCopy, BookOpen, Users } from 'lucide-react';

export interface ClassStudentRow {
  id: string;
  full_name: string;
  login: string | null;
  textbooks: number; // berilgan darsliklar soni
  booksActive: number; // hozir o'qiyotgan (faol ijara) kitoblar
  booksTotal: number; // jami olgan kitoblari
}

// O'qituvchi paneli uchun: o'z sinfidagi o'quvchilar va ularning
// darslik / kitob o'qish faolligi.
export default async function TeacherClassOverview({
  className,
  rows,
}: {
  className: string;
  rows: ClassStudentRow[];
}) {
  const t = await getTranslations('teacher');

  const withTextbooks = rows.filter((r) => r.textbooks > 0).length;
  const readingActive = rows.filter((r) => r.booksTotal > 0).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <div className="flex items-center gap-2 text-stone-500">
            <Users className="h-4 w-4" />
            <p className="text-sm">{t('studentsInClass')}</p>
          </div>
          <p className="mt-1 text-2xl font-bold text-stone-900">{rows.length}</p>
        </div>
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
          <div className="flex items-center gap-2 text-brand-700">
            <BookCopy className="h-4 w-4" />
            <p className="text-sm">{t('withTextbooks')}</p>
          </div>
          <p className="mt-1 text-2xl font-bold text-brand-700">
            {withTextbooks}
            <span className="text-base font-normal text-brand-700/60">/{rows.length}</span>
          </p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2 text-blue-700">
            <BookOpen className="h-4 w-4" />
            <p className="text-sm">{t('readingActive')}</p>
          </div>
          <p className="mt-1 text-2xl font-bold text-blue-700">
            {readingActive}
            <span className="text-base font-normal text-blue-700/60">/{rows.length}</span>
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-500">
          {t('noStudents')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-stone-500">
              <tr>
                <th className="p-3 font-medium">{t('student')}</th>
                <th className="p-3 font-medium">{t('textbooksCol')}</th>
                <th className="p-3 font-medium">{t('readingCol')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-stone-50">
                  <td className="p-3">
                    <p className="font-medium text-stone-900">{r.full_name}</p>
                    {r.login && (
                      <p className="font-mono text-xs text-stone-400">{r.login}</p>
                    )}
                  </td>
                  <td className="p-3">
                    {r.textbooks > 0 ? (
                      <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                        {t('textbooksN', { count: r.textbooks })}
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                        {t('noTextbooks')}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {r.booksTotal > 0 ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                          {t('active')}
                        </span>
                        <span className="text-xs text-stone-500">
                          {t('readCount', { total: r.booksTotal, active: r.booksActive })}
                        </span>
                      </span>
                    ) : (
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500">
                        {t('inactive')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
