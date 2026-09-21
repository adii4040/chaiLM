import "dotenv/config";
import mongoose from "mongoose";
import { Subscription } from "../models/subscription.model.js";

await mongoose.connect(process.env.MONGODB_URI);
console.log("dropped:", await Subscription.syncIndexes());
console.log(await Subscription.collection.indexes());
await mongoose.disconnect();