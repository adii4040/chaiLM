import { config } from '../config/env.js';
import { v2 as cloudinary } from 'cloudinary';
import { promises as fs } from "fs";

// Configuration
cloudinary.config({
    cloud_name: config.cloudinary.cloud_name,
    api_key: config.cloudinary.api_key,
    api_secret: config.cloudinary.api_secret
});

/**
 * Uploads a local file to Cloudinary and deletes the temporary local file afterwards.
 * @param {string} localfilePath - Local path to the temporary file.
 * @returns {Promise<Object|null>} Cloudinary upload response object or null on failure.
 */
const uploadOnCloudinary = async (localfilePath) => {
    if (!localfilePath) {
        console.log('No file to upload on Cloudinary');
        return null;
    }

    try {
        const uploadResponse = await cloudinary.uploader.upload(localfilePath, {
            secure: true,
            folder: "chaiLM",
            resource_type: "auto",
            use_filename: true,
            unique_filename: false,
        });

        return uploadResponse;
    } catch (error) {
        console.error(`Cloudinary Upload Unsuccessful: ${error}`);
        return null;
    } finally {
        // Always attempt to delete local temporary upload.
        try {
            await fs.unlink(localfilePath);
        } catch (unlinkError) {
            if (unlinkError?.code !== 'ENOENT') {
                console.log(`Could not delete temporary file ${localfilePath}: ${unlinkError.message}`);
            }
        }
    }
};

export { uploadOnCloudinary };
