import { ethers } from "ethers";
import * as dotenv from "dotenv";
import mongoose from "mongoose";
import { PoolModel } from "../models/pool.model";
import { ABI } from "../abis";

dotenv.config();

const RPC_URL = process.env.RPC_URL!;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS!;
const MONGO_URI = process.env.MONGO_URI!;

// ABI rút gọn chỉ cần PoolCreated

// Khởi tạo provider và contract
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

// Lắng nghe sự kiện
export async function trackingEvent() {
  contract.on(
    "PoolCreated",
    async (
      poolId: ethers.BigNumber,
      tokenAddress: string,
      tokenName: string,
      requiredAmount: ethers.BigNumber,
      endTime: ethers.BigNumber
    ) => {
      console.log(`📥 New PoolCreated event: poolId=${poolId.toString()}`);

      const poolData = {
        poolId: poolId.toNumber(),
        token: tokenAddress,
        tokenName,
        requiredAmount: requiredAmount.toString(),
        endTime: new Date(endTime.toNumber() * 1000),
      };

      try {
        await PoolModel.create(poolData);
        console.log(`✅ Pool saved: ID ${poolData.poolId}`);
      } catch (error) {
        console.error("❌ Error saving pool:", error);
      }
    }
  );
}

export async function getPastPoolCreatedEvents(fromBlock: number, toBlock: number | string) {
  console.log(`🔍 Fetching events from block ${fromBlock} to ${toBlock}...`);

  try {
    const filter = contract.filters.PoolCreated(); // Bạn có thể thay bằng tên event khác nếu cần
    const logs = await contract.queryFilter(filter, fromBlock, toBlock);

    const events = logs.map(log => ({
      poolId: log.args?.poolId.toString(),
      tokenAddress: log.args?.tokenAddress,
      tokenName: log.args?.tokenName,
      requiredAmount: log.args?.requiredAmount.toString(),
      endTime: new Date(log.args?.endTime.toNumber() * 1000),
      blockNumber: log.blockNumber,
      txHash: log.transactionHash
    }));

    console.log(`✅ Found ${events.length} event(s):`);
    // console.table(events);
    console.log(events)

    // save pool to MongoDB
    for (const event of events) {
      const poolData = {
        poolId: parseInt(event.poolId),
        token: event.tokenAddress,
        tokenName: event.tokenName,
        requiredAmount: event.requiredAmount,
        endTime: event.endTime,
        blockNumber: event.blockNumber,
        txHash: event.txHash,
        createdAt: new Date(),
      };
      try {
        await PoolModel.findOneAndUpdate({ poolId: poolData.poolId }, poolData, { upsert: true });
        console.log(`✅ Pool saved: ID ${poolData.poolId}`);
      } catch (error) {
        console.error("❌ Error saving pool:", error);
      }
    }
    console.log(`✅ Saved ${events.length} event(s) to MongoDB`);

    return events;
  } catch (err) {
    console.error("❌ Error fetching events:", err);
    return [];
  }
}