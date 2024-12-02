import express from 'express';
import { prisma } from '../utils/prisma/prismaClient.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import Joi from 'joi';

const playerIdSchema = Joi.object({
  playerId: Joi.number().integer().required().messages({
    'number.base': '플레이어 아이디는 숫자여야 합니다.',
    'number.integer': '플레이어 아이디는 정수여야 합니다.',
    'any.required': '플레이어 아이디를 입력해주세요.',
  }),
});

const router = express.Router();

// 게임에 존재하는 전체 선수의 목록
router.get('/players/base', async (req, res, next) => {
  try {
    const basePlayers = await prisma.baseCard.findMany();

    const response = basePlayers.map((player) => ({
      id: player.id,
      playername: player.playername,
      position: player.position,
      shoot: player.shoot,
      pass: player.pass,
      defence: player.defense,
    }));

    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// 플레이어가 소유한 선수 목록
router.get('/players/users', authMiddleware, async (req, res, next) => {
  try {
    const user = req.user;

    const players = await prisma.userCard.findMany({
      where: { userid: user.id },
      select: {
        id: true,
        playername: true,
        position: true,
        level: true,
      },
    });

    const response = players.map((player) => ({
      id: player.id,
      playername: player.playername,
      position: player.position,
      level: player.level,
    }));

    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

// 선수 정보 상세 조회
router.get('/players/users/:playerId', async (req, res, next) => {
  try {
    const { playerId } = await playerIdSchema.validateAsync(req.params);

    const player = await prisma.userCard.findUnique({
      where: { id: playerId },
      include: { user: true },
    });

    if (!player) {
      const error = new Error('선수를 찾을 수 없습니다.');
      error.status = 404;
      throw error;
    }

    const response = {
      id: player.id,
      owner: player.user.nickname,
      playername: player.playername,
      position: player.position,
      level: player.level,
      shoot: player.shoot,
      pass: player.pass,
      defense: player.defense,
    };

    return res.status(200).json(response);
  } catch (err) {
    next(err);
  }
});

export default router;
