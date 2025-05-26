import { ethers } from "ethers";
import * as dotenv from "dotenv";
import mongoose from "mongoose";
import { PoolModel, IPool } from "../models/pool.model"; 
import UserPoolDeposit, { IUserPoolDeposit } from '../models/user-pool-deposites.model'; 
import { ABI } from "../abis";

dotenv.config();

const RPC_URL = process.env.RPC_URL!;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS!;

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

export async function trackingEvent() {
  console.log("Starting event listeners...");

  contract.on(
    "PoolCreated",
    async (
      poolId: ethers.BigNumber,
      tokenAddress: string,
      tokenName: string,
      requiredAmount: ethers.BigNumber,
      endTime: ethers.BigNumber,
      event // Raw event object for block timestamp
    ) => {
      console.log(`[LIVE] 📥 New PoolCreated event: poolId=${poolId.toString()}`);
      const block = await event.getBlock();
      const eventTimestamp = new Date(block.timestamp * 1000);

      const poolData: Partial<IPool> = {
        poolId: poolId.toNumber(),
        token: tokenAddress,
        tokenName,
        requiredAmount: requiredAmount.toString(),
        endTime: new Date(endTime.toNumber() * 1000),
        isFinished: false,
        status: "active",
        winner: null,
        prizeReward: null,
        distributedRewardAt: null,
        finishedAt: null,
        blockNumber: event.blockNumber,
        txHash: event.transactionHash,
      };

      try {
        await PoolModel.findOneAndUpdate({ poolId: poolData.poolId }, poolData, { upsert: true, new: true, setDefaultsOnInsert: true });
        console.log(`[LIVE] ✅ Pool saved/updated: ID ${poolData.poolId}`);
      } catch (error) {
        console.error(`[LIVE] ❌ Error saving/updating pool ${poolData.poolId}:`, error);
      }
    }
  );

  contract.on(
    "Deposited",
    async (
      poolId: ethers.BigNumber,
      participant: string,
      amount: ethers.BigNumber,
      event // Raw event object
    ) => {
      console.log(`[LIVE] 📥 New Deposited event: poolId=${poolId.toString()}, participant=${participant}, amount=${amount.toString()}`);

      const depositData: Partial<IUserPoolDeposit> = {
        poolId: poolId.toString(),
        participantAddress: participant,
        amount: amount.toString(),
        // Add txHash and logIndex for potential future idempotency checks if needed
        // txHash: event.transactionHash,
        // logIndex: event.logIndex,
      };

      try {
        // Using create for live events as per original implementation
        await UserPoolDeposit.create(depositData);
        console.log(`[LIVE] ✅ Deposit saved for pool ${depositData.poolId} by ${depositData.participantAddress}`);
      } catch (error) {
        console.error(`[LIVE] ❌ Error saving deposit for pool ${depositData.poolId}:`, error);
      }
    }
  );

  contract.on(
    "PoolFinished",
    async (
      poolId: ethers.BigNumber,
      event // Raw event object for block timestamp
    ) => {
      console.log(`[LIVE] 📥 New PoolFinished event: poolId=${poolId.toString()}`);
      const block = await event.getBlock();
      const eventTimestamp = new Date(block.timestamp * 1000);
      const poolIdNumber = poolId.toNumber();

      try {
        const updatedPool = await PoolModel.findOneAndUpdate(
          { poolId: poolIdNumber },
          {
            $set: {
              status: "inactive",
              isFinished: true,
              finishedAt: eventTimestamp,
            },
          },
          { new: true }
        );

        if (updatedPool) {
          console.log(`[LIVE] ✅ Pool ${poolIdNumber} status updated to inactive.`);
        } else {
          console.warn(`[LIVE] ⚠️ Pool ${poolIdNumber} not found for PoolFinished event.`);
        }
      } catch (error) {
        console.error(`[LIVE] ❌ Error updating pool ${poolIdNumber} for PoolFinished event:`, error);
      }
    }
  );

  contract.on(
    "PrizeDistributed",
    async (
      poolId: ethers.BigNumber,
      winner: string,
      prizeAmount: ethers.BigNumber,
      event // Raw event object for block timestamp
    ) => {
      console.log(`[LIVE] 📥 New PrizeDistributed event: poolId=${poolId.toString()}, winner=${winner}, prizeAmount=${prizeAmount.toString()}`);
      const block = await event.getBlock();
      const eventTimestamp = new Date(block.timestamp * 1000);
      const poolIdNumber = poolId.toNumber();

      try {
        const updatedPool = await PoolModel.findOneAndUpdate(
          { poolId: poolIdNumber },
          {
            $set: {
              winner: winner,
              prizeReward: prizeAmount.toString(),
              distributedRewardAt: eventTimestamp,
            },
          },
          { new: true }
        );

        if (updatedPool) {
          console.log(`[LIVE] ✅ Pool ${poolIdNumber} updated with prize distribution info.`);
        } else {
          console.warn(`[LIVE] ⚠️ Pool ${poolIdNumber} not found for PrizeDistributed event.`);
        }
      } catch (error) {
        console.error(`[LIVE] ❌ Error updating pool ${poolIdNumber} for PrizeDistributed event:`, error);
      }
    }
  );

  contract.on(
    "WinnerSelected",
    async (
      poolId: ethers.BigNumber,
      winner: string,
      prizeAmount: ethers.BigNumber,
      event // Raw event object
    ) => {
      console.log(`[LIVE] 📥 New WinnerSelected event: poolId=${poolId.toString()}, winner=${winner}, prizeAmount=${prizeAmount.toString()}`);
      const poolIdNumber = poolId.toNumber();

      try {
        const updatedPool = await PoolModel.findOneAndUpdate(
          { poolId: poolIdNumber },
          {
            $set: {
              winner: winner,
              prizeReward: prizeAmount.toString(),
            },
          },
          { new: true }
        );

        if (updatedPool) {
          console.log(`[LIVE] ✅ Pool ${poolIdNumber} updated with winner selection info.`);
        } else {
          console.warn(`[LIVE] ⚠️ Pool ${poolIdNumber} not found for WinnerSelected event.`);
        }
      } catch (error) {
        console.error(`[LIVE] ❌ Error updating pool ${poolIdNumber} for WinnerSelected event:`, error);
      }
    }
  );

  console.log("Event listeners attached.");
}

// Functions to get past events

export async function getPastPoolCreatedEvents(fromBlock: number, toBlock: number | string) {
  console.log(`[PAST] 🔍 Fetching PoolCreated events from block ${fromBlock} to ${toBlock}...`);
  try {
    const filter = contract.filters.PoolCreated();
    const logs = await contract.queryFilter(filter, fromBlock, toBlock);
    console.log(`[PAST] ✅ Found ${logs.length} PoolCreated event(s).`);

    const events = [];
    for (const log of logs) {
        if (!log.args) continue;
        const block = await log.getBlock(); // Fetch block for timestamp
        const eventTimestamp = new Date(block.timestamp * 1000);
        const eventData = {
            poolId: log.args.poolId?.toNumber(),
            tokenAddress: log.args.tokenAddress,
            tokenName: log.args.tokenName,
            requiredAmount: log.args.requiredAmount?.toString(),
            endTime: log.args.endTime ? new Date(log.args.endTime.toNumber() * 1000) : null,
            blockNumber: log.blockNumber,
            txHash: log.transactionHash,
            eventTimestamp: eventTimestamp
        };
        events.push(eventData);

        if (eventData.poolId === undefined || isNaN(eventData.poolId)) {
            console.error(`[PAST] ❌ Invalid poolId found in PoolCreated event: ${log.args.poolId}. Skipping save.`);
            continue;
        }

        const poolDoc: Partial<IPool> = {
            poolId: eventData.poolId,
            token: eventData.tokenAddress,
            tokenName: eventData.tokenName,
            requiredAmount: eventData.requiredAmount,
            endTime: eventData.endTime,
            blockNumber: eventData.blockNumber,
            txHash: eventData.txHash,
            isFinished: false, // Default values for past events
            status: "active",
            winner: null,
            prizeReward: null,
            distributedRewardAt: null,
            finishedAt: null,
            // Let mongoose handle createdAt/updatedAt, but consider setting createdAt based on eventTimestamp?
        };

        try {
            await PoolModel.findOneAndUpdate({ poolId: poolDoc.poolId }, poolDoc, { upsert: true, new: true, setDefaultsOnInsert: true });
            console.log(`[PAST] ✅ Pool saved/updated via PoolCreated event: ID ${poolDoc.poolId}`);
        } catch (error) {
            console.error(`[PAST] ❌ Error saving/updating pool ${poolDoc.poolId} from PoolCreated event:`, error);
        }
    }
    console.log(`[PAST] ✅ Processed ${logs.length} past PoolCreated event(s) for MongoDB.`);
    return events;
  } catch (err) {
    console.error("[PAST] ❌ Error fetching past PoolCreated events:", err);
    return [];
  }
}

export async function getPastDepositedEvents(fromBlock: number, toBlock: number | string) {
    console.log(`[PAST] 🔍 Fetching Deposited events from block ${fromBlock} to ${toBlock}...`);
    try {
        const filter = contract.filters.Deposited();
        const logs = await contract.queryFilter(filter, fromBlock, toBlock);
        console.log(`[PAST] ✅ Found ${logs.length} Deposited event(s).`);

        const events = [];
        for (const log of logs) {
            if (!log.args) continue;
            const eventData = {
                poolId: log.args.poolId?.toString(),
                participant: log.args.participant,
                amount: log.args.amount?.toString(),
                blockNumber: log.blockNumber,
                txHash: log.transactionHash,
                logIndex: log.logIndex // Use logIndex for potential idempotency key
            };
            events.push(eventData);

            if (!eventData.poolId || !eventData.participant || !eventData.amount) {
                console.error(`[PAST] ❌ Invalid data in Deposited event: ${JSON.stringify(eventData)}. Skipping save.`);
                continue;
            }

            const depositDoc: Partial<IUserPoolDeposit> = {
                poolId: eventData.poolId,
                participantAddress: eventData.participant,
                amount: eventData.amount,
                // Consider adding blockNumber, txHash, logIndex to the model if needed for uniqueness/debugging
            };

            try {
                // Use findOneAndUpdate with upsert based on txHash and logIndex for idempotency
                await UserPoolDeposit.findOneAndUpdate(
                    { txHash: eventData.txHash, logIndex: eventData.logIndex }, // Query condition for idempotency
                    { $setOnInsert: depositDoc }, // Only insert if not found
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );
                console.log(`[PAST] ✅ Deposit saved/updated via Deposited event: Pool ${eventData.poolId}, Tx ${eventData.txHash.substring(0,10)}...`);
            } catch (error) {
                console.error(`[PAST] ❌ Error saving/updating deposit from Deposited event (Pool ${eventData.poolId}):`, error);
            }
        }
        console.log(`[PAST] ✅ Processed ${logs.length} past Deposited event(s) for MongoDB.`);
        return events;
    } catch (err) {
        console.error("[PAST] ❌ Error fetching past Deposited events:", err);
        return [];
    }
}

export async function getPastPoolFinishedEvents(fromBlock: number, toBlock: number | string) {
    console.log(`[PAST] 🔍 Fetching PoolFinished events from block ${fromBlock} to ${toBlock}...`);
    try {
        const filter = contract.filters.PoolFinished();
        const logs = await contract.queryFilter(filter, fromBlock, toBlock);
        console.log(`[PAST] ✅ Found ${logs.length} PoolFinished event(s).`);

        const events = [];
        for (const log of logs) {
            if (!log.args) continue;
            const block = await log.getBlock();
            const eventTimestamp = new Date(block.timestamp * 1000);
            const eventData = {
                poolId: log.args.poolId?.toNumber(),
                blockNumber: log.blockNumber,
                txHash: log.transactionHash,
                eventTimestamp: eventTimestamp
            };
            events.push(eventData);

            if (eventData.poolId === undefined || isNaN(eventData.poolId)) {
                console.error(`[PAST] ❌ Invalid poolId found in PoolFinished event: ${log.args.poolId}. Skipping update.`);
                continue;
            }

            try {
                const updatedPool = await PoolModel.findOneAndUpdate(
                    { poolId: eventData.poolId },
                    {
                        $set: {
                            status: "inactive",
                            isFinished: true,
                            finishedAt: eventData.eventTimestamp,
                        },
                    },
                    { new: true } // Return updated doc (optional)
                );
                if (updatedPool) {
                    console.log(`[PAST] ✅ Pool ${eventData.poolId} status updated via PoolFinished event.`);
                } else {
                    console.warn(`[PAST] ⚠️ Pool ${eventData.poolId} not found for past PoolFinished event.`);
                }
            } catch (error) {
                console.error(`[PAST] ❌ Error updating pool ${eventData.poolId} from PoolFinished event:`, error);
            }
        }
        console.log(`[PAST] ✅ Processed ${logs.length} past PoolFinished event(s) for MongoDB.`);
        return events;
    } catch (err) {
        console.error("[PAST] ❌ Error fetching past PoolFinished events:", err);
        return [];
    }
}

export async function getPastPrizeDistributedEvents(fromBlock: number, toBlock: number | string) {
    console.log(`[PAST] 🔍 Fetching PrizeDistributed events from block ${fromBlock} to ${toBlock}...`);
    try {
        const filter = contract.filters.PrizeDistributed();
        const logs = await contract.queryFilter(filter, fromBlock, toBlock);
        console.log(`[PAST] ✅ Found ${logs.length} PrizeDistributed event(s).`);

        const events = [];
        for (const log of logs) {
            if (!log.args) continue;
            const block = await log.getBlock();
            const eventTimestamp = new Date(block.timestamp * 1000);
            const eventData = {
                poolId: log.args.poolId?.toNumber(),
                winner: log.args.winner,
                prizeAmount: log.args.prizeAmount?.toString(),
                blockNumber: log.blockNumber,
                txHash: log.transactionHash,
                eventTimestamp: eventTimestamp
            };
            events.push(eventData);

            if (eventData.poolId === undefined || isNaN(eventData.poolId) || !eventData.winner || !eventData.prizeAmount) {
                console.error(`[PAST] ❌ Invalid data in PrizeDistributed event: ${JSON.stringify(eventData)}. Skipping update.`);
                continue;
            }

            try {
                const updatedPool = await PoolModel.findOneAndUpdate(
                    { poolId: eventData.poolId },
                    {
                        $set: {
                            winner: eventData.winner,
                            prizeReward: eventData.prizeAmount,
                            distributedRewardAt: eventData.eventTimestamp,
                        },
                    },
                    { new: true }
                );
                if (updatedPool) {
                    console.log(`[PAST] ✅ Pool ${eventData.poolId} updated via PrizeDistributed event.`);
                } else {
                    console.warn(`[PAST] ⚠️ Pool ${eventData.poolId} not found for past PrizeDistributed event.`);
                }
            } catch (error) {
                console.error(`[PAST] ❌ Error updating pool ${eventData.poolId} from PrizeDistributed event:`, error);
            }
        }
        console.log(`[PAST] ✅ Processed ${logs.length} past PrizeDistributed event(s) for MongoDB.`);
        return events;
    } catch (err) {
        console.error("[PAST] ❌ Error fetching past PrizeDistributed events:", err);
        return [];
    }
}

export async function getPastWinnerSelectedEvents(fromBlock: number, toBlock: number | string) {
    console.log(`[PAST] 🔍 Fetching WinnerSelected events from block ${fromBlock} to ${toBlock}...`);
    try {
        const filter = contract.filters.WinnerSelected();
        const logs = await contract.queryFilter(filter, fromBlock, toBlock);
        console.log(`[PAST] ✅ Found ${logs.length} WinnerSelected event(s).`);

        const events = [];
        for (const log of logs) {
            if (!log.args) continue;
            // WinnerSelected might not need block timestamp if it doesn't set a time field
            const eventData = {
                poolId: log.args.poolId?.toNumber(),
                winner: log.args.winner,
                prizeAmount: log.args.prizeAmount?.toString(), // Assuming event provides this
                blockNumber: log.blockNumber,
                txHash: log.transactionHash,
            };
            events.push(eventData);

            if (eventData.poolId === undefined || isNaN(eventData.poolId) || !eventData.winner || !eventData.prizeAmount) {
                console.error(`[PAST] ❌ Invalid data in WinnerSelected event: ${JSON.stringify(eventData)}. Skipping update.`);
                continue;
            }

            try {
                const updatedPool = await PoolModel.findOneAndUpdate(
                    { poolId: eventData.poolId },
                    {
                        $set: {
                            winner: eventData.winner,
                            prizeReward: eventData.prizeAmount,
                            // No specific timestamp field for WinnerSelected in the request
                        },
                    },
                    { new: true }
                );
                if (updatedPool) {
                    console.log(`[PAST] ✅ Pool ${eventData.poolId} updated via WinnerSelected event.`);
                } else {
                    console.warn(`[PAST] ⚠️ Pool ${eventData.poolId} not found for past WinnerSelected event.`);
                }
            } catch (error) {
                console.error(`[PAST] ❌ Error updating pool ${eventData.poolId} from WinnerSelected event:`, error);
            }
        }
        console.log(`[PAST] ✅ Processed ${logs.length} past WinnerSelected event(s) for MongoDB.`);
        return events;
    } catch (err) {
        console.error("[PAST] ❌ Error fetching past WinnerSelected events:", err);
        return [];
    }
}

