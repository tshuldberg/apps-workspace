'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { IdeaEditor, type IdeaEditorData } from '@marlin/ui/trading/idea-editor'

export default function NewIdeaPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handlePublish = useCallback(
    async (data: IdeaEditorData) => {
      setIsSubmitting(true)
      try {
        // Will be replaced with tRPC mutations:
        // 1. ideas.create(data)
        // 2. ideas.publish({ ideaId })
        console.log('Publishing idea:', data)

        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 500))

        // Navigate to the feed after publishing
        router.push('/ideas')
      } catch (err) {
        console.error('Failed to publish idea:', err)
      } finally {
        setIsSubmitting(false)
      }
    },
    [router],
  )

  const handleSaveDraft = useCallback(
    async (data: IdeaEditorData) => {
      setIsSubmitting(true)
      try {
        // Will be replaced with tRPC mutation:
        // ideas.create(data) — isPublished defaults to false
        console.log('Saving draft:', data)

        await new Promise((resolve) => setTimeout(resolve, 300))

        router.push('/ideas')
      } catch (err) {
        console.error('Failed to save draft:', err)
      } finally {
        setIsSubmitting(false)
      }
    },
    [router],
  )

  return (
    <div className="flex h-full flex-col overflow-hidden bg-navy-black">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-navy-dark px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-sm text-text-muted hover:text-text-primary"
            onClick={() => router.push('/ideas')}
          >
            &larr; Ideas
          </button>
          <div className="h-4 w-px bg-border" />
          <h1 className="text-sm font-semibold text-text-primary">New Trading Idea</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">
          <IdeaEditor
            onPublish={handlePublish}
            onSaveDraft={handleSaveDraft}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>
    </div>
  )
}
