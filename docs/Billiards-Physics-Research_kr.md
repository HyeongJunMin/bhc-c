# 현실형 당구 물리 연구 문서

## 1. 문서 정보
- 제목: 현실형 당구 물리 연구 문서
- 작성일: 2026-03-09
- 언어: 한국어
- 목적: 최신 공개 논문, 공식 문서, 현행 라이브러리를 참고해 웹 당구게임에 필요한 물리 규칙을 현실적으로 정리한다.
- 관계: 이 문서는 연구/설계 문서이며, 현재 소스 오브 트루스인 `docs/Physics-Spec.md`, `docs/Physics-Spec_kr.md`를 대체하지 않는다.

## 2. 이번 조사에서 바로 결론 내릴 수 있는 것
현실적인 당구 물리를 만들려면 아래 5개를 반드시 분리해서 모델링해야 한다.

1. 큐가 수구를 치는 순간의 충격량 문제
2. 충돌 직후 공의 선속도/각속도 상태
3. 천(cloth) 위에서 미끄럼 -> 구름 -> 제자리 회전으로 바뀌는 전이
4. 공-공 충돌의 법선/접선 임펄스와 충돌 후 throw
5. 공-쿠션 충돌의 속도 의존 반발, 쿠션 마찰, 접촉시간 효과

이 5개를 하나의 단순 탄성충돌이나 단순 반사각 공식으로 뭉개면 다음이 틀어진다.

- 드로우/팔로우의 거리
- 스턴(stun) 샷의 정지감
- 컷샷의 object ball throw
- 러닝/리버스 잉글리시의 쿠션 반사각 차이
- 저속에서 쿠션 각이 더 벌어지거나 짧아지는 현상
- 스퀴트(squirt)와 스워브(swerve)의 시간차

## 3. 참고한 최신 자료와 신뢰도
이 문서의 핵심 규칙은 아래 자료를 우선순위대로 사용했다.

### 3.1 1차 기준 자료
- UMB 공식 규정/장비 문서
  - 공 직경 허용범위 `61 ~ 61.5 mm`
  - 공 무게 허용범위 `205 ~ 220 g`
  - 가열 테이블, 공식 천 사용
- Mathavan et al. (2010), cushion impact 분석
- Mathavan et al. (2014), frictional ball-ball collision 가속 모델
- Independent friction-restitution description of billiard ball collisions (2023)
- Kim et al. (2022), cue stroke 이후 공 운동
- Ozkanlar et al. (2020), 수평 큐 스트로크 후 cue ball 운동
- Dr. Dave Alciatore의 최신 기술문서
  - TP A.14: throw
  - TP A.30 / FAQ: maximum spin, miscue 한계

### 3.2 최신 구현 레퍼런스
- `pooltool`
  - JOSS 2024 논문
  - 2025 문서 및 PyPI `0.5.0`
  - 공 상태 진화, 충돌 모델 교체, cushion/ball-ball 모델 선택 구조가 매우 좋다.
- `tailuge/billiards`
  - 브라우저/TypeScript 쪽 구조 참고용
  - 다만 일부 수식은 문서 자체에 "inferred"라고 표시되어 있어 검증 후 채택해야 한다.
- `python-billiards`
  - 정확한 2D hard-disk event simulation 참고용
  - 회전, 천 마찰, 쿠션 높이, 큐 임팩트가 없어서 현실형 큐스포츠 물리의 최종해로는 부족하다.

## 4. 현실형 엔진이 가져야 할 상태 변수
공 하나당 최소 상태는 아래다.

- 위치 `p = (x, y, z)`
- 선속도 `v = (vx, vy, vz)`
- 각속도 `omega = (wx, wy, wz)`
- 반지름 `R`
- 질량 `m`
- 관성모멘트 `I = (2/5) m R^2`
- 현재 운동 모드
  - `REST`
  - `SLIDING`
  - `ROLLING`
  - `SPINNING_IN_PLACE`
  - `AIRBORNE`
  - `BALL_CONTACT`
  - `CUSHION_CONTACT`

게임 규칙 판정용으로는 샷 단위 이벤트 로그도 분리해야 한다.

- 최초 충돌 상대 공
- 공-공 충돌 순서
- 공-쿠션 충돌 순서
- 각 이벤트의 시간, 충돌 전후 속도, 충돌 전후 회전

3쿠션 채점은 결국 "연속 충돌 이벤트 시퀀스" 문제라서, 위치/속도만 가지고 나중에 복원하려 하면 정확도가 급격히 떨어진다.

## 5. 현실적인 기본 상수와 캘리브레이션 범위
공식 장비 값과 논문/라이브러리의 실사용 범위를 묶으면 시작점은 아래가 안전하다.

### 5.1 캐롬 기본값
- 반지름 `R = 0.03075 m`
- 질량 `m = 0.21 kg`
- 플레이필드 `2.84 m x 1.42 m`
- 쿠션 nose 높이 `h ~= 0.037 m`

### 5.2 시작용 튜닝 범위
- 공-공 반발계수 `e_bb = 0.93 ~ 0.98`
- 공-쿠션 유효 반발계수 `e_bc = 0.70 ~ 0.78`
- 팁-공 마찰 `mu_tip = 0.60 ~ 0.80`
- 공-공 접촉 마찰 `mu_bb = 0.03 ~ 0.08`
- 공-쿠션 마찰 `mu_bc = 0.14 ~ 0.20`
- 슬라이딩 마찰 `mu_slide = 0.15 ~ 0.25`
- 롤링 저항 `mu_roll = 0.005 ~ 0.02`
- 제자리 횡회전 감쇠용 스핀 마찰 `mu_spin = 0.01 ~ 0.03`

주의:
- `e_bc`는 현실적으로 상수 하나로 끝나지 않는다. 속도, 회전, 입사각, 쿠션 고무 상태에 따라 달라진다.
- `mu_slide`, `mu_roll`, `mu_spin`은 같은 마찰이 아니다. 하나로 합치면 스턴, 드로우, 횡회전 감쇠가 동시에 틀어진다.

## 6. 좌표계 규약
구현 혼선을 막으려면 좌표계를 먼저 고정해야 한다.

- 월드 좌표
  - `x`: 테이블 가로
  - `y`: 테이블 세로
  - `z`: 위쪽
- 공 접지점 기준 천 상대 미끄럼 속도
  - `u = v + omega x (-R k)`
  - `k = (0, 0, 1)`
- 따라서 테이블 위에서
  - `u_x = v_x - R * omega_y`
  - `u_y = v_y + R * omega_x`

순수 구름(pure rolling) 조건은 `u = 0`이다.

- `v_x = R * omega_y`
- `v_y = -R * omega_x`

즉, 선속도와 각속도를 별도로 저장한 뒤 rolling constraint를 만족하는지 매 프레임 판정해야 한다.

## 7. 큐가 수구를 칠 때의 물리

### 7.1 왜 단순 `초기속도 + 초기스핀` 선형식만으로는 부족한가
단순식은 빠르지만 아래를 놓친다.

- 횡당점에 의한 squirt
- 팁 마찰이 부족할 때의 slip
- miscue 확률
- cue end-mass와 shaft flexibility에 따른 편차
- 큐 elevation에 따른 swerve/masse/jump

현실형 모델은 "충돌 순간의 접촉 임펄스"로 풀어야 한다.

### 7.2 추천하는 큐-공 충돌 모델
수구 중심에서 당점까지 벡터를 `r`이라고 하자.

- `r = (x_offset, y_offset, z_offset)`
- 실제 충돌점은 공 표면 위에 있어야 하므로
  - `x_offset^2 + y_offset^2 + z_offset^2 = R^2`
- 수평 샷 기준으로 큐 진행 방향 단위벡터를 `n`이라 두면
  - `z_offset = -sqrt(R^2 - x_offset^2 - y_offset^2)`

충돌 전 접촉점 상대속도:

- `u_rel = v_tip - (v_ball + omega x r)`

법선/접선 성분 분해:

- `u_n = (u_rel dot n) n`
- `u_t = u_rel - u_n`

법선 임펄스:

- `J_n = - (1 + e_tip) * (u_rel dot n) / D_n`
- `D_n = 1/m_eff + 1/m + (r x n)^T I^-1 (r x n)`

여기서 `m_eff`는 큐 전체 질량이 아니라 "팁에서 보이는 유효질량"이다. 실제 squirt와 spin transfer는 큐 총질량보다 `m_eff`에 더 민감하다.

접선 임펄스는 Coulomb 마찰 제약을 둔다.

- 무미끄럼 해 후보 `J_t*`를 먼저 푼다.
- 만약 `|J_t*| <= mu_tip * J_n`이면 stick
- 아니면 `J_t = -mu_tip * J_n * normalize(u_t)`로 slip

충돌 후 갱신:

- `v+ = v- + (J_n + J_t) / m`
- `omega+ = omega- + I^-1 (r x (J_n + J_t))`

이 모델을 쓰면 다음이 자연스럽게 나온다.

- 위당점: forward roll 증가
- 아래당점: backspin 증가
- 오른당점: 우회전(side spin) 증가
- 왼당점: 좌회전(side spin) 증가
- 좌우 당점이 커질수록 squirt는 반대 방향으로 발생

### 7.3 당점 위치별 결과

#### 중심 타격
- `x ~= 0`, `y ~= 0`
- 스핀 거의 없음
- 직진성 가장 높음
- object ball에 힘 전달이 가장 단순하다.

#### 위당점
- `y > 0`
- 타격 직후 전진 회전 증가
- 천과의 마찰로 rolling 전이가 빨라진다.
- object ball 충돌 뒤 cue ball이 앞으로 더 남는다.
- follow shot의 핵심

#### 아래당점
- `y < 0`
- 타격 직후 backspin 증가
- 먼저 미끄러지다가 backspin이 줄어든 뒤
  - 아직 backspin이 남아 있으면 draw
  - 거의 0이면 stun
  - 전진회전으로 바뀌면 natural roll

#### 오른당점
- `x > 0`
- 우측 side spin 생성
- 초기 squirt는 대체로 좌측
- 이후 속도가 줄고 천 마찰이 작동하면 경로가 우측으로 휘어 swerve가 나타난다.
- 쿠션에서는 running/reverse english를 바꾸는 핵심 입력이 된다.

#### 왼당점
- `x < 0`
- 왼쪽 side spin 생성
- 초기 squirt는 대체로 우측
- 이후 swerve는 좌측으로 진행

### 7.4 현실적인 miscue 한계
여기서 중요한 점은 "수학적 최대 오프셋"과 "실제 안전하게 가능한 오프셋"이 다르다는 것이다.

- 이론상 최대 스핀 전달은 공 중심에서 약 `0.73R` 부근까지 논해진다.
- 하지만 실제 플레이에서 안정적으로 쓰는 full english는 대개 그보다 훨씬 안쪽이다.
- 게임 엔진에서는 다음처럼 분리하는 것이 좋다.

권장 규칙:

- `rho = sqrt(x_offset^2 + y_offset^2)`
- `rho <= 0.50R`
  - 일반 샷 안정 구간
- `0.50R < rho <= 0.60R`
  - 전문가 영역, miscue 확률 증가
- `rho > 0.60R`
  - 현실형 모드에서는 강한 miscue 또는 파워 감쇄

즉, `0.9R` 같은 임계는 "UI 입력 허용 한계"로는 쓸 수 있어도 "현실형 miscue"로는 너무 관대하다.

### 7.5 squirt와 swerve는 분리해야 한다

#### squirt
- 큐 충돌 직후 수 밀리초 안에 생기는 즉시 편향
- 당점 방향의 반대쪽으로 작게 발생
- cue end-mass, shaft 강성, 팁/공 접촉에 민감

#### swerve
- 충돌 이후 천 마찰과 횡회전에 의해 시간에 따라 휘는 곡선
- 속도가 느릴수록, cue elevation이 클수록, 천 마찰이 클수록 커진다.

실무 규칙:
- squirt는 "초기 발사각 보정"
- swerve는 "시간 적분 곡률"

둘을 하나의 즉시 각도 보정으로 합치면 짧은 샷과 긴 샷이 동시에 틀어진다.

## 8. 천 위에서의 공 운동

### 8.1 상태 분류가 핵심이다
모든 공은 아래 중 하나의 상태로 간주해야 한다.

1. `SLIDING`
2. `ROLLING`
3. `SPINNING_IN_PLACE`
4. `REST`

공-공 또는 공-쿠션 충돌 직후에는 원래 rolling이던 공도 다시 `SLIDING`으로 돌아가는 경우가 많다.

### 8.2 sliding 상태
천 접지점 상대속도 `u`가 0이 아니면 sliding이다.

- `u = v + omega x (-R k)`
- `u_hat = normalize(u)`

가속도:

- `dv/dt = -mu_slide * g * u_hat`

각가속도:

- `domega/dt = (5 * mu_slide * g / (2R)) * (k x u_hat)`

접지점 미끄럼 속도는 더 빠르게 줄어든다.

- `du/dt = -(7/2) * mu_slide * g * u_hat`

따라서 sliding -> rolling 전이시간은

- `t_sr = 2 * |u0| / (7 * mu_slide * g)`

이 식은 구현적으로 매우 중요하다. 샷이 얼마나 오래 "끌리다가" 구르기 시작하는지 직접 결정하기 때문이다.

### 8.3 rolling 상태
rolling이면 `u ~= 0`이다.

- 선속도는 rolling resistance로 감소
- `dv/dt = -mu_roll * g * normalize(v)`
- 각속도는 rolling constraint를 유지하도록 같이 감소

이 단계에서는 감속이 sliding보다 훨씬 작아 장거리 쿠션 샷, 3쿠션 라인, 자연회전 경로에 큰 영향을 준다.

### 8.4 제자리 횡회전
공이 거의 멈췄는데 `omega_z`만 남아 있을 수 있다.

- `|v| < eps_v`
- `|omega_z| > eps_spin`

이때는 translation이 아니라 spin decay로 처리해야 한다.

- `domega_z/dt = -(5 * mu_spin * g / (2R)) * sign(omega_z)`

이걸 무시하면 쿠션 뒤 side spin이 비정상적으로 오래 남는다.

## 9. 공-공 충돌

### 9.1 충돌 전에 반드시 알아야 하는 상태
공 1, 공 2에 대해 충돌 직전 상태를 모두 써야 한다.

- `v1-`, `omega1-`
- `v2-`, `omega2-`
- 중심간 단위 법선 `n`
- 접선 평면 성분 `t`

접촉점 상대속도:

- 공 1 접촉점 속도 `c1 = v1- + omega1- x (R n)`
- 공 2 접촉점 속도 `c2 = v2- + omega2- x (-R n)`
- 상대속도 `u = c1 - c2`

분해:

- `u_n = (u dot n) n`
- `u_t = u - u_n`

### 9.2 즉시 충돌 해석
같은 질량의 실구 두 개라면 normal impulse는 비교적 단순하다.

- `J_n = -((1 + e_bb) * m / 2) * (u dot n)`

접선 임펄스는 friction regime을 봐야 한다.

무미끄럼 후보:

- `J_t_stick = -(m / 7) * u_t`

실제 적용:

- `if |J_t_stick| <= mu_bb * |J_n|` -> stick
- `else J_t = -mu_bb * |J_n| * normalize(u_t)` -> slip

갱신:

- `v1+ = v1- + (J_n n + J_t) / m`
- `v2+ = v2- - (J_n n + J_t) / m`
- `omega1+ = omega1- + I^-1 (R n x J_t)`
- `omega2+ = omega2- + I^-1 (R n x J_t)`

핵심은 이 충돌이 "선속도만 바꾸는 것"이 아니라는 점이다. 접선 임펄스가 있으면 두 공 모두 회전 상태가 바뀐다.

### 9.3 현실적으로 보이는 결과

#### 정면 충돌
- object ball은 거의 정면으로 나간다.
- cue ball은 속도를 크게 잃는다.
- stun이면 거의 멈춘 것처럼 보일 수 있다.
- follow면 앞으로 남고
- draw면 잠시 후 뒤로 끌린다.

#### 컷샷
- object ball은 접선 방향 sideways throw를 조금 얻는다.
- cue ball은 cut angle 방향으로 비껴 나간다.
- 충돌 순간의 접선 임펄스와 충돌 직후 천에서의 짧은 sliding 둘 다 각도에 기여한다.

#### side spin이 있는 컷샷
- spin-induced throw가 추가된다.
- object ball throw 방향은 cut 방향, side spin 방향, 속도에 따라 바뀐다.
- 저속, 높은 마찰, stun 근처에서 effect가 가장 커진다.

### 9.4 "충돌 직후 상태"와 "눈에 보이는 최종 상태"를 분리해야 한다
사용자 요구사항 중 중요한 부분이 바로 이것이다.

공-공 충돌 뒤 각 공의 상태는 최소 2단계로 봐야 한다.

1. `instant post-impact`
   - `v+`, `omega+`가 임펄스로 즉시 바뀜
2. `post-transition`
   - 천 마찰로 sliding -> rolling 전이 후 실제 플레이어가 보는 안정된 진로가 형성됨

예를 들어 draw shot은 충돌 직후 cue ball이 바로 뒤로 가는 것이 아니라,

- 전진속도 일부 보유
- backspin 우세
- 짧은 sliding
- 이후 역방향으로 전환

이 순서로 보인다.

## 10. 공-쿠션 충돌

### 10.1 왜 공-쿠션이 제일 어렵나
쿠션은 단순 벽이 아니다.

- 접촉점 높이가 공 중심보다 위에 있다.
- 공은 쿠션과 동시에 천에도 접촉할 수 있다.
- 고무 변형 시간 때문에 속도 의존성이 생긴다.
- side spin과 top/back spin이 둘 다 반사각에 들어간다.

따라서 `reflect(v, n)` 같은 거울반사는 현실형 당구에서는 거의 쓸 수 없다.

### 10.2 연구적으로 가장 믿을 만한 모델
Mathavan 2010 모델은 공-쿠션 접촉점 `I`와 공-천 접촉점 `C`를 동시에 보고, compression phase와 restitution phase를 work 기반으로 적분한다.

쿠션 접촉 지오메트리:

- `sin(theta) = (h - R) / R`
- `cos(theta) = sqrt(1 - sin(theta)^2)`

캐롬 기본값 `R = 30.75 mm`, `h = 37 mm`면 `sin(theta) ~= 0.203`이다.

Mathavan local frame에서 접촉점 slip은 다음처럼 쓸 수 있다.

- 쿠션 접점 `I`
  - `s_xI = v_x + R * omega_z * sin(theta) + R * omega_y * cos(theta)`
  - `s_yI = -v_z + R * omega_x * cos(theta) - v_y * sin(theta)`
- 천 접점 `C`
  - `s_xC = v_x - R * omega_z`
  - `s_yC = v_y * cos(theta) + v_z * sin(theta) - R * omega_x`

압축 단계:

- 공이 쿠션 안쪽으로 파고드는 동안 적분
- `vy <= 0`가 될 때까지 진행
- 이때의 work를 `W_I`로 누적

복원 단계:

- 목표 work `W_R = e_e^2 * W_I`
- `W_R`에 도달할 때까지 적분

이 모델의 장점:

- side spin과 top/back spin의 결합을 자연스럽게 처리
- 쿠션 마찰과 천 마찰을 동시에 반영
- 저속에서 throw가 커지는 현상을 단순 상수각보다 잘 잡음

### 10.3 게임 엔진에서 관찰되는 현상 정리

#### spin 없는 일반 입사
- 법선 성분은 반전되면서 감쇠
- 접선 성분도 쿠션 마찰 때문에 일부 줄어든다.
- 반사각은 단순 입사각 대칭보다 달라진다.

#### running english
- 쿠션 접점 slip이 줄어든다.
- 접선 속도를 더 유지한다.
- 결과적으로 "길게(long)" 나간다.
- 즉, 쿠션을 타고 더 눕는 각이 된다.

#### reverse english
- 접점 slip이 커진다.
- 접선 속도를 더 잃는다.
- 결과적으로 "짧게(short)" 나간다.
- 즉, 법선 쪽으로 더 말려 나온다.

#### topspin / backspin
- 쿠션 접점 높이 때문에 tangential velocity와 회전이 결합된다.
- topspin은 레일을 따라 나가는 성분을 보강할 수 있다.
- backspin은 그 성분을 죽이거나 반전시킬 수 있다.

#### 저속 + 큰 side spin
- 쿠션 접촉시간이 길어진다.
- throw angle이 더 커질 수 있다.
- 상수 `e_bc`, 상수 `mu_bc`만 두는 단순 모델이 여기서 특히 많이 틀어진다.

### 10.4 실무용 하이브리드 규칙
풀 Mathavan 적분이 부담되면 하이브리드로 갈 수 있다.

1. 법선 속도는 속도 의존 `e_bc(v_n)`로 반전
2. 접선 속도는 쿠션 마찰로 감쇠
3. side spin 기반 throw velocity를 추가
4. spin loss/damping은 속도 의존으로 준다.

하지만 주의할 점:

- throw는 접선 속도에 그냥 상수 더하기가 아니라 속도와 회전의 함수여야 한다.
- 에너지 보호를 하지 않으면 저속 고회전에서 충돌 후 속력이 오히려 커지는 비물리 현상이 생긴다.

## 11. cue-ball, object-ball, cushion의 상태변화를 질문별로 정리

### 11.1 큐와 공의 충격 시 위치에 따른 회전 방향과 속도

#### 위쪽을 치면
- 전진회전 증가
- rolling 전이 빨라짐
- object ball 맞은 뒤 cue ball follow 증가

#### 아래쪽을 치면
- backspin 증가
- sliding 기간 동안 backspin 감소
- object ball 맞을 시점에 backspin이 남아 있으면 draw

#### 오른쪽을 치면
- 우측 side spin 증가
- 초기 squirt는 좌측
- 진행 중 swerve는 우측
- 쿠션 이후 running/reverse 효과를 바꿈

#### 왼쪽을 치면
- 좌측 side spin 증가
- 초기 squirt는 우측
- 진행 중 swerve는 좌측

#### 대각선 당점
- 위/아래 회전과 좌/우 회전이 동시에 생김
- 결과는 벡터 합이지만, miscue와 squirt/swerve가 더 민감해진다.

### 11.2 공 간 충돌 시 충돌 전 상태와 충돌 후 상태변화

충돌 전에 필요한 값:

- 두 공의 선속도 `v1-`, `v2-`
- 두 공의 각속도 `omega1-`, `omega2-`
- 충돌 법선 `n`
- 접촉점 상대속도 `u`

충돌 직후 바뀌는 값:

- 각 공의 선속도 벡터
- 각 공의 각속도 벡터
- 충돌 직후 두 공 모두 sliding 상태로 재진입할 가능성

충돌 몇 프레임 후 추가로 바뀌는 값:

- 천 마찰에 의해 rolling 방향 재정렬
- draw/follow/stun의 눈에 보이는 결과
- object ball throw 최종각

### 11.3 공과 쿠션 충돌 시 상태변화

충돌 전:

- 입사 법선 속도
- 쿠션을 따라가는 접선 속도
- side spin
- topspin/backspin

충돌 직후:

- 법선 속도 반전 및 감쇠
- 접선 속도 증감
- side spin 일부 소실 또는 증폭된 coupling
- topspin/backspin 재분배

충돌 후 수 프레임:

- 다시 천 마찰이 지배
- sliding -> rolling 전이
- 결과적으로 플레이어가 보는 "짧다/길다"가 결정

## 12. 구현 권장안

### 12.1 가장 현실적인 구조
1. 샷 시작
   - cue-ball impulse solver
   - squirt 계산
2. 상태 진화
   - sliding / rolling / spin-in-place analytic or semi-analytic update
3. 공-공 충돌
   - frictional impulse model
4. 공-쿠션 충돌
   - Mathavan 2010 또는 그에 준하는 hybrid
5. 이벤트 로그
   - 규칙 판정용

### 12.2 웹게임에서 현실성과 비용의 균형이 좋은 구조
- 내부 물리 tick: `240 Hz` 이상 권장
- 렌더/브로드캐스트: `20 ~ 60 Hz`
- 충돌 직후엔 substep 증가
- 천 상태 전이는 가능한 한 analytic 식 사용
- 공 수가 3개라면 broadphase 최적화보다 충돌 정확도가 더 중요

### 12.3 이 저장소 기준으로 특히 중요한 포인트
- `impactOffsetLimit`와 `miscue limit`를 분리할 것
- squirt와 swerve를 분리할 것
- ball-ball 충돌 후 "즉시 상태"와 "전이 후 상태"를 테스트할 것
- cushion은 최소한 speed/spin dependent model을 유지할 것

## 13. 검증 시나리오
현실형 튜닝은 아래 샷들로 확인해야 한다.

1. center-ball stop shot
2. 같은 세기의 follow shot
3. 같은 세기의 draw shot
4. 1/2-ball cut shot without english
5. 같은 컷샷 + running english
6. 같은 컷샷 + reverse english
7. long rail one-cushion shot at low / medium / high speed
8. three-cushion standard route shot
9. repeated rail contacts energy monotonicity check
10. 동일 입력 재현성 test

이 검증은 "최종 위치"만 보면 부족하다. 최소한 아래를 같이 기록해야 한다.

- 최초 100 ms 궤적
- 첫 충돌 직전 속도/회전
- 첫 충돌 직후 속도/회전
- rolling 전이 완료 시점

## 14. 라이브러리 선택 가이드

### 14.1 `pooltool`
- 가장 추천
- 이유:
  - cue, ball-ball, ball-cushion, ball-pocket 모델이 분리되어 있음
  - 상태 진화(evolution)와 충돌(resolve) 구조가 명확함
  - 논문/문서 연결이 좋음
- 용도:
  - 수식 검증
  - 상태 머신 설계
  - 테스트 fixture 생성

### 14.2 `tailuge/billiards`
- 브라우저 구조 참고용으로 좋음
- 3D 렌더와 규칙/UI 통합 방식 참고 가능
- 단, 물리 수식은 일부 검증이 필요

### 14.3 `python-billiards`
- "정확한 event-driven collision architecture" 참고용
- spin, cloth, rail height가 없어서 현실형 큐스포츠 물리 엔진의 완성본으로 쓰면 안 된다.

## 15. 바로 적용 가능한 설계 판단

### 15.1 반드시 넣어야 하는 것
- 선속도와 각속도 분리
- sliding / rolling / spinning 분리
- ball-ball 접선 임펄스
- cushion speed/spin dependence
- 충돌 이벤트 로그

### 15.2 있으면 크게 좋아지는 것
- squirt
- swerve
- speed-dependent spin damping
- cue effective mass
- realistic miscue probability curve

### 15.3 나중으로 미뤄도 되는 것
- cloth anisotropy
- 온도/습도
- jump / masse full 3D
- cue shaft bending 상세 모델
- ball polish wear

## 16. 참고 문헌과 문서
- UMB Rules page: https://www.umb-carom.org/Rules.aspx
- UMB official rules PDF and equipment notes: https://www.umb-carom.org/Rules/Carom_Rules.pdf
- UMB World Cup 3-Cushion Rules (2024-12-15): https://www.umb-carom.org/Rules/World_Cup_3C_Rules.pdf
- Dr. Dave Alciatore technical proofs: https://drdavepoolinfo.com/technical-proofs/
- Dr. Dave TP A.14 throw angle resource: https://drdavepoolinfo.com/technical_proofs/TP_A-14.pdf
- Dr. Dave maximum spin / miscue FAQ: https://drdavepoolinfo.com/faq/english/maximum/
- Mathavan et al. (2010), A theoretical analysis of billiard ball dynamics under cushion impacts: https://billiards.colostate.edu/physics_articles/Mathavan_IMechE_2010.pdf
- Mathavan et al. (2014), An accelerated model for simulating the dynamics of a billiard ball: https://pooltool.readthedocs.io/en/latest/autoapi/pooltool/physics/resolve/ball_ball/frictional_mathavan/index.html
- Independent friction-restitution description of billiard ball collisions (2023): https://www.sciencedirect.com/science/article/pii/S0307904X23002747
- Kim et al. (2022), Motions of a billiard ball after a cue stroke: https://www.dbpia.co.kr/journal/articleDetail?nodeId=NODE11056051
- Ozkanlar et al. (2020), Billiard Physics: Motion of a Cue Ball after Hit by a Cue Stick Horizontally: https://avesis.hacettepe.edu.tr/yayin/b6e43efb-7060-4860-a870-5af9c8f0f9bd/billiard-physics-motion-of-a-cue-ball-after-hit-by-a-cue-stick-horizontally
- pooltool JOSS paper (2024): https://joss.theoj.org/papers/10.21105/joss.07301
- pooltool docs: https://pooltool.readthedocs.io/
- pooltool PyPI: https://pypi.org/project/pooltool/
- tailuge/billiards: https://github.com/tailuge/billiards
- tailuge documentation site: https://billiards.js.org/
- python-billiards: https://github.com/markus-ebke/python-billiards

## 17. 요약
현실형 당구 물리는 "초기속도만 잘 주면 되는 문제"가 아니다. 핵심은 아래다.

1. 큐-공 임펄스로 선속도와 회전을 동시에 만든다.
2. 충돌 직후 상태와 천 위 전이 상태를 분리한다.
3. 공-공 충돌은 법선 임펄스만이 아니라 접선 임펄스와 throw를 본다.
4. 공-쿠션 충돌은 속도/회전 의존성을 넣는다.
5. 3쿠션 규칙 판정은 충돌 이벤트 로그를 기반으로 한다.

이 5가지를 지키면 "당구처럼 보이는 공 튕김"이 아니라, 실제로 라인과 회전이 읽히는 당구게임에 가까워진다.
