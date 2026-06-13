"use server";

import dbConnect from "@/lib/mongodb";
import PaymentOption from "@/models/PaymentOption";
import BankPaymentOption from "@/models/BankPaymentOption";

export interface PaymentOptionData {
    id: string;
    network: string;
    ticker: string;
    walletAddress: string;
}

export interface BankPaymentOptionData {
    id: string;
    bankName: string;
    accountName: string;
    accountNumber: string;
    routingNumber?: string;
    iban?: string;
    swiftCode?: string;
    currency: string;
    instructions?: string;
}

export async function getPaymentOptions(): Promise<PaymentOptionData[]> {
    try {
        await dbConnect();
        const options = await PaymentOption.find({ isActive: true }).lean();

        return options.map((opt: any) => ({
            id: opt._id.toString(),
            network: opt.network,
            ticker: opt.ticker,
            walletAddress: opt.walletAddress,
        }));
    } catch (error) {
        console.error("Failed to fetch payment options:", error);
        return [];
    }
}

export async function getBankPaymentOptions(): Promise<BankPaymentOptionData[]> {
    try {
        await dbConnect();
        const options = await BankPaymentOption.find({ isActive: true }).lean();

        return options.map((opt: any) => ({
            id: opt._id.toString(),
            bankName: opt.bankName,
            accountName: opt.accountName,
            accountNumber: opt.accountNumber,
            routingNumber: opt.routingNumber,
            iban: opt.iban,
            swiftCode: opt.swiftCode,
            currency: opt.currency,
            instructions: opt.instructions,
        }));
    } catch (error) {
        console.error("Failed to fetch bank payment options:", error);
        return [];
    }
}
