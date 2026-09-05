const PRINCIPLES = [
  "No account and no personal details required",
  "No continuous location tracking",
  "Route and place searches are used for that request only, never stored",
  "Finding a Safe Haven does not require your identity",
];

export function PrivacyPanel() {
  return (
    <div className="lp-card lp-fade-up p-4">
      <h3 className="text-sm font-semibold text-white">Privacy by Design</h3>
      <p className="mt-1 text-xs leading-relaxed text-zinc-400">
        Your location is used to find routes and nearby places. LOG POSE does
        not continuously track you.
      </p>
      <ul className="mt-3 space-y-1.5">
        {PRINCIPLES.map((principle) => (
          <li key={principle} className="flex gap-2 text-xs text-zinc-400">
            <span className="mt-0.5 shrink-0 text-teal-400" aria-hidden="true">
              &#10003;
            </span>
            {principle}
          </li>
        ))}
      </ul>

      <p className="mt-3 border-t border-white/5 pt-3 text-[11px] leading-relaxed text-zinc-500">
        <span className="font-medium text-zinc-300">One exception:</span> if you
        start a Safe Walk, your start point and destination are stored until it
        resolves, because an overdue alert is worthless without knowing where
        you were heading. Still no name, phone number or account &mdash; and the
        record is deleted once you arrive or cancel. Your trusted contact&rsquo;s
        number never leaves your device.
      </p>
    </div>
  );
}
