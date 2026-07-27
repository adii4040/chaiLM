import mongoose from 'mongoose';

const connectDb = async () => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}`);
        console.log(`\nMongoDB connected successfully! DB host: ${connectionInstance.connection.host}`);
    } catch (error) {
        console.error('Error connecting to database:', error);
        process.exit(1);
    }
};

export default connectDb;
