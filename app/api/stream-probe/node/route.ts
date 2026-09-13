import { probeResponse } from '@/lib/stream-probe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 가정 ①: Hobby + Node 에서 이 값이 받아들여지는가

export function GET(req: Request) {
  return probeResponse(req, 'nodejs');
}
