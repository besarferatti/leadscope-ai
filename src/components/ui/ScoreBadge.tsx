import { getScoreColor, getScoreBg } from '../../lib/utils';

interface Props {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showBar?: boolean;
}

export function ScoreBadge({ score, size = 'md', showBar = false }: Props) {
  const colorClass = getScoreColor(score);
  const bgClass = getScoreBg(score);

  const sizeClasses = {
    sm: 'text-xs font-semibold w-8 h-8',
    md: 'text-sm font-bold w-10 h-10',
    lg: 'text-lg font-bold w-14 h-14',
  };

  if (showBar) {
    return (
      <div className="flex items-center gap-3">
        <span className={`font-bold tabular-nums ${colorClass} ${size === 'lg' ? 'text-2xl' : 'text-base'}`}>
          {score}
        </span>
        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${bgClass} rounded-full transition-all duration-700`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-full flex items-center justify-center ${bgClass}/20 border border-current/20 ${sizeClasses[size]}`}>
      <span className={`${colorClass} font-bold tabular-nums text-sm`}>{score}</span>
    </div>
  );
}
