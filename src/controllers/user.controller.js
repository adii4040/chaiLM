import User from '../models/user.model.js';

const isProduction = process.env.NODE_ENV === 'production';

const cookieOption = {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  partitioned: true,
};

const generateRefreshAndAccessToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    console.error(error);
    throw new Error('Something went wrong while generating access token and refresh token');
  }
};

const registerUser = async (req, res) => {
  try {
    const { fullname, email, password } = req.body;

    if (
      !fullname ||
      !email ||
      !password ||
      fullname.trim() === '' ||
      email.trim() === '' ||
      password.trim() === ''
    ) {
      return res.status(400).json({ error: 'All fields are required!!' });
    }

    const existedUser = await User.findOne({ email });
    if (existedUser) {
      return res.status(409).json({ error: 'User already exists!' });
    }

    const user = await User.create({
      fullname,
      email,
      password,
    });

    if (!user) {
      return res.status(400).json({ error: 'User not registered!!' });
    }

    const createdUser = await User.findById(user._id).select('-password -refreshToken');

    return res.status(201).json({
      success: true,
      user: createdUser,
      message: 'User registered successfully!',
    });
  } catch (error) {
    console.error('Error in registerUser:', error);
    return res.status(500).json({ error: error.message || 'Something went wrong during registration' });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User doesn't exist" });
    }

    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Password is incorrect!' });
    }

    const { accessToken, refreshToken } = await generateRefreshAndAccessToken(user._id);

    const loggedinUser = await User.findById(user._id).select('-password -refreshToken');

    return res
      .status(200)
      .cookie('accessToken', accessToken, cookieOption)
      .cookie('refreshToken', refreshToken, cookieOption)
      .json({
        success: true,
        user: loggedinUser,
        message: 'User logged in successfully',
      });
  } catch (error) {
    console.error('Error in loginUser:', error);
    return res.status(500).json({ error: error.message || 'Something went wrong during login' });
  }
};

const logoutUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.user?._id,
      {
        $unset: { refreshToken: '' },
      },
      {
        returnDocument: 'after',
      }
    );

    const clearOptions = {
      ...cookieOption,
      maxAge: 0,
      expires: new Date(0),
    };

    return res
      .status(200)
      .clearCookie('accessToken', cookieOption)
      .clearCookie('refreshToken', cookieOption)
      .json({
        success: true,
        message: 'User logged out successfully!',
      });
  } catch (error) {
    console.error('Error in logoutUser:', error);
    return res.status(500).json({ error: error.message || 'Something went wrong during logout' });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: req.user,
      message: 'Successfully fetched the current user!',
    });
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    return res.status(500).json({ error: error.message || 'Something went wrong fetching current user' });
  }
};

export { registerUser, loginUser, logoutUser, getCurrentUser };
