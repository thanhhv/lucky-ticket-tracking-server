import mongoose, { Schema, Document } from 'mongoose';

export interface IUserPoolDeposit extends Document {
  poolId: string;
  participantAddress: string;
  amount: string; // Assuming amount is a BigNumber string, adjust type if needed
  createdAt: Date;
  updatedAt: Date;
}

const UserPoolDepositSchema: Schema = new Schema(
  {
    poolId: { type: String, required: true, index: true },
    participantAddress: { type: String, required: true, index: true },
    amount: { type: String, required: true },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

// Optional: Compound index if queries often involve both fields
// UserPoolDepositSchema.index({ poolId: 1, participantAddress: 1 });

export default mongoose.model<IUserPoolDeposit>('UserPoolDeposit', UserPoolDepositSchema);

