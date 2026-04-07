'use client';

import { CAPACITY_THRESHOLDS } from '@/lib/constants';

interface CapacityBarProps {
  used: number;
  max: number;
}

export default function CapacityBar({ used, max }: CapacityBarProps) {
  const pct = max > 0 ? Math.round((used / max) * 100) : 0;

  let color = 'bg-green-500';
  let textColor = 'text-green-700';
  if (pct > CAPACITY_THRESHOLDS.critical) {
    color = 'bg-red-500';
    textColor = 'text-red-700';
  } else if (pct > CAPACITY_THRESHOLDS.warning) {
    color = 'bg-orange-500';
    textColor = 'text-orange-700';
  } else if (pct > CAPACITY_THRESHOLDS.normal) {
    color = 'bg-yellow-500';
    textColor = 'text-yellow-700';
  }

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className={textColor}>
          {used}/{max} batch
        </span>
        <span className={textColor}>{pct}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}
