import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[50vh] w-full flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-border/50 bg-card/50">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2 items-center">
            <AlertCircle className="h-8 w-8 text-destructive shrink-0" />
            <h1 className="text-xl sm:text-2xl font-bold font-mono text-foreground">
              404 Page Not Found
            </h1>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            This page doesn&apos;t exist. Use the sidebar to navigate back.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
