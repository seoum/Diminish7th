import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma/prismaClient.js';

export default async function authenticateToken(req, res, next) {
  try {
    //  헤더에 authorization를 저장
     const authHeader = req.headers['authorization'];

     if (!authHeader) throw new Error('토큰이 존재하지 않습니다.');

     const [tokenType, token] = authHeader.split(' ');

    if (tokenType !== 'Bearer') throw new Error('잘못된 토큰 형식입니다.');

    // token에 저장된 userId를 복호화 하여 저장
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decodedToken.userId;

    const user = await prisma.users.findFirst({
     where: { id: parseInt(userId) },
    });

    if (!user) {
      throw new Error('토큰 사용자가 존재하지 않습니다.');
    }

    // 인증된 user를 request의 user에 저장
    req.user = user;

    next();
  } catch (error) {
    // 에러에 따라 다른 에러 메세지 전송
    switch (error.name) {
      case 'TokenExpiredError':
        return res.status(401).json({ message: '토큰이 만료되었습니다.' });
      case 'JsonWebTokenError':
        return res.status(401).json({ message: '토큰이 조작되었습니다.' });
      default:
        return res.status(401).json({ message: error.message ?? '비정상적인 요청입니다.' });
    }
  }
}