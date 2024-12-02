import express from 'express';
import ErrorHandlerMiddleware from './middlewares/error-handler.middleware.js';
import LogMiddleware from './middlewares/log.middleware.js';


const app = express();
const PORT = 3000;
app.use(LogMiddleware);
app.use(ErrorHandlerMiddleware);

app.use(express.json());

app.listen(PORT, () => {
  console.log(PORT, '포트로 서버가 열렸어요!');
});
