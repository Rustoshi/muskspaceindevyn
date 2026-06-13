"use server";

import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Transaction from "@/models/Transaction";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function submitDeposit(formData: FormData) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized. Please log in." };
        }

        await dbConnect();

        const amount = Number(formData.get('amount'));
        const currency = formData.get('currency') as string;
        const proofUrl = formData.get('proofUrl') as string;

        if (isNaN(amount) || amount <= 0) {
            return { success: false, error: "Invalid deposit amount." };
        }

        if (!currency || !proofUrl) {
            return { success: false, error: "Missing required details or payment proof." };
        }

        const user = await User.findOne({ email: session.user.email });
        if (!user) return { success: false, error: "User account not found." };

        // Create a 'pending' deposit transaction.
        // We DO NOT adjust user.totalBalance here; the admin will do that upon approval.
        // NOTE: field names must match the Transaction schema — `paymentMethod` and
        // `paymentProof`. Previously these were saved as `currency`/`proofOfPayment`,
        // which Mongoose silently stripped, so the proof never persisted.
        await Transaction.create({
            userId: user._id,
            type: 'deposit',
            amount: amount,
            paymentMethod: currency, // The coin/network or bank the user claims to have sent
            paymentProof: proofUrl,
            status: 'pending',
            date: new Date()
        });

        revalidatePath('/dashboard/deposit');
        revalidatePath('/dashboard/transactions');
        revalidatePath('/admin/transactions');

        return { success: true };
    } catch (error: any) {
        console.error("Deposit submission error:", error);
        return { success: false, error: error.message || "An unexpected error occurred." };
    }
}
