import { getCategoryIconSrc } from "@/lib/categoryIcons";

type CategoryIconProps = {
  iconKey?: string | null;
  label?: string | null;
  size?: number;
  className?: string;
};

export function CategoryIcon({
  iconKey,
  label,
  size = 28,
  className,
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
    />
  );
}