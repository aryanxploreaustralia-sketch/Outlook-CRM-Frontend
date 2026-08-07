/**
 * Send progress for one campaign.
 *
 * A segmented bar rather than a single fill, because "80% complete" hides
 * whether the remaining fifth bounced or is still queued — which is the only
 * thing the operator actually needs to know mid-send.
 */

/** @param {{ stats: object, percentComplete: number, compact?: boolean }} props */
export function CampaignProgress({ stats, percentComplete, compact = false }) {
  const total = Math.max(1, stats?.recipients ?? 0)

  // Delivered is a subset of sent on the server, so subtracting here avoids
  // counting the same recipient in two segments and overflowing the bar.
  const segments = [
    { key: 'delivered', value: stats?.delivered ?? 0, className: 'bg-emerald-500', label: 'Delivered' },
    { key: 'sent', value: Math.max(0, (stats?.sent ?? 0) - (stats?.delivered ?? 0)), className: 'bg-sky-400', label: 'Sent' },
    { key: 'bounced', value: stats?.bounced ?? 0, className: 'bg-rose-500', label: 'Bounced' },
    { key: 'failed', value: stats?.failed ?? 0, className: 'bg-rose-300', label: 'Failed' },
    { key: 'skipped', value: stats?.skipped ?? 0, className: 'bg-slate-300', label: 'Skipped' },
  ].filter((segment) => segment.value > 0)

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={percentComplete ?? 0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Campaign send progress"
      >
        {segments.map((segment) => (
          <div
            key={segment.key}
            className={segment.className}
            style={{ width: `${(segment.value / total) * 100}%` }}
            title={`${segment.label}: ${segment.value}`}
          />
        ))}
      </div>

      {!compact && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {segments.map((segment) => (
            <span key={segment.key} className="inline-flex items-center gap-1.5">
              <span className={`inline-block size-2 rounded-full ${segment.className}`} aria-hidden="true" />
              {segment.label} {segment.value.toLocaleString()}
            </span>
          ))}
          <span className="ml-auto font-medium text-slate-700">
            {percentComplete ?? 0}% of {(stats?.recipients ?? 0).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  )
}

export default CampaignProgress
