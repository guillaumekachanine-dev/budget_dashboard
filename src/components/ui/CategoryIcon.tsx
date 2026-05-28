import type { CSSProperties } from "react";
import { getCategoryIconSrc } from "@/lib/categoryIcons";

type CategoryIconProps = {
  iconKey?: string | null;
  label?: string | null;
  size?: number;
  className?: string;
  style?: CSSProperties;
};

export function CategoryIcon({
  iconKey,
  label,
  size = 28,
  className,
  style,
}: CategoryIconProps) {
  const src = getCategoryIconSrc(iconKey);

  return (
    <img
      src={src}
      alt={label ? `Icône ${label}` : ""}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={className}
      style={style}
    />
  );
}
