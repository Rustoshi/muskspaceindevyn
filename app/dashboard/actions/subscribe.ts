"use server";

import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Transaction from "@/models/Transaction";
import UserPlan from "@/models/UserPlan";
import InvestmentPlan from "@/models/InvestmentPlan";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function subscribeToPlan(formData: FormData) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized. Please log in." };
        }

        await dbConnect();

        const planId = formData.get('planId') as string;
        const investedAmount = Number(formData.get('amount'));

        if (!planId || isNaN(investedAmount) || investedAmount <= 0) {
            return { success: false, error: "Invalid plan or investment amount." };
        }

        const user = await User.findOne({ email: session.user.email });
        if (!user) return { success: false, error: "User account not found." };

        const systemPlan = await InvestmentPlan.findById(planId);
        if (!systemPlan) return { success: false, error: "Investment Plan not found or no longer active." };

        if (!systemPlan.isActive) {
            return { success: false, error: "This plan is currently not accepting new subscriptions." };
        }

        // --- Prevent Duplicate Active Subscriptions for the same Plan ---
        const existingActivePlan = await UserPlan.findOne({
            userId: user._id,
            planId: systemPlan._id.toString(),
            status: 'active'
        });

        if (existingActivePlan) {
            return { success: false, error: "You already have an active subscription to this algorithmic strategy." };
        }

        if (user.totalBalance < investedAmount) {
            return { success: false, error: `Insufficient balance. You have $${user.totalBalance.toLocaleString()} available.` };
        }

        // --- Execute Financials Update ---
        user.totalBalance -= investedAmount;
        user.totalInvested += investedAmount;
        user.activePlans += 1;

        const targetReturn = `${systemPlan.returnLow}%${systemPlan.returnHigh ? '-' + systemPlan.returnHigh + '%' : ''} ${systemPlan.returnContext}`;

        // Create the user's active plan ledger
        await UserPlan.create({
            userId: user._id,
            planId: systemPlan._id.toString(),
            name: systemPlan.name,
            capital: investedAmount,
            cycle: systemPlan.cycle,
            target: targetReturn,
            status: 'active'
        });

        // Log the transaction history
        await Transaction.create({
            userId: user._id,
            type: 'investment',
            amount: investedAmount,
            status: 'approved',
            date: new Date()
        });

        await user.save();
        revalidatePath('/dashboard/subscribe');
        revalidatePath('/dashboard/plans');
        revalidatePath('/dashboard');

        return { success: true };
    } catch (error: any) {
        console.error("Subscription error:", error);
        return { success: false, error: error.message || "An unexpected error occurred." };
    }
}

// ─── withdrawFromPlan ───────────────────────────────────────────────────────────
// User liquidates an active plan position. The plan's accrued profit (currentPnL)
// was already credited to totalBalance when posted, so we only return the principal
// (capital) to the balance here — the user ends up holding the full value.
// Mirrors the admin "unsubscribe" reversal convention. The plan record is deleted.

export async function withdrawFromPlan(planId: string) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized. Please log in." };
        }

        await dbConnect();

        const user = await User.findOne({ email: session.user.email });
        if (!user) return { success: false, error: "User account not found." };

        // Scope the lookup to this user so one user can't withdraw another's plan.
        const plan = await UserPlan.findOne({ _id: planId, userId: user._id });
        if (!plan) return { success: false, error: "Plan not found." };
        if (plan.status !== "active") {
            return { success: false, error: "This plan is no longer active and cannot be withdrawn." };
        }

        const principal = plan.capital;
        const profit = plan.currentPnL || 0;
        const payout = principal + profit;

        // Realize the position: return capital + accumulated profit to the spendable
        // balance, and remove the profit from the (unrealized) totalProfit metric.
        user.totalBalance += payout;
        user.totalInvested = Math.max(0, user.totalInvested - principal);
        user.totalProfit = Math.max(0, user.totalProfit - profit);
        user.activePlans = Math.max(0, user.activePlans - 1);
        await user.save();

        // Ledger entry for the full amount returned to balance.
        await Transaction.create({
            userId: user._id,
            type: "transfer",
            amount: payout,
            status: "approved",
            paymentMethod: `${plan.name} — Investment Withdrawn`,
            date: new Date(),
        });

        await UserPlan.findByIdAndDelete(plan._id);

        revalidatePath("/dashboard/plans");
        revalidatePath("/dashboard");

        return { success: true, returned: payout };
    } catch (error: any) {
        console.error("[withdrawFromPlan] Error:", error);
        return { success: false, error: error.message || "An unexpected error occurred." };
    }
}
