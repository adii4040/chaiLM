import { Router } from 'express';
import { handleQuery } from '../controllers/query.controller.js';
import { verifyJwt } from '../middlewares/auth.middleware.js';
import { checkQueryLimit } from '../middlewares/entitlement.middleware.js';

const router = Router();

router.use(verifyJwt);

router.post('/', checkQueryLimit, handleQuery);

export default router;
