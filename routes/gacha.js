import express from 'express';
import { prisma } from '../utils/prisma/prismaClient.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

// 가챠 비용 설정
const gachaCostPerCard = 100; // 1장당 가챠 비용

// 가챠 실행
router.post('/gacha', authMiddleware, async (req, res) => {
    const { numDraws } = req.body;  // 몇 장을 뽑을 것인지
    const user = req.user; // 인증된 유저 정보

    // 기본값 설정: 1회 또는 10회
    let draws = parseInt(numDraws) || 1; // 기본값 1
    if (draws < 1 || draws > 10) draws = 10; // 1~10회 사이로 제한

    const totalCost = draws * gachaCostPerCard;

    try {
        // 골드 부족 체크
        if (user.cash < totalCost) {
            return res.status(400).json({ error: '골드가 부족합니다.' });
        }

        // 골드 차감
        const updatedUser = await prisma.users.update({
            where: { id: user.id },
            data: { cash: { decrement: totalCost } },
        });

        // 전체 BaseCard에서 무작위로 카드를 뽑음
        const baseCards = await prisma.BaseCard.findMany();
        let newCards = [];

        for (let i = 0; i < draws; i++) {
            const randomIndex = Math.floor(Math.random() * baseCards.length);
            const drawnBaseCard = baseCards[randomIndex];

            // 새로운 UserCard 생성 및 stat 정보 저장
            const newCard = await prisma.userCard.create({
                data: {
                    playername: drawnBaseCard.playername,
                    position: drawnBaseCard.position,
                    userid: user.id,
                    speed: drawnBaseCard.speed,
                    shoot: drawnBaseCard.shoot,
                    pass: drawnBaseCard.pass,
                    defense: drawnBaseCard.defense,
                },
            });

            // UserCard를 Storage에 추가
            await prisma.storage.create({
                data: {
                    user: { connect: { id: user.id } },
                    card: { connect: { id: newCard.id } },
                },
            });

            newCards.push(newCard);
        }

        res.json({ success: true, newCards, remainingCash: updatedUser.cash });
    } catch (error) {
        res.status(500).json({ error: '가챠 실행 중 오류가 발생했습니다.' });
    }
});

export default router;
