'use client';

import { FACTORIES, type FactoryKey } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FactoryToggleProps {
  value: FactoryKey;
  onChange: (value: FactoryKey) => void;
}

export default function FactoryToggle({ value, onChange }: FactoryToggleProps) {
  return (
    <div className="flex rounded-lg border overflow-hidden">
      {(Object.entries(FACTORIES) as [FactoryKey, (typeof FACTORIES)[FactoryKey]][]).map(
        ([key, factory]) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium transition-colors border-r last:border-r-0',
              value === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-accent'
            )}
          >
            {factory.name}
            {factory.lines > 0 && (
              <span className="ml-1 opacity-70">({factory.lines})</span>
            )}
          </button>
        )
      )}
    </div>
  );
}
