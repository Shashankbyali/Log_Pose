const PRINCIPLES = [
  "No account and no personal details required",
  "No continuous location tracking",
  "Your location is used for the current request only, never stored",
  "Finding a Safe Haven does not require your identity",
];

export function PrivacyPanel() {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4">
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
    </div>
  );
}
