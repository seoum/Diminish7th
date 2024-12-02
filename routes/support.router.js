import express from 'express';
import { prisma } from '../utils/prisma/prismaClient.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

async function statUpdate(userId, position) {
  const userSquad = await prisma.squad.findUnique({
    where: { userid: userId },
    include: {
      player1: true, // FW
      player2: true, // MF
      player3: true, // DF
    },
  });

  // 지원된 포지션이 있는지 체크
  if (userSquad.supportUsed) {
    throw new Error('이미 지원된 포지션이 있습니다. 더 이상 다른 포지션에 지원할 수 없습니다.');
  }

  // 포지션에 따라 스탯 업데이트
  switch (position) {
    case 'FW':
      await prisma.squad.update({
        where: { userid: userId },
        data: {
          player1: {
            update: {
              shoot: { increment: 2 },
            },
          },
          supportUsed: true, // 지원된 포지션 표시
        },
      });
      break;

    case 'MF':
      await prisma.squad.update({
        where: { userid: userId },
        data: {
          player2: {
            update: {
              pass: { increment: 2 },
            },
          },
          supportUsed: true, // 지원된 포지션 표시
        },
      });
      break;

    case 'DF':
      await prisma.squad.update({
        where: { userid: userId },
        data: {
          player3: {
            update: {
              defense: { increment: 2 },
            },
          },
          supportUsed: true, // 지원된 포지션 표시
        },
      });
      break;

    default:
      throw new Error('잘못된 포지션입니다.');
  }
}

// 지원 API 
router.post('/support/:position', authMiddleware, async (req, res, next) => {
  const { position } = req.params;
  const userId = req.user.id; // JWT로 인증된 유저 ID

  try {
    // 포지션 확인 및 스탯 업데이트
    await statUpdate(userId, position);
    return res.status(200).json({ message: `스탯이 성공적으로 증가했습니다: ${position}` });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

export default router;
