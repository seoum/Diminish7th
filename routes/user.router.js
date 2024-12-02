import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma/prismaClient.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import Joi from 'joi';

export const userSchema = Joi.object({
  username: Joi.string()
    .pattern(/^[a-z0-9]+$/)
    .min(3)
    .max(30)
    .required()
    .messages({
      'string.pattern.base': '아이디는 소문자와 숫자만 포함되어야 합니다.',
      'string.min': '아이디는 3글자 이상이어야 합니다.',
      'string.max': '아이디는 30글자를 넘을 수 없습니다.',
      'any.required': '아이디를 입력해주세요.',
    }),
  password: Joi.string().min(6).required().messages({
    'string.min': '비밀번호는 6글자 이상이어야 합니다.',
    'any.required': '비밀번호를 입력해주세요.',
  }),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
    'any.only': '비밀번호가 일치하지 않습니다.',
    'any.required': '비밀번호 확인을 입력해주세요.',
  }),
  nickname: Joi.string().required().messages({
    'any.required': '닉네임을 입력해주세요.',
  }),
});

export const loginSchema = Joi.object({
  username: Joi.string().required().messages({
    'any.required': '아이디를 입력해주세요.',
  }),
  password: Joi.string().required().messages({
    'any.required': '비밀번호를 입력해주세요.',
  }),
});

const cashAmountSchema = Joi.object({
  amount: Joi.number().integer().min(100).messages({
    'number.base': '캐시의 양은 숫자여야 합니다.',
    'number.integer': '캐시의 양은 정수여야 합니다.',
    'number.min': '100원 이상 충전해야 합니다.',
  }),
});

const router = express.Router();

// 회원가입 API
router.post('/user/sign-up', async (req, res, next) => {
  try {
    // Joi로 유효성 검증
    const { username, password, confirmPassword, nickname } = await userSchema.validateAsync(
      req.body,
    );

    // 입력된 username과 nickname이 이미 존재하는지 검색
    const existingUser = await prisma.users.findFirst({
      where: {
        OR: [{ username }, { nickname }],
      },
      select: {
        username: true,
        nickname: true,
      },
    });

    if (existingUser) {
      let errorMessage = '';
      if (existingUser.username === username) {
        errorMessage = '이미 존재하는 사용자명입니다.';
      } else if (existingUser.nickname === nickname) {
        errorMessage = '이미 존재하는 닉네임입니다.';
      }
      const error = new Error(errorMessage);
      error.status = 409;
      throw error;
    }

    // 입력된 password는 해시처리되어 DB에 저장
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.users.create({
      data: {
        username,
        password: hashedPassword,
        nickname,
      },
    });

    return res
      .status(201)
      .json({ message: '회원가입이 완료되었습니다.', username: user.username, name: user.name });
  } catch (error) {
    next(error);
  }
});

// 로그인 API
router.post('/user/login', async (req, res, next) => {
  try {
    const { username, password } = await loginSchema.validateAsync(req.body);

    // 유저가 입력한 username이 DB에 존재하는지 검색
    const user = await prisma.users.findUnique({ where: { username } });
    if (!user) {
      const error = new Error('사용자를 찾을 수 없습니다.');
      error.status = 401;
      throw error;
    }

    // 유저가 입력한 password가 DB에 저장된 password와 일치하는지 검사
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      const error = new Error('비밀번호가 일치하지 않습니다.');
      error.status = 401;
      throw error;
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.header('authorization', `Bearer ${token}`);
    res.status(200).json({ message: '로그인 성공', token });
  } catch (error) {
    next(error);
  }
});

router.post('/user/getcash', authMiddleware, async (req, res, next) => {
  try {
    const user = req.user;
    const { amount } = await cashAmountSchema.validateAsync(req.body);

    const updatedUser = await prisma.users.update({
      where: { id: user.id },
      data: {
        cash: { increment: amount },
      },
    });

    return res.status(200).json({
      message: `${amount}캐시 획득`,
      name: updatedUser.nickname,
      cash: updatedUser.cash,
    });
  } catch (error) {
    next(error);
  }
});

export default router;