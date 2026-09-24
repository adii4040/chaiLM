import { Router } from 'express';
import {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  updateUserProfile,
  changePassword,
} from '../controllers/user.controller.js';
import { verifyJwt } from '../middlewares/auth.middleware.js';

const router = Router();

router.route('/register').post(registerUser);
router.route('/login').post(loginUser);

// Secured Routes
router.route('/logout').post(verifyJwt, logoutUser);
router.route('/@me').get(verifyJwt, getCurrentUser);
router.route('/profile').patch(verifyJwt, updateUserProfile);
router.route('/change-password').post(verifyJwt, changePassword);

export default router;
