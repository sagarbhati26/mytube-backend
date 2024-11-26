import mongoose ,{Schema} from "mongoose";

const subscriptionSchema = new Schema({
 subscriber:{
    type:Schema.Types.ObjectId, //one who is subscribing
    ref:"User"
 },
 channel:{
    type:Schema.Types.ObjectId, //one who got subscribed
    ref:"User"
 }
},{timestamps:true})


export const Subscription = mongoose.model("subscription",subscriptionSchema)