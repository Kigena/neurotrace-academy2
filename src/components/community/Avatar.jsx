import React from "react";

const PALETTE = [
  "from-indigo-500 to-violet-500",
  "from-sky-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-fuchsia-500 to-purple-500",
];

/** A stable gradient per name so each member is recognisable. */
function colourFor(name = "") {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function Avatar({ name = "?", size = "md", online = false }) {
  const dims = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-14 w-14 text-lg" }[size];
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";
  return (
    <span className="relative inline-flex shrink-0">
      <span className={`inline-flex ${dims} items-center justify-center rounded-full bg-gradient-to-br ${colourFor(name)} font-semibold text-white`} aria-hidden="true">
        {initials}
      </span>
      {online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" title="Online" />}
    </span>
  );
}
