# Taein Trading System (TTS)

> An explainable trading system that turns research, quantitative signals, and
> risk rules into replayable paper-trading decisions.

리서치와 정량 신호를 리스크 규칙에 통과시켜 Paper Trade를 만들고, 그 결정이 왜
그렇게 났는지를 되감아 보여주는 웹 애플리케이션이다. 실거래는 하지 않는다.

- 종목별 팩터 점수 → 신호 생성 → 리스크 캡(Single 15% · Theme Cluster 40%) 적용까지
  순수 함수 파이프라인 한 번으로 돌린다. 유니버스를 뒤섞어도 같은 결과가 나온다.
- 모든 신호는 근거를 달고 나온다. 출처 없는 숫자는 화면에 올리지 않는다.
- 시세 스트리밍은 SSE. 서버리스 함수 실행 상한 앞에서 스스로 끊고 재접속한다.

## 상태

MVP 구현 전. 지금 있는 코드는 Day 0 스파이크 산출물 — 배포 플랫폼의 스트리밍
한계를 실측하는 하네스다.

```
app/api/stream-probe/{node,edge}   1초마다 tick을 흘리는 SSE 라우트
                                   ?accel=off 로 X-Accel-Buffering 헤더를 뺀 대조군
scripts/stream-probe.mjs           헤더 도달 · 첫 이벤트 도달 · 이벤트별 간격 ·
                                   끊긴 초를 재는 stdlib 전용 클라이언트
```

실측 결과 — Node 런타임은 `maxDuration` 60s가 그대로 먹혀 60.5초에 서버가 스트림을
닫았고, 첫 이벤트는 552ms에 도착했으며 대조군까지 버퍼링이 없었다. 즉
`X-Accel-Buffering: no`는 이 플랫폼에서 아무것도 하지 않는다. Edge 런타임은 130초까지
살아남지만 Next 16.3.5가 deprecated로 경고한다.
