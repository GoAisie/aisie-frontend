import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  href: string;
  label: string;
};

// "← {label}" back navigation. Outline button so it reads as an affordance
// (not a passive link), keeps the page chrome cohesive with PWA's BackLink.
export function BackLink({ href, label }: Props) {
  return (
    <Button asChild variant="outline" size="sm" className="mb-3 gap-1.5">
      <Link href={href} className="no-underline">
        <ArrowLeft className="size-4" aria-hidden />
        {label}
      </Link>
    </Button>
  );
}
