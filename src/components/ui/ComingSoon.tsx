// src/components/ui/ComingSoon.tsx
import React from 'react';
import { Rocket, Construction } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Variant = 'default' | 'compact' | 'inline';

interface ComingSoonProps {
  title?: string;
  description?: string;
  variant?: Variant;
  className?: string;
}

const ComingSoon: React.FC<ComingSoonProps> = ({ 
  title = "Coming Soon", 
  description = "This feature is currently under development",
  variant = 'default',
  className
}) => {
  if (variant === 'compact') {
    return (
      <div className={cn("flex items-center justify-center p-4", className)}>
        <div className="flex items-center space-x-3">
          <Rocket className="h-5 w-5 text-primary animate-pulse" />
          <span className="text-sm text-muted-foreground">{title}</span>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={cn("flex items-center space-x-2 text-muted-foreground", className)}>
        <Rocket className="h-4 w-4" />
        <span className="text-sm">Coming Soon</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-center h-full min-h-[400px] p-4", className)}>
      <Card className="max-w-md w-full">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="relative flex items-center justify-center w-16 h-16">
              <div className="absolute w-16 h-16 bg-primary/10 rounded-full" />
              <Construction className="h-10 w-10" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold tracking-tight">{title}</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {description}
              </p>
            </div>

            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComingSoon;
