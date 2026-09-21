import Razorpay from "razorpay";
import { config } from "../config/env.js";

export const razorpay = new Razorpay({
    key_id: config.razorpay.keyId,
    key_secret: config.razorpay.keySecret,
});