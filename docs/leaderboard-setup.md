# 온라인 순위 (Supabase) 설정

타이틀의 **순위** 화면은 라이더마다 **최고 기록 1개**를 올려 다른 플레이어와 겨룹니다. 서버는 무료 Supabase 프로젝트
하나면 충분하고, 게임은 SDK 없이 REST(PostgREST)로만 통신합니다 (`src/online/`).

- 서버를 설정하지 않으면 순위 화면은 **오프라인 모드**로 내 최고 기록만 보여 줍니다. 게임 플레이에는 영향이 없습니다.
- 계정이 필요 없습니다. 기기마다 익명 라이더 ID(UUID)를 만들어 `localStorage`(`soi-rider:player-id`)에 저장합니다.
- 최고 기록을 갈아치우면 결과 화면에서 자동으로 업로드되고 "최고 기록 등록! 온라인 순위 N위" 토스트가 뜹니다.
  순위 화면을 열 때도 아직 올리지 못한 기록이 있으면 함께 올립니다.

## 1. Supabase 프로젝트 만들기

1. <https://supabase.com> 에 가입하고 **New project**를 만듭니다 (Free 플랜, 리전은 `Southeast Asia (Singapore)` 추천).
2. 프로젝트가 준비되면 **Project Settings → API Keys**(또는 **Connect** 버튼)에서 두 값을 복사합니다.
   - **Project URL**: `https://xxxxxxxx.supabase.co`
   - **Publishable key** `sb_publishable_...`, 또는 예전 방식의 **anon public** key `eyJ...`. 둘 다 됩니다. 공개용 키라서
     클라이언트에 넣어도 되고, 데이터는 아래의 RLS가 지킵니다. `sb_secret_...`나 `service_role` 키는 **절대** 넣지 마세요.

## 2. 테이블 + 함수 만들기 (SQL Editor에 붙여넣고 Run)

```sql
-- 라이더당 최고 기록 1행
create table if not exists public.soi_scores (
  player_id  uuid primary key,
  nickname   text not null check (char_length(nickname) between 1 and 16),
  score      integer not null check (score between 0 and 30000),
  grade      text not null check (grade in ('S','A','B','C','D','F')),
  updated_at timestamptz not null default now()
);
create index if not exists soi_scores_rank_idx on public.soi_scores (score desc, updated_at asc);

-- 읽기는 누구나, 직접 쓰기는 불가 (쓰기는 submit_score 함수로만)
alter table public.soi_scores enable row level security;
drop policy if exists "ranking is public" on public.soi_scores;
create policy "ranking is public" on public.soi_scores for select to anon, authenticated using (true);
grant select on public.soi_scores to anon, authenticated;

-- 기록 제출: 범위 검사 후, 기존 기록보다 높을 때만 갱신
create or replace function public.submit_score(p_player uuid, p_nickname text, p_score integer, p_grade text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  nick text := left(coalesce(nullif(btrim(regexp_replace(p_nickname, '[[:cntrl:]]', '', 'g')), ''), 'RIDER'), 16);
begin
  if p_score is null or p_score < 0 or p_score > 30000 then
    raise exception 'score out of range';
  end if;
  if p_grade not in ('S','A','B','C','D','F') then
    raise exception 'invalid grade';
  end if;
  insert into public.soi_scores (player_id, nickname, score, grade)
  values (p_player, nick, p_score, p_grade)
  on conflict (player_id) do update
    set score = excluded.score, grade = excluded.grade, nickname = excluded.nickname, updated_at = now()
    where excluded.score > soi_scores.score;
end;
$$;

revoke all on function public.submit_score(uuid, text, integer, text) from public;
grant execute on function public.submit_score(uuid, text, integer, text) to anon, authenticated;
```

## 3. 게임에 연결하기

프로젝트 루트(`apps/soi-rider/`)에 `.env.local` 파일을 만듭니다. `.env.example`을 복사하면 됩니다.

```bash
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...   # 또는 eyJ... (anon key)
```

`npm run dev`를 다시 시작하면 순위 화면 상단 상태가 온라인으로 바뀝니다. `.env`와 `.env.local`은 `.gitignore`에 들어
있어서 GitHub에 올라가지 않습니다.

### 배포 빌드 (GitHub Pages 등)

Vite는 빌드할 때 `VITE_*` 값을 번들에 넣습니다. 그래서 **빌드하는 곳에 두 환경 변수가 있어야** 배포판에서도 순위가
켜집니다.

- **로컬에서 빌드해 올리는 경우**: `.env.local`이 있는 상태로 `npm run build`를 실행합니다.
- **GitHub Actions로 빌드하는 경우**: 저장소 **Settings → Secrets and variables → Actions**에 `VITE_SUPABASE_URL`과
  `VITE_SUPABASE_ANON_KEY`를 등록하고, 빌드 단계에 `env:`로 넘겨 줍니다.

## 4. 확인

- Supabase **Table Editor → soi_scores**: 게임에서 최고 기록을 내면 행이 생깁니다.
- 순위 화면은 상위 50명(`BOARD_SIZE`)을 점수 내림차순으로 보여 줍니다. 동점이면 먼저 달성한 사람이 위에 오고, 순위
  숫자는 같습니다. 내 행은 강조되며, 50위 밖이면 왼쪽 "내 기록" 카드에 실제 순위가 나옵니다.
- 네트워크 오류나 6초 이상의 응답 지연은 "순위를 불러오지 못했어요" 상태와 **다시 시도** 버튼으로 표시됩니다.

## 한계 (캐주얼 순위표)

anon 키는 공개 키라서, 마음먹으면 누구나 `submit_score`를 직접 호출해 점수를 꾸며 낼 수 있습니다. 함수가 범위
(0–30000)와 등급 값을 검사하고 라이더당 1행만 허용하지만, **치팅을 완전히 막지는 못합니다.** 상금이 걸린 대회처럼
신뢰가 필요해지면 다음 중 하나를 추가하세요.

- 서버 측 리플레이 검증
- Supabase Auth 로그인 + Edge Function으로 런 결과 서명 검증
- 관리자가 이상한 행을 삭제하는 운영 절차
