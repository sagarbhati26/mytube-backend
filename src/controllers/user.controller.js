import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access tokens"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { fullName, username, email, password } = req.body;

  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ email }, { username }],
  });
  if (existedUser) {
    throw new ApiError(409, "User already exists");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;
  let coverImageLocalPath;
  if (req.files?.coverImage?.length > 0) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = coverImageLocalPath
    ? await uploadOnCloudinary(coverImageLocalPath)
    : null;

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage ? coverImage.url : "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;
  if (!username && !email) {
    throw new ApiError(400, "Username or email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordCorrect = await user.isPasswordCorrect(password);
  if (!isPasswordCorrect) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.body._id,
    { $set: { refreshToken: undefined } },
    { new: true }
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);
    if (!user || incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "Invalid or expired refresh token");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
      user._id
    );

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(500, "Failed to refresh access token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => { 
  const { oldPassword, newPassword, confirmPassword } = req.body;

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!(newPassword === confirmPassword)) {
    throw new ApiError(401, "password did not match");
  }
  if (!isPasswordCorrect) {
    throw new ApiError(400, "invalid old password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: true });
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed succesfully"));
});
const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(200, req.user, "current user fetched succesfully");
});

const updateAccountDetail=asyncHandler(async(req,res)=>{
  const {fullName,email}= req.body

  if (!fullName || !email) {
    throw new ApiError(401,"all fields are required")
    
  }

 const user= User.findByIdAndUpdate(req.user?._id,
    {
       $set:{
        fullName,
        email
       } 
    },
    {new:true}
  ).select("-password -refreshToken")

  return res.status(200)
  .json(new ApiResponse(200,user,"account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    try {
      // Check if avatar file exists
      const avatarLocalPath = req.files?.avatar?.[0]?.path;
      if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar is missing");
      }
  
      // Upload avatar to Cloudinary
      const uploadedAvatar = await uploadOnCloudinary(avatarLocalPath);
  
      // Update user's avatar URL in the database
      const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        { $set: { avatar: uploadedAvatar.url } },
        { new: true } // Return the updated document
      ).select("-password -refreshToken");
  
      if (!updatedUser) {
        throw new ApiError(404, "User not found");
      }
  
      // Return the updated user details
      return res
        .status(200)
        .json(new ApiResponse(200, updatedUser, "User avatar updated successfully"));
    } catch (error) {
      throw new ApiError(500, error.message || "Failed to update user avatar");
    }
  });

const updateCoverImage=asyncHandler(async(req,res)=>{
   try {
     const coverImageLocalPath= req.file?.coverImage?.[0]?.path
 if (!coverImageLocalPath) {
     throw new ApiError(400,"Cover Image is missing")
     
 }
 const uploadedCoverImage= await uploadOnCloudinary(coverImageLocalPath)
 
 const updatedUser = User.findByIdAndUpdate(req.user?._id,{
 $set:{coverImage:uploadedCoverImage.url}
 },{
     new:true
 }).select("-password -refreshToken")
 if(!updatedUser){
     throw new ApiError(404,"user not found")
 }
 return res.
 status(200)
 .json(new ApiResponse(200,updatedUser,"User cover image uploaded"))
   } catch (error) {
    throw new ApiError(500,error.message,"failed to update cover image")
   }
})
  
export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetail,
  updateUserAvatar,
  updateCoverImage
};
