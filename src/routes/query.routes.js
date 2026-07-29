import { Router } from 'express';
import { handleQuery } from '../controllers/query.controller.js';
import { verifyJwt } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(verifyJwt);

router.post('/', handleQuery);

export default router;
