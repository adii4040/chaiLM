import { Router } from 'express';
import { handleQuery } from '../controllers/query.controller.js';

const router = Router();

router.post('/', handleQuery);

export default router;
