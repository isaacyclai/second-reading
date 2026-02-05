import type { TagColor } from "../../lib/types";
import { tagColorClasses } from "../../lib/types";

interface Props {
  color?: TagColor;
  children: preact.ComponentChildren;
  class?: string;
}

export default function Tag({ color = "accent", children, class: className = "" }: Props) {
  const colorClass = tagColorClasses[color];

  return (
    <span
      class={`inline-block font-sans text-label-sm uppercase tracking-wider px-2 py-0.5 rounded ${colorClass} ${className}`}
    >
      {children}
    </span>
  );
}
