interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <img
      src="/leadscope-icon.png"
      alt="LeadScope AI"
      className={className ?? 'h-8 w-auto object-contain'}
    />
  );
}
