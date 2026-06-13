"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowDownToLine } from "lucide-react";

interface WithdrawPositionButtonProps {
    // Bound server action — returns { success, error? }.
    action: () => Promise<{ success: boolean; error?: string }>;
    label?: string;
    confirmPrompt?: string;
    className?: string;
}

export default function WithdrawPositionButton({
    action,
    label = "Withdraw",
    confirmPrompt = "Return this investment to your balance?",
    className = "",
}: WithdrawPositionButtonProps) {
    const router = useRouter();
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const handleConfirm = () => {
        setError(null);
        startTransition(async () => {
            const res = await action();
            if (res.success) {
                setConfirming(false);
                router.refresh();
            } else {
                setError(res.error || "Withdrawal failed. Please try again.");
            }
        });
    };

    if (confirming) {
        return (
            <div className={className}>
                <p className="text-[10px] text-white/40 tracking-wide mb-2 text-center">
                    {confirmPrompt}
                </p>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={pending}
                        className="flex-1 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-[0.12em] bg-emerald-500 text-black hover:bg-emerald-400 transition-all disabled:opacity-60 flex items-center justify-center gap-1.5"
                    >
                        {pending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm"}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setConfirming(false);
                            setError(null);
                        }}
                        disabled={pending}
                        className="flex-1 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-[0.12em] border border-white/15 text-white/60 hover:text-white hover:border-white/30 transition-all disabled:opacity-60"
                    >
                        Cancel
                    </button>
                </div>
                {error && <p className="text-[10px] text-red-400 mt-2 text-center">{error}</p>}
            </div>
        );
    }

    return (
        <div className={className}>
            <button
                type="button"
                onClick={() => setConfirming(true)}
                className="w-full py-2.5 rounded-full text-[11px] font-bold uppercase tracking-[0.12em] border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition-all flex items-center justify-center gap-1.5"
            >
                <ArrowDownToLine className="w-3.5 h-3.5" />
                {label}
            </button>
            {error && <p className="text-[10px] text-red-400 mt-2 text-center">{error}</p>}
        </div>
    );
}
