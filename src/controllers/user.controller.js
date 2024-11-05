import { asyncHandler } from "../utils/asyncHandler.js";
 import{ApiError} from "../utils/ApiError.js"
 import { User } from "../models/user.model.js";
 import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser= asyncHandler(async(req,res)=>{
   // get details from frnt
   
   // validation-not empty
   // check if user already exists
   // check for images
   // check for avatar
   //upload them to cloudinary
   // create user object- create entry in db
   // remove password and refresh token field
   //check for user creation
   // return response
const {fullName,username,email,password}=req.body

if(
    [fullName,email,username,password].some((field)=>
    field?.trim()==="")
){
throw new ApiError(400,"all fields are required")
}

const existedUser = await User.findOne({
    $or:[{email},{username}]
})
if(existedUser){
    throw new ApiError(409,"user already exist")
}

const avatarLocalPath= req.files?.avatar[0]?.path
const coverImageLocalPath= req.files?.coverImage[0]?.path
if(!avatarLocalPath){
    throw new ApiError(400,"avatar is required")
}
const avatar= await uploadOnCloudinary(avatarLocalPath)
const coverImage =await uploadOnCloudinary(coverImageLocalPath)
if(!avatar){
    throw new ApiError(400,"avatar is compulsory")
}
const user= await User.create({
    fullName,
    avatar:avatar.url,
    coverImage:coverImage.url || "", 
    email,
    password,
    username: username.toLowerCase()

})
const createdUser= await User.findById(user._id).select(
    "-password -refreshToken"
)
if(!createdUser){
    throw new ApiError(500,"something went wrong while registering the user")
}

return res.status(201).json(
    new ApiResponse(200,createdUser,"user registered succesfully")
)

})

export{registerUser}