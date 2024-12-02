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
