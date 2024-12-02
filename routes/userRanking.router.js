import express from 'express';
import { prisma } from '../utils/prisma/prismaClient.js';

const router = express.Router();

// 예시 요청: GET localhost:3000/api/rankings?page=1&limit=5
// 유저 랭킹 조회 API
router.get('/rankings', async (req, res, next) => {
  try {
    // query에서 값을 가져온다.
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // 전체 유저의 수
    const totalUsers = await prisma.users.count();

    // 사용자가 지정한 페이지에 해당되는 유저들을 검색
    const users = await prisma.users.findMany({
      select: {
        nickname: true,
        rating: true,
      },
      orderBy: { rating: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // 유저 랭킹 데이터 생성
    const userRanking = users.map((user, index) => ({
      ranking: (page - 1) * limit + index + 1,
      name: user.nickname,
      rating: user.rating,
    }));

    return res.status(200).json({
      totalUsers: totalUsers,
      totalPages: Math.ceil(totalUsers / limit),
      data: userRanking,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
