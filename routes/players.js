import express from 'express';
import { prisma } from '../utils/prisma/prismaClient.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

// 사용자가 보유한 카드 목록 조회
router.get('/cards', authMiddleware, async (req, res) => {
    const user = req.user;  // 인증된 유저 정보
    
    try {
        const userCards = await prisma.storage.findMany({
            where: { userid: user.id },
            include: {
                card: true, // UserCard 정보를 함께 불러옴
            },
        });

        if (!userCards) {
            return res.status(404).json({ error: '보유한 카드를 찾을 수 없습니다.' });
        }

        res.json({ ownedCards: userCards });
    } catch (error) {
        res.status(500).json({ error: '보유 카드 목록을 불러오는 데 실패했습니다.' });
    }
});

export default router;
