import express from 'express';
import { prisma } from '../utils/prisma/prismaClient.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

// 기회 분배 및  득점 확률 계산 함수
function calculateProb(a, b) {
  return a ** 2 / (a ** 2 + b ** 2);
}

// 공격 기회 분배 함수
function allocateAttacks(userA_pass, userB_pass, base_attacks = 5, extra_attacks = 10) {
  let userA_attacks = base_attacks;
  let userB_attacks = base_attacks;

  for (let i = 0; i < extra_attacks; i++) {
    const prob_a = calculateProb(userA_pass, userB_pass);
    if (Math.random() < prob_a) {
      userA_attacks += 1;
    } else {
      userB_attacks += 1;
    }
  }

  return { userA_attacks, userB_attacks };
}

// 득점 시뮬레이션 함수
function simulateGoals(
  userA_shoot,
  userB_defense,
  userA_attacks,
  userB_shoot,
  userA_defense,
  userB_attacks,
) {
  let userA_goals = 0;
  let userB_goals = 0;

  for (let i = 0; i < userA_attacks; i++) {
    const prob_a_goal = calculateProb(userA_shoot, userB_defense);
    if (Math.random() < prob_a_goal) {
      userA_goals += 1;
    }
  }

  for (let i = 0; i < userB_attacks; i++) {
    const prob_b_goal = calculateProb(userB_shoot, userA_defense);
    if (Math.random() < prob_b_goal) {
      userB_goals += 1;
    }
  }

  return { userA_goals, userB_goals };
}

async function getUserStats(userId) {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    include: { squad: { include: { player1: true, player2: true, player3: true } } },
  });

  if (!user) {
    return null;
  }
  // 각 유저의 미드필더, 공격수, 수비수 스탯 추출
  const stats = {
    midfielder_pass: user.squad?.player2?.pass || 0,
    attacker_shoot: user.squad?.player1?.shoot || 0,
    defender_defense: user.squad?.player3?.defense || 0,
  };

  return stats;
}

async function playMatch(userAid, userBid) {
  const userA = await getUserStats(userAid);
  const userB = await getUserStats(userBid);

  if (!userA || !userB) {
    const error = new Error('유저가 발견되지 않았습니다.');
    error.status = 404;
    return error;
  }

  // Step 1: 공격 기회 분배
  const { userA_attacks, userB_attacks } = allocateAttacks(
    userA.midfielder_pass,
    userB.midfielder_pass,
  );

  // Step 2: 득점 시뮬레이션
  const { userA_goals, userB_goals } = simulateGoals(
    userA.attacker_shoot,
    userB.defender_defense,
    userA_attacks,
    userB.attacker_shoot,
    userA.defender_defense,
    userB_attacks,
  );

  // Step 3: 레이팅 변경 값 설정
  const winRatingChange = 10;
  const loseRatingChange = -10;

  // 승리 여부에 따라 레이팅 변경 설정
  const ratingChangeA = userA_goals > userB_goals ? winRatingChange : loseRatingChange;
  const ratingChangeB = userB_goals > userA_goals ? winRatingChange : loseRatingChange;

  // Step 4: 사용자 레이팅 업데이트
  await prisma.users.update({
    where: { id: userAid },
    data: {
      rating: {
        increment: ratingChangeA,
      },
    },
  });

  await prisma.users.update({
    where: { id: userBid },
    data: {
      rating: {
        increment: ratingChangeB,
      },
    },
  });

  // Step 5: 경기 결과 저장
  const matchLog = await prisma.matchLog.create({
    data: {
      userA: { connect: { id: userAid } },
      userB: { connect: { id: userBid } },
      scoreA: userA_goals,
      scoreB: userB_goals,
      RatingChangeA: ratingChangeA, // 레이팅 변경
      RatingChangeB: ratingChangeB,
    },
  });

  return { matchLog };
}
// 경기를 시뮬레이션하는 API 엔드포인트
router.post('/play', authMiddleware, async (req, res, next) => {
  const { userBid } = req.body;

  // 상대 유저 ID 검증
  if (typeof userBid !== 'number') {
    return res.status(400).json({ error: '유저 ID는 숫자여야 합니다.' });
  }

  try {
    const userAid = req.user.id; // JWT로 인증된 유저의 ID
    const result = await playMatch(userAid, userBid);

    if (result instanceof Error) {
      throw result; // 결과가 에러 객체라면 throw
    }

    return res.status(200).json({
      message: '경기가 끝났습니다.',
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

// 유저를 매칭해서 대결하는 API
router.post('/play/matchmaking', authMiddleware, async (req, res, next) => {
  try {
    // todo: 인증 정보에서 유저 정보 가져오기
    const user = req.user;

    let opponent = null;
    let currentRange = 10;
    const extendRange = 10;
    const maxRange = 100;

    // 처음엔 +-10부터 시작해서 10씩 점차 늘려나가면서 검색
    // 최대 +-100까지 검색한 후 없다면 매치 실패를 리턴
    while (!opponent && currentRange <= maxRange) {
      opponent = await prisma.users.findMany({
        where: {
          AND: [
            { rating: { gte: user.rating - currentRange } },
            { rating: { lte: user.rating + currentRange } },
            { id: { not: user.id } },
          ],
        },
        orderBy: { rating: 'desc' },
      });

      // 찾은 범위의 유저들 중 하나만 랜덤으로 선택
      if (opponent.length > 0) {
        opponent = opponent[Math.floor(Math.random() * opponent.length)];
      } else {
        opponent = null;
        currentRange += extendRange;
      }
    }

    if (!opponent) {
      return res.status(404).json({ error: '상대를 찾을 수 없습니다.' });
    }

    // 유저 경기 시뮬레이션
    const result = await playMatch(user.id, opponent.id);

    if (result instanceof Error) {
      throw result; // 결과가 에러 객체라면 throw
    }

    return res.json({
      message: '경기가 끝났습니다.',
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
