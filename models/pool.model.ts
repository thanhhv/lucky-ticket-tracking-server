import mongoose from "mongoose";

export interface IPool {
  poolId: number;
  token: string;
  tokenName: string;
  requiredAmount: string;
  endTime: Date;
  blockNumber?: number;
  txHash?: string;
  createdAt?: Date;
  status: string
}

const poolSchema = new mongoose.Schema<IPool>(
  {
    poolId: { type: Number, required: true, unique: true },
    token: { type: String, required: true },
    tokenName: { type: String, required: true },
    requiredAmount: { type: String, required: true },
    endTime: { type: Date, required: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true }
);

poolSchema.index({ poolId: 1 }, { unique: true });
export const PoolModel = mongoose.model<IPool>("Pool", poolSchema);
