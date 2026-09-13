// Day 0 계측용. plan:208 미검증 플랫폼 가정 3건(maxDuration · CDN 버퍼링 · Edge 대안)을
// 배포본에서 재기 위한 임시 라우트다. 실측이 끝나면 Day 4 배포 전에 지운다 (T3 · D22).

const ENC = new TextEncoder();

export function probeResponse(req: Request, runtime: 'nodejs' | 'edge'): Response {
  // ?accel=off 로 X-Accel-Buffering 헤더를 빼고 같은 측정을 한 번 더 한다.
  // 헤더 없이도 첫 이벤트가 즉시 오면 CDN 버퍼링 가정은 애초에 문제가 아니었다는 뜻이다.
  const accel = new URL(req.url).searchParams.get('accel') !== 'off';
  const t0 = Date.now();

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(ENC.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send('open', { runtime, accel, t: 0 });

      let n = 0;
      const timer = setInterval(() => {
        try {
          send('tick', { n: ++n, t: Date.now() - t0 });
        } catch {
          clearInterval(timer); // 스트림이 이미 닫혔다
        }
      }, 1000);

      // 클라이언트가 끊으면 타이머도 끊는다. 플랫폼이 끊는 경우는 여기로 안 온다 —
      // 그 지점이 바로 재려는 값이다.
      req.signal.addEventListener('abort', () => {
        clearInterval(timer);
        try {
          controller.close();
        } catch {
          /* 이미 닫힘 */
        }
      });
    },
  });

  const headers = new Headers({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  if (accel) headers.set('X-Accel-Buffering', 'no');

  return new Response(body, { headers });
}
