import app from './src/app.js';
import connectDb from './src/db/db.js';

const PORT = process.env.PORT || 5000;



connectDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

  })
  .catch((err) => {
    console.error("Database connection failed, server starting aborted:", err);
  });