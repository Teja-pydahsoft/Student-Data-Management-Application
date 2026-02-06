/**
 * Faculty – My Content (Pydah v2.0): list and create notes, assignments, tests.
 */

import React, { useEffect, useState } from 'react';
import api from '../../config/api';
import { FileText, Plus, Loader2, BookOpen, ClipboardList, FileQuestion } from 'lucide-react';
import toast from 'react-hot-toast';

const typeLabels = { note: 'Note', assignment: 'Assignment', test: 'Test' };
const typeIcons = { note: BookOpen, assignment: ClipboardList, test: FileQuestion };

export default function ContentManage() {
  const [list, setList] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ type: 'note', title: '', description: '', college_id: '', course_id: '', subject_id: '', due_date: '', max_marks: '' });

  useEffect(() => {
    api.get('/academic-content').then((r) => {
      if (r.data.success) setList(r.data.data || []);
    }).catch(() => setList([])).finally(() => setLoading(false));
    api.get('/colleges').then((r) => { if (r.data.success && r.data.data?.length) setColleges(r.data.data); }).catch(() => {});
    api.get('/subjects').then((r) => { if (r.data.success && r.data.data?.length) setSubjects(r.data.data); }).catch(() => {});
  }, []);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!form.title || !form.college_id) {
      toast.error('Title and college required');
      return;
    }
    setSubmitting(true);
    api.post('/academic-content', {
      type: form.type,
      title: form.title,
      description: form.description || undefined,
      college_id: form.college_id,
      course_id: form.course_id || undefined,
      subject_id: form.subject_id || undefined,
      due_date: form.due_date || undefined,
      max_marks: form.max_marks ? Number(form.max_marks) : undefined,
    })
      .then((r) => {
        if (r.data.success) {
          toast.success('Content created');
          setShowForm(false);
          setForm({ type: 'note', title: '', description: '', college_id: '', course_id: '', subject_id: '', due_date: '', max_marks: '' });
          return api.get('/academic-content');
        }
      })
      .then((r) => { if (r?.data?.success) setList(r.data.data || []); })
      .catch((e) => toast.error(e.response?.data?.message || 'Failed'))
      .finally(() => setSubmitting(false));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">My Content</h1>
          <p className="text-slate-600">Notes, assignments and tests.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-slate-800 mb-4">Add content</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2">
                  <option value="note">Note</option>
                  <option value="assignment">Assignment</option>
                  <option value="test">Test</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">College</label>
                <select value={form.college_id} onChange={(e) => setForm((f) => ({ ...f, college_id: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" required>
                  <option value="">Select</option>
                  {colleges.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description (optional)</label>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" rows={2} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Subject (optional)</label>
                <select value={form.subject_id} onChange={(e) => setForm((f) => ({ ...f, subject_id: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2">
                  <option value="">None</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Due date (optional)</label>
                <input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Max marks (optional)</label>
                <input type="number" min="0" value={form.max_marks} onChange={(e) => setForm((f) => ({ ...f, max_marks: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" />
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={submitting} className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Due / Max</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {list.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No content yet. Add a note, assignment or test.</td></tr>
              ) : (
                list.map((c) => {
                  const Icon = typeIcons[c.type] || FileText;
                  return (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-50 text-teal-700 text-sm"><Icon className="w-4 h-4" /> {typeLabels[c.type] || c.type}</span></td>
                      <td className="px-4 py-3 font-medium text-slate-800">{c.title}</td>
                      <td className="px-4 py-3 text-slate-600">{c.subject_name || '–'}</td>
                      <td className="px-4 py-3 text-slate-600">{c.due_date || '–'} {c.max_marks != null ? ` / ${c.max_marks}` : ''}</td>
                      <td className="px-4 py-3 text-slate-500 text-sm">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '–'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
