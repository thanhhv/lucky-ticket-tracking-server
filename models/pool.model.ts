import mongoose, { Schema, Document } from "mongoose";

export interface IPool extends Document {
  poolId: number;
  token: string;
  tokenName: string;
  requiredAmount: string;
  endTime: Date | null;
  status: "active" | "inactive"; 
  isFinished: boolean; 
  finishedAt?: Date | null; 
  winner?: string | null; 
  prizeReward?: string | null; 
  distributedRewardAt?: Date | null;
  blockNumber?: number;
  txHash?: string;
  createdAt?: Date;
  updatedAt?: Date; 
}

const poolSchema = new Schema<IPool>(
  {
    poolId: { type: Number, required: true, unique: true, index: true },
    token: { type: String, required: true },
    tokenName: { type: String, required: true },
    requiredAmount: { type: String, required: true },
    endTime: { type: Date, required: true },
    status: { type: String, enum: ["active", "inactive"], default: "active", index: true }, 
    isFinished: { type: Boolean, default: false, index: true },
    finishedAt: { type: Date, default: null }, 
    winner: { type: String, default: null, index: true },
    prizeReward: { type: String, default: null }, 
    distributedRewardAt: { type: Date, default: null }, 
    blockNumber: { type: Number },
    txHash: { type: String },
  },
  { timestamps: true } 
);

// Ensure the unique index is still there if needed, though poolId is already unique
poolSchema.index({ poolId: 1 }, { unique: true }); // This is redundant if poolId has unique: true

export const PoolModel = mongoose.model<IPool>("Pool", poolSchema);

