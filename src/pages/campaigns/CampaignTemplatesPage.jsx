/**
 * Template library.
 *
 * Templates are copied into a campaign at creation, not referenced — editing
 * one here never changes what a running campaign is sending. That is why this
 * page can be freely edited without a warning about live sends.
 */

import { useCallback, useEffect, useState } from 'react'
import { FileText, Plus, Trash2 } from 'lucide-react'

import { createTemplate, deleteTemplate, fetchTemplates } from '@/api/services/campaign.service'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { PERSONALISATION_VARIABLES, TEMPLATE_CATEGORIES } from '@/constants/campaign.constants'

const EMPTY_DRAFT = { name: '', category: 'custom', description: '', subject: '', bodyHtml: '' }

export function CampaignTemplatesPage() {
  const [templates, setTemplates] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [category, setCategory] = useState('')

  const load = useCallback(async (selected) => {
    setIsLoading(true)
    try {
      setTemplates(await fetchTemplates(selected ? { category: selected } : {}))
      setError(null)
    } catch (loadError) {
      setError(loadError)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load(category)
  }, [load, category])

  const handleCreate = useCallback(async () => {
    setIsSaving(true)
    setError(null)
    try {
      await createTemplate({
        ...draft,
        description: draft.description.trim() || null,
      })
      setDraft(EMPTY_DRAFT)
      setIsCreating(false)
      await load(category)
    } catch (saveError) {
      setError(saveError)
    } finally {
      setIsSaving(false)
    }
  }, [draft, load, category])

  const handleDelete = useCallback(
    async (id, name) => {
      if (!window.confirm(`Delete the template "${name}"? Campaigns already using it keep their copy.`)) return
      await deleteTemplate(id)
      await load(category)
    },
    [load, category],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          aria-label="Filter by category"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          <option value="">All categories</option>
          {TEMPLATE_CATEGORIES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>

        <Button className="ml-auto" onClick={() => setIsCreating((open) => !open)}>
          <Plus className="size-4" aria-hidden="true" />
          New template
        </Button>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
          {error?.response?.data?.message ?? error?.message ?? 'Something went wrong.'}
        </p>
      )}

      {isCreating && (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="template-name" className="block text-sm font-medium text-slate-700">Name</label>
              <input
                id="template-name"
                value={draft.name}
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label htmlFor="template-category" className="block text-sm font-medium text-slate-700">Category</label>
              <select
                id="template-category"
                value={draft.category}
                onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {TEMPLATE_CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="template-subject" className="block text-sm font-medium text-slate-700">Subject</label>
            <input
              id="template-subject"
              value={draft.subject}
              onChange={(event) => setDraft((current) => ({ ...current, subject: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label htmlFor="template-body" className="block text-sm font-medium text-slate-700">Body</label>
            <textarea
              id="template-body"
              rows={10}
              value={draft.bodyHtml}
              onChange={(event) => setDraft((current) => ({ ...current, bodyHtml: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PERSONALISATION_VARIABLES.map((variable) => (
                <button
                  key={variable.name}
                  type="button"
                  title={variable.hint}
                  onClick={() =>
                    setDraft((current) => ({ ...current, bodyHtml: `${current.bodyHtml}{{${variable.name}}}` }))
                  }
                  className="rounded border border-slate-200 bg-white px-2 py-1 font-mono text-xs text-slate-600 hover:border-blue-400 hover:text-blue-600"
                >
                  {`{{${variable.name}}}`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleCreate}
              isLoading={isSaving}
              disabled={!draft.name.trim() || !draft.subject.trim() || !draft.bodyHtml.trim()}
            >
              Save template
            </Button>
            <Button variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner label="Loading templates" />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <FileText className="mx-auto size-8 text-slate-300" aria-hidden="true" />
          <h2 className="mt-3 text-base font-semibold text-slate-900">No templates yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            A template is a reusable subject and body with personalisation placeholders.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <li key={template.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-slate-900">{template.name}</h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {TEMPLATE_CATEGORIES.find((c) => c.value === template.category)?.label ?? template.category}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(template.id, template.name)}>
                  <Trash2 className="size-4" aria-hidden="true" />
                  <span className="sr-only">Delete</span>
                </Button>
              </div>

              <p className="mt-3 line-clamp-2 text-sm text-slate-600">{template.subject}</p>

              <dl className="mt-auto flex gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <div>
                  <dt className="inline">Used </dt>
                  <dd className="inline font-medium tabular-nums text-slate-700">{template.useCount ?? 0}×</dd>
                </div>
                <div>
                  <dt className="inline">Reply rate </dt>
                  <dd className="inline font-medium tabular-nums text-slate-700">
                    {template.replyRate === null || template.replyRate === undefined ? '—' : `${template.replyRate}%`}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default CampaignTemplatesPage
