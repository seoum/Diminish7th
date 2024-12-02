import express from 'express';
import { prisma } from '../utils/prisma/prismaClient.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import Joi from 'joi';

const router = express.Router();

const teamComposeSchema = Joi.object({
  player1Id: Joi.number().integer().required(),
  player2Id: Joi.number().integer().required(),
  player3Id: Joi.number().integer().required(),
}).messages({
  'any.required': '{{#label}}는 필수 입력 항목입니다.',
  'number.base': '{{#label}}는 숫자여야 합니다.',
  'number.integer': '{{#label}}는 정수여야 합니다.',
});

// 스쿼드 조회 함수
async function getUserSquad(userId) {
  try {
    // userId로 유저와 스쿼드 정보 조회
    const user = await prisma.users.findUnique({
      where: {
        id: parseInt(userId),
      },
      include: {
        squad: {
          include: {
            player1: true,
            player2: true,
            player3: true,
          },
        },
      },
    });

    // 정보 없을 경우 처리
    if (!user || !user.squad) {
      console.log('유저 또는 스쿼드를 찾을 수 없습니다.');
      return null;
    }

    // 스쿼드 정보 반환
    const squadPlayers = [
      { id: user.squad.player1?.id, name: user.squad.player1?.playername },
      { id: user.squad.player2?.id, name: user.squad.player2?.playername },
      { id: user.squad.player3?.id, name: user.squad.player3?.playername },
    ];

    console.log({ players: squadPlayers });
    return squadPlayers;
  } catch (error) {
    console.error('오류가 발생했습니다: ', error);
    return null;
  }
}

router.get('/teams/:userId', async (req, res) => {
  const { userId } = req.params; //userId 받아오기

  // 함수호출
  const squadPlayers = await getUserSquad(userId);

  if (!squadPlayers) {
    return res.status(404).json({ message: '유저 또는 스쿼드를 찾을 수 없습니다.' });
  }

  return res.json({ players: squadPlayers });
});

router.post('/teams', authMiddleware, async (req, res, next) => {
  try {
    const user = req.user;
    const { player1Id, player2Id, player3Id } = await teamComposeSchema.validateAsync(req.body);

    const playerIds = [player1Id, player2Id, player3Id];
    if (new Set(playerIds).size !== playerIds.length) {
      return res.status(400).json({ message: '중복된 선수를 선택할 수 없습니다.' });
    }

    const userCards = await prisma.userCard.findMany({
      where: {
        AND: [{ userid: user.id }, { id: { in: playerIds } }],
      },
      select: {
        id: true,
        playername: true,
      },
    });

    // userCards에 존재하지 않는 playerIds를 찾아서 반환
    const foundCardIds = userCards.map((card) => card.id);
    const missingPlayerIds = playerIds.filter((id) => !foundCardIds.includes(id));

    if (missingPlayerIds.length > 0) {
      return res.status(404).json({
        message: '선택된 선수가 존재하지 않습니다.',
        missingPlayers: missingPlayerIds.join(', '),
      });
    }

    // Squad가 존재했다면 update, 존재하지 않았다면 create
    const updatedSquad = await prisma.squad.upsert({
      where: { userid: user.id },
      update: {
        player1Id,
        player2Id,
        player3Id,
      },
      create: {
        userid: user.id,
        player1Id,
        player2Id,
        player3Id,
      },
    });

    // 응답 데이터 생성
    const response = {
      message: '팀 구성이 완료되었습니다.',
      squad: {
        userid: updatedSquad.userid, // upsert된 데이터에서 가져오기
        player1Id: updatedSquad.player1Id,
        player2Id: updatedSquad.player2Id,
        player3Id: updatedSquad.player3Id,
      },
    };

    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
