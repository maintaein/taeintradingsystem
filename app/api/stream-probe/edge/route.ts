import { probeResponse } from '@/lib/stream-probe';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return probeResponse(req, 'edge');
}
