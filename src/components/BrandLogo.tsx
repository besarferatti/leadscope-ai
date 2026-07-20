interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className }: BrandLogoProps) {
  return (
    <img
      src="/leadscope-logo.png"
      alt="LeadScope AI"
      className={className ?? 'h-8 w-auto object-contain'}
    />
  );
}
