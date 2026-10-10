import { Router } from "express";
import { createOrder, verifyPayment } from "../controllers/payment.controller.js";

const router = Router();

// Order creation endpoint
router.post("/create-order", createOrder);

// Payment signature verification endpoint
router.post("/verify-payment", verifyPayment);
router.post("/verify", verifyPayment);

export default router;
