interface BrandLogoProps {
  variant?: 'full' | 'icon';
  className?: string;
}

export function BrandLogo({ variant = 'full', className }: BrandLogoProps) {
  const isIcon = variant === 'icon';

  return (
    <img
      src={isIcon ? '/brand/leadscope-icon.png' : '/brand/leadscope-logo.png'}
      alt={isIcon ? '' : 'LeadScope AI'}
      aria-hidden={isIcon || undefined}
      className={className ?? (isIcon ? 'h-8 w-8 object-contain' : 'h-8 w-auto object-contain')}
    />
  );
}
